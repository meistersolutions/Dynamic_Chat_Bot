// index.js
const express = require('express');
const dotenv = require('dotenv');
const { insertAppointment, updateAppointment, updateJsonData, updateAvailableSlots, getClientID, getWelcomeMessage, getMainMenu, getFromList, insertUserData, getUserData, updateUserField, getPocFromPoc, getAvailableDates, getAvailableTimes } = require('./dbController');
const { connectDB } = require('./db');
const { sendWhatsAppMessage, sendInteractiveMessage, sendRadioButtonMessage } = require('./utils');
const { isValidEmail, isValidPhoneNumber } = require('./validate');

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
connectDB();
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Server is running! Welcome to the Meister Solutions.');
});

const sessionMap = {};

app.get('/webhook', (req, res) => {
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'your_verify_token';
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('WEBHOOK_VERIFIED');
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});


//let Appointment_ID; //GLOBAL DECLARATION
app.post('/webhook', async(req, res) => {
    const body = req.body;

    // console.log(`webhook received: ${JSON.stringify(body, null, 2)}`);
    //console.log(JSON.stringify(body));
    let title = [];
    let Response_id = [];

    if (body.object) {
        const changes = body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages;
        const displayPhoneNumber = body.entry[0].changes[0].value.metadata.display_phone_number;
        const phoneNumberId = body.entry[0].changes[0].value.metadata.phone_number_id;

        process.env.PHONE_NUMBER_ID = phoneNumberId;

        if (changes && changes[0]) {
            const from = changes[0].from;
            const messageBody = changes[0].text ? changes[0].text.body : null;
            console.log(`Received message: ${messageBody} from: ${from}`);

            const messageType = changes[0].text ? changes[0].type : null;
            console.log(`Received message type: ${messageType}`);

            if (messageType === 'text') {
                // Get client ID based on the display phone number
                const clientId = await getClientID(displayPhoneNumber);

                // Check user status (new or returning)
                let userData = await getUserData(from);

                if (userData) {
                    // User exists - check for missing fields and prompt accordingly
                    if (!userData.User_Name) {
                        await updateUserField(from, 'User_Name', messageBody);
                        await sendWhatsAppMessage(from, "Thank you! Please enter your email:");
                    } else if (!userData.User_Email) {
                        // Validate the email before updating
                        if (isValidEmail(messageBody)) {
                            await updateUserField(from, 'User_Email', messageBody);
                            await sendWhatsAppMessage(from, "Thank you! Please share your location:");
                        } else {
                            // Invalid email format - prompt user to enter a valid email
                            await sendWhatsAppMessage(from, "The email you entered is invalid. Please enter a valid email address:");
                        }
                    }
                    /*  else if (!userData.User_Contact) {
                          // Validate phone number before updating
                          if (isValidPhoneNumber(messageBody)) {
                              await updateUserField(from, 'User_Contact', messageBody);
                              await sendWhatsAppMessage(from, "Thank you! Please share your location:");
                          } else {
                              // Invalid phone number format - prompt user to enter a valid phone number
                              await sendWhatsAppMessage(from, "The phone number you entered is invalid. Please enter a valid phone number:");
                          }
                      } */
                    else if (!userData.User_Location) {
                        await updateUserField(from, 'User_Location', messageBody);
                        await sendWhatsAppMessage(from, "Thank you for completing your details.");

                        // Show main menu after completing registration
                        const welcomeMessage = await getWelcomeMessage(clientId);
                        await sendWhatsAppMessage(from, `Hi ${userData.User_Name}, ${welcomeMessage}`);

                        const mainMenuItems = await getMainMenu(clientId, 0);
                        const headerMessage = mainMenuItems[0].HEADER_MESSAGE;
                        const menuNames = mainMenuItems.map(item => ({ id: item.CLIENT_ID + '~' + item.MENU_ID + '~' + item.MENU_ID, title: item.MENU_NAME }));
                        await sendInteractiveMessage(from, headerMessage, menuNames);
                    } else {
                        // Fully registered user - display main menu
                        const welcomeMessage = await getWelcomeMessage(clientId);
                        await sendWhatsAppMessage(from, `Hi ${userData.User_Name}, ${welcomeMessage}`);

                        const mainMenuItems = await getMainMenu(clientId, 0);
                        const headerMessage = mainMenuItems[0].HEADER_MESSAGE;
                        const menuNames = mainMenuItems.map(item => ({ id: item.CLIENT_ID + '~' + item.MENU_ID + '~' + item.MENU_ID, title: item.MENU_NAME }));
                        await sendInteractiveMessage(from, headerMessage, menuNames);

                        // Initialize Appointment_ID right after collecting full user data
                        console.log(`user Id: ${userData.User_ID}`);
                        const Appointment_ID = await insertAppointment(clientId, userData.User_ID);
                        sessionMap[from] = Appointment_ID;
                        console.log(`Appointment id: ${Appointment_ID}`);

                    }
                } else {
                    // New user - insert user record and ask for name
                    await insertUserData(from);
                    await sendWhatsAppMessage(from, "Welcome! Please enter your name:");
                }
            } else {
                // Extract the title from the JSON data
                message = body.entry[0].changes[0].value.messages[0];
                if (message.interactive) {
                    const interactiveType = message.interactive.type;
                    if (interactiveType === 'button_reply' && message.interactive.button_reply) {
                        title = message.interactive.button_reply.title;
                        Response_id = message.interactive.button_reply.id.split('~');
                    } else if (interactiveType === 'list_reply' && message.interactive.list_reply) {
                        title = message.interactive.list_reply.title;
                        Response_id = message.interactive.list_reply.id.split('~');
                    }
                }

                console.log(`Title: ${title} ID: ${Response_id}`);

                clientId = Response_id[0];
                menuId = Response_id[1];
                selectId = Response_id[2];

                try {
                    // Get the main menu for initial interaction
                    const mainMenuItems = await getMainMenu(clientId, menuId);

                    if (mainMenuItems.length === 0) {
                        sendWhatsAppMessage(from, "No menu options available.");
                        return;
                    } else if (mainMenuItems.length === 1 && mainMenuItems[0].ACTION) {
                        const actionMenuNames = await handleAction(mainMenuItems[0].ACTION.split('~'), clientId, mainMenuItems[0].MENU_ID, title, selectId, from)

                        // Retrieve the first menu item's HEADER_MESSAGE (assuming only one HEADER_MESSAGE for the main menu)
                        let headerMessage = mainMenuItems[0].HEADER_MESSAGE;
                        if (actionMenuNames !== null) {
                            // Extract MENU_NAME items for interactive message
                            const menuNames = actionMenuNames.map(item => ({ id: item.CLIENT_ID + '~' + item.MENU_ID + '~' + item.ITEM_ID, title: item.MENU_NAME }));
                            await sendRadioButtonMessage(from, headerMessage, menuNames);
                        } else {
                            let appointment_id = sessionMap[from];
                            // Replace the placeholder with the actual value
                            headerMessage = headerMessage.replace("[Appointment_ID]", appointment_id);
                            await sendWhatsAppMessage(from, headerMessage);
                        }
                    } else {

                        // Retrieve the first menu item's HEADER_MESSAGE (assuming only one HEADER_MESSAGE for the main menu)
                        const headerMessage = mainMenuItems[0].HEADER_MESSAGE;
                        // Extract MENU_NAME items for interactive message
                        const menuNames = mainMenuItems.map(item => ({ id: item.CLIENT_ID + '~' + item.MENU_ID + '~' + item.ITEM_ID, title: item.MENU_NAME }));
                        await sendRadioButtonMessage(from, headerMessage, menuNames);
                    }

                } catch (error) {
                    console.error("Error fetching main menu:", error);
                    sendWhatsAppMessage(from, "Sorry, an error occurred while fetching the menu.");
                }
            }
            res.sendStatus(200);
        } else {
            res.sendStatus(200);
        }
    } else {
        res.sendStatus(404);
    }
});

// This will be used to store dynamic variables
let dynamicVariables = {};
async function handleAction(iAction, iClientId, iMenuId, iUserValue, iSelectId, from) {
    const iLang = 'ENG';
    console.log(`handleAction: iAction:${iAction} ,iClientID:${iClientId} ,iMenuId:${iMenuId}, iUserValue:${iUserValue} iSelectId: ${iSelectId} appointment_id: ${sessionMap[from]}`);

    const dynamicVarName = iAction[0].split('~')[0];
    dynamicVariables[dynamicVarName] = iUserValue;

    const Appointment_ID = sessionMap[from];
    if (Appointment_ID) {
        if (dynamicVarName === 'Poc_name') {
            await updateAppointment('POC_ID', iSelectId, Appointment_ID);
        } else if (dynamicVarName !== 'Department' && dynamicVarName !== 'Confirm_Status') {
            await updateAppointment(iAction[0], iUserValue, Appointment_ID);
        }
    } else {
        console.log("Error: Appointment_ID is undefined when trying to update the appointment.");
    }

    await updateJsonData(Appointment_ID, dynamicVarName, iUserValue);

    if (iAction[1] === 'LIST') {
        return await getFromList(iClientId, iMenuId, iAction[2], iLang);
    } else if (iAction[1] === 'POC') {
        return await getPocFromPoc(iClientId, iMenuId, iUserValue);
    } else if (iAction[1] === 'FETCH_AVAILABLE_DATES_DIRECT') {
        dynamicVariables['Poc_ID'] = iSelectId;
        return await getAvailableDates(iClientId, iMenuId, iSelectId);
    } else if (iAction[1] === 'FETCH_AVAILABLE_TIMES_DIRECT') {
        return await getAvailableTimes(iClientId, iMenuId, iSelectId, iUserValue);
    } else if (iAction[1] === 'CONFIRM') {
        const appointmentDetails = {
            doctor: dynamicVariables.Poc_name,
            date: dynamicVariables.Appointment_Date,
            time: dynamicVariables.Appointment_Time
        };
        const confirmationMessage = `Your appointment details:\nDoctor: ${appointmentDetails.doctor}\nDate: ${appointmentDetails.date}\nTime: ${appointmentDetails.time}.`;

        // Send confirmation message to user
        await sendWhatsAppMessage(from, confirmationMessage);

        // Create confirmation options with unique placeholders
        const confirmationOptions = [
            { CLIENT_ID: iClientId, MENU_ID: iMenuId, ITEM_ID: 'Confirm', MENU_NAME: 'Confirm' },
            { CLIENT_ID: iClientId, MENU_ID: iMenuId, ITEM_ID: 'Cancel', MENU_NAME: 'Cancel' }
        ];

        // Return formatted list of options
        return confirmationOptions;
    } // Inside handleAction, add the following:
    else if (iAction[1] === 'FINALIZE') {
        if (iUserValue === 'Confirm') {
            await updateAppointment('Status', 'Confirmed', Appointment_ID);
            await updateAvailableSlots(dynamicVariables);
            await sendWhatsAppMessage(from, "Your appointment has been successfully confirmed. Thank you!");
        } else if (iUserValue === 'Cancel') {
            await sendWhatsAppMessage(from, "Your appointment request has been canceled. You can start over if you'd like to make a new appointment.");
        }
        return null;
    } else {
        console.log('handleAction:inside Else');
    }
}
// Start the server 
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
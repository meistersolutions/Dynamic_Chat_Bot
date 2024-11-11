// index.js
const express = require('express');
const dotenv = require('dotenv');
const { getClientID, getWelcomeMessage, getMainMenu, getFromList, getPocFromPoc, getAvailableDates, getAvailableTimes } = require('./dbController');
const { connectDB } = require('./db');
const {
    sendWhatsAppMessage,
    sendInteractiveMessage,
    sendRadioButtonMessage
} = require('./utils');

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
connectDB();
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Server is running! Welcome to the Meister Solutions.');
});

const userState = {};

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

app.post('/webhook', async(req, res) => {
    const body = req.body;

   // console.log(`webhook received: ${JSON.stringify(body, null, 2)}`);
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

            if (!userState[from]) {
                userState[from] = { step: 0, client_id: null };
            }

            if (messageBody && messageBody.toLowerCase() === 'hi') {
                // Fetch client ID based on the display phone number
                const clientId = await getClientID(displayPhoneNumber);
                userState[from].client_id = clientId;

                // Get and send the welcome message
                const welcomeMessage = await getWelcomeMessage(clientId);
                await sendWhatsAppMessage(from, welcomeMessage);

                // Get the main menu
                try {
                    // Get the main menu for initial interaction
                    const mainMenuItems = await getMainMenu(clientId, 0);

                    if (mainMenuItems.length === 0) {
                        sendWhatsAppMessage(from, "No menu options available.");
                        return;
                    }

                    // Retrieve the first menu item's HEADER_MESSAGE (assuming only one HEADER_MESSAGE for the main menu)
                    const headerMessage = mainMenuItems[0].HEADER_MESSAGE;
                    // Extract MENU_NAME items for interactive message
                    const menuNames = mainMenuItems.map(item => ({ id: item.CLIENT_ID+'-'+item.MENU_ID+'-'+item.MENU_ID, title: item.MENU_NAME }));
                    sendInteractiveMessage(from, headerMessage, menuNames);

                } catch (error) {
                    console.error("Error fetching main menu:", error);
                    sendWhatsAppMessage(from, "Sorry, an error occurred while fetching the menu.");
                }
            }
            else{
                // Extract the title from the JSON data
                message=body.entry[0].changes[0].value.messages[0];
                if (message.interactive) {
                    const interactiveType = message.interactive.type;
                    if (interactiveType === 'button_reply' && message.interactive.button_reply) {
                       title = message.interactive.button_reply.title;
                       Response_id = message.interactive.button_reply.id.split('-'); 
                    } else if (interactiveType === 'list_reply' && message.interactive.list_reply) {
                       title = message.interactive.list_reply.title;
                       Response_id = message.interactive.list_reply.id.split('-');
                    }
                }
                
                console.log(`Title: ${title} ID: ${Response_id}` );
                
                clientId = Response_id[0];
                menuId = Response_id[1];
                selectId= Response_id[2];

                try {
                    // Get the main menu for initial interaction
                    const mainMenuItems = await getMainMenu(clientId, menuId);

                    if (mainMenuItems.length === 0) {
                        sendWhatsAppMessage(from, "No menu options available.");
                        return;
                    }
                    else if (mainMenuItems.length === 1 && mainMenuItems[0].ACTION)
                    {
                        const actionMenuNames = await handleAction(mainMenuItems[0].ACTION.split(':'),clientId,mainMenuItems[0].MENU_ID,title,selectId)
                       
                        // Retrieve the first menu item's HEADER_MESSAGE (assuming only one HEADER_MESSAGE for the main menu)
                        const headerMessage = mainMenuItems[0].HEADER_MESSAGE;
                        
                        // Extract MENU_NAME items for interactive message
                        
                        const menuNames = actionMenuNames.map(item => ({ id: item.CLIENT_ID+'-'+item.MENU_ID+'-'+item.ITEM_ID, title: item.MENU_NAME }));
                        await sendRadioButtonMessage(from, headerMessage, menuNames);
                    }
                    else
                    {

                        // Retrieve the first menu item's HEADER_MESSAGE (assuming only one HEADER_MESSAGE for the main menu)
                        const headerMessage = mainMenuItems[0].HEADER_MESSAGE;
                        // Extract MENU_NAME items for interactive message
                        const menuNames = mainMenuItems.map(item => ({ id: item.CLIENT_ID+'-'+item.MENU_ID+'-'+item.ITEM_ID, title: item.MENU_NAME }));
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

async function handleAction(iAction,iClientId,iMenuId,iUserValue,iSelectId) {
    const iLang='ENG';
    console.log(`handleAction: iAction:${iAction} ,iClientID:${iClientId} ,iMenuId:${iMenuId}, iUserValue:${iUserValue} iSelectId: ${iSelectId}`);
    console.log(`handleAction: iAction[0]:${iAction[0]}`);
    // Action-based handling
    if (iAction[0] === 'LIST') {
        const oList = await getFromList(iClientId,iMenuId,iAction[1],iLang);   
        return oList;     
    }
    else if (iAction[0] === 'POC')
    {
        const oList = await getPocFromPoc(iClientId,iMenuId,iUserValue);   
        return oList;
    }
    else if(iAction[0] === 'FETCH_AVAILABLE_DATES_DIRECT')
    {
        console.log('Inside FETCH_AVAILABLE_DATES_DIRECT');
        const oList = await getAvailableDates(iClientId,iMenuId,iSelectId);   
        return oList;
        
    }
    else if(iAction[0] === 'FETCH_AVAILABLE_TIMES_DIRECT')
    {
        console.log('Inside FETCH_AVAILABLE_TIMES_DIRECT');
        const oList = await getAvailableTimes(iClientId,iMenuId,iSelectId,iUserValue);   
        return oList;
        
    }
    else
    {
        console.log('handleAction:inside Else');
    }
}

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

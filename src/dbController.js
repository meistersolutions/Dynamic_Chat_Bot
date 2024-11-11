const { getConnection } = require('./db');

function getClientID(displayPhoneNumber) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT Client_ID FROM Client WHERE Contact_Number LIKE CONCAT("+", ?)';
        const connection = getConnection();
        console.log(`displayPhoneNumber"${displayPhoneNumber}`);
        connection.execute(query, [displayPhoneNumber], (err, results) => {
            if (err) {
                console.error('error running query:', err);
                return;
            }
            const clientId = results[0].Client_ID;
            resolve(clientId);
        });
    });
}

function getWelcomeMessage(clientId) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT Value_name FROM List WHERE Client_ID =? AND Key_name = "GREETINGS"';
        const connection = getConnection();
        connection.execute(query, [clientId], (err, results) => {
            if (err) {
                console.error('error running query:', err);
                return;
            }
            const welcomeMessage = results[0].Value_name;
            resolve(welcomeMessage);
        });
    });
}

async function getMainMenu(clientId, parentMenuID) {
    return new Promise(async(resolve, reject) => {
        const query = `
        SELECT 
            Client_ID as CLIENT_ID,
            Menu_ID as MENU_ID,
            Menu_Name AS MENU_NAME, 
            Header_Message AS HEADER_MESSAGE,
            Action as ACTION
        FROM menu 
        WHERE Client_ID = ? AND Language = 'ENG' AND Parent_Menu_ID = ?
        ORDER BY Display_Order;
    `;

        const connection = getConnection();

        connection.execute(query, [clientId, parentMenuID], (err, rows) => {
            if (err) {
                console.error('error running query:', err);
                return;
            }

            resolve(rows);
        });
    });
}


function getFromList(iClientId,iMenuId,iKey,iLang) {
    return new Promise((resolve, reject) => {
        console.log(`getFromList: iClientId:${iClientId} , iMenuId:${iMenuId} ,iKey:${iKey} , iLang:${iLang}`);
        const query = `SELECT 
                            Client_ID as CLIENT_ID,
                            ? MENU_ID,
                            Item_ID as ITEM_ID,
                            Value_name as MENU_NAME 
                        FROM LIST 
                        WHERE   Client_ID= ?
                            AND Key_name = ?
                            AND Lang = ?
                        ORDER BY Display_order
                        LIMIT 10`;
        const connection = getConnection();
        connection.execute(query, [iMenuId,iClientId,iKey,iLang], (err, results) => {
            if (err) {
                console.error('error running query:', err);
                return;
            }
            console.log('Query results:', results);

            resolve(results);
        });
    });
}

function getPocFromPoc(iClientId,iMenuId,iKey) {
    return new Promise((resolve, reject) => {
        console.log(`getFromList: iClientId:${iClientId} , iMenuId:${iMenuId} ,iKey:${iKey}`);
        const query = `SELECT 
                            Client_ID as CLIENT_ID,
                            ? MENU_ID,
                            POC_ID as ITEM_ID,
                            POC_Name as MENU_NAME 
                        FROM POC 
                        WHERE   Client_ID= ?
                            AND Specialization = ?
                            LIMIT 10`;
        const connection = getConnection();
        connection.execute(query, [iMenuId,iClientId,iKey], (err, results) => {
            if (err) {
                console.error('error running query:', err);
                return;
            }
            console.log('Query results:', results);

            resolve(results);
        });
    });
}

// Function to get available dates for a doctor  
function getAvailableDates(iClientId,iMenuId,iKey) {  
    return new Promise((resolve, reject) => {  
        console.log(`getAvailableDates: iClientId:${iClientId} ,iMenuId: ${iMenuId}, iKey: ${iKey}`);
       const query = `SELECT DISTINCT
                            ? as CLIENT_ID,
                            ? MENU_ID,
                            CONCAT(POC_ID,'-',DATE_FORMAT(Schedule_Date,'%Y-%m-%d')) as ITEM_ID,
                            DATE_FORMAT(Schedule_Date,'%Y-%m-%d') as MENU_NAME 
                        FROM poc_available_slots 
                        WHERE   POC_ID= ?
                        LIMIT 10`;
       const connection = getConnection();  
   
       connection.execute(query, [iClientId,iMenuId,iKey], (err, results) => {  
         if (err) {  
            console.error('Error fetching available dates:', err.message);  
            reject(err);  
         } else {  
            // Extract available dates from the results and format them  
            //const availableDates = results.map(row => moment(row.Schedule_Date).format('YYYY-MM-DD'));  
            resolve(results); // Return available dates  
         }  
       });  
    });  
  }  

  function getAvailableTimes(iClientId,iMenuId,iKey,iValue) {  
    return new Promise((resolve, reject) => {  
        console.log(`getAvailableTimes: iClientId:${iClientId} ,iMenuId: ${iMenuId}, iKey: ${iKey}`);
       const query = `SELECT DISTINCT
                            ? as CLIENT_ID,
                            ? MENU_ID,
                            CONCAT(POC_ID,'-',DATE_FORMAT(Schedule_Date,'%Y-%m-%d'),'-',Start_Time) as ITEM_ID,
                            Start_Time as MENU_NAME 
                        FROM poc_available_slots 
                        WHERE   POC_ID= ?
                        and Schedule_Date = STR_TO_DATE(?, '%Y-%m-%d')
                        LIMIT 10`;
       const connection = getConnection();  
   
       connection.execute(query, [iClientId,iMenuId,iKey,iValue], (err, results) => {  
         if (err) {  
            console.error('Error fetching available dates:', err.message);  
            reject(err);  
         } else {  
            // Extract available dates from the results and format them  
            //const availableDates = results.map(row => moment(row.Schedule_Date).format('YYYY-MM-DD'));  
            resolve(results); // Return available dates  
         }  
       });  
    });  
  }  

  
module.exports = { getClientID, getWelcomeMessage, getMainMenu, getFromList, getPocFromPoc, getAvailableDates,getAvailableTimes };

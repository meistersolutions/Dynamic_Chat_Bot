const { getConnection } = require('./db');

function getClientID(displayPhoneNumber) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT Client_ID FROM Client WHERE Contact_Number LIKE CONCAT("+", ?)';
        const connection = getConnection();

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
        SELECT Menu_Name AS MENU_NAME, Header_Message AS HEADER_MESSAGE 
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

module.exports = { getClientID, getWelcomeMessage, getMainMenu };
const fs = require('fs');
const path = require('path');

const CREDS_FILE = path.join(__dirname, 'whatsapp-session', 'creds.json');

function run() {
  console.log('Resetting processedHistoryMessages in creds.json...');
  if (!fs.existsSync(CREDS_FILE)) {
    console.error('Credentials file not found.');
    return;
  }

  try {
    const content = fs.readFileSync(CREDS_FILE, 'utf8');
    const creds = JSON.parse(content);
    
    // Clear history messages cache
    creds.processedHistoryMessages = [];
    delete creds.lastAccountSyncTimestamp;
    
    fs.writeFileSync(CREDS_FILE, JSON.stringify(creds), 'utf8');
    console.log('Successfully reset processedHistoryMessages in creds.json!');
  } catch (err) {
    console.error('Error modifying creds.json:', err.message);
  }
}

run();

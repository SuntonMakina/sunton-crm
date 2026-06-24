const fs = require('fs');
const path = require('path');

const CONTACTS_FILE = path.join(__dirname, 'contacts.json');
const LID_MAP_FILE = path.join(__dirname, 'lid-map.json');

const targetPhones = [
  '905340681497',
  '905070471373',
  '15556503833',
  '905454483223',
  '905074127087',
  '905340377473',
  '905321201359',
  '905331271248'
];

function run() {
  const contacts = fs.existsSync(CONTACTS_FILE) ? JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf8')) : {};
  const lidMap = fs.existsSync(LID_MAP_FILE) ? JSON.parse(fs.readFileSync(LID_MAP_FILE, 'utf8')) : {};

  console.log('--- CACHE LOOKUP RESULTS ---');
  for (const phone of targetPhones) {
    const name = contacts[phone] || 'Not Found';
    
    // Find LID if mapped
    let lid = 'Not Found';
    for (const [k, v] of Object.entries(lidMap)) {
      if (v === phone) {
        lid = k;
        break;
      }
    }
    
    console.log(`Phone: ${phone} | Name: ${name} | LID: ${lid}`);
  }
}

run();

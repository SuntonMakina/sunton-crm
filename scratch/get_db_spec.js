const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

async function run() {
  try {
    const url = `${supabaseUrl}/rest/v1/`;
    const response = await fetch(url, {
      headers: {
        'apikey': supabaseKey,
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
    }
    
    const spec = await response.json();
    console.log('--- DATABASE DEFINITIONS ---');
    if (spec.definitions) {
      console.log('Available tables:', Object.keys(spec.definitions));
      
      if (spec.definitions.messages) {
        console.log('\n--- MESSAGES TABLE spec.definitions.messages.properties ---');
        console.log(JSON.stringify(spec.definitions.messages.properties, null, 2));
      } else {
        console.log('\nNo messages table found in definitions.');
      }

      if (spec.definitions.leads) {
        console.log('\n--- LEADS TABLE spec.definitions.leads.properties ---');
        console.log(JSON.stringify(spec.definitions.leads.properties, null, 2));
      }
    } else {
      console.log('No definitions field in spec.');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

run();

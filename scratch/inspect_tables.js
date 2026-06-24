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
    if (response.ok) {
      const data = await response.json();
      console.log('Available tables/paths:', Object.keys(data.paths));
    } else {
      console.log('Error fetching schema:', response.status, await response.text());
    }
  } catch (err) {
    console.error('Error running script:', err);
  }
}

run();

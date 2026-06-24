const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

async function loginAndGetToken() {
  const authUrl = `${supabaseUrl}/auth/v1/token?grant_type=password`;
  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'mert@suntonmakina.com',
      password: 'Sunton123*'
    })
  });
  if (!response.ok) {
    throw new Error(`Auth failed! status: ${response.status}`);
  }
  const data = await response.json();
  return data.access_token;
}

async function callSupabase(endpoint, token, params = '') {
  const url = `${supabaseUrl}/rest/v1/${endpoint}?${params}`;
  const response = await fetch(url, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
  }
  return response.json();
}

const partials = ['5427725312', '5337127905', '5531376143', '5435062773', '5373730860'];

async function run() {
  try {
    const token = await loginAndGetToken();
    console.log('Logged in successfully!');

    for (const p of partials) {
      console.log(`\nSearching for ${p}...`);
      const results = await callSupabase('leads', token, `phone=ilike.*${p}*`);
      console.log(`Results by phone ilike: ${results.length}`);
      results.forEach(l => {
        console.log(`  Lead ID: ${l.id} | Phone: ${l.phone} | PhoneNorm: ${l.phone_normalized} | Name: ${l.first_name} ${l.last_name} | Status: ${l.status_id}`);
      });
      
      const results2 = await callSupabase('leads', token, `phone_normalized=ilike.*${p}*`);
      console.log(`Results by phone_normalized ilike: ${results2.length}`);
      results2.forEach(l => {
        console.log(`  Lead ID: ${l.id} | Phone: ${l.phone} | PhoneNorm: ${l.phone_normalized} | Name: ${l.first_name} ${l.last_name} | Status: ${l.status_id}`);
      });
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

run();

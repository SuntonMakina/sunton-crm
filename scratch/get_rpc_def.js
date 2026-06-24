const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

async function loginAndGetToken(email) {
  const authUrl = `${supabaseUrl}/auth/v1/token?grant_type=password`;
  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: email,
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
  return response;
}

async function run() {
  try {
    const token = await loginAndGetToken('mert@suntonmakina.com');
    console.log('Logged in successfully!');

    // Let's try querying different system views or routines to get the function definition
    const endpoints = [
      'rpc/handle_webhook_incoming_message_definition', // check if a custom definition endpoint exists
    ];

    for (const ep of endpoints) {
      try {
        const res = await callSupabase(ep, token);
        console.log(`Endpoint ${ep} status: ${res.status}`);
        if (res.ok) {
          console.log(await res.json());
        }
      } catch (e) {
        console.log(`Endpoint ${ep} error: ${e.message}`);
      }
    }
  } catch (err) {
    console.error('Error running script:', err);
  }
}

run();

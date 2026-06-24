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

async function run() {
  try {
    const token = await loginAndGetToken();
    console.log('Logged in successfully!');

    // Let's try to call the postgres routine or check if we can get it via a REST call to a custom view, or try querying it.
    // If PostgREST has pg_catalog or information_schema exposed:
    const urls = [
      `${supabaseUrl}/rest/v1/pg_proc?proname=eq.handle_webhook_incoming_message`,
      `${supabaseUrl}/rest/v1/routines?routine_name=eq.handle_webhook_incoming_message`
    ];

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${token}`
          }
        });
        console.log(`URL: ${url} -> Status: ${response.status}`);
        if (response.ok) {
          const data = await response.json();
          console.log('Data:', JSON.stringify(data, null, 2));
        } else {
          console.log('Error text:', await response.text());
        }
      } catch (e) {
        console.log('Error:', e.message);
      }
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

run();

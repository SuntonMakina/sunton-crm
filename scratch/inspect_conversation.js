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

async function run() {
  try {
    const token = await loginAndGetToken();
    console.log('Logged in successfully!');

    // Get messages for conversation de6193b7-aaac-4900-affb-b01d33b3b081
    const messages = await callSupabase('messages', token, 'conversation_id=eq.de6193b7-aaac-4900-affb-b01d33b3b081&order=created_at.desc');
    console.log('--- MESSAGES ---');
    console.log(messages);

    const conversations = await callSupabase('conversations', token, 'id=eq.de6193b7-aaac-4900-affb-b01d33b3b081');
    console.log('--- CONVERSATION ---');
    console.log(conversations);

    if (conversations.length > 0) {
      const lead = await callSupabase('leads', token, `id=eq.${conversations[0].lead_id}`);
      console.log('--- LEAD ---');
      console.log(lead);
    }

  } catch (err) {
    console.error('Error running script:', err);
  }
}

run();

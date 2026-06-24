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
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

async function run() {
  try {
    const token = await loginAndGetToken('mert@suntonmakina.com');
    console.log('Logged in successfully!');

    // Fetch all leads with phone_normalized containing 905335745839 or clean numbers
    const leads = await callSupabase('leads', token, 'phone_normalized=eq.905335745839');
    console.log('Leads with this phone:', JSON.stringify(leads, null, 2));

    // Fetch all conversations for these leads
    for (const lead of leads) {
      const convs = await callSupabase('conversations', token, `lead_id=eq.${lead.id}`);
      console.log(`Convs for Lead ${lead.first_name} ${lead.last_name} (${lead.id}):`, JSON.stringify(convs, null, 2));
      for (const conv of convs) {
        const messages = await callSupabase('messages', token, `conversation_id=eq.${conv.id}`);
        console.log(`  Messages count: ${messages.length}`);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

run();

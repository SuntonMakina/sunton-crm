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

    // Get latest conversations with leads ordered by last_message_at desc
    const conversations = await callSupabase('conversations', token, 'select=id,unread_count,last_message_at,lead_id,leads(*)&channel=eq.whatsapp&order=last_message_at.desc&limit=15');
    console.log('--- LATEST CONVERSATIONS ---');
    for (const c of conversations) {
      console.log(`ConvID: ${c.id} | LastMsgAt: ${c.last_message_at} | Phone: ${c.leads?.phone_normalized} | Name: ${c.leads?.first_name} ${c.leads?.last_name} | Content: ${c.leads?.last_message_content}`);
      
      // Get messages count for this conversation
      const messages = await callSupabase('messages', token, `conversation_id=eq.${c.id}&select=id`);
      console.log(`  -> Messages count: ${messages.length}`);
    }

  } catch (err) {
    console.error('Error running script:', err);
  }
}

run();

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

const targetPhones = [
  '905427725312',
  '905337127905',
  '905531376143',
  '905435062773',
  '905373730860'
];

async function run() {
  try {
    const token = await loginAndGetToken();
    console.log('Logged in successfully!');

    for (const phone of targetPhones) {
      console.log(`\n=== CHECKING PHONE: ${phone} ===`);
      const leads = await callSupabase('leads', token, `phone_normalized=eq.${phone}`);
      console.log(`Leads found: ${leads.length}`);
      for (const lead of leads) {
        console.log(`  Lead ID: ${lead.id}`);
        console.log(`  Name: ${lead.first_name} ${lead.last_name}`);
        console.log(`  Status ID: ${lead.status_id}`);
        console.log(`  Created at: ${lead.created_at}`);
        console.log(`  Last contact at: ${lead.last_contact_at}`);
        
        const convs = await callSupabase('conversations', token, `lead_id=eq.${lead.id}`);
        console.log(`  Conversations found: ${convs.length}`);
        for (const conv of convs) {
          console.log(`    Conv ID: ${conv.id}`);
          console.log(`    Last message at: ${conv.last_message_at}`);
          console.log(`    Unread count: ${conv.unread_count}`);
          
          const messages = await callSupabase('messages', token, `conversation_id=eq.${conv.id}`);
          console.log(`    Messages found: ${messages.length}`);
          for (const msg of messages) {
            console.log(`      Msg: [${msg.sent_at || msg.created_at}] (${msg.direction}): ${msg.content}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error running script:', err);
  }
}

run();

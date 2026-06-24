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
  '905529222121',
  '905326116304',
  '905453321438'
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
        console.log(`  Lead ID: ${lead.id} | Name: ${lead.first_name} ${lead.last_name} | LastContact: ${lead.last_contact_at} | LastMsg: ${lead.last_message_content}`);
        const convs = await callSupabase('conversations', token, `lead_id=eq.${lead.id}`);
        console.log(`  Conversations: ${convs.length}`);
        for (const conv of convs) {
          console.log(`    Conv ID: ${conv.id} | LastMsgAt: ${conv.last_message_at}`);
          const messages = await callSupabase('messages', token, `conversation_id=eq.${conv.id}&order=sent_at.desc`);
          console.log(`    Messages: ${messages.length}`);
          messages.slice(0, 5).forEach(m => {
            console.log(`      [${m.sent_at}] (${m.direction}): ${m.content}`);
          });
        }
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

run();

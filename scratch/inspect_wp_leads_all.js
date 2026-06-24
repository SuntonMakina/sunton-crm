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

    const statusId = '22222222-0000-0000-0000-000000000020'; // WhatsApp Sohbeti
    const leads = await callSupabase('leads', token, `status_id=eq.${statusId}&order=created_at.desc`);
    console.log(`Total leads with status WhatsApp Sohbeti: ${leads.length}`);
    for (const lead of leads.slice(0, 20)) {
      console.log(`Lead ID: ${lead.id} | Name: ${lead.first_name} ${lead.last_name} | Phone: ${lead.phone} | Phone Normalized: ${lead.phone_normalized} | Created: ${lead.created_at} | Last Contact: ${lead.last_contact_at}`);
      const convs = await callSupabase('conversations', token, `lead_id=eq.${lead.id}`);
      for (const conv of convs) {
        console.log(`  -> Conv ID: ${conv.id} | Last message at: ${conv.last_message_at} | Unread: ${conv.unread_count}`);
        const messages = await callSupabase('messages', token, `conversation_id=eq.${conv.id}`);
        console.log(`     -> Messages: ${messages.length}`);
        if (messages.length > 0) {
          messages.slice(0, 1).forEach(m => console.log(`        Msg: [${m.sent_at}] ${m.content}`));
        }
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

run();

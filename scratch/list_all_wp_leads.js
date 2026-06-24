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

    // 1. Get all leads with status 'WhatsApp Sohbeti'
    const statusId = '22222222-0000-0000-0000-000000000020';
    const leads = await callSupabase('leads', token, `status_id=eq.${statusId}&order=created_at.desc`);
    console.log(`\n=== LEADS WITH WHATSAPP SOHBETI STATUS (${leads.length}) ===`);
    leads.forEach(l => {
      console.log(`ID: ${l.id} | Phone: ${l.phone} | PhoneNorm: ${l.phone_normalized} | Name: ${l.first_name} ${l.last_name} | Created: ${l.created_at} | LastContact: ${l.last_contact_at}`);
    });

    // 2. Get all conversations
    const convs = await callSupabase('conversations', token, `channel=eq.whatsapp&order=last_message_at.desc`);
    console.log(`\n=== CONVERSATIONS WITH CHANNEL WHATSAPP (${convs.length}) ===`);
    convs.forEach(c => {
      console.log(`ID: ${c.id} | LeadID: ${c.lead_id} | LastMsgAt: ${c.last_message_at} | Unread: ${c.unread_count}`);
    });

  } catch (err) {
    console.error('Error:', err);
  }
}

run();

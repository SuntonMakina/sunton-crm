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
    throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
  }
  return response.json();
}

async function run() {
  try {
    const token = await loginAndGetToken('mert@suntonmakina.com');
    console.log('Logged in successfully!');

    // Fetch all conversations
    const convs = await callSupabase('conversations', token, 'channel=eq.whatsapp&select=*,leads(*),messages(*)');
    console.log(`\nFound ${convs.length} WhatsApp conversations in the DB:`);
    
    convs.forEach(c => {
      const l = c.leads;
      const msgs = c.messages || [];
      console.log(`\n- ConvID: ${c.id}`);
      console.log(`  Lead: ${l ? `${l.first_name} ${l.last_name} (${l.phone})` : 'None'}`);
      console.log(`  last_message_at (Conv table): ${c.last_message_at}`);
      console.log(`  last_contact_at (Lead table): ${l ? l.last_contact_at : 'N/A'}`);
      console.log(`  last_message_content (Lead table): "${l ? l.last_message_content : ''}"`);
      console.log(`  Messages count: ${msgs.length}`);
      if (msgs.length > 0) {
        console.log(`  Latest Message in messages table:`);
        // Sort descending by sent_at
        const sortedMsgs = [...msgs].sort((a,b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
        console.log(`    - Content: "${sortedMsgs[0].content}"`);
        console.log(`    - Sent At: ${sortedMsgs[0].sent_at}`);
      }
    });

  } catch (err) {
    console.error('Error running script:', err);
  }
}

run();

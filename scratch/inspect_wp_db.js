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

    const convs = await callSupabase('conversations', token, 'select=id,unread_count,last_message_at,lead_id,leads(*)&channel=eq.whatsapp&order=last_message_at.desc');
    console.log('--- WHATSAPP CONVERSATIONS (Ordered by last_message_at DESC) ---');
    for (const c of convs) {
      const messages = await callSupabase('messages', token, `select=id,content,sent_at,direction&conversation_id=eq.${c.id}&order=sent_at.desc`);
      console.log(`Conv JID/Phone: ${c.leads?.phone_normalized} | Last msg at: ${c.last_message_at} | Messages count: ${messages.length}`);
      if (messages.length > 0) {
        console.log(`  Latest messages:`);
        messages.slice(0, 3).forEach(m => {
          console.log(`    [${m.sent_at}] (${m.direction}): ${m.content ? m.content.substring(0, 60) : 'NULL'}`);
        });
      } else {
        console.log(`  NO MESSAGES`);
      }
    }

  } catch (err) {
    console.error('Error running script:', err);
  }
}

run();

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

async function callRpc(rpcName, payload, token) {
  const url = `${supabaseUrl}/rest/v1/rpc/${rpcName}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'params=single-object'
    },
    body: JSON.stringify(payload)
  });
  
  const text = await response.text();
  return {
    status: response.status,
    body: text
  };
}

async function run() {
  try {
    const token = await loginAndGetToken('mert@suntonmakina.com');
    console.log('Logged in successfully!');

    // 1. Test handle_webhook_incoming_message RPC
    console.log('\n--- Testing handle_webhook_incoming_message ---');
    const webhookRes = await callRpc('handle_webhook_incoming_message', {
      p_from_phone: '905335745839',
      p_content: 'Test message from diagnostic script',
      p_profile_name: 'Diagnostic Test',
      p_timestamp: String(Math.floor(Date.now() / 1000))
    }, token);
    console.log('Status:', webhookRes.status);
    console.log('Response:', webhookRes.body);

    // 2. Test handle_whatsapp_history_sync RPC
    console.log('\n--- Testing handle_whatsapp_history_sync ---');
    const syncRes = await callRpc('handle_whatsapp_history_sync', {
      p_chats: [
        {
          id: '905335745839',
          name: 'Diagnostic Sync Chat'
        }
      ],
      p_messages: [
        {
          id: 'diag_' + Math.random().toString(36).substring(7),
          chatId: '905335745839',
          from: '905335745839',
          fromMe: false,
          timestamp: Math.floor(Date.now() / 1000),
          content: 'Diagnostic sync message'
        }
      ]
    }, token);
    console.log('Status:', syncRes.status);
    console.log('Response:', syncRes.body);

  } catch (err) {
    console.error('Error running diagnostic:', err);
  }
}

run();

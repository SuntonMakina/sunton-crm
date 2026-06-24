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
  return response.json();
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
  return response.json();
}

async function run() {
  try {
    const token = await loginAndGetToken('mert@suntonmakina.com');
    console.log('Logged in successfully!');

    const testPhone = '905999999999'; // Brand new test phone number

    // Call RPC
    console.log(`Triggering webhook incoming for new number: ${testPhone}`);
    const rpcRes = await callRpc('handle_webhook_incoming_message', {
      p_from_phone: testPhone,
      p_content: 'Hello, this is a test message from a new number',
      p_profile_name: 'Yeni Test Musteri',
      p_timestamp: String(Math.floor(Date.now() / 1000))
    }, token);
    
    console.log('RPC Result:', JSON.stringify(rpcRes, null, 2));

    // Retrieve created lead
    const leads = await callSupabase('leads', token, `phone_normalized=eq.${testPhone}`);
    console.log('Created Lead details:', JSON.stringify(leads, null, 2));

    // Clean up test lead and related conversation/messages so we don't pollute the db
    if (leads && leads.length > 0) {
      const leadId = leads[0].id;
      console.log(`Cleaning up test lead: ${leadId}`);
      
      const deleteUrl = `${supabaseUrl}/rest/v1/leads?id=eq.${leadId}`;
      const delRes = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('Cleanup delete status:', delRes.status);
    }

  } catch (err) {
    console.error('Error running test:', err);
  }
}

run();

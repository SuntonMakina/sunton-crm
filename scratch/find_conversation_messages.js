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

async function callSupabase(endpoint, token, params = '', method = 'GET', body = null) {
  const url = `${supabaseUrl}/rest/v1/${endpoint}?${params}`;
  const options = {
    method: method,
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP error on ${method} ${endpoint}! status: ${response.status} - ${text}`);
  }
  return response.json();
}

async function run() {
  try {
    const token = await loginAndGetToken();
    const phones = [
      '905452733802',
      '905077632022',
      '8618696636174',
      '905416003432',
      '905379527977',
      '905456807989',
      '905379528018',
      '905337127905'
    ];

    for (const phone of phones) {
      const leads = await callSupabase('leads', token, `phone_normalized=eq.${phone}`);
      if (leads.length > 0) {
        const lead = leads[0];
        const convs = await callSupabase('conversations', token, `lead_id=eq.${lead.id}&channel=eq.whatsapp`);
        if (convs.length > 0) {
          const conv = convs[0];
          const messages = await callSupabase('messages', token, `conversation_id=eq.${conv.id}`);
          console.log(`Phone: ${phone} | LeadName: ${lead.first_name} ${lead.last_name} | ConvID: ${conv.id} | Messages count: ${messages.length}`);
          if (messages.length > 0) {
            console.log(`  Newest message: ${JSON.stringify(messages[messages.length - 1], null, 2)}`);
          }
        } else {
          console.log(`Phone: ${phone} | LeadName: ${lead.first_name} ${lead.last_name} | No conversation`);
        }
      } else {
        console.log(`Phone: ${phone} | No lead found`);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

run();

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

    const leads = await callSupabase('leads', token, 'select=id,first_name,last_name,phone,phone_normalized,source_id,status_id,created_at');
    console.log('Total leads in database:', leads.length);

    const lidLeads = leads.filter(l => {
      return l.phone_normalized && (l.phone_normalized.length >= 13 && !l.phone_normalized.startsWith('90'));
    });

    console.log(`Found ${lidLeads.length} leads with suspected LID phone numbers:`);
    console.log(lidLeads.slice(0, 10).map(l => ({
      id: l.id,
      name: `${l.first_name} ${l.last_name}`,
      phone: l.phone,
      phone_normalized: l.phone_normalized,
      created_at: l.created_at
    })));

    const wpLeads = leads.filter(l => l.source_id === '11111111-0000-0000-0000-000000000005' || l.status_id === '22222222-0000-0000-0000-000000000020');
    console.log(`Found ${wpLeads.length} leads with WhatsApp source or WhatsApp status:`);
    console.log(wpLeads.slice(0, 10).map(l => ({
      id: l.id,
      name: `${l.first_name} ${l.last_name}`,
      phone: l.phone,
      phone_normalized: l.phone_normalized,
      created_at: l.created_at
    })));

  } catch (err) {
    console.error('Error running script:', err);
  }
}

run();

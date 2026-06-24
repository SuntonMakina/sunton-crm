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
    const leads = await callSupabase('leads', token, 'legacy_lead_id=in.(L-0327,L-0335,L-0336,L-0352)');
    console.log('Leads Details:');
    leads.forEach(l => {
      console.log(`Lead ${l.legacy_lead_id}:`);
      console.log(`- assigned_sales_user_id: ${l.assigned_sales_user_id}`);
      console.log(`- assigned_call_center_user_id: ${l.assigned_call_center_user_id}`);
      console.log(`- legacy_source_file: ${l.legacy_source_file}`);
      console.log(`- is_active: ${l.is_active}`);
    });
  } catch (err) {
    console.error(err);
  }
}

run();

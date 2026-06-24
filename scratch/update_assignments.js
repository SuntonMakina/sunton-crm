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

async function patchSupabase(endpoint, token, payload, params = '') {
  const url = `${supabaseUrl}/rest/v1/${endpoint}?${params}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(payload)
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

    // Ebru's profile ID
    const ebruId = 'b2b2b2b2-bbbb-cccc-dddd-eeeeeeeeeeee';
    // Test lead ID
    const testLeadId = 'c4c1832e-c272-4f96-9ae4-21a619f53cc1';

    const leadsResult = await patchSupabase('leads', token, {
      assigned_call_center_user_id: ebruId
    }, `id=eq.${testLeadId}`);
    console.log('Updated leads:', leadsResult);

    const convResult = await patchSupabase('conversations', token, {
      assigned_user_id: ebruId
    }, `lead_id=eq.${testLeadId}`);
    console.log('Updated conversations:', convResult);

  } catch (err) {
    console.error('Error running script:', err);
  }
}

run();

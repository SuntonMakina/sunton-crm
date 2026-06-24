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
      'Content-Type': 'application/json'
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function run() {
  try {
    const token = await loginAndGetToken();
    console.log('Logged in successfully!');

    // 1. Fetch the leads to get their UUIDs
    const targetIds = ['L-0352', 'L-0353', 'L-0354', 'L-0355'];
    const leads = await callSupabase('leads', token, `legacy_lead_id=in.(${targetIds.join(',')})`);
    
    if (leads.length === 0) {
      console.log('No leads found with these legacy_lead_ids.');
      return;
    }

    const uuids = leads.map(l => l.id);
    console.log(`Found ${leads.length} leads in database:`, targetIds);
    console.log('UUIDs:', uuids);

    // 2. Delete related activities
    console.log('Deleting related activities...');
    await callSupabase('activities', token, `entity_type=eq.lead&entity_id=in.(${uuids.join(',')})`, 'DELETE');

    // 3. Delete related tasks
    console.log('Deleting related tasks...');
    await callSupabase('tasks', token, `lead_id=in.(${uuids.join(',')})`, 'DELETE');

    // 4. Delete the leads themselves
    console.log('Deleting leads from database...');
    await callSupabase('leads', token, `id=in.(${uuids.join(',')})`, 'DELETE');

    console.log('Delete operations completed successfully!');

    // 5. Verify they are gone
    const check = await callSupabase('leads', token, `legacy_lead_id=in.(${targetIds.join(',')})`);
    console.log(`Verification: leads remaining in database: ${check.length}`);

  } catch (err) {
    console.error('Error during deletion:', err);
  }
}

run();

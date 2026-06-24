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
      email: 'ebru@suntonmakina.com',
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

    // Get Ebru's profile
    const profiles = await callSupabase('profiles', token);
    const ebru = profiles.find(p => p.full_name.includes('Ebru') || p.email.includes('ebru'));
    console.log('Ebru Profile:', ebru);

    // Run query similar to app/workspace/page.tsx
    // or= (assigned_call_center_user_id.eq.UUID, legacy_source_file.not.is.null, source_id.eq.11111111-0000-0000-0000-000000000005)
    // Note: since query param syntax for Postgrest or is nested, let's write it:
    const params = `is_active=eq.true&or=(assigned_call_center_user_id.eq.${ebru.id},legacy_source_file.not.is.null,source_id.eq.11111111-0000-0000-0000-000000000005)`;
    const leads = await callSupabase('leads', token, params);
    console.log('Leads fetched by page query:', leads.length);

    if (leads.length > 0) {
      console.log('First 5 leads fetched:');
      leads.slice(0, 5).forEach(l => {
        console.log(`- ID: ${l.id}, Name: ${l.first_name} ${l.last_name}, assigned_cc: ${l.assigned_call_center_user_id}, legacy_file: ${l.legacy_source_file}, source_id: ${l.source_id}`);
      });
    }

  } catch (err) {
    console.error('Error running script:', err);
  }
}

run();

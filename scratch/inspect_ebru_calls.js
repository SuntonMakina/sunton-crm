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

    // Get Ebru's profile
    const profiles = await callSupabase('profiles', token);
    const ebru = profiles.find(p => p.full_name.includes('Ebru') || p.email.includes('ebru'));
    
    // Fetch all calls made by Ebru
    const calls = await callSupabase('calls', token, `user_id=eq.${ebru.id}`);
    console.log('\nTotal calls made by Ebru:', calls.length);
    
    // Fetch all leads assigned to Ebru
    const leads = await callSupabase('leads', token, `assigned_call_center_user_id=eq.${ebru.id}`);
    console.log('Total leads assigned to Ebru:', leads.length);

    // Fetch all leads in the database that are active
    const activeLeads = await callSupabase('leads', token, 'is_active=eq.true');
    console.log('Total active leads in system:', activeLeads.length);

    // Fetch some calls and check which leads they belong to
    if (calls.length > 0) {
      console.log('Ebru\'s calls sample (first 10):');
      calls.slice(0, 10).forEach(c => {
        const lead = activeLeads.find(l => l.id === c.lead_id);
        console.log(`- Call ID: ${c.id}, Lead ID: ${c.lead_id}, Lead Name: ${lead ? lead.first_name + ' ' + lead.last_name : 'Unknown'}, Status: ${c.status}, Notes: ${c.notes}`);
      });
    }

  } catch (err) {
    console.error('Error running script:', err);
  }
}

run();

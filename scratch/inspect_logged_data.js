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
    // Log in as mert (admin) to see everything regardless of RLS restrictions if any
    const token = await loginAndGetToken('mert@suntonmakina.com');
    console.log('Logged in as mert@suntonmakina.com successfully!');

    // Get Ebru's profile ID
    const profiles = await callSupabase('profiles', token);
    const ebru = profiles.find(p => p.full_name.includes('Ebru') || p.email.includes('ebru'));
    console.log('Ebru Profile:', ebru);

    // Get lead 122ddbec-79e3-456e-b6a5-338c47d5d734
    try {
      const lead = await callSupabase('leads', token, 'id=eq.122ddbec-79e3-456e-b6a5-338c47d5d734');
      console.log('Created Lead:', JSON.stringify(lead, null, 2));
    } catch (e) {
      console.error('Failed to load lead:', e.message);
    }

    // Get conversation 6c7d88f0-ccec-45b3-8171-02c86834779d
    try {
      const conv = await callSupabase('conversations', token, 'id=eq.6c7d88f0-ccec-45b3-8171-02c86834779d');
      console.log('Created Conversation:', JSON.stringify(conv, null, 2));
    } catch (e) {
      console.error('Failed to load conversation:', e.message);
    }

    // Fetch lead sources
    const sources = await callSupabase('lead_sources', token);
    console.log('Available Lead Sources:');
    sources.forEach(s => console.log(`- ID: ${s.id}, Name: ${s.name}, Code: ${s.code}`));

    // Check leads for Ebru page query
    // In page.tsx:
    // .eq('source_id', '474b7a22-c53f-43ba-a8bd-75ce0977a798')
    // .eq('assigned_call_center_user_id', userId)
    console.log('\nChecking leads matching source_id 474b7a22-c53f-43ba-a8bd-75ce0977a798...');
    const matchLeads = await callSupabase('leads', token, 'source_id=eq.474b7a22-c53f-43ba-a8bd-75ce0977a798');
    console.log(`Total leads matching source: ${matchLeads.length}`);
    matchLeads.forEach(l => {
      console.log(`- ID: ${l.id}, Name: ${l.first_name} ${l.last_name}, Phone: ${l.phone}, Assigned: ${l.assigned_call_center_user_id}`);
    });

  } catch (err) {
    console.error('Error running script:', err);
  }
}

run();

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

    // Fetch assigned leads under Ebru's RLS
    const userId = 'b2b2b2b2-bbbb-cccc-dddd-eeeeeeeeeeee';
    const params = `is_active=eq.true&or=(assigned_call_center_user_id.eq.${userId},legacy_source_file.not.is.null,source_id.eq.11111111-0000-0000-0000-000000000005)&select=id,legacy_lead_id,legacy_source_file,is_active`;
    const leads = await callSupabase('leads', token, params);
    console.log('Total Leads fetched by Ebru:', leads.length);

    // Count by source file
    const fileGroups = {};
    leads.forEach(l => {
      const f = l.legacy_source_file || 'Non-legacy/WA';
      fileGroups[f] = (fileGroups[f] || 0) + 1;
    });
    console.log('File groups fetched by Ebru:', fileGroups);

    // Check specific ranges
    const newLeads = leads.filter(l => l.legacy_source_file === 'Sunton Makina Reklam Lead Takip - Lead Takip (2).csv');
    console.log('New CSV leads fetched by Ebru:', newLeads.length);

  } catch (err) {
    console.error('Error running check:', err);
  }
}

run();

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

    // Fetch leads where legacy_source_file = 'Sunton Makina Reklam Lead Takip - Lead Takip (2).csv'
    const leads = await callSupabase('leads', token, 'legacy_source_file=eq.Sunton%20Makina%20Reklam%20Lead%20Takip%20-%20Lead%20Takip%20(2).csv');
    console.log(`Leads from (2).csv: ${leads.length}`);

    if (leads.length > 0) {
      console.log('Sample lead structure:');
      console.log(JSON.stringify(leads[0], null, 2));

      // Count by is_active status
      const activeCount = leads.filter(l => l.is_active === true).length;
      const inactiveCount = leads.filter(l => l.is_active === false).length;
      console.log(`Active: ${activeCount}, Inactive: ${inactiveCount}`);

      // Count by assigned_call_center_user_id
      const ccAssigned = leads.map(l => l.assigned_call_center_user_id);
      const uniqueCC = [...new Set(ccAssigned)];
      console.log('Assigned Call Center Rep IDs:', uniqueCC);

      // Check query match under Ebru
      const ebruUserId = 'b2b2b2b2-bbbb-cccc-dddd-eeeeeeeeeeee';
      const waSourceId = '11111111-0000-0000-0000-000000000005';
      const visibleToEbru = leads.filter(l => 
        l.assigned_call_center_user_id === ebruUserId ||
        l.legacy_source_file !== null ||
        l.source_id === waSourceId
      );
      console.log(`Visible to Ebru based on query rule: ${visibleToEbru.length}`);
    }

  } catch (err) {
    console.error('Error running check:', err);
  }
}

run();

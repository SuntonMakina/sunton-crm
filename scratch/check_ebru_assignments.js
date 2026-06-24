const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

async function loginAndGetToken(email, password) {
  const authUrl = `${supabaseUrl}/auth/v1/token?grant_type=password`;
  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      password
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
    const adminToken = await loginAndGetToken('mert@suntonmakina.com', 'Sunton123*');
    const ebruToken = await loginAndGetToken('ebru@suntonmakina.com', 'Sunton123*');

    // Fetch all leads visible to Ebru
    const ebruLeads = await callSupabase('leads', ebruToken, 'select=id,legacy_lead_id,legacy_source_file,assigned_call_center_user_id');
    console.log(`Ebru sees ${ebruLeads.length} leads in total`);

    const nullCC = ebruLeads.filter(l => l.assigned_call_center_user_id === null);
    const ebruCC = ebruLeads.filter(l => l.assigned_call_center_user_id === 'b2b2b2b2-bbbb-cccc-dddd-eeeeeeeeeeee');
    const otherCC = ebruLeads.filter(l => l.assigned_call_center_user_id !== null && l.assigned_call_center_user_id !== 'b2b2b2b2-bbbb-cccc-dddd-eeeeeeeeeeee');

    console.log(`- Assigned to null: ${nullCC.length}`);
    console.log(`- Assigned to Ebru: ${ebruCC.length}`);
    console.log(`- Assigned to others: ${otherCC.length}`);

    // If she sees leads with null assigned, RLS must allow it.
    // Let's check the 5 missing leads and their assignments using admin token
    const missingIds = ['L-0335', 'L-0352', 'L-0353', 'L-0354', 'L-0355'];
    const adminMissingLeads = await callSupabase('leads', adminToken, `legacy_lead_id=in.(${missingIds.join(',')})`);
    console.log('\nMissing leads in DB details:');
    adminMissingLeads.forEach(l => {
      console.log(`- ID: ${l.legacy_lead_id}, assigned_cc: ${l.assigned_call_center_user_id}, assigned_sales: ${l.assigned_sales_user_id}`);
    });

  } catch (err) {
    console.error('Error running check:', err);
  }
}

run();

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
    body: JSON.stringify({ email, password })
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

    // Fetch all active leads as admin
    const adminLeads = await callSupabase('leads', adminToken, 'is_active=eq.true');
    console.log(`Admin sees ${adminLeads.length} active leads`);

    // Fetch all active leads as Ebru (using Ebru's own token and her actual workspace query parameters)
    const userId = 'b2b2b2b2-bbbb-cccc-dddd-eeeeeeeeeeee';
    const params = `is_active=eq.true&or=(assigned_call_center_user_id.eq.${userId},legacy_source_file.not.is.null,source_id.eq.11111111-0000-0000-0000-000000000005)`;
    const ebruLeads = await callSupabase('leads', ebruToken, params);
    console.log(`Ebru sees ${ebruLeads.length} active leads via workspace query`);

    // Find the missing active leads
    const ebruIds = new Set(ebruLeads.map(l => l.id));
    const missingLeads = adminLeads.filter(l => !ebruIds.has(l.id));

    console.log(`\nFound ${missingLeads.length} missing active leads for Ebru:`);
    missingLeads.forEach(l => {
      console.log(`- ID: ${l.legacy_lead_id || 'CRM-' + l.lead_number}, file: ${l.legacy_source_file}, source_id: ${l.source_id}, assigned_cc: ${l.assigned_call_center_user_id}, assigned_sales: ${l.assigned_sales_user_id}`);
    });

  } catch (err) {
    console.error(err);
  }
}

run();

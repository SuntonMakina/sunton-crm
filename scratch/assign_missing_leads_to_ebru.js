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
    const adminToken = await loginAndGetToken('mert@suntonmakina.com', 'Sunton123*');
    const ebruToken = await loginAndGetToken('ebru@suntonmakina.com', 'Sunton123*');

    const ebruUserId = 'b2b2b2b2-bbbb-cccc-dddd-eeeeeeeeeeee';

    // 1. Get the 8 missing active leads
    const adminLeads = await callSupabase('leads', adminToken, 'is_active=eq.true');
    
    const params = `is_active=eq.true&or=(assigned_call_center_user_id.eq.${ebruUserId},legacy_source_file.not.is.null,source_id.eq.11111111-0000-0000-0000-000000000005)`;
    const ebruLeadsBefore = await callSupabase('leads', ebruToken, params);

    const ebruIdsBefore = new Set(ebruLeadsBefore.map(l => l.id));
    const missingLeads = adminLeads.filter(l => !ebruIdsBefore.has(l.id));

    console.log(`Found ${missingLeads.length} missing leads. Assigning them to Ebru (id: ${ebruUserId})...`);

    for (const lead of missingLeads) {
      console.log(`Assigning lead ${lead.legacy_lead_id || lead.id}...`);
      await callSupabase('leads', adminToken, `id=eq.${lead.id}`, 'PATCH', {
        assigned_call_center_user_id: ebruUserId
      });
    }

    console.log('\nAll missing active leads assigned successfully!');

    // 2. Fetch active leads as Ebru again to verify
    const ebruLeadsAfter = await callSupabase('leads', ebruToken, params);
    console.log(`Ebru now sees ${ebruLeadsAfter.length} active leads (Before: ${ebruLeadsBefore.length})`);

  } catch (err) {
    console.error('Error:', err);
  }
}

run();

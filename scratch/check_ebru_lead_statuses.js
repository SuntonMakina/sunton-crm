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
    const token = await loginAndGetToken('ebru@suntonmakina.com', 'Sunton123*');
    
    const userId = 'b2b2b2b2-bbbb-cccc-dddd-eeeeeeeeeeee';
    const params = `is_active=eq.true&or=(assigned_call_center_user_id.eq.${userId},legacy_source_file.not.is.null,source_id.eq.11111111-0000-0000-0000-000000000005)&select=id,legacy_lead_id,legacy_source_file,status_id`;
    const leads = await callSupabase('leads', token, params);

    const newCSVLeads = leads.filter(l => l.legacy_source_file === 'Sunton Makina Reklam Lead Takip - Lead Takip (2).csv');
    console.log(`Ebru fetched ${newCSVLeads.length} leads from the new CSV`);
    
    const statusCounts = {};
    newCSVLeads.forEach(l => {
      statusCounts[l.status_id] = (statusCounts[l.status_id] || 0) + 1;
    });
    console.log('Status counts of these new leads:', statusCounts);

  } catch (err) {
    console.error(err);
  }
}

run();

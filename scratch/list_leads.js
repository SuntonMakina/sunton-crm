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

    // Get count of legacy leads (legacy_source_file IS NOT NULL)
    const legacyCount = await callSupabase('leads', token, 'legacy_source_file=not.is.null&select=id&limit=1');
    // We can't do full count easily without headers or a query, but let's query all leads
    const allLeads = await callSupabase('leads', token, 'select=id,lead_number,first_name,last_name,legacy_source_file,source_id,is_active');
    console.log('Total Leads in DB:', allLeads.length);
    
    const legacy = allLeads.filter(l => l.legacy_source_file !== null);
    const nonLegacy = allLeads.filter(l => l.legacy_source_file === null);
    const active = allLeads.filter(l => l.is_active);
    const inactive = allLeads.filter(l => !l.is_active);

    console.log('Legacy Leads count:', legacy.length);
    console.log('Non-legacy Leads count:', nonLegacy.length);
    console.log('Active Leads count:', active.length);
    console.log('Inactive Leads count:', inactive.length);

    console.log('Sample non-legacy leads:');
    console.log(nonLegacy.slice(0, 10));

  } catch (err) {
    console.error('Error running script:', err);
  }
}

run();

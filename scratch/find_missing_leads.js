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

    // Fetch all 42 imported leads using admin token
    const adminLeads = await callSupabase('leads', adminToken, 'legacy_source_file=eq.Sunton%20Makina%20Reklam%20Lead%20Takip%20-%20Lead%20Takip%20(2).csv');
    console.log(`Admin sees ${adminLeads.length} leads from (2).csv`);

    // Fetch same using Ebru token
    const ebruLeads = await callSupabase('leads', ebruToken, 'legacy_source_file=eq.Sunton%20Makina%20Reklam%20Lead%20Takip%20-%20Lead%20Takip%20(2).csv');
    console.log(`Ebru sees ${ebruLeads.length} leads from (2).csv`);

    // Find the 5 leads that are missing for Ebru
    const ebruIds = new Set(ebruLeads.map(l => l.id));
    const missingLeads = adminLeads.filter(l => !ebruIds.has(l.id));

    console.log('\nMissing leads for Ebru:');
    missingLeads.forEach(l => {
      console.log(`- ID: ${l.legacy_lead_id}, legacy_source_file: ${l.legacy_source_file}, source_id: ${l.source_id}, assigned_call_center_user_id: ${l.assigned_call_center_user_id}, is_active: ${l.is_active}`);
    });

  } catch (err) {
    console.error('Error running check:', err);
  }
}

run();

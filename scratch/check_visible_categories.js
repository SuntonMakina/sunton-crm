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

    // Fetch all 42 imported leads as admin
    const adminLeads = await callSupabase('leads', adminToken, 'legacy_source_file=eq.Sunton%20Makina%20Reklam%20Lead%20Takip%20-%20Lead%20Takip%20(2).csv');
    // Fetch same as Ebru
    const ebruLeads = await callSupabase('leads', ebruToken, 'legacy_source_file=eq.Sunton%20Makina%20Reklam%20Lead%20Takip%20-%20Lead%20Takip%20(2).csv');

    const ebruIds = new Set(ebruLeads.map(l => l.id));

    console.log('Comparison of imported leads (L-0314 to L-0355):');
    adminLeads.sort((a, b) => a.legacy_lead_id.localeCompare(b.legacy_lead_id)).forEach(l => {
      const isVisible = ebruIds.has(l.id);
      console.log(`Lead ${l.legacy_lead_id}: Visible to Ebru: ${isVisible ? 'YES' : 'NO'}, Category: ${l.lead_quality_category}, Sales Rep: ${l.sales_representative_text}, Phone: "${l.phone_normalized}"`);
    });

  } catch (err) {
    console.error(err);
  }
}

run();

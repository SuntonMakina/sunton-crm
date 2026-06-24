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
    const leads = await callSupabase('leads', token, 'legacy_source_file=not.is.null&select=legacy_lead_id,lead_number,legacy_source_file');
    console.log(`Fetched ${leads.length} legacy leads`);

    // Sort by numeric sequence of legacy_lead_id
    const parseSeq = id => {
      const m = String(id || '').match(/L-(\d+)/);
      return m ? parseInt(m[1]) : 0;
    };
    leads.sort((a,b) => parseSeq(a.legacy_lead_id) - parseSeq(b.legacy_lead_id));

    console.log('Sample sequence:');
    leads.slice(0, 10).forEach(l => {
      console.log(`- ${l.legacy_lead_id}: ${l.lead_number} (${l.legacy_source_file})`);
    });
    console.log('...');
    leads.slice(leads.length - 15).forEach(l => {
      console.log(`- ${l.legacy_lead_id}: ${l.lead_number} (${l.legacy_source_file})`);
    });

  } catch (err) {
    console.error(err);
  }
}

run();

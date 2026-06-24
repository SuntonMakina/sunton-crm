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
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
  }
  return response.json();
}

function getLeadSequence(leadId) {
  const match = String(leadId ?? '').trim().match(/^L-(\d+)$/i);
  return match ? Number(match[1]) : null;
}

async function run() {
  try {
    const token = await loginAndGetToken();
    console.log('Logged in successfully!');

    // Fetch all legacy leads from database
    const leads = await callSupabase('leads', token, 'select=id,legacy_lead_id,legacy_source_file,legacy_excel_row,phone_normalized,first_contact_date,assigned_sales_user_id,status_id&legacy_source_file=eq.Sunton%20Makina%20Reklam%20Lead%20Takip%20-%20Lead%20Takip%20(2).csv');
    console.log(`Total legacy leads in database from source file: ${leads.length}`);

    // Filter leads by sequence
    const newLeads = leads.filter(l => {
      const seq = getLeadSequence(l.legacy_lead_id);
      return seq !== null && seq > 313;
    });

    const oldLeads = leads.filter(l => {
      const seq = getLeadSequence(l.legacy_lead_id);
      return seq !== null && seq <= 313;
    });

    console.log(`New leads count (seq > 313): ${newLeads.length}`);
    console.log(`Old leads count (seq <= 313) from this file: ${oldLeads.length}`);

    // Verify ranges
    if (newLeads.length > 0) {
      const sequences = newLeads.map(l => getLeadSequence(l.legacy_lead_id)).sort((a,b)=>a-b);
      console.log(`Imported Lead ID range: L-${String(sequences[0]).padStart(4, '0')} to L-${String(sequences[sequences.length-1]).padStart(4, '0')}`);
      console.log(`Minimum numeric ID: ${sequences[0]}, Maximum numeric ID: ${sequences[sequences.length-1]}`);
    }

    // Verify no duplicates
    const uniqueKeys = new Set(newLeads.map(l => `${l.legacy_source_file}|${l.legacy_excel_row}`));
    console.log(`Unique (source_file, excel_row) count: ${uniqueKeys.size} (Expected: ${newLeads.length})`);
    if (uniqueKeys.size === newLeads.length) {
      console.log('Duplicate check passed: No duplicate rows created in database!');
    } else {
      console.error('Duplicate check failed: Duplicates exist!');
    }

    // Check sample normalization
    if (newLeads.length > 0) {
      const sample = newLeads[0];
      console.log('Sample Lead details for L-0314:');
      console.log(`- ID: ${sample.legacy_lead_id}`);
      console.log(`- Date: ${sample.first_contact_date} (Expected format YYYY-MM-DD)`);
      console.log(`- Phone Normalized: ${sample.phone_normalized} (Expected standardized number)`);
    }

  } catch (err) {
    console.error('Error running verification:', err);
  }
}

run();

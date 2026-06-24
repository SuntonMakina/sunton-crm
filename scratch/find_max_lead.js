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

async function run() {
  try {
    const token = await loginAndGetToken();
    console.log('Logged in successfully!');

    // Fetch all leads (id, lead_number)
    const leads = await callSupabase('leads', token, 'select=id,lead_number,legacy_lead_id,first_name,last_name&limit=5000');
    
    let maxSeq = 0;
    let maxLead = null;

    for (const l of leads) {
      if (l.lead_number) {
        const match = l.lead_number.match(/(\d+)$/);
        if (match) {
          const seq = parseInt(match[1], 10);
          if (seq > maxSeq) {
            maxSeq = seq;
            maxLead = l;
          }
        }
      }
      if (l.legacy_lead_id) {
        const seq = parseInt(l.legacy_lead_id, 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
          maxLead = l;
        }
      }
    }

    console.log(`Maximum lead sequence value found: ${maxSeq}`);
    if (maxLead) {
      console.log(`Lead Details: ID=${maxLead.id}, Name=${maxLead.first_name} ${maxLead.last_name}, Lead No=${maxLead.lead_number}, Legacy ID=${maxLead.legacy_lead_id}`);
    }

  } catch (err) {
    console.error('Error running script:', err);
  }
}

run();

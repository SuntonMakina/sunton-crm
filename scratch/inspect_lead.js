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
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
  }
  if (method === 'DELETE' || response.status === 204) {
    return { success: true };
  }
  return response.json();
}

async function run() {
  try {
    const token = await loginAndGetToken();
    console.log('Logged in successfully!');

    // Fetch all leads
    const leads = await callSupabase('leads', token, 'select=id,lead_number,legacy_lead_id,first_name,last_name,is_active&limit=5000');
    
    // Filter leads with sequence >= 2680
    const testLeads = leads.filter(l => {
      if (!l.lead_number) return false;
      const match = l.lead_number.match(/^LD-\d{4}-(\d+)$/);
      if (match) {
        const seq = parseInt(match[1], 10);
        return seq >= 2680;
      }
      return false;
    });

    console.log(`Found ${testLeads.length} test leads:`);
    console.log(testLeads.map(l => ({ id: l.id, lead_number: l.lead_number, name: `${l.first_name} ${l.last_name}` })));

  } catch (err) {
    console.error('Error running script:', err);
  }
}

run();

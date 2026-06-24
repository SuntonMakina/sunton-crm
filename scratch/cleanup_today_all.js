const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

const authUrl = `${supabaseUrl}/auth/v1/token?grant_type=password`;

async function loginAndGetToken() {
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
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP error on ${method} ${endpoint}! status: ${response.status} - ${text}`);
  }
  return response.json();
}

async function run() {
  try {
    const token = await loginAndGetToken();
    console.log('Logged in successfully!');

    // First fetch all leads that are scheduled for today or past
    // next_contact_at <= now() (we can select all non-null first, then filter or use lte in query)
    const nowIso = new Date().toISOString();
    console.log(`Fetching leads where next_contact_at is not null and less than or equal to ${nowIso}...`);
    
    const leads = await callSupabase(
      'leads',
      token,
      `select=id,lead_number,first_name,last_name,next_contact_at&next_contact_at=lte.${nowIso}&is_active=eq.true`
    );

    console.log(`Found ${leads.length} leads in today's calling queue.`);

    if (leads.length > 0) {
      console.log('Clearing call queues for these leads...');
      for (const lead of leads) {
        await callSupabase(
          'leads',
          token,
          `id=eq.${lead.id}`,
          'PATCH',
          {
            next_contact_at: null,
            callback_status: 'completed'
          }
        );
        console.log(`- Cleared lead: ${lead.lead_number} (${lead.first_name} ${lead.last_name})`);
      }
      console.log('All today call queues successfully cleared!');
    } else {
      console.log('No leads found in today calling queue.');
    }

  } catch (err) {
    console.error('Error during call queue cleanup:', err);
  }
}

run();

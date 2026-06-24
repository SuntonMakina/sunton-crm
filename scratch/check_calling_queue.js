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
      'Content-Type': 'application/json'
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

    // Fetch active leads that are not resolved
    console.log('Fetching leads...');
    const leads = await callSupabase(
      'leads',
      token,
      'select=id,lead_number,first_name,last_name,next_contact_at,status_id,legacy_source_file,created_at,source_id&is_active=eq.true'
    );

    console.log(`Total active leads in DB: ${leads.length}`);

    const isToday = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      const today = new Date();
      return d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear();
    };

    const bugunAranacakLeads = leads.filter(l => 
      l.status_id !== '22222222-0000-0000-0000-000000000009' && 
      l.status_id !== '22222222-0000-0000-0000-000000000012' &&
      l.status_id !== '22222222-0000-0000-0000-000000000007' &&
      (
        l.next_contact_at 
          ? (isToday(l.next_contact_at) || new Date(l.next_contact_at) < new Date())
          : (!l.legacy_source_file)
      )
    );

    console.log(`Found ${bugunAranacakLeads.length} leads in today's calling queue.`);
    
    // Group by created_at date (YYYY-MM-DD)
    const groups = {};
    const sources = {};
    const statuses = {};
    for (const l of bugunAranacakLeads) {
      const dateKey = l.created_at.split('T')[0];
      groups[dateKey] = (groups[dateKey] || 0) + 1;

      sources[l.source_id] = (sources[l.source_id] || 0) + 1;
      statuses[l.status_id] = (statuses[l.status_id] || 0) + 1;
    }

    console.log('\nCalling queue leads grouped by creation date:');
    console.log(groups);

    console.log('\nCalling queue leads grouped by source ID:');
    console.log(sources);

    console.log('\nCalling queue leads grouped by status ID:');
    console.log(statuses);

    if (bugunAranacakLeads.length > 0) {
      console.log('\nSample calling queue leads details:');
      bugunAranacakLeads.slice(0, 10).forEach(l => {
        console.log(`  * ${l.lead_number} | ${l.first_name} ${l.last_name} | Created: ${l.created_at} | Status: ${l.status_id} | Source: ${l.source_id}`);
      });
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

run();

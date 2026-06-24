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

    // 1. Fetch leads matching cleanup criteria
    console.log('Fetching leads that need cleanup...');
    const leads = await callSupabase(
      'leads',
      token,
      'select=id,first_name,last_name,phone,phone_normalized,source_id,status_id&is_active=eq.true'
    );

    const targets = leads.filter(l => {
      const isWpStatus = l.status_id === '22222222-0000-0000-0000-000000000020';
      const isWpSource = l.source_id === '11111111-0000-0000-0000-000000000005';
      const isLid = l.phone_normalized && (l.phone_normalized.startsWith('1317') || l.phone_normalized.length >= 13);
      return isWpStatus || isWpSource || isLid;
    });

    console.log(`Found ${targets.length} leads that match cleanup criteria.`);
    if (targets.length === 0) {
      console.log('No leads need cleanup.');
      return;
    }

    const targetIds = targets.map(l => l.id);

    // 2. Delete WhatsApp messages in bulk
    console.log('Deleting all WhatsApp messages...');
    await callSupabase('messages', token, 'channel=eq.whatsapp', 'DELETE');

    // 3. Delete WhatsApp conversations in bulk
    console.log('Deleting all WhatsApp conversations...');
    await callSupabase('conversations', token, 'channel=eq.whatsapp', 'DELETE');

    // Chunk target IDs (max 100 per request) to prevent URI length issues
    const chunkSize = 100;
    for (let i = 0; i < targetIds.length; i += chunkSize) {
      const chunk = targetIds.slice(i, i + chunkSize);
      const idFilter = `id=in.(${chunk.join(',')})`;
      const entityFilter = `entity_id=in.(${chunk.join(',')})`;
      const leadIdFilter = `lead_id=in.(${chunk.join(',')})`;

      console.log(`Cleaning chunk ${i / chunkSize + 1} (${chunk.length} leads)...`);

      // Delete associated activities, notifications, tasks, calls
      await callSupabase('activities', token, `entity_type=eq.lead&${entityFilter}`, 'DELETE');
      await callSupabase('notifications', token, `entity_type=eq.lead&${entityFilter}`, 'DELETE');
      await callSupabase('tasks', token, leadIdFilter, 'DELETE');
      await callSupabase('calls', token, leadIdFilter, 'DELETE');

      // Delete leads themselves
      await callSupabase('leads', token, idFilter, 'DELETE');
    }

    console.log('Bulk database cleanup completed successfully!');

  } catch (err) {
    console.error('Error during bulk cleanup:', err);
  }
}

run();

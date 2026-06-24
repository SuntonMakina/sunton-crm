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
  if (method === 'DELETE' || response.status === 204) {
    try {
      return await response.json();
    } catch (e) {
      return { success: true };
    }
  }
  return response.json();
}

async function run() {
  try {
    const token = await loginAndGetToken();
    console.log('Logged in successfully!');

    // Find all leads where legacy_source_file IS NULL (simulated/test leads)
    const nonLegacyLeads = await callSupabase('leads', token, 'legacy_source_file=is.null&select=id,first_name,last_name,lead_number');
    console.log(`Found ${nonLegacyLeads.length} non-legacy leads to delete.`);

    for (const lead of nonLegacyLeads) {
      const leadId = lead.id;
      console.log(`Deleting Lead: ${lead.first_name} ${lead.last_name} (ID: ${leadId}, No: ${lead.lead_number})`);

      // 1. Delete associated activities
      await callSupabase('activities', token, `entity_type=eq.lead&entity_id=eq.${leadId}`, 'DELETE');
      console.log(`  Deleted activities`);

      // 2. Delete associated notifications
      await callSupabase('notifications', token, `entity_type=eq.lead&entity_id=eq.${leadId}`, 'DELETE');
      console.log(`  Deleted notifications`);

      // 3. Delete associated tasks
      await callSupabase('tasks', token, `lead_id=eq.${leadId}`, 'DELETE');
      console.log(`  Deleted tasks`);

      // 4. Delete associated calls
      await callSupabase('calls', token, `lead_id=eq.${leadId}`, 'DELETE');
      console.log(`  Deleted calls`);

      // 5. Delete associated messages and conversations
      const conversations = await callSupabase('conversations', token, `lead_id=eq.${leadId}`);
      for (const conv of conversations) {
        await callSupabase('messages', token, `conversation_id=eq.${conv.id}`, 'DELETE');
        console.log(`    Deleted messages for conversation ${conv.id}`);
        await callSupabase('conversations', token, `id=eq.${conv.id}`, 'DELETE');
        console.log(`    Deleted conversation ${conv.id}`);
      }

      // 6. Finally delete the lead
      await callSupabase('leads', token, `id=eq.${leadId}`, 'DELETE');
      console.log(`  Successfully deleted lead ${leadId}`);
    }

    console.log('Finished cascade delete of all non-legacy leads.');
  } catch (err) {
    console.error('Error running script:', err);
  }
}

run();

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

    // 1. Delete messages older than 2026-05-01
    console.log('Deleting messages before May 1, 2026...');
    const deletedMsgs = await callSupabase('messages', token, 'sent_at=lt.2026-05-01T00:00:00Z', 'DELETE');
    console.log(`Successfully deleted ${deletedMsgs.length || 0} messages.`);

    // 2. Cascade delete raw WhatsApp Sohbeti chats to force clean sync
    console.log('Fetching leads that need cleanup...');
    const leads = await callSupabase(
      'leads',
      token,
      'select=id,first_name,last_name,phone,status_id&is_active=eq.true'
    );

    const targets = leads.filter(l => l.status_id === '22222222-0000-0000-0000-000000000020');
    console.log(`Found ${targets.length} raw WhatsApp Sohbeti leads in database to delete.`);

    for (const lead of targets) {
      console.log(`Deleting raw lead ${lead.first_name} (${lead.phone})...`);
      // Delete associated activities
      try { await callSupabase('activities', token, `entity_type=eq.lead&entity_id=eq.${lead.id}`, 'DELETE'); } catch(e){}
      // Delete notifications
      try { await callSupabase('notifications', token, `entity_type=eq.lead&entity_id=eq.${lead.id}`, 'DELETE'); } catch(e){}
      // Delete tasks
      try { await callSupabase('tasks', token, `lead_id=eq.${lead.id}`, 'DELETE'); } catch(e){}
      // Delete calls
      try { await callSupabase('calls', token, `lead_id=eq.${lead.id}`, 'DELETE'); } catch(e){}
      
      // Delete messages and conversations
      const convs = await callSupabase('conversations', token, `lead_id=eq.${lead.id}`);
      for (const conv of convs) {
        try { await callSupabase('messages', token, `conversation_id=eq.${conv.id}`, 'DELETE'); } catch(e){}
        try { await callSupabase('conversations', token, `id=eq.${conv.id}`, 'DELETE'); } catch(e){}
      }
      // Delete lead itself
      try { await callSupabase('leads', token, `id=eq.${lead.id}`, 'DELETE'); } catch(e){}
    }

    console.log('Database cleanup completed!');
  } catch (err) {
    console.error('Error:', err);
  }
}

run();

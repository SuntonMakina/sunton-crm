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

async function deleteLeadCascade(token, lead) {
  const leadId = lead.id;
  console.log(`Cascade deleting Lead ID: ${leadId} | Name: ${lead.first_name} ${lead.last_name} | Phone: ${lead.phone}`);

  // 1. Delete associated activities
  try {
    await callSupabase('activities', token, `entity_type=eq.lead&entity_id=eq.${leadId}`, 'DELETE');
  } catch (err) {
    console.log(`  Failed to delete activities: ${err.message}`);
  }

  // 2. Delete associated notifications
  try {
    await callSupabase('notifications', token, `entity_type=eq.lead&entity_id=eq.${leadId}`, 'DELETE');
  } catch (err) {
    console.log(`  Failed to delete notifications: ${err.message}`);
  }

  // 3. Delete associated tasks
  try {
    await callSupabase('tasks', token, `lead_id=eq.${leadId}`, 'DELETE');
  } catch (err) {
    console.log(`  Failed to delete tasks: ${err.message}`);
  }

  // 4. Delete associated calls
  try {
    await callSupabase('calls', token, `lead_id=eq.${leadId}`, 'DELETE');
  } catch (err) {
    console.log(`  Failed to delete calls: ${err.message}`);
  }

  // 5. Delete associated messages and conversations
  try {
    const conversations = await callSupabase('conversations', token, `lead_id=eq.${leadId}`);
    for (const conv of conversations) {
      await callSupabase('messages', token, `conversation_id=eq.${conv.id}`, 'DELETE');
      await callSupabase('conversations', token, `id=eq.${conv.id}`, 'DELETE');
    }
  } catch (err) {
    console.log(`  Failed to delete conversations/messages: ${err.message}`);
  }

  // 6. Delete the lead itself
  try {
    await callSupabase('leads', token, `id=eq.${leadId}`, 'DELETE');
    console.log(`  Deleted lead ${leadId} successfully.`);
  } catch (err) {
    console.log(`  Failed to delete lead: ${err.message}`);
  }
}

async function run() {
  try {
    // 1. Clear Cache Files
    const cacheFiles = [
      path.join(__dirname, 'contacts.json'),
      path.join(__dirname, 'whatsapp-session/contacts.json'),
      path.join(__dirname, 'lid-map.json'),
      path.join(__dirname, 'whatsapp-session/lid-map.json')
    ];

    console.log('Clearing local cache files...');
    for (const file of cacheFiles) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`Deleted cache file: ${file}`);
      }
    }

    // Also delete any reverse lid mappings in session folder
    const sessionDir = path.join(__dirname, 'whatsapp-session');
    if (fs.existsSync(sessionDir)) {
      const files = fs.readdirSync(sessionDir);
      for (const file of files) {
        if (file.startsWith('lid-mapping-') && file.endsWith('_reverse.json')) {
          fs.unlinkSync(path.join(sessionDir, file));
          console.log(`Deleted JID resolution cache file: ${file}`);
        }
      }
    }

    // 2. Cascade Delete 'WhatsApp Sohbeti' Leads (status_id = '22222222-0000-0000-0000-000000000020')
    const token = await loginAndGetToken();
    console.log('Logged in successfully to Supabase!');

    console.log('Fetching leads that need cleanup...');
    const leads = await callSupabase(
      'leads',
      token,
      'select=id,first_name,last_name,phone,status_id&is_active=eq.true'
    );

    const targets = leads.filter(l => l.status_id === '22222222-0000-0000-0000-000000000020');
    console.log(`Found ${targets.length} raw WhatsApp Sohbeti leads in database.`);

    if (targets.length > 0) {
      console.log('Starting cascade delete of raw chats...');
      for (const lead of targets) {
        await deleteLeadCascade(token, lead);
      }
      console.log('Database raw chats cleanup completed!');
    } else {
      console.log('No raw WhatsApp Sohbeti leads found in database.');
    }

  } catch (err) {
    console.error('Error during cleanup:', err);
  }
}

run();

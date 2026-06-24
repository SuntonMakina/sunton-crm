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
  await callSupabase('activities', token, `entity_type=eq.lead&entity_id=eq.${leadId}`, 'DELETE');

  // 2. Delete associated notifications
  await callSupabase('notifications', token, `entity_type=eq.lead&entity_id=eq.${leadId}`, 'DELETE');

  // 3. Delete associated tasks
  await callSupabase('tasks', token, `lead_id=eq.${leadId}`, 'DELETE');

  // 4. Delete associated calls
  await callSupabase('calls', token, `lead_id=eq.${leadId}`, 'DELETE');

  // 5. Delete associated messages and conversations
  const conversations = await callSupabase('conversations', token, `lead_id=eq.${leadId}`);
  for (const conv of conversations) {
    await callSupabase('messages', token, `conversation_id=eq.${conv.id}`, 'DELETE');
    await callSupabase('conversations', token, `id=eq.${conv.id}`, 'DELETE');
  }

  // 6. Delete the lead itself
  await callSupabase('leads', token, `id=eq.${leadId}`, 'DELETE');
}

async function run() {
  try {
    const token = await loginAndGetToken();
    console.log('Logged in successfully!');

    // Fetch leads to delete
    console.log('Fetching leads that need cleanup...');
    const leads = await callSupabase(
      'leads',
      token,
      'select=id,first_name,last_name,phone,phone_normalized,source_id,status_id&is_active=eq.true'
    );

    // Filter leads to delete:
    // 1. Status is '22222222-0000-0000-0000-000000000020' (WhatsApp Sohbeti)
    // 2. Source is '11111111-0000-0000-0000-000000000005' (WHATSAPP)
    // 3. Phone normalized starts with '1317' or length of phone normalized is 15 (LIDs)
    const targets = leads.filter(l => {
      const isWpStatus = l.status_id === '22222222-0000-0000-0000-000000000020';
      const isWpSource = l.source_id === '11111111-0000-0000-0000-000000000005';
      const isLid = l.phone_normalized && (l.phone_normalized.startsWith('1317') || l.phone_normalized.length === 15);
      return isWpStatus || isWpSource || isLid;
    });

    console.log(`Found ${targets.length} leads that match cleanup criteria.`);

    if (targets.length > 0) {
      console.log('Starting cascade delete...');
      for (const lead of targets) {
        await deleteLeadCascade(token, lead);
      }
      console.log('Database cleanup completed successfully!');
    } else {
      console.log('No leads found for cleanup.');
    }

  } catch (err) {
    console.error('Error during cleanup:', err);
  }
}

run();

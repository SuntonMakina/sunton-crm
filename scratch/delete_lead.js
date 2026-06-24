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

async function deleteLeadCascade(token, targetIdPattern) {
  console.log(`Checking for lead with ID pattern: ${targetIdPattern}`);
  
  // Find leads matching lead_number or legacy_lead_id
  const leadsByNumber = await callSupabase('leads', token, `lead_number=eq.${targetIdPattern}`);
  const leadsByLegacy = await callSupabase('leads', token, `legacy_lead_id=eq.${targetIdPattern}`);
  
  const allLeads = [...leadsByNumber, ...leadsByLegacy];
  // Remove duplicates
  const uniqueLeads = [];
  const seenIds = new Set();
  for (const l of allLeads) {
    if (!seenIds.has(l.id)) {
      seenIds.add(l.id);
      uniqueLeads.push(l);
    }
  }

  if (uniqueLeads.length === 0) {
    console.log(`No lead found in DB matching ${targetIdPattern}`);
    return;
  }

  for (const lead of uniqueLeads) {
    const leadId = lead.id;
    console.log(`Deleting Lead: ${lead.first_name} ${lead.last_name} (ID: ${leadId}, No: ${lead.lead_number}, Legacy: ${lead.legacy_lead_id})`);

    // 1. Delete associated activities
    const delActivities = await callSupabase('activities', token, `entity_type=eq.lead&entity_id=eq.${leadId}`, 'DELETE');
    console.log(`Deleted activities for lead ${leadId}`);

    // 2. Delete associated notifications
    const delNotifications = await callSupabase('notifications', token, `entity_type=eq.lead&entity_id=eq.${leadId}`, 'DELETE');
    console.log(`Deleted notifications for lead ${leadId}`);

    // 3. Delete associated tasks
    const delTasks = await callSupabase('tasks', token, `lead_id=eq.${leadId}`, 'DELETE');
    console.log(`Deleted tasks for lead ${leadId}`);

    // 4. Delete associated calls
    const delCalls = await callSupabase('calls', token, `lead_id=eq.${leadId}`, 'DELETE');
    console.log(`Deleted calls for lead ${leadId}`);

    // 5. Delete associated messages and conversations
    const conversations = await callSupabase('conversations', token, `lead_id=eq.${leadId}`);
    for (const conv of conversations) {
      const delMessages = await callSupabase('messages', token, `conversation_id=eq.${conv.id}`, 'DELETE');
      console.log(`  Deleted messages for conversation ${conv.id}`);
      const delConv = await callSupabase('conversations', token, `id=eq.${conv.id}`, 'DELETE');
      console.log(`  Deleted conversation ${conv.id}`);
    }

    // 6. Finally delete the lead
    const delLead = await callSupabase('leads', token, `id=eq.${leadId}`, 'DELETE');
    console.log(`Successfully deleted lead ${leadId}`);
  }
}

async function run() {
  try {
    const token = await loginAndGetToken();
    console.log('Logged in successfully!');

    // Cascade delete target lead number
    await deleteLeadCascade(token, 'LD-2026-002322');

    console.log('Deletion script finished.');
  } catch (err) {
    console.error('Error running deletion script:', err);
  }
}

run();

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

async function deleteLeadCascade(token, leadNumber) {
  console.log(`Searching for lead: ${leadNumber}`);
  const leads = await callSupabase('leads', token, `lead_number=eq.${leadNumber}`);
  
  if (leads.length === 0) {
    console.log(`No lead found with lead_number ${leadNumber}`);
    return;
  }

  const lead = leads[0];
  const leadId = lead.id;
  console.log(`Deleting Lead: ${lead.first_name} ${lead.last_name} (ID: ${leadId})`);

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

  // 6. Delete the lead itself
  await callSupabase('leads', token, `id=eq.${leadId}`, 'DELETE');
  console.log(`  Successfully deleted lead ${leadId} (${leadNumber})`);
}

async function run() {
  try {
    const token = await loginAndGetToken();
    console.log('Logged in successfully!');

    // Mock leads sequence from L-2682 to L-2692
    const targetNumbers = [
      'LD-2026-002682',
      'LD-2026-002683',
      'LD-2026-002684',
      'LD-2026-002685',
      'LD-2026-002686',
      'LD-2026-002687',
      'LD-2026-002688',
      'LD-2026-002689',
      'LD-2026-002690',
      'LD-2026-002691',
      'LD-2026-002692'
    ];

    for (const num of targetNumbers) {
      await deleteLeadCascade(token, num);
    }

    console.log('All simulated leads cleaned successfully!');
  } catch (err) {
    console.error('Error running script:', err);
  }
}

run();

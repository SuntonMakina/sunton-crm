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

    // Fetch all whatsapp conversations
    const convs = await callSupabase('conversations', token, 'channel=eq.whatsapp');
    console.log(`Found ${convs.length} whatsapp conversations.`);

    for (const conv of convs) {
      // Fetch messages for this conversation
      const messages = await callSupabase('messages', token, `conversation_id=eq.${conv.id}&order=sent_at.desc`);
      
      const leadId = conv.lead_id;
      const leads = await callSupabase('leads', token, `id=eq.${leadId}`);
      if (leads.length === 0) continue;
      const lead = leads[0];

      if (messages.length === 0) {
        console.log(`Conv ${conv.id} (Lead: ${lead.first_name} ${lead.last_name}, Phone: ${lead.phone}) has 0 messages.`);
        
        if (lead.status_id === '22222222-0000-0000-0000-000000000020') {
          // Cascade delete raw lead
          console.log(`  Cascade deleting raw lead ${leadId}...`);
          try { await callSupabase('activities', token, `entity_type=eq.lead&entity_id=eq.${leadId}`, 'DELETE'); } catch(e){}
          try { await callSupabase('notifications', token, `entity_type=eq.lead&entity_id=eq.${leadId}`, 'DELETE'); } catch(e){}
          try { await callSupabase('tasks', token, `lead_id=eq.${leadId}`, 'DELETE'); } catch(e){}
          try { await callSupabase('calls', token, `lead_id=eq.${leadId}`, 'DELETE'); } catch(e){}
          try { await callSupabase('conversations', token, `id=eq.${conv.id}`, 'DELETE'); } catch(e){}
          try { await callSupabase('leads', token, `id=eq.${leadId}`, 'DELETE'); } catch(e){}
          console.log(`  Successfully deleted raw lead.`);
        } else {
          // Registered lead: just delete the empty conversation, set last_contact_at to null
          console.log(`  Registered lead. Deleting empty conversation ${conv.id}...`);
          try { await callSupabase('conversations', token, `id=eq.${conv.id}`, 'DELETE'); } catch(e){}
          try {
            await callSupabase('leads', token, `id=eq.${leadId}`, 'PATCH', {
              last_contact_at: null,
              last_message_content: null
            });
          } catch(e){}
        }
      } else {
        // Conversation has messages: update timestamps to match the newest message
        const newestMsg = messages[0];
        console.log(`Conv ${conv.id} (Lead: ${lead.first_name} ${lead.last_name}) newest msg time: ${newestMsg.sent_at}`);
        
        try {
          await callSupabase('conversations', token, `id=eq.${conv.id}`, 'PATCH', {
            last_message_at: newestMsg.sent_at
          });
          
          await callSupabase('leads', token, `id=eq.${leadId}`, 'PATCH', {
            last_contact_at: newestMsg.sent_at,
            last_message_content: newestMsg.content
          });
          console.log(`  Updated conversation and lead timestamps successfully.`);
        } catch(err) {
          console.error(`  Error updating timestamps:`, err.message);
        }
      }
    }

    console.log('Timestamp and cleanup script finished!');
  } catch (err) {
    console.error('Error:', err);
  }
}

run();

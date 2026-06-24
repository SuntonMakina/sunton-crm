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

async function callSupabase(endpoint, token, params = '') {
  const url = `${supabaseUrl}/rest/v1/${endpoint}?${params}`;
  const response = await fetch(url, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
  }
  return response.json();
}

async function run() {
  try {
    const token = await loginAndGetToken();
    console.log('Logged in successfully!');

    // Fetch messages from June 17, 18, 19
    const messages = await callSupabase('messages', token, 'sent_at=gte.2026-06-17T00:00:00Z&sent_at=lte.2026-06-20T00:00:00Z&order=sent_at.asc');
    console.log(`\n=== MESSAGES FROM JUNE 17-19 (${messages.length} messages) ===`);
    for (const m of messages) {
      // Get conversation and lead details
      const convs = await callSupabase('conversations', token, `id=eq.${m.conversation_id}`);
      if (convs.length > 0) {
        const c = convs[0];
        const leads = await callSupabase('leads', token, `id=eq.${c.lead_id}`);
        const leadName = leads.length > 0 ? `${leads[0].first_name} ${leads[0].last_name} (${leads[0].phone_normalized})` : 'Unknown Lead';
        console.log(`[${m.sent_at}] ${leadName} | ${m.direction} | Content: ${m.content}`);
      } else {
        console.log(`[${m.sent_at}] Unknown Conversation (${m.conversation_id}) | ${m.direction} | Content: ${m.content}`);
      }
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

run();

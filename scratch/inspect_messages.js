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

    const messages = await callSupabase('messages', token, 'order=created_at.desc&limit=5');
    console.log('--- RECENT MESSAGES ---');
    console.log(messages);

    const conversations = await callSupabase('conversations', token, 'order=created_at.desc&limit=5');
    console.log('--- RECENT CONVERSATIONS ---');
    console.log(conversations);

    const leads = await callSupabase('leads', token, 'order=created_at.desc&limit=5');
    console.log('--- RECENT LEADS ---');
    console.log(leads.map(l => ({ id: l.id, name: `${l.first_name} ${l.last_name}`, phone: l.phone, source_id: l.source_id, created_at: l.created_at })));

  } catch (err) {
    console.error('Error running script:', err);
  }
}

run();

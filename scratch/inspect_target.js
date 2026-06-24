const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

async function loginAndGetToken(email) {
  const authUrl = `${supabaseUrl}/auth/v1/token?grant_type=password`;
  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: email,
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
    const token = await loginAndGetToken('mert@suntonmakina.com');
    console.log('Logged in as mert@suntonmakina.com successfully!');

    // Get Ebru's profile ID
    const profiles = await callSupabase('profiles', token);
    const ebru = profiles.find(p => p.full_name.includes('Ebru') || p.email.includes('ebru'));
    console.log('Ebru Profile:', ebru);

    // Get lead 122ddbec-79e3-456e-b6a5-338c47d5d734
    try {
      const lead = await callSupabase('leads', token, 'id=eq.122ddbec-79e3-456e-b6a5-338c47d5d734');
      console.log('Created Lead:', JSON.stringify(lead, null, 2));
    } catch (e) {
      console.error('Failed to load lead:', e.message);
    }

    // Get conversation 6c7d88f0-ccec-45b3-8171-02c86834779d
    try {
      const conv = await callSupabase('conversations', token, 'id=eq.6c7d88f0-ccec-45b3-8171-02c86834779d');
      console.log('Created Conversation:', JSON.stringify(conv, null, 2));
    } catch (e) {
      console.error('Failed to load conversation:', e.message);
    }

    // Get messages for the conversation
    try {
      const messages = await callSupabase('messages', token, 'conversation_id=eq.6c7d88f0-ccec-45b3-8171-02c86834779d');
      console.log('Messages for this conversation:', JSON.stringify(messages, null, 2));
    } catch (e) {
      console.error('Failed to load messages:', e.message);
    }

  } catch (err) {
    console.error('Error running script:', err);
  }
}

run();

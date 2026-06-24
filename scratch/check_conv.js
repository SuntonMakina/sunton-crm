const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

async function checkConv() {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/conversations?id=eq.6c7d88f0-ccec-45b3-8171-02c86834779d&select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    const data = await response.json();
    console.log('Conversation details:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}

checkConv();

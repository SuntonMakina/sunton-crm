const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
  }
});

async function run() {
  const authUrl = `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`;
  const authResponse = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'apikey': env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'mert@suntonmakina.com',
      password: 'Sunton123*'
    })
  });
  const authData = await authResponse.json();
  const token = authData.access_token;

  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`;
  const response = await fetch(url, {
    headers: {
      'apikey': env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`
    }
  });
  if (response.ok) {
    const doc = await response.json();
    console.log('Available tables/paths:', Object.keys(doc.definitions || {}));
  } else {
    console.log('Failed REST query:', response.status, await response.text());
  }
}

run();

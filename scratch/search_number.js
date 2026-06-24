const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

const authUrl = `${supabaseUrl}/auth/v1/token?grant_type=password`;

async function run() {
  try {
    const authRes = await fetch(authUrl, {
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
    
    const authData = await authRes.json();
    const token = authData.access_token;
    console.log('Logged in successfully!');

    // 1. Search in leads
    console.log('Searching in leads table...');
    const searchPhones = ['+905061122350', '905061122350', '5061122350', '+90 506 112 23 50', '05061122350'];
    for (const phone of searchPhones) {
      const url = `${supabaseUrl}/rest/v1/leads?phone=eq.${encodeURIComponent(phone)}`;
      const res = await fetch(url, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          console.log(`Found lead matching phone "${phone}":`, data);
        }
      }
      
      const urlNorm = `${supabaseUrl}/rest/v1/leads?phone_normalized=eq.${encodeURIComponent(phone)}`;
      const resNorm = await fetch(urlNorm, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${token}`
        }
      });
      if (resNorm.ok) {
        const data = await resNorm.json();
        if (data.length > 0) {
          console.log(`Found lead matching phone_normalized "${phone}":`, data);
        }
      }
    }

    // 2. Search in profiles
    console.log('Searching in profiles table...');
    for (const phone of searchPhones) {
      const url = `${supabaseUrl}/rest/v1/profiles?phone=eq.${encodeURIComponent(phone)}`;
      const res = await fetch(url, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          console.log(`Found profile matching phone "${phone}":`, data);
        }
      }
    }
  } catch (err) {
    console.error('Search script error:', err);
  }
}

run();

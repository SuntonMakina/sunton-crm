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

    // Fetch top 50 WhatsApp leads
    const url = `${supabaseUrl}/rest/v1/leads?select=id,first_name,last_name,phone,phone_normalized,source_id,status_id,created_at&source_id=in.("11111111-0000-0000-0000-000000000005","474b7a22-c53f-43ba-a8bd-75ce0977a798")&order=created_at.desc&limit=50`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${token}`
      }
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`Successfully fetched ${data.length} leads:`);
      data.forEach(l => {
        console.log(`- ID: ${l.id} | Name: ${l.first_name} ${l.last_name} | Phone: ${l.phone} | Norm: ${l.phone_normalized} | Status: ${l.status_id} | Created: ${l.created_at}`);
      });
    } else {
      console.error('Error fetching leads:', res.status, await res.text());
    }
  } catch (err) {
    console.error('Inspect script error:', err);
  }
}

run();

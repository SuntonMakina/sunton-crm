const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

async function loginAndGetToken(email, password) {
  const authUrl = `${supabaseUrl}/auth/v1/token?grant_type=password`;
  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
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
      'Content-Type': 'application/json'
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function run() {
  try {
    const adminToken = await loginAndGetToken('mert@suntonmakina.com', 'Sunton123*');
    const ebruToken = await loginAndGetToken('ebru@suntonmakina.com', 'Sunton123*');

    console.log('--- TEST 1: Check L-0335 (has assigned_sales_user_id) ---');
    // Check if Ebru can see it
    let res = await callSupabase('leads', ebruToken, 'legacy_lead_id=eq.L-0335');
    console.log('Initially Ebru sees L-0335:', res.length);

    // Temp clear assigned_sales_user_id using admin token
    console.log('Temporarily clearing assigned_sales_user_id on L-0335...');
    await callSupabase('leads', adminToken, 'legacy_lead_id=eq.L-0335', 'PATCH', {
      assigned_sales_user_id: null
    });

    // Check if Ebru can see it now
    res = await callSupabase('leads', ebruToken, 'legacy_lead_id=eq.L-0335');
    console.log('After clearing sales user, Ebru sees L-0335:', res.length);

    // Restore assigned_sales_user_id
    console.log('Restoring assigned_sales_user_id on L-0335...');
    await callSupabase('leads', adminToken, 'legacy_lead_id=eq.L-0335', 'PATCH', {
      assigned_sales_user_id: '99999999-0000-0000-0000-000000000001'
    });


    console.log('\n--- TEST 2: Check L-0352 (has empty phone) ---');
    // Check if Ebru can see it
    res = await callSupabase('leads', ebruToken, 'legacy_lead_id=eq.L-0352');
    console.log('Initially Ebru sees L-0352:', res.length);

    // Temp update phone using admin token
    console.log('Temporarily setting phone on L-0352...');
    await callSupabase('leads', adminToken, 'legacy_lead_id=eq.L-0352', 'PATCH', {
      phone: '90 555 555 55 55',
      phone_normalized: '905555555555'
    });

    // Check if Ebru can see it now
    res = await callSupabase('leads', ebruToken, 'legacy_lead_id=eq.L-0352');
    console.log('After setting phone, Ebru sees L-0352:', res.length);

    // Restore empty phone
    console.log('Restoring empty phone on L-0352...');
    await callSupabase('leads', adminToken, 'legacy_lead_id=eq.L-0352', 'PATCH', {
      phone: '',
      phone_normalized: ''
    });

  } catch (err) {
    console.error('Error during test:', err);
  }
}

run();

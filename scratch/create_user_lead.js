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

async function callSupabase(endpoint, token, method, payload, params = '') {
  const url = `${supabaseUrl}/rest/v1/${endpoint}?${params}`;
  const response = await fetch(url, {
    method: method,
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: payload ? JSON.stringify(payload) : undefined
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

    const ebruId = 'b2b2b2b2-bbbb-cccc-dddd-eeeeeeeeeeee';
    const userPhone = '+905070471373';
    const cleanPhone = '905070471373';

    // Check if lead already exists
    const existingLeads = await callSupabase('leads', token, 'GET', null, `phone=eq.${userPhone}`);
    let lead;

    if (existingLeads && existingLeads.length > 0) {
      lead = existingLeads[0];
      console.log('Lead already exists:', lead.id);
      // Ensure it is assigned to Ebru
      await callSupabase('leads', token, 'PATCH', {
        assigned_call_center_user_id: ebruId
      }, `id=eq.${lead.id}`);
    } else {
      // Create new lead
      const leads = await callSupabase('leads', token, 'POST', {
        first_name: 'Berkhan',
        last_name: 'Test',
        phone: userPhone,
        phone_normalized: cleanPhone,
        source_id: '474b7a22-c53f-43ba-a8bd-75ce0977a798', // Meta WhatsApp Reklamı
        status_id: '22222222-0000-0000-0000-000000000001', // Yeni Lead
        assigned_call_center_user_id: ebruId,
        whatsapp_step: 'viewed'
      });
      lead = leads[0];
      console.log('Created lead:', lead.id);
    }

    // Check if conversation exists
    const existingConvs = await callSupabase('conversations', token, 'GET', null, `lead_id=eq.${lead.id}&channel=eq.whatsapp`);
    let conv;

    if (existingConvs && existingConvs.length > 0) {
      conv = existingConvs[0];
      console.log('Conversation already exists:', conv.id);
      await callSupabase('conversations', token, 'PATCH', {
        assigned_user_id: ebruId
      }, `id=eq.${conv.id}`);
    } else {
      // Create new conversation
      const convs = await callSupabase('conversations', token, 'POST', {
        lead_id: lead.id,
        channel: 'whatsapp',
        assigned_user_id: ebruId,
        status: 'open',
        unread_count: 0
      });
      conv = convs[0];
      console.log('Created conversation:', conv.id);
    }

  } catch (err) {
    console.error('Error running script:', err);
  }
}

run();

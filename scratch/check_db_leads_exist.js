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

const targetPhones = [
  '905340681497',
  '905070471373',
  '15556503833',
  '905454483223',
  '905074127087',
  '905340377473',
  '905321201359',
  '905331271248'
];

async function run() {
  try {
    const token = await loginAndGetToken();
    console.log('Logged in successfully!');

    // 1. Fetch all leads
    const leads = await callSupabase('leads', token, 'select=id,legacy_source_file,status_id,source_id,assigned_call_center_user_id,last_contact_at,conversation_completed,next_contact_at,callback_status');
    console.log('Total leads in database:', leads.length);

    // 2. Count legacy leads
    const legacyLeads = leads.filter(l => l.legacy_source_file !== null);
    console.log('Legacy leads:', legacyLeads.length);

    // 3. Count raw WhatsApp chats
    const rawWhatsAppChats = leads.filter(l => l.status_id === '22222222-0000-0000-0000-000000000020');
    console.log('Raw WhatsApp chats (status_id = 22222222-0000-0000-0000-000000000020):', rawWhatsAppChats.length);

    // 4. Count leads visible to Ebru (Call Center Rep query: assigned_call_center_user_id = Ebru ID OR legacy_source_file is not null OR source_id = WhatsApp Source)
    const ebruUserId = 'b2b2b2b2-bbbb-cccc-dddd-eeeeeeeeeeee';
    const waSourceId = '11111111-0000-0000-0000-000000000005';
    
    const ebruLeads = leads.filter(l => 
      l.assigned_call_center_user_id === ebruUserId ||
      l.legacy_source_file !== null ||
      l.source_id === waSourceId
    );
    console.log('Total leads matching Ebru\'s workspace query:', ebruLeads.length);

    // 5. Count of ebruLeads excluding raw WhatsApp chats (which is what TOPLAM ULAŞAN shows)
    const ebruToplamUlasan = ebruLeads.filter(l => l.status_id !== '22222222-0000-0000-0000-000000000020');
    console.log('Ebru\'s TOPLAM ULAŞAN (excluding raw WhatsApp chats):', ebruToplamUlasan.length);

    // 6. Count of ebruLeads for TOPLAM YAPILMIŞ ARAMALAR
    const ebruToplamYapilan = ebruLeads.filter(l => {
      const isWhatsApp = (
        l.source_id === '474b7a22-c53f-43ba-a8bd-75ce0977a798' || 
        l.source_id === '11111111-0000-0000-0000-000000000005' ||
        l.status_id === '22222222-0000-0000-0000-000000000020'
      ) && l.legacy_source_file === null;
      if (isWhatsApp) {
        return l.next_contact_at !== null || l.callback_status === 'pending';
      }
      return l.last_contact_at !== null || (l.legacy_source_file !== null && l.conversation_completed !== null);
    });
    console.log('Ebru\'s TOPLAM YAPILMIŞ ARAMALAR:', ebruToplamYapilan.length);

  } catch (err) {
    console.error('Error running script:', err);
  }
}

run();

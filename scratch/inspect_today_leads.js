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
  return response.json();
}

const isToday = (dateStr) => {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const today = new Date()
  return d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
}

const isPast = (dateStr) => {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  return d < now && !isToday(dateStr)
}

async function run() {
  try {
    const token = await loginAndGetToken();
    console.log('Logged in successfully!');

    // Let's find Ebru's profile first
    const profiles = await callSupabase('profiles', token, 'full_name=ilike.*Ebru*');
    if (profiles.length === 0) {
      console.log('Ebru profile not found!');
      return;
    }
    const ebru = profiles[0];
    const userId = ebru.id;
    console.log(`Ebru User ID: ${userId}, Name: ${ebru.full_name}`);

    // Fetch leads assigned to Ebru
    const queryParams = `or=(assigned_call_center_user_id.eq.${userId},legacy_source_file.not.is.null,source_id.eq.11111111-0000-0000-0000-000000000005)&is_active=eq.true`;
    const leads = await callSupabase('leads', token, queryParams);
    console.log(`Fetched ${leads.length} active leads assigned/visible to Ebru.`);

    const isWhatsAppLead = (l) => {
      const isWaAd = (l.source_id === '474b7a22-c53f-43ba-a8bd-75ce0977a798' || l.source_code === 'META_WA') && l.legacy_source_file === null;
      if (isWaAd) {
        if (l.next_contact_at && (isToday(l.next_contact_at) || isPast(l.next_contact_at))) {
          return false;
        }
        return true;
      }
      return false;
    }

    // Filter bugunAranacakLeads
    const bugunAranacakLeads = leads.filter(l => 
      !isWhatsAppLead(l) && (
        l.callback_status === 'pending' || (
          l.status_id !== '22222222-0000-0000-0000-000000000009' && 
          l.status_id !== '22222222-0000-0000-0000-000000000012' &&
          (
            l.legacy_source_file 
              ? (l.next_contact_at && (isToday(l.next_contact_at) || isPast(l.next_contact_at)))
              : (!l.next_contact_at || isToday(l.next_contact_at) || isPast(l.next_contact_at))
          )
        )
      )
    );

    console.log('\n--- Bugün Aranacaklar Leads ---');
    console.log(bugunAranacakLeads.map(l => ({
      id: l.id,
      lead_number: l.lead_number,
      name: `${l.first_name} ${l.last_name}`,
      status_id: l.status_id,
      callback_status: l.callback_status,
      next_contact_at: l.next_contact_at,
      legacy_source_file: l.legacy_source_file
    })));

    // Fetch calls logged today by Ebru
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const callsToday = await callSupabase('calls', token, `user_id=eq.${userId}&created_at=gte.${todayStart.toISOString()}`);
    console.log(`\n--- Ebru Calls Logged Today (${callsToday.length}) ---`, callsToday);

    // Fetch messages sent today by Ebru
    const messagesToday = await callSupabase('messages', token, `sender_user_id=eq.${userId}&channel=eq.whatsapp&created_at=gte.${todayStart.toISOString()}`);
    console.log(`\n--- Ebru Messages Sent Today (${messagesToday.length}) ---`, messagesToday);

    const leadIdsCalledToday = new Set(callsToday.map(c => c.lead_id));
    // Resolve conversation lead_ids for messages
    const messagedTodayLeadIds = new Set();
    for (const msg of messagesToday) {
      if (msg.conversation_id) {
        const conversations = await callSupabase('conversations', token, `id=eq.${msg.conversation_id}`);
        if (conversations.length > 0) {
          messagedTodayLeadIds.add(conversations[0].lead_id);
        }
      }
    }

    const bugunYapilanLeads = leads.filter(l => 
      leadIdsCalledToday.has(l.id) || messagedTodayLeadIds.has(l.id)
    );

    console.log('\n--- Bugün Yapılan Aramalar Leads ---');
    console.log(bugunYapilanLeads.map(l => ({
      id: l.id,
      lead_number: l.lead_number,
      name: `${l.first_name} ${l.last_name}`,
      status_id: l.status_id,
      callback_status: l.callback_status,
      next_contact_at: l.next_contact_at
    })));

  } catch (err) {
    console.error('Error running script:', err);
  }
}

run();

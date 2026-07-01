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
      email: 'ebru@suntonmakina.com',
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

const isWhatsAppLead = (l) => {
  return (
    l.source_id === '474b7a22-c53f-43ba-a8bd-75ce0977a798' || 
    l.source_id === '11111111-0000-0000-0000-000000000005' ||
    l.status_id === '22222222-0000-0000-0000-000000000020' ||
    l.lead_sources?.code === 'META_WA'
  ) && l.legacy_source_file === null;
}

const isToday = (dateStr) => {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  return d.getDate() === now.getDate() &&
         d.getMonth() === now.getMonth() &&
         d.getFullYear() === now.getFullYear()
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

    // Fetch assigned leads
    const userId = 'b2b2b2b2-bbbb-cccc-dddd-eeeeeeeeeeee';
    const params = `is_active=eq.true&or=(assigned_call_center_user_id.eq.${userId},legacy_source_file.not.is.null,source_id.eq.11111111-0000-0000-0000-000000000005)&select=*,lead_statuses(name,color),lead_sources(name,code),calls(id,status,created_at)`;
    const leads = await callSupabase('leads', token, params);
    console.log('Total Leads fetched:', leads.length);

    // Filter leads like sorting
    const sortedLeads = [...leads];

    // todayStart for calls
    const todayStart = new Date()
    todayStart.setHours(0,0,0,0)

    // Fetch calls logged today by user
    const callsToday = await callSupabase('calls', token, `user_id=eq.${userId}&created_at=gte.${todayStart.toISOString()}`);
    console.log('Calls logged today:', callsToday.length);

    // Fetch WhatsApp messages sent today by user
    const userMessages = await callSupabase('messages', token, `sender_user_id=eq.${userId}&channel=eq.whatsapp&created_at=gte.${todayStart.toISOString()}&select=conversation:conversations(lead_id)`);
    console.log('Messages sent today:', userMessages.length);
    const messagedTodayLeads = new Set(
      userMessages
        .map((m) => m.conversation?.lead_id)
        .filter(Boolean)
    );

    // Calculate lists
    const bugunAranacakLeads = sortedLeads.filter(l => 
      !isWhatsAppLead(l) && 
      l.status_id !== '22222222-0000-0000-0000-000000000009' && 
      l.status_id !== '22222222-0000-0000-0000-000000000012' &&
      l.status_id !== '22222222-0000-0000-0000-000000000007' &&
      (
        l.next_contact_at 
          ? (isToday(l.next_contact_at) || isPast(l.next_contact_at))
          : (!l.legacy_source_file)
      )
    )

    const leadIdsCalledToday = new Set(callsToday.map(c => c.lead_id))
    const bugunYapilanLeads = sortedLeads.filter(l => 
      !isWhatsAppLead(l) && (leadIdsCalledToday.has(l.id) || messagedTodayLeads.has(l.id))
    )

    const toplamYapilanLeads = sortedLeads.filter(l => {
      if (isWhatsAppLead(l)) {
        return l.next_contact_at !== null || 
               l.callback_status === 'pending' || 
               (l.calls && l.calls.length > 0) ||
               l.status_id === '22222222-0000-0000-0000-000000000009' ||
               l.assigned_sales_user_id !== null ||
               !!l.sales_representative_text;
      }
      return l.last_contact_at !== null || (l.legacy_source_file !== null && l.conversation_completed !== null) || !!l.sales_representative_text;
    })

    const toplamUlasanLeads = sortedLeads.filter(l => 
      l.status_id !== '22222222-0000-0000-0000-000000000020'
    )

    console.log('\n--- Calculated Dashboard Counters ---');
    console.log('BUGÜN ARANACAKLAR:', bugunAranacakLeads.length);
    console.log('BUGÜN YAPILAN ARAMALAR:', bugunYapilanLeads.length);
    console.log('TOPLAM YAPILMIŞ ARAMALAR:', toplamYapilanLeads.length);
    console.log('TOPLAM ULAŞAN:', toplamUlasanLeads.length);

    // Let's print some info about WhatsApp leads that are included in toplamYapilanLeads
    const waInToplamYapilan = toplamYapilanLeads.filter(isWhatsAppLead);
    console.log('\nWhatsApp Leads in TOPLAM YAPILMIŞ ARAMALAR:', waInToplamYapilan.length);
    if (waInToplamYapilan.length > 0) {
      waInToplamYapilan.slice(0, 10).forEach(l => {
        console.log(`- ID: ${l.id}, next_contact_at: ${l.next_contact_at}, callback_status: ${l.callback_status}, calls: ${l.calls?.length || 0}`);
      });
    }

  } catch (err) {
    console.error('Error running check:', err);
  }
}

run();

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

// Extract helpers from page.tsx to run them exactly
function cleanPhoneNum(phone) {
  if (!phone) return '';
  const cleaned = String(phone).replace(/\D/g, '');
  return cleaned.length >= 10 ? cleaned.slice(-10) : cleaned;
}

function parseRawDateToIso(rawDate) {
  if (!rawDate) return null;
  const s = String(rawDate).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parts = s.split('.');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  if (s.includes('T')) return s.split('T')[0];
  return null;
}

function getLocalDateStringWithShift(dateStr) {
  if (!dateStr) return null;
  try {
    const trimmed = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.split('T')[0];
    
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const formattedParts = formatter.formatToParts(d);
    const partMap = {};
    formattedParts.forEach(p => { partMap[p.type] = p.value; });
    
    const localDate = `${partMap.year}-${partMap.month}-${partMap.day}`;
    const localHours = parseInt(partMap.hour, 10);
    const localMinutes = parseInt(partMap.minute, 10);
    
    if (localHours > 17 || (localHours === 17 && localMinutes >= 30)) {
      const shiftedDate = new Date(d.getTime() + 24 * 60 * 60 * 1000);
      return shiftedDate.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
    }
    return localDate;
  } catch (e) {
    return dateStr.split('T')[0];
  }
}

function getLeadDate(lead) {
  if (lead.first_contact_date) return lead.first_contact_date;
  const rawDate = lead.legacy_raw_data?.["İlk Temas Tarihi"];
  if (rawDate) return parseRawDateToIso(rawDate);
  if (lead.first_contact_at) return getLocalDateStringWithShift(lead.first_contact_at);
  if (lead.legacy_source_file === null && lead.conversations && lead.conversations.length > 0) {
    const conv = lead.conversations[0];
    const convDate = conv.last_message_at || conv.created_at;
    if (convDate) return getLocalDateStringWithShift(convDate);
  }
  if (lead.created_at) return getLocalDateStringWithShift(lead.created_at);
  return null;
}

function isWaLead(l) {
  if (!l) return false;
  const channelName = String(l.communication_channels?.name || l.legacy_raw_data?.["İletişim Kanalı"] || '').toLowerCase();
  const sourceCode = String(l.lead_sources?.code || '').toLowerCase();
  const sourceName = String(l.lead_sources?.name || l.legacy_raw_data?.["Lead Kaynağı"] || '').toLowerCase();
  
  return (
    channelName.includes('whatsapp') || channelName.includes('wp') ||
    sourceCode.includes('wa') || sourceCode.includes('whatsapp') ||
    sourceName.includes('whatsapp') || sourceName.includes('wp') ||
    l.status_id === '22222222-0000-0000-0000-000000000020'
  );
}

async function run() {
  try {
    const token = await loginAndGetToken();
    
    // Fetch leads
    const leadsRes = await fetch(`${supabaseUrl}/rest/v1/leads?select=*,communication_channels:communication_channel_id(name),lead_sources:source_id(name,code),conversations(last_message_at,created_at)&is_active=eq.true`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${token}` }
    });
    const leads = await leadsRes.json();
    
    // Fetch conversations
    const convsRes = await fetch(`${supabaseUrl}/rest/v1/conversations?select=*&channel=eq.whatsapp`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${token}` }
    });
    const conversations = await convsRes.json();
    
    console.log(`Leads count: ${leads.length}, Conversations count: ${conversations.length}`);

    // Let's run check for each day between June 15 and June 21
    const days = ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21', '2026-06-22'];
    
    days.forEach(day => {
      const activePhones = new Set();
      
      conversations.forEach(c => {
        const lead = c.lead_id ? leads.find(l => l.id === c.lead_id) : null;
        const ph = cleanPhoneNum(lead?.phone || lead?.phone_normalized || '');
        const dateStr = c.last_message_at || c.created_at;
        const localDate = getLocalDateStringWithShift(dateStr);
        if (ph && localDate === day) {
          activePhones.add(ph);
        }
      });
      
      leads.forEach(l => {
        const ph = cleanPhoneNum(l.phone || l.phone_normalized);
        const leadDate = getLeadDate(l);
        if (ph && leadDate === day && isWaLead(l)) {
          activePhones.add(ph);
        }
      });
      
      console.log(`Day: ${day} -> Active WhatsApp Phones: ${activePhones.size} (${Array.from(activePhones).join(', ')})`);
    });
    
  } catch (err) {
    console.error('Error running script:', err);
  }
}

run();

const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }
});

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

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

function computeWhatsAppStats(conversations, leads, messages, mStart, mEnd) {
  const cleanPhoneNum = (phone) => {
    if (!phone) return '';
    return String(phone).replace(/\D/g, '');
  };

  const phoneToLeads = new Map();
  leads.forEach(l => {
    const ph = cleanPhoneNum(l.phone || l.phone_normalized);
    if (ph) {
      if (!phoneToLeads.has(ph)) phoneToLeads.set(ph, []);
      phoneToLeads.get(ph).push(l);
    }
  });

  const phoneToConvs = new Map();
  conversations.forEach(c => {
    const lead = c.lead_id ? leads.find(l => l.id === c.lead_id) : null;
    const ph = cleanPhoneNum(lead?.phone || lead?.phone_normalized || '');
    if (ph) {
      if (!phoneToConvs.has(ph)) phoneToConvs.set(ph, []);
      phoneToConvs.get(ph).push(c);
    }
  });

  const getLocalDateString = (dateStr) => getLocalDateStringWithShift(dateStr);
  const isInPeriod = (dateStr) => {
    if (!dateStr) return false;
    const localDate = getLocalDateString(dateStr);
    return localDate && localDate >= mStart && localDate <= mEnd;
  };

  const activePhones = new Set();

  conversations.forEach(c => {
    const lead = c.lead_id ? leads.find(l => l.id === c.lead_id) : null;
    const ph = cleanPhoneNum(lead?.phone || lead?.phone_normalized || '');
    if (ph && isInPeriod(c.last_message_at || c.created_at)) {
      activePhones.add(ph);
    }
  });

  leads.forEach(l => {
    const ph = cleanPhoneNum(l.phone || l.phone_normalized);
    const leadDate = getLeadDate(l);
    const inPeriod = leadDate && leadDate >= mStart && leadDate <= mEnd;
    if (ph && inPeriod && isWaLead(l)) {
      activePhones.add(ph);
    }
  });

  let unconvertedChatsCount = 0;
  let newLeadsCount = 0;
  let contactedLeadsCount = 0;
  let uncontactedLeadsCount = 0;

  const resolvedLeadsList = [];

  activePhones.forEach(ph => {
    const phoneLeads = phoneToLeads.get(ph) || [];
    const convertedLead = phoneLeads.find(l => l.status_id !== '22222222-0000-0000-0000-000000000020');
    const unconvertedLead = phoneLeads.find(l => l.status_id === '22222222-0000-0000-0000-000000000020');
    const resolvedLead = convertedLead || unconvertedLead;
    if (!resolvedLead) return;

    const isConverted = !!convertedLead;
    resolvedLeadsList.push({
      lead: resolvedLead,
      isConverted
    });

    if (isConverted) {
      newLeadsCount++;
      const hasBeenCalled = resolvedLead.conversation_completed === true || (resolvedLead.calls && resolvedLead.calls.length > 0);
      if (hasBeenCalled) {
        contactedLeadsCount++;
      } else {
        uncontactedLeadsCount++;
      }
    } else {
      unconvertedChatsCount++;
    }
  });

  return {
    totalChats: activePhones.size,
    newLeadsCount,
    contactedLeadsCount,
    uncontactedLeadsCount,
    unconvertedChatsCount,
    resolvedLeadsList
  };
}

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'mert@suntonmakina.com',
    password: 'Sunton123*'
  });

  const { data: convs } = await supabase.from('conversations').select('*').eq('channel', 'whatsapp');
  const { data: leads } = await supabase.from('leads').select('*, lead_sources(name), communication_channels(name), calls(id)').eq('is_active', true);
  const { data: msgs } = await supabase.from('messages').select('*');

  const stats = computeWhatsAppStats(convs, leads, msgs, '2026-06-22', '2026-06-22');

  console.log('=== VERIFICATION RESULTS FOR 2026-06-22 ===');
  console.log(`Gelen WP Sohbetleri (totalChats): ${stats.totalChats}`);
  console.log(`Sisteme Eklenenler (newLeadsCount): ${stats.newLeadsCount}`);
  console.log(`Aranan Leadler (contactedLeadsCount): ${stats.contactedLeadsCount}`);
  console.log(`Aranmayan / Bekleyen (uncontactedLeadsCount): ${stats.uncontactedLeadsCount}`);
  console.log(`Unutulan / Eklenmeyen (unconvertedChatsCount): ${stats.unconvertedChatsCount}`);
  
  console.log('\n--- Unconverted Chats list: ---');
  stats.resolvedLeadsList.filter(x => !x.isConverted).forEach(x => {
    console.log(`- Unconverted: ${x.lead.phone} | Name: ${x.lead.first_name} ${x.lead.last_name}`);
  });

  console.log('\n--- Converted Leads list (sample): ---');
  stats.resolvedLeadsList.filter(x => x.isConverted).slice(0, 10).forEach(x => {
    console.log(`- Converted: ${x.lead.phone} | Name: ${x.lead.first_name} ${x.lead.last_name}`);
  });
}

run();

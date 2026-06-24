const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
  }
});

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

function getLocalDateStringWithShift(dateStr) {
  if (!dateStr) return null;
  try {
    const trimmed = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
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
    formattedParts.forEach(p => {
      partMap[p.type] = p.value;
    });
    
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

function cleanPhoneNum(phone) {
  if (!phone) return '';
  const cleaned = String(phone).replace(/\D/g, '');
  return cleaned.length >= 10 ? cleaned.slice(-10) : cleaned;
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

function getLeadDate(lead) {
  if (lead.first_contact_date) {
    return lead.first_contact_date;
  }
  const rawDate = lead.legacy_raw_data?.["İlk Temas Tarihi"];
  if (rawDate) {
    // Parse Turkish date format
    const parts = rawDate.split('.');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  if (lead.first_contact_at) {
    return getLocalDateStringWithShift(lead.first_contact_at);
  }
  if (lead.legacy_source_file === null && lead.conversations && lead.conversations.length > 0) {
    const conv = lead.conversations[0];
    const convDate = conv.last_message_at || conv.created_at;
    if (convDate) {
      return getLocalDateStringWithShift(convDate);
    }
  }
  if (lead.created_at) {
    return getLocalDateStringWithShift(lead.created_at);
  }
  return null;
}

function computeWhatsAppStatsOld(conversations, leads, messages, mStart, mEnd) {
  const isInPeriod = (dateStr) => {
    if (!dateStr) return false;
    const localDate = getLocalDateStringWithShift(dateStr);
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

  return activePhones.size;
}

function computeWhatsAppStatsNew(conversations, leads, messages, mStart, mEnd) {
  const isInPeriod = (dateStr) => {
    if (!dateStr) return false;
    const localDate = getLocalDateStringWithShift(dateStr);
    return localDate && localDate >= mStart && localDate <= mEnd;
  };

  const activePhones = new Set();

  // 1. By conversation's last message or creation time
  conversations.forEach(c => {
    const lead = c.lead_id ? leads.find(l => l.id === c.lead_id) : null;
    const ph = cleanPhoneNum(lead?.phone || lead?.phone_normalized || '');
    if (ph && isInPeriod(c.last_message_at || c.created_at)) {
      activePhones.add(ph);
    }
  });

  // 2. By lead's contact date
  leads.forEach(l => {
    const ph = cleanPhoneNum(l.phone || l.phone_normalized);
    const leadDate = getLeadDate(l);
    const inPeriod = leadDate && leadDate >= mStart && leadDate <= mEnd;
    if (ph && inPeriod && isWaLead(l)) {
      activePhones.add(ph);
    }
  });

  // 3. By messages sent/received during the period
  const convMap = new Map(conversations.map(c => [c.id, c]));
  messages.forEach(m => {
    if (isInPeriod(m.sent_at || m.created_at)) {
      const c = convMap.get(m.conversation_id);
      if (c) {
        const lead = c.lead_id ? leads.find(l => l.id === c.lead_id) : null;
        const ph = cleanPhoneNum(lead?.phone || lead?.phone_normalized || '');
        if (ph) {
          activePhones.add(ph);
        }
      }
    }
  });

  return activePhones.size;
}

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'mert@suntonmakina.com',
    password: 'Sunton123*'
  });

  const { data: convs } = await supabase.from('conversations').select('*').eq('channel', 'whatsapp');
  const { data: leads } = await supabase.from('leads').select('*').eq('is_active', true);
  const { data: msgs } = await supabase.from('messages').select('*').order('sent_at', { ascending: false }).limit(3000);

  const dates = ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21', '2026-06-22', '2026-06-23'];

  console.log('Comparison of WhatsApp active chats (Old vs New):');
  dates.forEach(d => {
    const oldVal = computeWhatsAppStatsOld(convs, leads, msgs, d, d);
    const newVal = computeWhatsAppStatsNew(convs, leads, msgs, d, d);
    console.log(`${d}: Old (conv last_msg_at only) = ${oldVal} | New (including individual messages) = ${newVal}`);
  });
}

run();

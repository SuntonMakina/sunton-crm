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

function getLeadDate(lead) {
  if (lead.first_contact_date) {
    return lead.first_contact_date;
  }
  const rawDate = lead.legacy_raw_data?.["İlk Temas Tarihi"];
  if (rawDate) {
    return parseRawDateToIso(rawDate);
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

async function run() {
  try {
    await supabase.auth.signInWithPassword({
      email: 'mert@suntonmakina.com',
      password: 'Sunton123*'
    });

    const { data: convs, error: convErr } = await supabase
      .from('conversations')
      .select('*')
      .eq('channel', 'whatsapp');
    if (convErr) throw convErr;

    const { data: leads, error: leadErr } = await supabase
      .from('leads')
      .select('*, conversations(last_message_at, created_at), calls(id)')
      .eq('is_active', true);
    if (leadErr) throw leadErr;

    const mStart = '2026-06-19';
    const mEnd = '2026-06-19';

    const isInManagerPeriod = (dateStr) => {
      if (!dateStr) return false;
      const localDate = getLocalDateStringWithShift(dateStr);
      return localDate && localDate >= mStart && localDate <= mEnd;
    };

    const periodConvs = convs.filter(c => isInManagerPeriod(c.last_message_at || c.created_at));

    const leadsMapForConvs = new Map(leads ? leads.map(l => [l.id, l]) : []);
    let unconvertedChatsCount = 0;
    periodConvs.forEach(c => {
      const lead = c.lead_id ? leadsMapForConvs.get(c.lead_id) : null;
      if (!lead || lead.status_id === '22222222-0000-0000-0000-000000000020') {
        unconvertedChatsCount++;
      }
    });

    ['legacy_only', 'all_data'].forEach(scopeFilter => {
      let managerLeads = leads || [];

      // Apply scope filter
      if (scopeFilter === 'legacy_only') {
        managerLeads = managerLeads.filter(lead => {
          if (lead.legacy_source_file !== null) return true;
          const leadDate = getLeadDate(lead);
          return leadDate && leadDate >= '2026-06-01';
        });
      }

      // Apply official start dates filter
      managerLeads = managerLeads.filter(lead => {
        if (lead.legacy_source_file === null) {
          const leadDate = getLeadDate(lead);
          if (lead.status_id === '22222222-0000-0000-0000-000000000020') {
            if (!leadDate || leadDate < '2026-06-01') {
              return false;
            }
          } else {
            if (!leadDate || leadDate < '2026-06-01') {
              return false;
            }
          }
        }
        return true;
      });

      // Filter by manager period
      managerLeads = managerLeads.filter(lead => {
        const leadDate = getLeadDate(lead);
        return leadDate && leadDate >= mStart && leadDate <= mEnd;
      });

      let newLeadsCount = 0;
      let contactedLeadsCount = 0;
      let uncontactedLeadsCount = 0;

      managerLeads.forEach(lead => {
        const isConverted = lead.status_id !== '22222222-0000-0000-0000-000000000020';
        if (isConverted) {
          newLeadsCount++;
          const hasBeenCalled = lead.conversation_completed === true || (lead.calls && lead.calls.length > 0);
          if (hasBeenCalled) {
            contactedLeadsCount++;
          } else {
            uncontactedLeadsCount++;
          }
        }
      });

      const whatsappConvsCount = newLeadsCount + unconvertedChatsCount;

      console.log(`\n=== SCOPE: ${scopeFilter} ===`);
      console.log(`Gelen WP Sohbetleri (whatsappConvsCount = new + unconverted): ${whatsappConvsCount}`);
      console.log(`Sisteme Eklenenler (newLeadsCount): ${newLeadsCount}`);
      console.log(`Aranan Leadler (contactedLeadsCount): ${contactedLeadsCount}`);
      console.log(`Aranmayan / Bekleyen (uncontactedLeadsCount): ${uncontactedLeadsCount}`);
      console.log(`Unutulan / Eklenmeyen (unconvertedChatsCount): ${unconvertedChatsCount}`);
    });

  } catch (err) {
    console.error('Error:', err);
  }
}

run();

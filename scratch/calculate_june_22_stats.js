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

function getLeadDate(lead) {
  if (lead.first_contact_date) return lead.first_contact_date;
  const rawDate = lead.legacy_raw_data?.["İlk Temas Tarihi"];
  if (rawDate) return parseRawDateToIso(rawDate);
  if (lead.first_contact_at) return lead.first_contact_at.split('T')[0];
  if (lead.legacy_source_file === null && lead.conversations && lead.conversations.length > 0) {
    const conv = lead.conversations[0];
    const convDate = conv.last_message_at || conv.created_at;
    if (convDate) return convDate.split('T')[0];
  }
  if (lead.created_at) return lead.created_at.split('T')[0];
  return null;
}

const getLocalDateString = (dateStr) => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.split('T')[0];
    return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
  } catch (e) {
    return dateStr.split('T')[0];
  }
};

async function run() {
  try {
    await supabase.auth.signInWithPassword({
      email: 'mert@suntonmakina.com',
      password: 'Sunton123*'
    });

    // 1. Fetch conversations
    const { data: convs, error: convErr } = await supabase
      .from('conversations')
      .select('*')
      .eq('channel', 'whatsapp');
    if (convErr) throw convErr;

    // 2. Fetch leads
    const { data: leads, error: leadErr } = await supabase
      .from('leads')
      .select('*, calls(id)')
      .eq('is_active', true);
    if (leadErr) throw leadErr;

    const mStart = '2026-06-22';
    const mEnd = '2026-06-22';

    const isInManagerPeriod = (dateStr) => {
      if (!dateStr) return false;
      const localDate = getLocalDateString(dateStr);
      return localDate && localDate >= mStart && localDate <= mEnd;
    };

    const periodConvs = convs.filter(c => isInManagerPeriod(c.last_message_at || c.created_at));
    const leadsMap = new Map(leads.map(l => [l.id, l]));

    let newLeadsCount = 0;
    let contactedLeadsCount = 0;
    let uncontactedLeadsCount = 0;
    let unconvertedChatsCount = 0;

    console.log(`Conversations in manager period (2026-06-22): ${periodConvs.length}`);

    periodConvs.forEach(c => {
      const lead = c.lead_id ? leadsMap.get(c.lead_id) : null;
      if (lead) {
        const isConverted = lead.status_id !== '22222222-0000-0000-0000-000000000020';
        if (isConverted) {
          newLeadsCount++;
          const hasBeenCalled = lead.conversation_completed === true || (lead.calls && lead.calls.length > 0);
          if (hasBeenCalled) {
            contactedLeadsCount++;
          } else {
            uncontactedLeadsCount++;
          }
        } else {
          unconvertedChatsCount++;
        }
      } else {
        unconvertedChatsCount++;
      }
    });

    console.log('\n--- MANAGER STATS CARD VALUES ---');
    console.log(`Gelen WP Sohbetleri (whatsappConvsCount): ${periodConvs.length}`);
    console.log(`Sisteme Eklenenler (newLeadsCount): ${newLeadsCount}`);
    console.log(`Aranan Leadler (contactedLeadsCount): ${contactedLeadsCount}`);
    console.log(`Aranmayan / Bekleyen (uncontactedLeadsCount): ${uncontactedLeadsCount}`);
    console.log(`Unutulan / Eklenmeyen (unconvertedChatsCount): ${unconvertedChatsCount}`);

    // Let's check how many total incoming leads are there in legacy / all scopes
    // Filter by resolved date in JavaScript (same as page.tsx)
    const filteredLeads = leads.filter(lead => {
      const leadDate = getLeadDate(lead);
      return leadDate === '2026-06-22';
    });

    console.log(`\n--- ALL DATA SCOPE ---`);
    console.log(`Toplam Gelen Lead (all_data scope): ${filteredLeads.length}`);

    const legacyFiltered = filteredLeads.filter(l => l.legacy_source_file !== null);
    console.log(`\n--- LEGACY ONLY SCOPE ---`);
    console.log(`Toplam Gelen Lead (legacy_only scope): ${legacyFiltered.length}`);

  } catch (err) {
    console.error('Error:', err);
  }
}

run();

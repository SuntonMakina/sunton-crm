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
      .select('*, conversations(*)')
      .eq('is_active', true);
    if (leadErr) throw leadErr;

    console.log(`Total active leads in database: ${leads.length}`);

    // Filter by date June 22
    const june22Leads = leads.filter(l => getLeadDate(l) === '2026-06-22');
    console.log(`Leads with lead date '2026-06-22': ${june22Leads.length}`);

    // Let's print details of each lead for June 22
    console.log('\n--- LEADS FOR JUNE 22 ---');
    june22Leads.forEach(l => {
      console.log(`ID: ${l.id}, Phone: ${l.phone}, Number: ${l.lead_number || 'N/A'}, Legacy: ${l.legacy_source_file !== null}, Status: ${l.status_id}, Converted: ${l.status_id !== '22222222-0000-0000-0000-000000000020'}`);
      if (l.conversations && l.conversations.length > 0) {
        l.conversations.forEach(c => {
          console.log(`  -> Has WhatsApp Conversation! ID: ${c.id}, Last Message At: ${c.last_message_at}, Created At: ${c.created_at}`);
        });
      } else {
        console.log(`  -> NO WhatsApp Conversation`);
      }
    });

    // Find conversations on June 22
    const mStart = '2026-06-22';
    const mEnd = '2026-06-22';
    const isInManagerPeriod = (dateStr) => {
      if (!dateStr) return false;
      const localDate = getLocalDateString(dateStr);
      return localDate && localDate >= mStart && localDate <= mEnd;
    };
    const periodConvs = convs.filter(c => isInManagerPeriod(c.last_message_at || c.created_at));
    console.log(`\n--- CONVERSATIONS FOR JUNE 22: ${periodConvs.length} ---`);
    const leadsMap = new Map(leads.map(l => [l.id, l]));
    periodConvs.forEach(c => {
      const lead = c.lead_id ? leadsMap.get(c.lead_id) : null;
      console.log(`Conv ID: ${c.id}, Lead ID: ${c.lead_id || 'N/A'}, Lead Phone: ${lead ? lead.phone : 'N/A'}, Converted: ${lead ? (lead.status_id !== '22222222-0000-0000-0000-000000000020') : 'N/A'}`);
    });

  } catch (err) {
    console.error('Error:', err);
  }
}

run();

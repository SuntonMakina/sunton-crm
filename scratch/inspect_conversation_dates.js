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

    const { data: leads, error: leadErr } = await supabase
      .from('leads')
      .select('*, conversations(*)')
      .eq('is_active', true);
    if (leadErr) throw leadErr;

    const june22Leads = leads.filter(l => getLeadDate(l) === '2026-06-22');
    
    console.log(`Analyzing ${june22Leads.length} leads of June 22:`);
    june22Leads.forEach(l => {
      const isLegacy = l.legacy_source_file !== null;
      const isConverted = l.status_id !== '22222222-0000-0000-0000-000000000020';
      if (!isConverted) {
        console.log(`Unconverted lead: ID: ${l.id}, Phone: ${l.phone}`);
        return;
      }
      
      const convs = l.conversations || [];
      if (convs.length === 0) {
        console.log(`Converted lead with NO conversation: ID: ${l.id}, Phone: ${l.phone}, Lead Date: ${getLeadDate(l)}, Legacy: ${isLegacy}`);
      } else {
        convs.forEach(c => {
          const convDateStr = c.last_message_at || c.created_at;
          const convLocalDate = getLocalDateString(convDateStr);
          console.log(`Converted lead: ID: ${l.id}, Phone: ${l.phone}, Lead Date: ${getLeadDate(l)}, Legacy: ${isLegacy}, Conv Date: ${convLocalDate} (raw: ${convDateStr})`);
        });
      }
    });

  } catch (e) {
    console.error(e);
  }
}

run();

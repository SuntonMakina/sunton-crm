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
  if (lead.created_at) return lead.created_at.split('T')[0];
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
      .select('*')
      .eq('is_active', true);
    if (leadErr) throw leadErr;

    const leadsMap = new Map(leads.map(l => [l.id, l]));

    // Filter conversations between June 12 and June 21
    const targetConvs = convs.filter(c => {
      const d = (c.last_message_at || c.created_at || '').split('T')[0];
      return d >= '2026-06-12' && d <= '2026-06-21';
    });

    console.log(`Analyzing ${targetConvs.length} conversations between June 12 and June 21:`);
    targetConvs.forEach(c => {
      const d = (c.last_message_at || c.created_at || '').split('T')[0];
      const lead = c.lead_id ? leadsMap.get(c.lead_id) : null;
      if (lead) {
        console.log(`Conv Date: ${d}, Conv Phone: ${c.phone}, Lead ID: ${lead.id}, Lead Phone: ${lead.phone}, Lead Date: ${getLeadDate(lead)}, status_id: ${lead.status_id}, Converted: ${lead.status_id !== '22222222-0000-0000-0000-000000000020'}`);
      } else {
        console.log(`Conv Date: ${d}, Conv Phone: ${c.phone}, NO Lead linked!`);
      }
    });

  } catch (e) {
    console.error(e);
  }
}

run();

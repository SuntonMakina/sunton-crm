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

    console.log(`Total conversations: ${convs.length}`);
    console.log(`Total active leads: ${leads.length}`);

    // Let's summarize the dates of leads
    const leadDateCounts = {};
    leads.forEach(l => {
      const d = getLeadDate(l) || 'N/A';
      leadDateCounts[d] = (leadDateCounts[d] || 0) + 1;
    });
    console.log('\n--- LEAD DATE COUNTS ---');
    console.log(leadDateCounts);

    // Let's summarize the dates of conversations
    const convDateCounts = {};
    convs.forEach(c => {
      const d = (c.last_message_at || c.created_at || '').split('T')[0] || 'N/A';
      convDateCounts[d] = (convDateCounts[d] || 0) + 1;
    });
    console.log('\n--- CONVERSATION DATE COUNTS ---');
    console.log(convDateCounts);

  } catch (e) {
    console.error(e);
  }
}

run();

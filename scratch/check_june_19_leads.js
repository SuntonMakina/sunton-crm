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

async function run() {
  try {
    await supabase.auth.signInWithPassword({
      email: 'mert@suntonmakina.com',
      password: 'Sunton123*'
    });

    const { data: leads, error: leadErr } = await supabase
      .from('leads')
      .select('*')
      .eq('is_active', true);
    if (leadErr) throw leadErr;

    function getLeadDate(lead) {
      if (lead.first_contact_date) return lead.first_contact_date;
      if (lead.first_contact_at) return lead.first_contact_at.split('T')[0];
      if (lead.created_at) return lead.created_at.split('T')[0];
      return null;
    }

    const june19Leads = leads.filter(l => getLeadDate(l) === '2026-06-19');
    console.log(`Found ${june19Leads.length} leads on June 19:`);
    june19Leads.forEach(l => {
      console.log(`Lead ID: ${l.id}, Phone: ${l.phone}, status_id: ${l.status_id}, legacy: ${l.legacy_source_file !== null}, converted: ${l.status_id !== '22222222-0000-0000-0000-000000000020'}`);
    });

  } catch (e) {
    console.error(e);
  }
}

run();

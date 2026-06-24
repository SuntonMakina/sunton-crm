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

async function run() {
  try {
    await supabase.auth.signInWithPassword({
      email: 'mert@suntonmakina.com',
      password: 'Sunton123*'
    });

    const { data: leads, error } = await supabase
      .from('leads')
      .select('*, conversations(last_message_at, created_at)')
      .eq('is_active', true);

    if (error) throw error;

    const todayLeads = [];
    leads.forEach(l => {
      const date = getLeadDate(l);
      if (date === '2026-06-22') {
        todayLeads.push(l);
      }
    });

    console.log(`Leads that resolve to "2026-06-22" today: ${todayLeads.length}`);
    
    // Group by source / file
    const groups = {};
    todayLeads.forEach(l => {
      const source = l.legacy_source_file || 'CRM (WhatsApp/Real-time)';
      const status = l.status_id === '22222222-0000-0000-0000-000000000020' ? 'Unconverted Chat' : 'Converted Lead';
      const key = `${source} | ${status}`;
      groups[key] = (groups[key] || 0) + 1;
    });

    console.log('\nGrouping of today\'s leads:');
    Object.entries(groups).forEach(([k, c]) => {
      console.log(`- ${k} -> ${c}`);
    });

    console.log('\nSample of CRM today leads:');
    todayLeads.filter(l => !l.legacy_source_file).slice(0, 10).forEach(l => {
      console.log(`- ID: ${l.id} | Name: ${l.first_name} ${l.last_name} | Phone: ${l.phone} | Status: ${l.status_id} | Created: ${l.created_at}`);
    });

  } catch (err) {
    console.error('Error:', err);
  }
}

run();

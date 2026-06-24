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

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'mert@suntonmakina.com',
    password: 'Sunton123*'
  });

  const start_date = '2026-06-22';
  const end_date = '2026-06-22';

  // 1. Original fetch query
  let origQuery = supabase
    .from('conversations')
    .select('*, leads:lead_id(*)')
    .eq('channel', 'whatsapp')
    .gte('last_message_at', start_date);
  
  const eod = new Date(end_date);
  eod.setHours(23, 59, 59, 999);
  origQuery = origQuery.lte('last_message_at', eod.toISOString());

  const { data: origData } = await origQuery;
  console.log(`Original query results: ${origData ? origData.length : 0}`);
  if (origData) {
    origData.forEach(c => {
      console.log(`- Orig: ${c.leads ? c.leads.phone : 'No Phone'} / ${c.leads ? c.leads.first_name + ' ' + c.leads.last_name : 'No Name'} / LastMessage: ${c.last_message_at}`);
    });
  }

  // 2. Shifted bounds query
  let utcStart = null;
  let utcEnd = null;

  if (start_date) {
    const d = new Date(start_date);
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    utcStart = `${y}-${m}-${day}T14:30:00.000Z`;
  }
  if (end_date) {
    utcEnd = `${end_date}T14:30:00.000Z`;
  }

  let shiftedQuery = supabase
    .from('conversations')
    .select('*, leads:lead_id(*)')
    .eq('channel', 'whatsapp')
    .gte('last_message_at', utcStart)
    .lte('last_message_at', utcEnd);

  const { data: shiftedData } = await shiftedQuery;
  console.log(`\nNew shifted bounds query results: ${shiftedData ? shiftedData.length : 0}`);
  if (shiftedData) {
    shiftedData.forEach(c => {
      console.log(`- Shifted: ${c.leads ? c.leads.phone : 'No Phone'} / ${c.leads ? c.leads.first_name + ' ' + c.leads.last_name : 'No Name'} / LastMessage: ${c.last_message_at}`);
    });
  }
}

run();

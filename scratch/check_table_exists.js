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
  
  // Try to query unmatched_call_contacts
  const { data, error } = await supabase
    .from('unmatched_call_contacts')
    .select('*')
    .limit(1);
    
  if (error) {
    console.log('Error for unmatched_call_contacts:', error.code, error.message);
  } else {
    print('unmatched_call_contacts exists!');
  }

  // Try to query unmatched_call_logs
  const { data: d2, error: e2 } = await supabase
    .from('unmatched_call_logs')
    .select('*')
    .limit(1);
    
  if (e2) {
    console.log('Error for unmatched_call_logs:', e2.code, e2.message);
  } else {
    console.log('unmatched_call_logs exists!');
  }

  // Try to query unmatched_calls
  const { data: d3, error: e3 } = await supabase
    .from('unmatched_calls')
    .select('*')
    .limit(1);
    
  if (e3) {
    console.log('Error for unmatched_calls:', e3.code, e3.message);
  } else {
    console.log('unmatched_calls exists!');
  }
}

run();

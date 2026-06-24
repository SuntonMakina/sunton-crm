const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
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
  
  const { data: calls, error } = await supabase
    .from('calls')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error(error);
    return;
  }
  
  console.log('Calls table columns:');
  if (calls && calls.length > 0) {
    console.log(Object.keys(calls[0]));
    console.log('Sample call:', calls[0]);
  } else {
    console.log('No calls found.');
  }
}

run();

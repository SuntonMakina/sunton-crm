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
  
  const { data: messages, error } = await supabase
    .from('messages')
    .select('created_at, sent_at, direction');
    
  if (error) {
    console.error(error);
    return;
  }
  
  console.log('Total messages in DB: ' + messages.length);
  
  const dates = {};
  messages.forEach(m => {
    const t = m.sent_at || m.created_at;
    if (t) {
      const d = t.split('T')[0];
      dates[d] = (dates[d] || 0) + 1;
    }
  });
  
  console.log('Date distribution:');
  console.log(JSON.stringify(dates, null, 2));
}

run();

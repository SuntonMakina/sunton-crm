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
  
  // Total messages count
  const { count: msgCount, error: msgErr } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true });
    
  // Total conversations count
  const { count: convCount, error: convErr } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true });

  // Total leads count
  const { count: leadCount, error: leadErr } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true });

  console.log({ msgCount, convCount, leadCount });

  // Date distribution for conversations last_message_at
  const { data: convs, error: convsErr } = await supabase
    .from('conversations')
    .select('created_at, last_message_at');

  const convDates = {};
  convs.forEach(c => {
    const t = c.last_message_at || c.created_at;
    if (t) {
      const d = t.split('T')[0];
      convDates[d] = (convDates[d] || 0) + 1;
    }
  });
  console.log('Conversations last_message_at distribution:', convDates);

  // Let's get messages and print the dates of those messages
  const { data: msgs, error: msgsErr } = await supabase
    .from('messages')
    .select('sent_at, created_at')
    .order('sent_at', { ascending: false })
    .limit(10);
  console.log('Latest 10 messages dates:', msgs);
}

run();

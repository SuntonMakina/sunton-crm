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

    const { data: convs, error: convErr } = await supabase
      .from('conversations')
      .select('*')
      .eq('channel', 'whatsapp');
    if (convErr) throw convErr;

    console.log(`Total conversations: ${convs.length}`);
    const nullLastMessage = convs.filter(c => !c.last_message_at);
    console.log(`Conversations with null last_message_at: ${nullLastMessage.length}`);
    if (nullLastMessage.length > 0) {
      nullLastMessage.forEach(c => {
        console.log(`Conv ID: ${c.id}, Phone: ${c.phone}, created_at: ${c.created_at}`);
      });
    }

    const afterJune16 = convs.filter(c => {
      const d = (c.last_message_at || c.created_at || '').split('T')[0];
      return d > '2026-06-16';
    });
    console.log(`Conversations after June 16: ${afterJune16.length}`);
    afterJune16.forEach(c => {
      console.log(`Conv ID: ${c.id}, last_message_at: ${c.last_message_at}, created_at: ${c.created_at}`);
    });

  } catch (e) {
    console.error(e);
  }
}

run();

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

    const leadIds = ['b6587079-4e8f-45da-b9d9-eb1a45573d27', 'b906f1bc-0fa7-4ea2-a17e-ea3ec8b016e2'];
    const phones = ['5397714761', '5458057736', '539 771 47 61', '545 805 77 36'];

    console.log('Searching in messages table by lead_id:');
    const { data: msgsById, error: err1 } = await supabase
      .from('messages')
      .select('*')
      .in('lead_id', leadIds);
    if (err1) throw err1;
    console.log(`Found ${msgsById.length} messages by lead_id.`);

    console.log('Searching in messages table by body text containing phones:');
    const { data: allMsgs, error: err2 } = await supabase
      .from('messages')
      .select('*');
    if (err2) throw err2;

    const matchedMsgs = allMsgs.filter(m => {
      const body = m.body || '';
      return phones.some(p => body.includes(p));
    });
    console.log(`Found ${matchedMsgs.length} messages by text content.`);
    matchedMsgs.forEach(m => {
      console.log(`Msg ID: ${m.id}, Lead ID: ${m.lead_id}, Sender: ${m.sender_phone}, Body: ${m.body}`);
    });

  } catch (e) {
    console.error(e);
  }
}

run();

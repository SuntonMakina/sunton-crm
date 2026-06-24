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

    const numbers = ['905397714761', '905458057736', '5397714761', '5458057736', '90 539 771 47 61', '90 545 805 77 36'];
    
    console.log('Searching in conversations table:');
    const { data: convs, error: convErr } = await supabase
      .from('conversations')
      .select('*');
    if (convErr) throw convErr;

    const matchedConvs = convs.filter(c => {
      const phoneClean = (c.phone || '').replace(/\D/g, '');
      return phoneClean.includes('5397714761') || phoneClean.includes('5458057736');
    });

    console.log(`Found ${matchedConvs.length} matched conversations:`);
    matchedConvs.forEach(c => {
      console.log(`Conv ID: ${c.id}, Phone: ${c.phone}, Lead ID: ${c.lead_id}, Created At: ${c.created_at}`);
    });

    console.log('\nSearching in leads table:');
    const { data: leads, error: leadErr } = await supabase
      .from('leads')
      .select('*')
      .or('phone.ilike.%5397714761%,phone.ilike.%5458057736%');
    if (leadErr) throw leadErr;

    console.log(`Found ${leads.length} matched leads:`);
    leads.forEach(l => {
      console.log(`Lead ID: ${l.id}, Phone: ${l.phone}, status_id: ${l.status_id}, first_contact_date: ${l.first_contact_date}`);
    });

  } catch (e) {
    console.error(e);
  }
}

run();

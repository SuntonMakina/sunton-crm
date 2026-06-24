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

    // We will look at some of the phones from our previous trace:
    const targetPhones = [
      '+905511808293',
      '+905414959796',
      '+905373730860',
      '+905435062773',
      '+905062606155'
    ];

    console.log('Searching for target phones across all leads:');
    targetPhones.forEach(phone => {
      const cleanPhone = phone.replace(/\D/g, '');
      const matches = leads.filter(l => {
        const leadPhoneClean = (l.phone || '').replace(/\D/g, '');
        return leadPhoneClean.includes(cleanPhone) || cleanPhone.includes(leadPhoneClean);
      });
      console.log(`\nPhone: ${phone} (clean: ${cleanPhone}) matches: ${matches.length}`);
      matches.forEach(m => {
        console.log(`  Lead ID: ${m.id}, Phone: ${m.phone}, status_id: ${m.status_id}, legacy: ${m.legacy_source_file !== null}`);
      });
    });

  } catch (e) {
    console.error(e);
  }
}

run();

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

const targets = [
  { phone: '+905377675634', digits: '5377675634' },
  { phone: '+905350535369', digits: '5350535369' },
  { phone: '+905357880681', digits: '5357880681' },
  { phone: '+905056847576', digits: '5056847576' },
  { phone: '+905313113006', digits: '5313113006' },
  { phone: '+905332636068', digits: '5332636068' },
  { phone: '+905055648174', digits: '5055648174' },
  { phone: '+8618151032788', digits: '18151032788' },
  { phone: '+905330681932', digits: '5330681932' }
];

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'mert@suntonmakina.com',
    password: 'Sunton123*'
  });
  
  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, lead_number, first_name, last_name, phone, phone_normalized, status_id, first_contact_date, created_at');
    
  if (error) {
    console.error(error);
    return;
  }

  const cleanDigits = (s) => String(s || '').replace(/\D/g, '');

  console.log(`Checking ${targets.length} targets against ${leads.length} leads in memory...`);
  
  targets.forEach(t => {
    console.log(`\nTarget: ${t.phone}`);
    const matches = leads.filter(l => {
      const pDigits = cleanDigits(l.phone);
      const pnDigits = cleanDigits(l.phone_normalized);
      return pDigits.includes(t.digits) || pnDigits.includes(t.digits);
    });
    
    if (matches.length === 0) {
      console.log('  No matches found.');
    } else {
      matches.forEach(m => {
        console.log(`  Match found: ID ${m.id} / Number ${m.lead_number} / Name: ${m.first_name} ${m.last_name} / Phone: ${m.phone} / Normalized: ${m.phone_normalized} / Status: ${m.status_id} / Converted: ${m.status_id !== '22222222-0000-0000-0000-000000000020'}`);
      });
    }
  });
}

run();

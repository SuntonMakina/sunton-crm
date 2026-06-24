const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const ws = require('ws');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

async function run() {
  try {
    console.log('Authenticating...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'mert@suntonmakina.com',
      password: 'Sunton123*'
    });
    if (authError) throw authError;
    console.log('Authenticated successfully!');

    console.log('Fetching profiles...');
    const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, first_name, last_name, full_name').eq('is_active', true);
    if (pErr) {
      console.error('Error:', pErr.message);
    } else {
      console.log('Profiles count:', profiles.length);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

run();

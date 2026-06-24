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
  
  // Query to get all table names
  const { data, error } = await supabase.rpc('get_tables_list'); // wait, if get_tables_list RPC doesn't exist, we can use SQL or inspect REST API
  if (error) {
    // Try querying REST schema
    const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`;
    const response = await fetch(url, {
      headers: {
        'apikey': env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      }
    });
    if (response.ok) {
      const doc = await response.json();
      console.log('Available tables/paths:', Object.keys(doc.definitions || {}));
    } else {
      console.log('Failed REST query:', response.status);
    }
  } else {
    console.log('Tables from RPC:', data);
  }
}

run();

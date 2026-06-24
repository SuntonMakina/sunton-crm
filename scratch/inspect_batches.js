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

    const { data: batches, error } = await supabase
      .from('legacy_import_batches')
      .select('*')
      .order('started_at', { ascending: false });

    if (error) throw error;

    console.log('Import Batches:');
    batches.forEach(b => {
      console.log(`- BatchID: ${b.id} | File: ${b.source_file} | TotalRows: ${b.total_rows} | Inserted: ${b.inserted_rows} | Status: ${b.status} | CreatedAt: ${b.created_at}`);
    });

  } catch (err) {
    console.error('Batches inspect error:', err);
  }
}

run();

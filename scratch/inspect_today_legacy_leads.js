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

    const targetDate = '2026-06-22';
    
    // Fetch leads created on 2026-06-22 or first_contact_date = 2026-06-22
    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, first_name, last_name, phone, phone_normalized, is_active, created_at, first_contact_date, legacy_lead_id, legacy_source_file, legacy_excel_row, legacy_import_batch_id')
      .eq('is_active', true);

    if (error) throw error;

    console.log(`Total active leads fetched: ${leads.length}`);

    // Group by first_contact_date and legacy_import_batch_id
    const groups = {};
    leads.forEach(l => {
      const fcDate = l.first_contact_date || 'null';
      const batchId = l.legacy_import_batch_id || 'null';
      const key = `Date: ${fcDate} | Batch: ${batchId} | File: ${l.legacy_source_file}`;
      groups[key] = (groups[key] || 0) + 1;
    });

    console.log('\nLeads grouping:');
    Object.entries(groups).forEach(([key, count]) => {
      console.log(`- ${key} -> Count: ${count}`);
    });

  } catch (err) {
    console.error('Inspect error:', err);
  }
}

run();

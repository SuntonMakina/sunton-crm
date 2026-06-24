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
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: 'mert@suntonmakina.com',
      password: 'Sunton123*'
    });
    
    // Fetch all leads
    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, first_name, last_name, phone, phone_normalized, is_active, created_at, first_contact_date, legacy_lead_id, legacy_source_file, legacy_excel_row')
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log(`Total active/inactive leads in database: ${leads.length}`);
    const summary = {};
    leads.forEach(l => {
      const date = l.created_at.split('T')[0];
      summary[date] = (summary[date] || 0) + 1;
    });
    console.log('Leads count by created_at date:', summary);

    // List top 30 leads
    console.log('\nTop 30 leads:');
    leads.slice(0, 30).forEach(l => {
      console.log(`- ID: ${l.id} | LegacyID: ${l.legacy_lead_id} | Name: ${l.first_name} ${l.last_name} | Phone: ${l.phone} | File: ${l.legacy_source_file} | Row: ${l.legacy_excel_row} | Created: ${l.created_at}`);
    });

  } catch (err) {
    console.error('Inspect error:', err);
  }
}

run();

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

    // 1. Check leads columns
    console.log('Checking leads columns...');
    const { data: leads, error: leadsErr } = await supabase.from('leads').select('*').limit(1);
    if (leadsErr) {
      console.error('Leads table error:', leadsErr.message);
    } else if (leads.length > 0) {
      const hasCol = 'legacy_sales_specialist_name' in leads[0];
      console.log(`Column 'legacy_sales_specialist_name' exists in leads: ${hasCol}`);
    } else {
      console.log('Leads table is empty, cannot verify columns directly.');
    }

    // 2. Check lead_sales_assignments table
    console.log('Checking lead_sales_assignments table...');
    const { data: assignments, error: assignErr } = await supabase.from('lead_sales_assignments').select('*').limit(1);
    if (assignErr) {
      console.error('lead_sales_assignments table error/does not exist:', assignErr.message);
    } else {
      console.log('lead_sales_assignments table exists successfully!');
    }
  } catch (err) {
    console.error('Error running test:', err);
  }
}

run();

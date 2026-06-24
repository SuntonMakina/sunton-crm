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

const targetPhones = ['905335745839', '905416003432'];

async function run() {
  try {
    console.log('Authenticating as Mert...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'mert@suntonmakina.com',
      password: 'Sunton123*'
    });
    if (authError || !authData?.session) {
      throw new Error('Auth failed: ' + authError?.message);
    }
    console.log('Authenticated successfully.');

    for (const phone of targetPhones) {
      console.log(`\nFinding lead with normalized phone: ${phone}...`);
      const { data: leadMatch, error: findError } = await supabase
        .from('leads')
        .select('id, first_name, last_name')
        .eq('phone_normalized', phone)
        .maybeSingle();

      if (findError) {
        console.error(`Error finding lead ${phone}:`, findError.message);
        continue;
      }

      if (!leadMatch) {
        console.log(`No lead found with phone ${phone}.`);
        continue;
      }

      const leadId = leadMatch.id;
      console.log(`Found lead: ${leadMatch.first_name} ${leadMatch.last_name} (ID: ${leadId}). Deleting dependencies...`);

      // 1. Delete tasks
      console.log('  Deleting tasks...');
      await supabase.from('tasks').delete().eq('lead_id', leadId);

      // 2. Delete activities
      console.log('  Deleting activities...');
      await supabase.from('activities').delete().eq('entity_type', 'lead').eq('entity_id', leadId);

      // 3. Delete conversations (cascades to messages)
      console.log('  Deleting conversations...');
      await supabase.from('conversations').delete().eq('lead_id', leadId);

      // 4. Delete lead itself
      console.log('  Deleting lead record...');
      const { error: delError } = await supabase.from('leads').delete().eq('id', leadId);
      if (delError) {
        console.error(`  Error deleting lead ${phone}:`, delError.message);
      } else {
        console.log(`  Successfully deleted lead with phone: ${phone}`);
      }
    }

    console.log('\nRepresentative cleanup process completed.');

  } catch (err) {
    console.error('Execution failed:', err);
  }
}

run();

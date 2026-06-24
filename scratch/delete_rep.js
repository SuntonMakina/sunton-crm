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
    console.log('Authenticating as Mert...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'mert@suntonmakina.com',
      password: 'Sunton123*'
    });
    if (authError || !authData?.session) {
      throw new Error('Auth failed: ' + authError?.message);
    }
    const token = authData.session.access_token;
    console.log('Authenticated successfully.');

    // Look for lead matching phone number +90 506 112 23 50
    const targetPhone = '905061122350';
    console.log(`Finding lead with normalized phone: ${targetPhone}...`);
    const { data: leadMatch, error: findError } = await supabase
      .from('leads')
      .select('id, first_name, last_name')
      .eq('phone_normalized', targetPhone)
      .maybeSingle();

    if (findError) {
      throw new Error('Error finding lead: ' + findError.message);
    }

    if (!leadMatch) {
      console.log('No lead found with phone number +90 506 112 23 50. It might have been deleted already.');
      return;
    }

    const leadId = leadMatch.id;
    console.log(`Found lead: ${leadMatch.first_name} ${leadMatch.last_name} (ID: ${leadId}). Deleting dependencies...`);

    // 1. Delete tasks
    console.log('Deleting tasks...');
    const { error: taskError } = await supabase
      .from('tasks')
      .delete()
      .eq('lead_id', leadId);
    if (taskError) console.error('Error deleting tasks:', taskError.message);

    // 2. Delete activities
    console.log('Deleting activities...');
    const { error: actError } = await supabase
      .from('activities')
      .delete()
      .eq('entity_type', 'lead')
      .eq('entity_id', leadId);
    if (actError) console.error('Error deleting activities:', actError.message);

    // 3. Delete conversations (cascades to messages)
    console.log('Deleting conversations...');
    const { error: convError } = await supabase
      .from('conversations')
      .delete()
      .eq('lead_id', leadId);
    if (convError) console.error('Error deleting conversations:', convError.message);

    // 4. Delete lead
    console.log('Deleting lead record...');
    const { error: leadDelError } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId);
    if (leadDelError) {
      throw new Error('Error deleting lead: ' + leadDelError.message);
    }

    console.log('Representative lead +90 506 112 23 50 deleted successfully from the system.');

  } catch (err) {
    console.error('Execution failed:', err);
    process.exit(1);
  }
}

run();

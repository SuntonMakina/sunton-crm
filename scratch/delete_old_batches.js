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

const LATEST_BATCH_ID = '0c7f454d-ca10-4969-ba28-49656dbcff17';

async function run() {
  try {
    await supabase.auth.signInWithPassword({
      email: 'mert@suntonmakina.com',
      password: 'Sunton123*'
    });

    console.log('Fetching old legacy leads...');
    // We select leads where legacy_source_file is not null and legacy_import_batch_id != LATEST_BATCH_ID
    const { data: leads, error: findError } = await supabase
      .from('leads')
      .select('id, legacy_lead_id, first_name, last_name, legacy_import_batch_id')
      .not('legacy_source_file', 'is', null);

    if (findError) throw findError;

    const toDelete = leads.filter(l => l.legacy_import_batch_id !== LATEST_BATCH_ID);
    console.log(`Total legacy leads in database: ${leads.length}`);
    console.log(`Leads in latest batch to KEEP: ${leads.length - toDelete.length}`);
    console.log(`Old legacy leads to DELETE: ${toDelete.length}`);

    if (toDelete.length === 0) {
      console.log('No old legacy leads found to delete.');
      return;
    }

    const deleteIds = toDelete.map(l => l.id);
    const BATCH_SIZE = 50;

    console.log('Starting deletion of old leads and their dependencies in batches...');
    for (let i = 0; i < deleteIds.length; i += BATCH_SIZE) {
      const chunk = deleteIds.slice(i, i + BATCH_SIZE);
      console.log(`Deleting batch ${Math.floor(i / BATCH_SIZE) + 1} (${chunk.length} leads)...`);

      // 1. Delete tasks
      await supabase.from('tasks').delete().in('lead_id', chunk);
      // 2. Delete activities
      await supabase.from('activities').delete().eq('entity_type', 'lead').in('entity_id', chunk);
      // 3. Delete conversations (cascades to messages)
      await supabase.from('conversations').delete().in('lead_id', chunk);
      // 4. Delete leads
      const { error: delError } = await supabase.from('leads').delete().in('id', chunk);
      if (delError) {
        console.error('Error deleting leads chunk:', delError.message);
      }
    }

    console.log('Old legacy leads cleanup completed successfully!');

  } catch (err) {
    console.error('Deletion error:', err);
  }
}

run();

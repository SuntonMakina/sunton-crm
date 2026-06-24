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

const UNCONVERTED_STATUS = '22222222-0000-0000-0000-000000000020';

async function run() {
  try {
    await supabase.auth.signInWithPassword({
      email: 'mert@suntonmakina.com',
      password: 'Sunton123*'
    });

    console.log('Fetching all active leads...');
    const { data: leads, error: leadErr } = await supabase
      .from('leads')
      .select('id, first_name, last_name, phone, phone_normalized, status_id, is_active, legacy_source_file, created_at, calls(id), conversations(id)')
      .eq('is_active', true);

    if (leadErr) throw leadErr;

    console.log(`Fetched ${leads.length} active leads.`);

    // 1. Separate unconverted chats (status_id = UNCONVERTED_STATUS)
    const unconvertedChats = leads.filter(l => l.status_id === UNCONVERTED_STATUS);
    // 2. Separate converted leads (status_id !== UNCONVERTED_STATUS)
    const convertedLeads = leads.filter(l => l.status_id !== UNCONVERTED_STATUS);

    console.log(`Unconverted chats: ${unconvertedChats.length}`);
    console.log(`Converted/Manually added/Imported leads: ${convertedLeads.length}`);

    // Map converted leads by phone_normalized for fast lookup
    const convertedMap = new Map();
    convertedLeads.forEach(l => {
      if (l.phone_normalized) {
        if (!convertedMap.has(l.phone_normalized)) {
          convertedMap.set(l.phone_normalized, []);
        }
        convertedMap.get(l.phone_normalized).push(l);
      }
    });

    const mergeCandidates = [];

    // Find matches
    unconvertedChats.forEach(chat => {
      const matchPhone = chat.phone_normalized;
      if (matchPhone && convertedMap.has(matchPhone)) {
        const matches = convertedMap.get(matchPhone);
        mergeCandidates.push({
          unconvertedChat: chat,
          convertedLeads: matches
        });
      }
    });

    console.log(`\nFound ${mergeCandidates.length} phone numbers that exist in both unconverted chats and converted leads:`);
    
    for (const cand of mergeCandidates) {
      const chat = cand.unconvertedChat;
      const targetLead = cand.convertedLeads[0]; // Merging into the first match
      console.log(`\nMatch phone: ${chat.phone_normalized}`);
      console.log(`  - Unconverted: ID: ${chat.id} | Name: ${chat.first_name} ${chat.last_name} | Created: ${chat.created_at}`);
      console.log(`  - Converted Target: ID: ${targetLead.id} | Name: ${targetLead.first_name} ${targetLead.last_name} | File: ${targetLead.legacy_source_file} | Created: ${targetLead.created_at}`);

      // Perform the merge:
      // 1. Move conversations from unconverted lead to target lead
      console.log(`    Moving conversations from ${chat.id} to ${targetLead.id}...`);
      const { data: convs, error: convFindErr } = await supabase
        .from('conversations')
        .select('id')
        .eq('lead_id', chat.id);

      if (convFindErr) {
        console.error('    Error finding conversations:', convFindErr.message);
        continue;
      }

      if (convs.length > 0) {
        const convIds = convs.map(c => c.id);
        const { error: convUpdateErr } = await supabase
          .from('conversations')
          .update({ lead_id: targetLead.id })
          .in('id', convIds);
        if (convUpdateErr) {
          console.error('    Error moving conversations:', convUpdateErr.message);
        } else {
          console.log(`    Successfully moved ${convs.length} conversations.`);
        }
      }

      // 2. Move tasks/activities (if any, though unconverted chats shouldn't have much)
      console.log(`    Moving tasks/activities...`);
      await supabase.from('tasks').update({ lead_id: targetLead.id }).eq('lead_id', chat.id);
      await supabase.from('activities').update({ entity_id: targetLead.id }).eq('entity_type', 'lead').eq('entity_id', chat.id);

      // 3. Mark the unconverted lead as inactive/deleted
      console.log(`    Deactivating unconverted lead ${chat.id}...`);
      const { error: deactivateErr } = await supabase
        .from('leads')
        .delete()
        .eq('id', chat.id);
      if (deactivateErr) {
        console.error('    Error deleting unconverted lead:', deactivateErr.message);
      } else {
        console.log(`    Successfully deleted duplicate unconverted lead.`);
      }
    }

    console.log('\nMerge scan completed.');

  } catch (err) {
    console.error('Scan error:', err);
  }
}

run();

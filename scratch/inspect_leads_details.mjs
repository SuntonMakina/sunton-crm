import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import ws from 'ws'

// Manual env parse
const envContent = fs.readFileSync('.env.local', 'utf-8')
const env = {}
envContent.split('\n').forEach(line => {
  const parts = line.split('=')
  if (parts.length >= 2) {
    const key = parts[0].trim()
    const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '')
    env[key] = value
  }
})

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  realtime: {
    transport: ws
  }
})

async function run() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'mert@suntonmakina.com',
    password: 'Sunton123*'
  })
  
  if (authError) {
    throw new Error("Auth failed: " + authError.message)
  }

  // Fetch leads on 2026-06-22
  const { data: leads, error } = await supabase
    .from('leads')
    .select('*, conversations(*)')
    .eq('is_active', true)

  if (error) throw error

  const leadsOn22 = leads.filter(l => {
    if (l.status_id !== '22222222-0000-0000-0000-000000000020') return false;
    // Check if created_at or first_contact_at or first_contact_date is 2026-06-22
    const d = l.created_at?.split('T')[0] || l.first_contact_at?.split('T')[0] || l.first_contact_date;
    return d === '2026-06-22';
  })

  console.log("Sample lead on 2026-06-22:")
  if (leadsOn22.length > 0) {
    const sample = leadsOn22[0];
    console.log(JSON.stringify({
      id: sample.id,
      created_at: sample.created_at,
      first_contact_at: sample.first_contact_at,
      first_contact_date: sample.first_contact_date,
      status_id: sample.status_id,
      source_id: sample.source_id,
      conversations: sample.conversations
    }, null, 2))
  }

  // Let's count how many of these 171 leads have actual conversations, and when the last message was sent
  let countWithConvs = 0;
  let convDates = {};
  leadsOn22.forEach(l => {
    if (l.conversations && l.conversations.length > 0) {
      countWithConvs++;
      l.conversations.forEach(c => {
        const d = c.last_message_at?.split('T')[0] || c.created_at?.split('T')[0];
        convDates[d] = (convDates[d] || 0) + 1;
      });
    }
  });

  console.log(`Out of ${leadsOn22.length} leads:`)
  console.log(`- Count with conversations: ${countWithConvs}`)
  console.log(`- Conversation last_message_at dates:`, convDates)
}

run().catch(console.error)

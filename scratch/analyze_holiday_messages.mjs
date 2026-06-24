import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import ws from 'ws'

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
  realtime: { transport: ws }
})

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'mert@suntonmakina.com',
    password: 'Sunton123*'
  })

  // Get active conversations that fall in the holiday period (May 23-31, 2026)
  const holidayStart = '2026-05-23T00:00:00+03:00'
  const holidayEnd = '2026-05-31T23:59:59+03:00'

  const { data: convs, error } = await supabase
    .from('conversations')
    .select('id, lead_id, last_message_at')
    .gte('last_message_at', holidayStart)
    .lte('last_message_at', holidayEnd)

  if (error) throw error

  console.log(`Conversations with last_message_at during holiday: ${convs.length}`)

  // For each conversation, fetch its messages and check the direction
  let totalMessagesCount = 0
  let outgoingCount = 0
  let incomingCount = 0
  
  for (const c of convs) {
    const { data: msgs, error: msgsErr } = await supabase
      .from('messages')
      .select('id, direction, content, created_at')
      .eq('conversation_id', c.id)
    
    if (msgsErr) throw msgsErr
    
    totalMessagesCount += msgs.length
    msgs.forEach(m => {
      if (m.direction === 'outgoing') outgoingCount++
      else if (m.direction === 'incoming') incomingCount++
    })
  }

  console.log(`Total messages in these conversations: ${totalMessagesCount}`)
  console.log(`Outgoing (agent) messages: ${outgoingCount}`)
  console.log(`Incoming (customer) messages: ${incomingCount}`)
}

run().catch(console.error)

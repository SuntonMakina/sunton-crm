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

  // Fetch legacy leads
  const { data: leads } = await supabase
    .from('leads')
    .select('id, legacy_lead_id')
    .eq('is_active', true)
    .not('legacy_source_file', 'is', null)

  const rawLeadsMap = new Map(leads ? leads.map(l => [l.id, l]) : [])

  // Fetch conversations
  const { data: convs, error } = await supabase
    .from('conversations')
    .select('*, profiles:assigned_user_id(full_name)')
    .eq('channel', 'whatsapp')
  if (error) throw error

  const activeConversations = convs.filter(c => rawLeadsMap.has(c.lead_id))
  console.log(`Total active legacy conversations: ${activeConversations.length}`)

  const isHoliday = (dateStr) => {
    if (!dateStr) return false
    const d = new Date(dateStr)
    const month = d.getMonth() // 4 = May
    const day = d.getDate()
    return month === 4 && day >= 23 && day <= 31
  }

  const isWeekend = (dateStr) => {
    if (!dateStr) return false
    const d = new Date(dateStr)
    const dayOfWeek = d.getDay()
    return dayOfWeek === 0 || dayOfWeek === 6
  }

  let holidayConvs = 0
  let weekendConvs = 0
  const holidayDetails = []
  const weekendDetails = []

  activeConversations.forEach(c => {
    const dateStr = (c.last_message_at || c.created_at).split('T')[0]
    if (isHoliday(dateStr)) {
      holidayConvs++
      holidayDetails.push({ id: c.id, lead_id: c.lead_id, dateStr, last_message_at: c.last_message_at })
    }
    if (isWeekend(dateStr)) {
      weekendConvs++
      weekendDetails.push({ id: c.id, lead_id: c.lead_id, dateStr, last_message_at: c.last_message_at })
    }
  })

  console.log(`WhatsApp Conversations on Holiday: ${holidayConvs}`)
  console.log(`WhatsApp Conversations on Weekend: ${weekendConvs}`)

  if (holidayDetails.length > 0) {
    console.log("Example holiday conversations:", holidayDetails.slice(0, 10))
  }
  if (weekendDetails.length > 0) {
    console.log("Example weekend conversations:", weekendDetails.slice(0, 10))
  }
}

run().catch(console.error)

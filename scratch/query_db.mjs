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

  const isWhatsAppLead = (l) => {
    return (
      l.source_id === '474b7a22-c53f-43ba-a8bd-75ce0977a798' || 
      l.source_id === '11111111-0000-0000-0000-000000000005' ||
      l.status_id === '22222222-0000-0000-0000-000000000020' ||
      l.lead_sources?.code === 'META_WA'
    ) && l.legacy_source_file === null;
  }

  // Fetch all active leads with calls
  const { data: leads, error } = await supabase
    .from('leads')
    .select('*, lead_sources(code), calls(id)')
    .eq('is_active', true)

  if (error) throw error

  const waLeads = leads.filter(isWhatsAppLead)
  console.log("Total active WhatsApp leads in database:", waLeads.length)

  const queuedWaLeads = waLeads.filter(l => l.next_contact_at !== null || l.callback_status === 'pending')
  console.log("Queued WhatsApp leads (next_contact_at not null or callback_status is pending):", queuedWaLeads.length)

  const calledWaLeads = waLeads.filter(l => l.calls && l.calls.length > 0)
  console.log("WhatsApp leads with logged calls:", calledWaLeads.length)

  const queuedOrCalledWa = waLeads.filter(l => l.next_contact_at !== null || l.callback_status === 'pending' || (l.calls && l.calls.length > 0))
  console.log("WhatsApp leads queued OR called:", queuedOrCalledWa.length)
}

run().catch(console.error)

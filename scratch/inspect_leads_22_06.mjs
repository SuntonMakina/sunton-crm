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

function getLeadDate(lead) {
  if (lead.first_contact_date) {
    return lead.first_contact_date;
  }
  const rawDate = lead.legacy_raw_data?.["İlk Temas Tarihi"];
  if (rawDate) {
    // Parse to YYYY-MM-DD
    const parts = String(rawDate).trim().split('.');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  if (lead.first_contact_at) {
    return lead.first_contact_at.split('T')[0];
  }
  if (lead.created_at) {
    return lead.created_at.split('T')[0];
  }
  return null;
}

async function run() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'mert@suntonmakina.com',
    password: 'Sunton123*'
  })
  
  if (authError) {
    throw new Error("Auth failed: " + authError.message)
  }

  // Fetch all active leads
  const { data: leads, error } = await supabase
    .from('leads')
    .select('*, conversations(*)')
    .eq('is_active', true)

  if (error) throw error

  const newLeads = leads.filter(l => l.legacy_source_file === null)
  console.log("Total new (CRM) leads:", newLeads.length)

  // Group by date and status
  const summary = {}
  newLeads.forEach(l => {
    // Resolve conversation date if it's a raw chat
    let d = getLeadDate(l)
    if (l.status_id === '22222222-0000-0000-0000-000000000020' && l.conversations && l.conversations.length > 0) {
      const conv = l.conversations[0];
      d = (conv.last_message_at || conv.created_at)?.split('T')[0];
    }
    const isRaw = l.status_id === '22222222-0000-0000-0000-000000000020'
    const key = `${d} (${isRaw ? 'Raw Chat' : 'Registered Lead'})`
    summary[key] = (summary[key] || 0) + 1
  })

  console.log("Summary of new (CRM) leads:")
  console.log(Object.entries(summary).sort((a,b) => b[0].localeCompare(a[0])))
}

run().catch(console.error)

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
    .select('*')
    .eq('is_active', true)

  if (error) throw error

  console.log("Total leads:", leads.length)

  // Group by date
  const countsByDate = {}
  leads.forEach(l => {
    const d = getLeadDate(l)
    countsByDate[d] = (countsByDate[d] || 0) + 1
  })

  console.log("Counts by date:")
  console.log(Object.entries(countsByDate).sort((a,b) => b[0].localeCompare(a[0])).slice(0, 10))

  // Inspect leads for 2026-06-22
  const leadsOn22 = leads.filter(l => getLeadDate(l) === '2026-06-22')
  console.log("Number of leads on 2026-06-22:", leadsOn22.length)

  // Status breakdown on 2026-06-22
  const statusCounts = {}
  leadsOn22.forEach(l => {
    statusCounts[l.status_id] = (statusCounts[l.status_id] || 0) + 1
  })
  console.log("Status breakdown on 2026-06-22:", statusCounts)

  // Source breakdown on 2026-06-22
  const sourceCounts = {}
  leadsOn22.forEach(l => {
    sourceCounts[l.source_id] = (sourceCounts[l.source_id] || 0) + 1
  })
  console.log("Source breakdown on 2026-06-22:", sourceCounts)

  // Legacy file flag
  const legacyCounts = { 'legacy': 0, 'new': 0 }
  leadsOn22.forEach(l => {
    if (l.legacy_source_file !== null) {
      legacyCounts.legacy++
    } else {
      legacyCounts.new++
    }
  })
  console.log("Legacy vs new breakdown on 2026-06-22:", legacyCounts)
}

run().catch(console.error)

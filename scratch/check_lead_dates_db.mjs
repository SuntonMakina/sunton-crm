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

function parseRawDateToIso(rawDate) {
  if (!rawDate) return null
  const s = String(rawDate).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s
  }
  const parts = s.split('.')
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
  }
  return null
}

function getLeadDate(lead) {
  if (lead.first_contact_date) {
    return lead.first_contact_date
  }
  const rawDate = lead.legacy_raw_data?.["İlk Temas Tarihi"]
  if (rawDate) {
    return parseRawDateToIso(rawDate)
  }
  return null
}

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'mert@suntonmakina.com',
    password: 'Sunton123*'
  })

  const { data: leads, error } = await supabase
    .from('leads')
    .select('*, lead_sources(code), calls(id)')
    .eq('is_active', true)

  if (error) throw error

  console.log(`Total active leads: ${leads.length}`)

  const legacyOnly = leads.filter(l => l.legacy_source_file !== null)
  console.log(`Legacy only leads: ${legacyOnly.length}`)

  // Let's check May 2026 and June 2026 counts
  let mayCount = 0
  let juneCount = 0
  let otherCount = 0
  let nullCount = 0

  legacyOnly.forEach(l => {
    const date = getLeadDate(l)
    if (!date) {
      nullCount++
    } else if (date.startsWith('2026-05')) {
      mayCount++
    } else if (date.startsWith('2026-06')) {
      juneCount++
    } else {
      otherCount++
    }
  })

  console.log(`May 2026: ${mayCount}`)
  console.log(`June 2026: ${juneCount}`)
  console.log(`Other: ${otherCount}`)
  console.log(`Null date: ${nullCount}`)
}

run().catch(console.error)

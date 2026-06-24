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
  if (s.includes('T')) {
    return s.split('T')[0]
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

  const legacyOnly = leads.filter(l => l.legacy_source_file !== null)
  console.log(`Total active legacy leads in DB: ${legacyOnly.length}`)

  const periods = ['tum_eski', 'bu_ay', 'gecen_ay', 'mayis_2026', 'haziran_2026']

  periods.forEach(periodFilter => {
    let start_date = null
    let end_date = null
    const today = new Date()

    if (periodFilter === 'bu_ay') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      start_date = start.toISOString().split('T')[0]
      end_date = end.toISOString().split('T')[0]
    } else if (periodFilter === 'gecen_ay') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const end = new Date(today.getFullYear(), today.getMonth(), 0)
      start_date = start.toISOString().split('T')[0]
      end_date = end.toISOString().split('T')[0]
    } else if (periodFilter === 'mayis_2026') {
      start_date = '2026-05-01'
      end_date = '2026-05-31'
    } else if (periodFilter === 'haziran_2026') {
      start_date = '2026-06-01'
      end_date = '2026-06-30'
    }

    let filtered = legacyOnly
    if (start_date || end_date) {
      filtered = legacyOnly.filter(lead => {
        const leadDate = getLeadDate(lead)
        if (!leadDate) return false
        if (start_date && leadDate < start_date) return false
        if (end_date && leadDate > end_date) return false
        return true
      })
    }

    console.log(`Period: ${periodFilter} | start_date: ${start_date} | end_date: ${end_date} | count: ${filtered.length}`)
  })
}

run().catch(console.error)

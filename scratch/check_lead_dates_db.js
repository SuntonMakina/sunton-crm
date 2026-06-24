import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'mert@suntonmakina.com',
    password: 'Sunton123*'
  })

  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, first_contact_date, first_contact_at, created_at, legacy_lead_id, legacy_source_file, legacy_raw_data')
    .eq('is_active', true)

  if (error) throw error

  console.log(`Total active leads: ${leads.length}`)

  // Group by date check
  const dateCounts = {}
  let nullDates = 0
  let formatExamples = []

  leads.forEach(l => {
    const date = l.first_contact_date
    const rawDate = l.legacy_raw_data?.["İlk Temas Tarihi"]
    const atDate = l.first_contact_at
    
    if (!date && !rawDate && !atDate) {
      nullDates++
    } else {
      const key = `${date || 'null'}_${rawDate || 'null'}_${atDate ? atDate.split('T')[0] : 'null'}`
      dateCounts[key] = (dateCounts[key] || 0) + 1
      if (formatExamples.length < 20) {
        formatExamples.push({ id: l.legacy_lead_id || l.id, date, rawDate, atDate })
      }
    }
  })

  console.log(`Leads with completely null dates: ${nullDates}`)
  console.log("Format examples (first 20):", formatExamples)
}

run().catch(console.error)

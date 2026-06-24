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

function getLeadChannel(lead) {
  const rawChannel = lead.legacy_raw_data?.["İletişim Kanalı"]
  if (lead.legacy_source_file && rawChannel) {
    const lower = String(rawChannel).toLowerCase()
    if (lower.includes('whatsapp') || lower.includes('wp')) return 'WhatsApp Mesajı'
    if (lower.includes('telefon') || lower.includes('arama') || lower.includes('tel')) return 'Telefon'
    if (lower.includes('eposta') || lower.includes('e-posta') || lower.includes('mail')) return 'E-posta'
    if (lower.includes('instagram') || lower.includes('dm')) return 'Instagram'
    if (lower.includes('facebook') || lower.includes('fb')) return 'Facebook'
    if (lower.includes('web') || lower.includes('site') || lower.includes('form')) return 'Web Sitesi'
    return 'Diğer'
  }
  if (lead.communication_channels?.name) {
    return lead.communication_channels.name
  }
  return 'Belirtilmemiş'
}

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'mert@suntonmakina.com',
    password: 'Sunton123*'
  })

  // 1. Fetch leads
  let query = supabase
    .from('leads')
    .select('*, communication_channels:communication_channel_id(name), lead_sources:source_id(name, code), calls(id)')
    .eq('is_active', true)

  query = query.not('legacy_source_file', 'is', null) // legacy_only

  const { data: rawLeads, error } = await query
  if (error) throw error

  console.log(`Raw leads count: ${rawLeads.length}`)

  // 2. Fetch conversations
  const { data: convData } = await supabase
    .from('conversations')
    .select('*, profiles:assigned_user_id(full_name)')
    .eq('channel', 'whatsapp')
  const rawConversations = convData || []

  // 3. Transform to adaptedLeads
  const adaptedLeads = rawLeads.map(lead => ({
    "Lead ID": lead.legacy_lead_id ?? lead.lead_number ?? lead.id,
    "İlk Temas Tarihi": lead.first_contact_date ?? lead.first_contact_at ?? lead.legacy_raw_data?.["İlk Temas Tarihi"],
    "Ad Soyad / Firma": lead.full_name ?? lead.company_name ?? lead.legacy_raw_data?.["Ad Soyad / Firma"],
    "Telefon Numarası": lead.phone ?? lead.legacy_raw_data?.["Telefon Numarası"],
    "İstenen Makine / Ürün": lead.requested_product ?? lead.legacy_raw_data?.["İstenen Makine / Ürün"],
    "İlk Mesaj / Arama Notu": lead.first_message_note ?? lead.message ?? lead.legacy_raw_data?.["İlk Mesaj / Arama Notu"],
    "Görüşme Özeti / Sonuç": lead.conversation_summary ?? lead.legacy_raw_data?.["Görüşme Özeti / Sonuç"],
    "Ek Notlar": lead.extra_notes ?? lead.legacy_raw_data?.["Ek Notlar"],
    "Sonraki Aksiyon": lead.next_action ?? lead.legacy_raw_data?.["Sonraki Aksiyon"],
    "Satış Uzmanı": lead.legacy_sales_specialist_name ?? lead.sales_representative_text ?? lead.legacy_raw_data?.["Satış Uzmanı"],
    rawLead: lead
  }))

  const rawLeadsMap = new Map(rawLeads ? rawLeads.map(l => [l.id, l]) : [])
  const activeConversations = rawConversations.filter(c => {
    const lead = rawLeadsMap.get(c.lead_id)
    if (!lead) return false
    return true
  })

  const virtualCalls = activeConversations.map(c => ({
    id: `conv-${c.id}`,
    created_at: c.last_message_at || c.created_at,
    notes: 'WhatsApp Görüşmesi',
    lead_id: c.lead_id,
    user_id: c.assigned_user_id,
    channel: 'whatsapp'
  }))

  // Map legacy calls from adaptedLeads
  const legacyCalls = adaptedLeads
    .filter(l => l.rawLead.legacy_source_file !== null && l.rawLead.conversation_completed !== null)
    .map(l => ({
      id: `legacy-${l.rawLead.id}`,
      created_at: l.rawLead.first_contact_date || l.rawLead.first_contact_at,
      notes: l.rawLead.conversation_summary,
      lead_id: l.rawLead.id
    }))

  const combinedCalls = [...virtualCalls, ...legacyCalls]
  console.log(`Virtual calls: ${virtualCalls.length}`)
  console.log(`Legacy calls: ${legacyCalls.length}`)
  console.log(`Combined calls: ${combinedCalls.length}`)

  // Wait, let's print all values of l.rawLead.conversation_completed for legacy leads
  const compValues = {}
  rawLeads.forEach(l => {
    const val = l.conversation_completed
    compValues[val] = (compValues[val] || 0) + 1
  })
  console.log("Values of conversation_completed in rawLeads:", compValues)
}

run().catch(console.error)

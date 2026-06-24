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

// Mock functions from app/dashboard/statistics/page.tsx
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

function getLeadDate(lead) {
  if (lead.first_contact_date) {
    return lead.first_contact_date
  }
  const rawDate = lead.legacy_raw_data?.["İlk Temas Tarihi"]
  if (rawDate) {
    // simple parse
    if (rawDate.includes('.')) {
      const p = rawDate.split('.')
      if (p.length === 3) return `${p[2]}-${p[1]}-${p[0]}`
    }
    return rawDate.split('T')[0]
  }
  return null
}

async function run() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'mert@suntonmakina.com',
    password: 'Sunton123*'
  })
  
  if (authError) {
    throw new Error("Auth failed: " + authError.message)
  }

  const start_date = null
  const end_date = null
  const scopeFilter = 'all_leads'
  const channelFilter = 'all_channels'

  console.log(`=== Simulating fetchStatsData (scope: ${scopeFilter}, channel: ${channelFilter}) ===`)

  // Query calls matching active date filter
  let callsQuery = supabase
    .from('calls')
    .select('*, profiles:user_id(full_name)')
  
  const { data: cData, error: cErr } = await callsQuery
  const activeCalls = (!cErr && cData) ? cData : []
  console.log("Fetched active calls from table:", activeCalls.length)

  // Query conversations
  let convQuery = supabase
    .from('conversations')
    .select('*, profiles:assigned_user_id(full_name)')
    .eq('channel', 'whatsapp')
  
  const { data: convData, error: convErr } = await convQuery
  const rawConversations = (!convErr && convData) ? convData : []
  console.log("Fetched raw conversations from table:", rawConversations.length)

  // Fetch leads
  let query = supabase
    .from('leads')
    .select('*, communication_channels:communication_channel_id(name), lead_sources:source_id(name, code), calls(id)')
    .eq('is_active', true)

  if (scopeFilter === 'legacy_only') {
    query = query.not('legacy_source_file', 'is', null)
  }

  const { data: rawLeads, error } = await query
  if (error) throw error
  console.log("Fetched raw active leads:", rawLeads.length)

  // Transform to adaptedLeads
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

  // Filter conversations by rawLeads (respecting queue status)
  const rawLeadsMap = new Map(rawLeads ? rawLeads.map(l => [l.id, l]) : [])
  const activeConversations = rawConversations.filter(c => {
    const lead = rawLeadsMap.get(c.lead_id)
    if (!lead) return false
    
    // For WhatsApp leads, only count them if they are queued or called
    const isWa = (
      lead.source_id === '474b7a22-c53f-43ba-a8bd-75ce0977a798' || 
      lead.source_id === '11111111-0000-0000-0000-000000000005' ||
      lead.status_id === '22222222-0000-0000-0000-000000000020' ||
      lead.lead_sources?.code === 'META_WA'
    ) && lead.legacy_source_file === null;

    if (isWa) {
      const hasCalls = lead.calls && lead.calls.length > 0;
      const isQueued = lead.next_contact_at !== null || lead.callback_status === 'pending';
      return isQueued || hasCalls;
    }
    return true
  })
  console.log("Active conversations after queue/call filter:", activeConversations.length)

  // Transform conversations to virtual calls
  const virtualCalls = activeConversations.map(c => ({
    id: `conv-${c.id}`,
    created_at: c.last_message_at || c.created_at,
    notes: 'WhatsApp Görüşmesi',
    profiles: {
      full_name: c.profiles?.full_name || 'Bilinmeyen Temsilci'
    },
    lead_id: c.lead_id,
    user_id: c.assigned_user_id,
    channel: 'whatsapp'
  }))

  // Apply channel filter
  let filteredActiveCalls = activeCalls
  let filteredVirtualCalls = virtualCalls

  if (channelFilter === 'WhatsApp Mesajı') {
    filteredActiveCalls = []
  } else if (channelFilter === 'Telefon') {
    filteredVirtualCalls = []
  } else if (channelFilter !== 'all_channels') {
    filteredActiveCalls = []
    filteredVirtualCalls = []
  }

  // Map legacy calls from adaptedLeads
  const legacyCalls = adaptedLeads
    .filter(l => l.rawLead.legacy_source_file !== null && l.rawLead.conversation_completed !== null)
    .map(l => ({
      id: `legacy-${l.rawLead.id}`,
      created_at: l.rawLead.first_contact_date || l.rawLead.first_contact_at,
      notes: l.rawLead.conversation_summary,
      profiles: {
        full_name: 'Geçmiş Aktarım'
      },
      lead_id: l.rawLead.id
    }))
  console.log("Legacy completed calls:", legacyCalls.length)

  const combinedCalls = [...filteredActiveCalls, ...filteredVirtualCalls, ...legacyCalls]
  console.log("Combined calls/conversations count:", combinedCalls.length)

  // Group by representative
  const callerGroups = {}
  combinedCalls.forEach(call => {
    const callerName = call.profiles?.full_name || 'Bilinmeyen Temsilci'
    callerGroups[callerName] = (callerGroups[callerName] || 0) + 1
  })
  console.log("Caller performance breakdown:", callerGroups)
}

run().catch(console.error)

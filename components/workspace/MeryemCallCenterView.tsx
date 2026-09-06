'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/crm'
import {
  Phone,
  PhoneCall,
  PhoneMissed,
  PhoneOff,
  User,
  MapPin,
  Building,
  Clock,
  Search,
  CheckCircle,
  RefreshCw,
  Copy,
  Check,
  Send,
  Sparkles,
  Calendar,
  X
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { getProgressiveCallSchedule } from '@/lib/utils'

interface MeryemCallCenterViewProps {
  profile: Profile
}

type TabType = 'toCall' | 'followups' | 'forwarded' | 'calledToday' | 'all'

export default function MeryemCallCenterView({ profile }: MeryemCallCenterViewProps) {
  const supabase = createClient()

  // Data states
  const [leads, setLeads] = useState<any[]>([])
  const [callsToday, setCallsToday] = useState<any[]>([])
  const [salesReps, setSalesReps] = useState<any[]>([])
  const [outcomes, setOutcomes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filter & Search states
  const [activeTab, setActiveTab] = useState<TabType>('toCall')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProvince, setSelectedProvince] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'queue' | 'newest' | 'company'>('queue')

  // Calling & Modal states
  const [selectedLead, setSelectedLead] = useState<any>(null)
  const [actionModalOpen, setActionModalOpen] = useState(false)
  const [savingAction, setSavingAction] = useState(false)
  const [actionType, setActionType] = useState<'reached' | 'missed' | 'forward' | 'uninterested'>('reached')

  // Form states inside modal
  const [reachedNote, setReachedNote] = useState('')
  const [reachedOutcomeId, setReachedOutcomeId] = useState('')
  const [needsCallback, setNeedsCallback] = useState(false)
  const [callbackDate, setCallbackDate] = useState('')
  const [callbackTime, setCallbackTime] = useState('10:00')

  const [selectedSalesUserId, setSelectedSalesUserId] = useState('')
  const [forwardNote, setForwardNote] = useState('')
  const [copiedForwardText, setCopiedForwardText] = useState(false)

  const [uninterestedReason, setUninterestedReason] = useState('')

  // Copy phone notification toast
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null)

  // Fetch initial data
  useEffect(() => {
    fetchData()
  }, [profile.id])

  const fetchData = async () => {
    setLoading(true)
    try {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      // 1. Fetch leads assigned to Meryem
      const { data: leadsData, error: leadsErr } = await supabase
        .from('leads')
        .select(`
          *,
          lead_statuses(name, color),
          lead_sources(name, code),
          calls(id, status, notes, created_at, outcome_id),
          assigned_sales:profiles!leads_assigned_sales_user_id_fkey(id, full_name, email)
        `)
        .eq('assigned_call_center_user_id', profile.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (leadsErr) throw leadsErr
      setLeads(leadsData || [])

      // 2. Fetch calls logged today by Meryem
      const { data: userCalls, error: callsErr } = await supabase
        .from('calls')
        .select('*')
        .eq('user_id', profile.id)
        .gte('created_at', todayStart.toISOString())

      if (callsErr) throw callsErr
      setCallsToday(userCalls || [])

      // 3. Fetch sales specialists for forwarding
      const { data: repsData, error: repsErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('role', 'sales_specialist')
        .eq('is_active', true)
        .order('full_name', { ascending: true })

      if (repsErr) throw repsErr
      setSalesReps(repsData || [])

      // 4. Fetch call outcomes
      const { data: outcomesData, error: outErr } = await supabase
        .from('call_outcomes')
        .select('*')
        .order('name', { ascending: true })

      if (outErr) throw outErr
      setOutcomes(outcomesData || [])
    } catch (err: any) {
      console.error('Error fetching Meryem workspace data:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
  }

  // Get distinct provinces
  const provincesList = useMemo(() => {
    const set = new Set<string>()
    leads.forEach((l) => {
      if (l.province && l.province.trim()) {
        set.add(l.province.trim())
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'))
  }, [leads])

  // Categorize leads
  const {
    toCallLeads,
    followupLeads,
    forwardedLeads,
    calledTodayLeads,
    allLeads
  } = useMemo(() => {
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    const todayEndISO = today.toISOString()

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayStartISO = todayStart.toISOString()

    // 1. Forwarded to sales
    const forwarded = leads.filter(
      (l) =>
        l.status_id === '22222222-0000-0000-0000-000000000009' ||
        !!l.forwarded_to_sales_at ||
        !!l.assigned_sales_user_id
    )

    // 2. Uninterested or lost
    const uninterestedIds = [
      '22222222-0000-0000-0000-000000000012', // İlgilenmiyor
      '22222222-0000-0000-0000-000000000013', // Geçersiz
      '22222222-0000-0000-0000-000000000015', // Kara Liste
      '2a863b5c-e571-4153-9342-6e894f5bb2da'  // Olumsuz
    ]

    // 3. Called today (had a call or contact today)
    const calledToday = leads.filter((l) => {
      const calledInList = (l.calls || []).some((c: any) => c.created_at >= todayStartISO)
      const contactToday = l.last_contact_at && l.last_contact_at >= todayStartISO
      return calledInList || contactToday
    })

    // 4. Follow-ups pending (2., 3., 4. call scheduled or callback scheduled)
    const followups = leads.filter((l) => {
      if (forwarded.some((f) => f.id === l.id)) return false
      if (uninterestedIds.includes(l.status_id)) return false
      const hasCalls = (l.calls || []).length > 0
      const isCallbackPending = l.callback_status === 'pending' || (l.next_contact_at && l.next_contact_at > todayEndISO)
      return hasCalls && (isCallbackPending || (l.calls || []).length < 4)
    })

    // 5. To call today (Queue):
    // - New leads never contacted
    // - Follow-ups due today or overdue
    const toCall = leads.filter((l) => {
      if (forwarded.some((f) => f.id === l.id)) return false
      if (uninterestedIds.includes(l.status_id)) return false

      const callCount = (l.calls || []).length
      if (callCount >= 4 && l.status_id === '22222222-0000-0000-0000-000000000005') {
        // Max limit reached on missed calls
        return false
      }

      // If scheduled, check if due today or past
      if (l.next_contact_at) {
        return l.next_contact_at <= todayEndISO
      }

      // If never called and not forwarded/closed, it is in queue
      if (!l.last_contact_at && callCount === 0) {
        return true
      }

      // If called previously but not scheduled for future day
      return true
    })

    return {
      toCallLeads: toCall,
      followupLeads: followups,
      forwardedLeads: forwarded,
      calledTodayLeads: calledToday,
      allLeads: leads
    }
  }, [leads])

  // Filter current active list by search and province
  const currentList = useMemo(() => {
    let list: any[] = []
    if (activeTab === 'toCall') list = toCallLeads
    else if (activeTab === 'followups') list = followupLeads
    else if (activeTab === 'forwarded') list = forwardedLeads
    else if (activeTab === 'calledToday') list = calledTodayLeads
    else list = allLeads

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter((l) => {
        const name = `${l.first_name || ''} ${l.last_name || ''}`.toLowerCase()
        const company = (l.company_name || '').toLowerCase()
        const phone = (l.phone || '').toLowerCase()
        const prov = (l.province || '').toLowerCase()
        const msg = (l.message || '').toLowerCase()
        const extra = (l.extra_notes || '').toLowerCase()
        return (
          name.includes(q) ||
          company.includes(q) ||
          phone.includes(q) ||
          prov.includes(q) ||
          msg.includes(q) ||
          extra.includes(q)
        )
      })
    }

    // Apply province filter
    if (selectedProvince !== 'all') {
      list = list.filter((l) => l.province === selectedProvince)
    }

    // Apply sorting
    return [...list].sort((a, b) => {
      if (sortBy === 'company') {
        return (a.company_name || a.first_name || '').localeCompare(
          b.company_name || b.first_name || '',
          'tr'
        )
      }
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      // 'queue' sort: scheduled time ascending (earliest first), then new leads
      if (a.next_contact_at && b.next_contact_at) {
        return new Date(a.next_contact_at).getTime() - new Date(b.next_contact_at).getTime()
      }
      if (a.next_contact_at) return -1
      if (b.next_contact_at) return 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [activeTab, toCallLeads, followupLeads, forwardedLeads, calledTodayLeads, allLeads, searchQuery, selectedProvince, sortBy])

  // Open action modal for a lead
  const handleOpenAction = (lead: any, defaultType: 'reached' | 'missed' | 'forward' | 'uninterested' = 'reached') => {
    setSelectedLead(lead)
    setActionType(defaultType)
    setReachedNote('')
    setReachedOutcomeId(outcomes[0]?.id || '')
    setNeedsCallback(false)
    setCallbackDate('')
    setCallbackTime('10:00')
    setForwardNote('')
    setSelectedSalesUserId(lead.assigned_sales_user_id || salesReps[0]?.id || '')
    setUninterestedReason('')
    setCopiedForwardText(false)
    setActionModalOpen(true)
  }

  // Copy phone number helper
  const handleCopyPhone = (lead: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (lead.phone) {
      navigator.clipboard.writeText(lead.phone)
      setCopiedPhoneId(lead.id)
      setTimeout(() => setCopiedPhoneId(null), 2000)
    }
  }

  // Generate formatted forwarding text for WhatsApp / note
  const getFormattedForwardText = (lead: any, customNote?: string) => {
    if (!lead) return ''
    const id = lead.lead_number ? `#${lead.lead_number}` : `#${lead.id.substring(0, 6)}`
    const company = lead.company_name || '-'
    const name = `${lead.first_name || ''} ${lead.last_name && lead.last_name !== '-' ? lead.last_name : ''}`.trim() || '-'
    const phone = lead.phone || '-'
    const location = [lead.province, lead.district].filter(Boolean).join(' / ') || 'Belirtilmedi'
    const product = lead.requested_product || 'Fiber Lazer / Makine'
    const note = customNote ? ` - Not: ${customNote.trim()}` : ''

    return `${id} | ${company} | Yetkili: ${name} | Tel: ${phone} | Konum: ${location} | Talep: ${product}${note}`
  }

  // Copy forward text to clipboard
  const handleCopyForwardText = () => {
    if (!selectedLead) return
    const text = getFormattedForwardText(selectedLead, forwardNote)
    navigator.clipboard.writeText(text)
    setCopiedForwardText(true)
    setTimeout(() => setCopiedForwardText(false), 2500)
  }

  // Submit Call Action
  const handleSubmitAction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLead || !profile) return

    setSavingAction(true)
    try {
      const now = new Date()
      const nowStr = now.toISOString()
      const currentCallCount = (selectedLead.calls || []).length

      let updatedStatusId = selectedLead.status_id
      let nextContactAt: string | null = null
      let callbackStatus = 'none'
      let callNotes = ''
      let callStatus = 'completed'
      let callOutcomeId = reachedOutcomeId || null
      let assignedSalesId = selectedLead.assigned_sales_user_id || null
      let salesRepText = selectedLead.sales_representative_text || null
      let forwardedAt = selectedLead.forwarded_to_sales_at || null

      let extraNotes = selectedLead.extra_notes || ''

      // 1. CASE: REACHED (Ulaşıldı / Görüştüm)
      if (actionType === 'reached') {
        updatedStatusId = '22222222-0000-0000-0000-000000000007' // Görüşme Yapıldı
        callStatus = 'completed'
        callNotes = reachedNote.trim() ? `Görüşüldü: ${reachedNote.trim()}` : 'Müşteriyle görüşme yapıldı'

        if (needsCallback && callbackDate) {
          const targetDate = new Date(`${callbackDate}T${callbackTime || '10:00'}:00`)
          nextContactAt = targetDate.toISOString()
          callbackStatus = 'pending'
          updatedStatusId = '22222222-0000-0000-0000-000000000006' // Geri Aranacak
          callNotes += ` (Geri arama planlandı: ${targetDate.toLocaleDateString('tr-TR')} ${callbackTime})`
        }

        const timeStr = now.toLocaleString('tr-TR')
        extraNotes = `[${timeStr}] - ${callNotes}\n` + extraNotes

      // 2. CASE: MISSED / NO ANSWER (Açmadı / Ulaşılamadı - Otomatik Kademeli Planlama)
      } else if (actionType === 'missed') {
        callStatus = 'missed'
        updatedStatusId = '22222222-0000-0000-0000-000000000005' // Ulaşılamadı

        // Progressive schedule calculation:
        // 0 past calls -> 1st missed -> 2h later 2nd call
        // 1 past call  -> 2nd missed -> next business day 3rd call
        // 2 past calls -> 3rd missed -> 48h later 4th call
        // 3+ past calls -> 4th missed -> max limit
        const progressive = getProgressiveCallSchedule(currentCallCount, now)
        nextContactAt = progressive.nextContactAt
        callbackStatus = progressive.callbackStatus

        const missedOutcome = outcomes.find(
          (o) => o.name.toLowerCase().includes('ulaşılmadı') || o.name.toLowerCase().includes('cevap vermedi') || o.name.toLowerCase().includes('açmadı')
        )
        callOutcomeId = missedOutcome?.id || null
        callNotes = `Cevap Vermedi / Açmadı${progressive.attemptInfo}`

        const timeStr = now.toLocaleString('tr-TR')
        extraNotes = `[${timeStr}] - ${callNotes}\n` + extraNotes

      // 3. CASE: FORWARD TO SALES REP (Satış Uzmanına İlet)
      } else if (actionType === 'forward') {
        if (!selectedSalesUserId) {
          alert('Lütfen yönlendirilecek Satış Uzmanını seçin.')
          setSavingAction(false)
          return
        }

        const selectedRep = salesReps.find((r) => r.id === selectedSalesUserId)
        salesRepText = selectedRep ? selectedRep.full_name : null
        assignedSalesId = selectedSalesUserId
        forwardedAt = nowStr
        updatedStatusId = '22222222-0000-0000-0000-000000000009' // Satış Uzmanına İletildi
        nextContactAt = null
        callbackStatus = 'none'

        const forwardOutcome = outcomes.find((o) => o.name.toLowerCase().includes('satış'))
        callOutcomeId = forwardOutcome?.id || null
        callNotes = `Satış Uzmanına (${salesRepText || 'Satış'}) Yönlendirildi.` + (forwardNote.trim() ? ` Not: ${forwardNote.trim()}` : '')

        const timeStr = now.toLocaleString('tr-TR')
        extraNotes = `[${timeStr}] - [Satışa İletildi - ${salesRepText}] ${forwardNote.trim()}\n` + extraNotes

        // Create Supabase notification for the sales specialist (fail-safe)
        try {
          await supabase.from('notifications').insert({
            user_id: selectedSalesUserId,
            type: 'assigned_lead',
            title: 'Yeni Müşteri Yönlendirildi (Meryem)',
            message: `Meryem, ${selectedLead.company_name || selectedLead.first_name} isimli müşteriyi size yönlendirdi.${forwardNote.trim() ? ' Not: ' + forwardNote.trim() : ''}`,
            entity_type: 'lead',
            entity_id: selectedLead.id
          })
        } catch (notifErr) {
          console.warn('Notification insert skipped or handled by trigger:', notifErr)
        }

        // Create activity record
        try {
          await supabase.from('activities').insert({
            entity_type: 'lead',
            entity_id: selectedLead.id,
            activity_type: 'forwarded_to_sales',
            title: 'Satış Uzmanına Yönlendirildi',
            description: `Müşteri, ${salesRepText || 'Satış Danışmanı'} uzmanına iletildi. Not: ${forwardNote.trim() || '-'}`,
            user_id: profile.id
          })
        } catch (actErr) {
          console.warn('Activity insert error:', actErr)
        }

      // 4. CASE: UNINTERESTED / NEGATIVE (İlgilenmiyor / Olumsuz)
      } else if (actionType === 'uninterested') {
        updatedStatusId = '22222222-0000-0000-0000-000000000012' // İlgilenmiyor
        nextContactAt = null
        callbackStatus = 'none'

        const unintOutcome = outcomes.find((o) => o.name.toLowerCase().includes('ilgilenmiyor') || o.name.toLowerCase().includes('olumsuz'))
        callOutcomeId = unintOutcome?.id || null
        callNotes = `İlgilenmiyor / Olumsuz.` + (uninterestedReason.trim() ? ` Neden: ${uninterestedReason.trim()}` : '')

        const timeStr = now.toLocaleString('tr-TR')
        extraNotes = `[${timeStr}] - ${callNotes}\n` + extraNotes
      }

      // Update the Lead record
      const { error: updateErr } = await supabase
        .from('leads')
        .update({
          status_id: updatedStatusId,
          last_contact_at: nowStr,
          next_contact_at: nextContactAt,
          callback_status: callbackStatus,
          assigned_sales_user_id: assignedSalesId,
          sales_representative_text: salesRepText,
          forwarded_to_sales_at: forwardedAt,
          lead_quality_category: actionType === 'forward' ? 'potential' : selectedLead.lead_quality_category,
          extra_notes: extraNotes
        })
        .eq('id', selectedLead.id)

      if (updateErr) throw updateErr

      // Insert Call record
      const { error: callErr } = await supabase.from('calls').insert({
        lead_id: selectedLead.id,
        user_id: profile.id,
        direction: 'outgoing',
        phone_number: selectedLead.phone,
        outcome_id: callOutcomeId,
        notes: callNotes,
        duration_seconds: actionType === 'missed' ? 0 : 60,
        status: callStatus
      })

      if (callErr) console.error('Call log error:', callErr)

      // Close modal and refresh
      setActionModalOpen(false)
      setSelectedLead(null)
      fetchData()
    } catch (err: any) {
      console.error('Error saving action:', err)
      alert('İşlem kaydedilirken bir hata oluştu: ' + err.message)
    } finally {
      setSavingAction(false)
    }
  }

  // Progressive badge component
  const getCallBadge = (lead: any) => {
    const callCount = (lead.calls || []).length
    const isForwarded = lead.status_id === '22222222-0000-0000-0000-000000000009' || !!lead.forwarded_to_sales_at
    const isUninterested = lead.status_id === '22222222-0000-0000-0000-000000000012'

    if (isForwarded) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
          <Send className="h-3 w-3" />
          Satışa İletildi {lead.sales_representative_text ? `(${lead.sales_representative_text})` : ''}
        </span>
      )
    }

    if (isUninterested) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-500 border border-zinc-500/20">
          <PhoneOff className="h-3 w-3" />
          İlgilenmiyor
        </span>
      )
    }

    if (lead.callback_status === 'pending' && lead.next_contact_at) {
      const d = new Date(lead.next_contact_at)
      const dateStr = d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })
      const timeStr = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
          <Calendar className="h-3 w-3" />
          Randevu: {dateStr} {timeStr}
        </span>
      )
    }

    if (callCount === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
          <Sparkles className="h-3 w-3" />
          1. Arama Bekliyor
        </span>
      )
    }

    if (callCount === 1) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-500/10 text-orange-600 border border-orange-500/20">
          <PhoneMissed className="h-3 w-3" />
          2. Arama Aşaması (1 Cevapsız)
        </span>
      )
    }

    if (callCount === 2) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 border border-purple-500/20">
          <PhoneMissed className="h-3 w-3" />
          3. Arama Aşaması (2 Cevapsız)
        </span>
      )
    }

    if (callCount === 3) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
          <PhoneMissed className="h-3 w-3" />
          4. Arama Aşaması (Son Hak)
        </span>
      )
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-500/10 text-zinc-600 border border-zinc-500/20">
        <PhoneCall className="h-3 w-3" />
        {callCount}. Arama Yapıldı
      </span>
    )
  }

  return (
    <div className="space-y-5 select-none pb-12 max-w-7xl mx-auto">
      
      {/* 1. TOP STATS BAR */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        
        {/* Arama Kuyruğu */}
        <div
          onClick={() => setActiveTab('toCall')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'toCall'
              ? 'bg-primary/10 border-primary shadow-sm ring-2 ring-primary/20'
              : 'bg-card border-border hover:border-primary/50'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">Bugün Aranacaklar</span>
            <PhoneCall className={`h-4 w-4 ${activeTab === 'toCall' ? 'text-primary' : ''}`} />
          </div>
          <div className="text-2xl font-black text-foreground">{toCallLeads.length}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Sıradaki aramalar</p>
        </div>

        {/* Kademeli Takipler */}
        <div
          onClick={() => setActiveTab('followups')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'followups'
              ? 'bg-amber-500/10 border-amber-500 shadow-sm ring-2 ring-amber-500/20'
              : 'bg-card border-border hover:border-amber-500/50'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">Takipler & Randevular</span>
            <Clock className={`h-4 w-4 ${activeTab === 'followups' ? 'text-amber-500' : ''}`} />
          </div>
          <div className="text-2xl font-black text-amber-500">{followupLeads.length}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">2., 3., 4. Arama takipleri</p>
        </div>

        {/* Satışa İletilenler */}
        <div
          onClick={() => setActiveTab('forwarded')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'forwarded'
              ? 'bg-emerald-500/10 border-emerald-500 shadow-sm ring-2 ring-emerald-500/20'
              : 'bg-card border-border hover:border-emerald-500/50'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">Satışa İletilenler</span>
            <Send className={`h-4 w-4 ${activeTab === 'forwarded' ? 'text-emerald-500' : ''}`} />
          </div>
          <div className="text-2xl font-black text-emerald-500">{forwardedLeads.length}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Başarıyla yönlendirilen</p>
        </div>

        {/* Bugün Arananlar */}
        <div
          onClick={() => setActiveTab('calledToday')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'calledToday'
              ? 'bg-blue-500/10 border-blue-500 shadow-sm ring-2 ring-blue-500/20'
              : 'bg-card border-border hover:border-blue-500/50'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">Bugün Aranan</span>
            <CheckCircle className={`h-4 w-4 ${activeTab === 'calledToday' ? 'text-blue-500' : ''}`} />
          </div>
          <div className="text-2xl font-black text-blue-500">{callsToday.length}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Bugün tamamlanan arama</p>
        </div>

        {/* Toplam Script */}
        <div
          onClick={() => setActiveTab('all')}
          className={`col-span-2 md:col-span-1 p-4 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'all'
              ? 'bg-purple-500/10 border-purple-500 shadow-sm ring-2 ring-purple-500/20'
              : 'bg-card border-border hover:border-purple-500/50'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">Toplam Script</span>
            <Building className={`h-4 w-4 ${activeTab === 'all' ? 'text-purple-500' : ''}`} />
          </div>
          <div className="text-2xl font-black text-purple-500">{allLeads.length}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Atanan toplam havuz</p>
        </div>

      </div>

      {/* 2. SEARCH & FILTER CONTROLS */}
      <div className="bg-card border border-border p-3.5 rounded-xl shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Search box */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Firma adı, yetkili, telefon, il veya not ara..."
              className="w-full pl-9 pr-8 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filter options */}
          <div className="flex items-center gap-2.5 w-full md:w-auto overflow-x-auto">
            
            {/* Province selector */}
            <select
              value={selectedProvince}
              onChange={(e) => setSelectedProvince(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="all">Tüm Şehirler ({leads.length})</option>
              {provincesList.map((prov) => (
                <option key={prov} value={prov}>
                  {prov}
                </option>
              ))}
            </select>

            {/* Sort selector */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="queue">Sıralama: Arama Önceliği</option>
              <option value="newest">Sıralama: En Yeni Atananlar</option>
              <option value="company">Sıralama: Firma Adı (A-Z)</option>
            </select>

            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3 py-2 bg-accent hover:bg-accent/80 text-foreground border border-border rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Yenile"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Yenile</span>
            </button>
          </div>
        </div>

        {/* Tab pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-border">
          <button
            onClick={() => setActiveTab('toCall')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'toCall'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            <PhoneCall className="h-3.5 w-3.5" />
            Bugün Aranacaklar ({toCallLeads.length})
          </button>

          <button
            onClick={() => setActiveTab('followups')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'followups'
                ? 'bg-amber-500 text-white'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Kademeli Takipler ({followupLeads.length})
          </button>

          <button
            onClick={() => setActiveTab('forwarded')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'forwarded'
                ? 'bg-emerald-600 text-white'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            <Send className="h-3.5 w-3.5" />
            Satışa İletilenler ({forwardedLeads.length})
          </button>

          <button
            onClick={() => setActiveTab('calledToday')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'calledToday'
                ? 'bg-blue-600 text-white'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Bugün Arananlar ({calledTodayLeads.length})
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-purple-600 text-white'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            <Building className="h-3.5 w-3.5" />
            Tüm Scriptler ({allLeads.length})
          </button>
        </div>
      </div>

      {/* 3. LEADS LIST VIEW */}
      {loading ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border">
          <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm font-semibold text-muted-foreground">Scriptler ve aramalar yükleniyor...</p>
        </div>
      ) : currentList.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border p-8">
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-foreground">Bu listede kayıt bulunmuyor</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {activeTab === 'toCall'
              ? 'Tebrikler! Bugün aranacak tüm aramaları tamamladınız.'
              : 'Seçili filtre ve kriterlere uygun müşteri kaydı bulunamadı.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {currentList.map((lead) => {
            const callCount = (lead.calls || []).length
            const isForwarded = lead.status_id === '22222222-0000-0000-0000-000000000009' || !!lead.forwarded_to_sales_at
            const isCopied = copiedPhoneId === lead.id

            return (
              <div
                key={lead.id}
                className={`bg-card border rounded-2xl p-4.5 transition-all shadow-xs hover:shadow-md ${
                  isForwarded
                    ? 'border-emerald-500/30 bg-emerald-500/[0.02]'
                    : lead.callback_status === 'pending'
                    ? 'border-blue-500/30'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  
                  {/* Left: Company & Contact Information */}
                  <div className="flex-1 space-y-2">
                    
                    {/* Header: Name, ID, Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {lead.lead_number ? `#${lead.lead_number}` : `#${lead.id.substring(0, 6)}`}
                      </span>

                      <h3 className="text-base font-bold text-foreground hover:text-primary transition-colors">
                        {lead.company_name || lead.first_name || 'İsimsiz Firma'}
                      </h3>

                      {getCallBadge(lead)}

                      {lead.province && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-accent text-accent-foreground">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {lead.province} {lead.district ? `/${lead.district}` : ''}
                        </span>
                      )}
                    </div>

                    {/* Middle: Phone number & Quick Contact */}
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      
                      {/* Click-to-call Phone link */}
                      <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-lg border border-primary/20">
                        <Phone className="h-3.5 w-3.5" />
                        <a
                          href={`tel:${lead.phone}`}
                          className="font-bold tracking-wider hover:underline"
                        >
                          {lead.phone || 'Numara Yok'}
                        </a>
                        <button
                          type="button"
                          onClick={(e) => handleCopyPhone(lead, e)}
                          className="ml-1 text-primary/70 hover:text-primary transition-colors cursor-pointer"
                          title="Telefonu Kopyala"
                        >
                          {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>

                      {/* Contact Person */}
                      {lead.first_name && lead.first_name !== lead.company_name && (
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          Yetkili: <strong className="text-foreground">{lead.first_name} {lead.last_name !== '-' ? lead.last_name : ''}</strong>
                        </span>
                      )}

                      {/* Call Attempt Count */}
                      <span className="text-xs text-muted-foreground">
                        Toplam Arama: <strong className="text-foreground">{callCount} kez</strong>
                      </span>

                      {/* Last Contact time */}
                      {lead.last_contact_at && (
                        <span className="text-xs text-muted-foreground">
                          Son İletişim: <strong className="text-foreground">{new Date(lead.last_contact_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</strong>
                        </span>
                      )}
                    </div>

                    {/* Script Details / Activity Description */}
                    {lead.message && (
                      <div className="text-xs bg-muted/40 border border-border/60 rounded-lg p-2.5 text-foreground leading-relaxed font-sans max-h-24 overflow-y-auto">
                        <span className="font-bold text-muted-foreground text-[10px] block uppercase tracking-wider mb-0.5">Script Bilgisi / Faaliyet:</span>
                        <div className="whitespace-pre-line text-muted-foreground/90">{lead.message}</div>
                      </div>
                    )}

                    {/* Previous Call / Handover Notes */}
                    {lead.extra_notes && (
                      <div className="text-[11px] bg-amber-500/5 border border-amber-500/20 rounded-lg p-2 text-foreground max-h-20 overflow-y-auto">
                        <span className="font-bold text-amber-600 text-[10px] block uppercase tracking-wider mb-0.5">Arama Geçmişi Notları:</span>
                        <div className="whitespace-pre-line text-muted-foreground font-mono">{lead.extra_notes}</div>
                      </div>
                    )}

                  </div>

                  {/* Right: Action Buttons */}
                  <div className="flex flex-row lg:flex-col items-center gap-2 w-full lg:w-48 shrink-0 justify-end">
                    
                    {/* Primary Button: Open Calling Result Modal */}
                    <button
                      onClick={() => handleOpenAction(lead, 'reached')}
                      className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-md shadow-primary/20 hover:bg-primary/90 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <PhoneCall className="h-4 w-4" />
                      Arama Kaydet
                    </button>

                    {/* Fast Action 1: Missed (1-click trigger) */}
                    <button
                      onClick={() => handleOpenAction(lead, 'missed')}
                      className="w-full py-1.5 px-3 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 border border-orange-500/20 font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                    >
                      <PhoneMissed className="h-3.5 w-3.5" />
                      Açmadı
                    </button>

                    {/* Fast Action 2: Forward to Sales */}
                    <button
                      onClick={() => handleOpenAction(lead, 'forward')}
                      className="w-full py-1.5 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/20 font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Satışa İlet
                    </button>

                  </div>

                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 4. CALLING & OUTCOME RECORD DIALOG MODAL */}
      <Dialog.Root open={actionModalOpen} onOpenChange={setActionModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 animate-in fade-in" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-2xl shadow-2xl z-50 w-full max-w-xl p-6 overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            
            {selectedLead && (
              <form onSubmit={handleSubmitAction} className="space-y-4">
                
                {/* Modal Header */}
                <div className="flex items-start justify-between border-b border-border pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Çağrı Merkezi İşlem Konsolu</span>
                    <Dialog.Title className="text-lg font-black text-foreground">
                      {selectedLead.company_name || selectedLead.first_name || 'Müşteri Araması'}
                    </Dialog.Title>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono font-bold text-muted-foreground">{selectedLead.phone}</span>
                      <span className="text-xs text-muted-foreground">• {selectedLead.province || 'İl Belirtilmedi'}</span>
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setActionModalOpen(false)}
                    className="h-8 w-8 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Script info snippet */}
                {selectedLead.message && (
                  <div className="bg-muted/50 p-2.5 rounded-lg text-xs text-muted-foreground">
                    <strong className="text-foreground block text-[11px] mb-0.5">Script / Faaliyet Detayı:</strong>
                    {selectedLead.message}
                  </div>
                )}

                {/* Outcome Category Selectors (4 Main Tabs) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  
                  {/* Option 1: Reached */}
                  <button
                    type="button"
                    onClick={() => setActionType('reached')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      actionType === 'reached'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-background border-border text-foreground hover:border-blue-500/50'
                    }`}
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>Ulaşıldı / Görüştüm</span>
                  </button>

                  {/* Option 2: Missed */}
                  <button
                    type="button"
                    onClick={() => setActionType('missed')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      actionType === 'missed'
                        ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                        : 'bg-background border-border text-foreground hover:border-orange-500/50'
                    }`}
                  >
                    <PhoneMissed className="h-4 w-4" />
                    <span>Açmadı / Ulaşılamadı</span>
                  </button>

                  {/* Option 3: Forward to Sales */}
                  <button
                    type="button"
                    onClick={() => setActionType('forward')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      actionType === 'forward'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-background border-border text-foreground hover:border-emerald-500/50'
                    }`}
                  >
                    <Send className="h-4 w-4" />
                    <span>Satışa İlet</span>
                  </button>

                  {/* Option 4: Uninterested */}
                  <button
                    type="button"
                    onClick={() => setActionType('uninterested')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      actionType === 'uninterested'
                        ? 'bg-zinc-700 text-white border-zinc-700 shadow-sm'
                        : 'bg-background border-border text-foreground hover:border-zinc-500/50'
                    }`}
                  >
                    <PhoneOff className="h-4 w-4" />
                    <span>İlgilenmiyor</span>
                  </button>

                </div>

                {/* DYNAMIC FORM BODY BASED ON ACTION */}

                {/* 1. REACHED FORM */}
                {actionType === 'reached' && (
                  <div className="space-y-3 bg-blue-500/5 border border-blue-500/20 p-4 rounded-xl">
                    <div>
                      <label className="text-xs font-bold text-foreground block mb-1">
                        Görüşme Notu / Talep Detayı:
                      </label>
                      <textarea
                        rows={3}
                        value={reachedNote}
                        onChange={(e) => setReachedNote(e.target.value)}
                        placeholder="Müşteri ne söyledi? Hangi makinelerle ilgileniyor? Ne zaman yatırım planlıyor?"
                        className="w-full p-2.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    {/* Callback checkbox */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="needsCallback"
                        checked={needsCallback}
                        onChange={(e) => setNeedsCallback(e.target.checked)}
                        className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <label htmlFor="needsCallback" className="text-xs font-bold text-foreground cursor-pointer">
                        Müşteri daha sonra aranmak istedi (Randevu / Takip Planla)
                      </label>
                    </div>

                    {needsCallback && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="text-[11px] font-bold text-muted-foreground block mb-1">Arama Tarihi:</label>
                          <input
                            type="date"
                            value={callbackDate}
                            onChange={(e) => setCallbackDate(e.target.value)}
                            required={needsCallback}
                            className="w-full p-2 bg-background border border-border rounded-lg text-xs text-foreground"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-muted-foreground block mb-1">Arama Saati:</label>
                          <input
                            type="time"
                            value={callbackTime}
                            onChange={(e) => setCallbackTime(e.target.value)}
                            className="w-full p-2 bg-background border border-border rounded-lg text-xs text-foreground"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. MISSED FORM */}
                {actionType === 'missed' && (
                  <div className="bg-orange-500/5 border border-orange-500/20 p-4 rounded-xl space-y-2.5">
                    <div className="flex items-center gap-2 text-orange-600 font-bold text-xs">
                      <PhoneMissed className="h-4 w-4 shrink-0" />
                      <span>Otomatik Kademeli Takip Planı:</span>
                    </div>

                    <div className="text-xs text-muted-foreground leading-relaxed">
                      {(selectedLead.calls || []).length === 0 && (
                        <p>
                          Bu firmanın <strong>1. araması</strong> cevapsız olarak kaydedilecek ve sistem otomatik olarak{' '}
                          <strong>2 saat sonra 2. arama</strong> planlayacaktır.
                        </p>
                      )}
                      {(selectedLead.calls || []).length === 1 && (
                        <p>
                          Bu firmanın <strong>2. araması</strong> cevapsız olarak kaydedilecek ve sistem otomatik olarak{' '}
                          <strong>ertesi iş günü 3. arama</strong> planlayacaktır.
                        </p>
                      )}
                      {(selectedLead.calls || []).length === 2 && (
                        <p>
                          Bu firmanın <strong>3. araması</strong> cevapsız olarak kaydedilecek ve sistem otomatik olarak{' '}
                          <strong>48 saat sonra 4. arama</strong> planlayacaktır.
                        </p>
                      )}
                      {(selectedLead.calls || []).length >= 3 && (
                        <p className="text-rose-600 font-semibold">
                          Bu firmanın <strong>4. araması</strong> cevapsız olarak kaydedilecek. Maksimum arama sınırına ulaşıldığı için otomatik planlama sonlandırılacaktır.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. FORWARD TO SALES FORM */}
                {actionType === 'forward' && (
                  <div className="space-y-3 bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl">
                    
                    {/* Select Sales Specialist */}
                    <div>
                      <label className="text-xs font-bold text-foreground block mb-1">
                        Yönlendirilecek Satış Uzmanı: <span className="text-destructive">*</span>
                      </label>
                      <select
                        value={selectedSalesUserId}
                        onChange={(e) => setSelectedSalesUserId(e.target.value)}
                        required
                        className="w-full p-2.5 bg-background border border-border rounded-lg text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                      >
                        <option value="">-- Satış Temsilcisi Seçin --</option>
                        {salesReps.map((rep) => (
                          <option key={rep.id} value={rep.id}>
                            {rep.full_name || rep.email}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Forwarding Note */}
                    <div>
                      <label className="text-xs font-bold text-foreground block mb-1">
                        Satış Uzmanına İletilecek Not / Talep:
                      </label>
                      <textarea
                        rows={2}
                        value={forwardNote}
                        onChange={(e) => setForwardNote(e.target.value)}
                        placeholder="Örn: 1530 6kW sac kesim makinesi için fiyat ve ziyaret istiyor..."
                        className="w-full p-2.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>

                    {/* Copy message button */}
                    <div className="pt-1 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={handleCopyForwardText}
                        className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        {copiedForwardText ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedForwardText ? '✓ Satış Metni Kopyalandı' : '📋 Satış Metnini Kopyala (WhatsApp / Not)'}</span>
                      </button>
                    </div>

                  </div>
                )}

                {/* 4. UNINTERESTED FORM */}
                {actionType === 'uninterested' && (
                  <div className="space-y-3 bg-zinc-500/5 border border-zinc-500/20 p-4 rounded-xl">
                    <div>
                      <label className="text-xs font-bold text-foreground block mb-1">
                        Olumsuz / İlgilenmeme Nedeni:
                      </label>
                      <textarea
                        rows={2}
                        value={uninterestedReason}
                        onChange={(e) => setUninterestedReason(e.target.value)}
                        placeholder="Örn: Makine yatırımı düşünmüyor, başka marka almış, fason yaptırıyor..."
                        className="w-full p-2.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-zinc-500/20"
                      />
                    </div>
                  </div>
                )}

                {/* Modal Footer Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setActionModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-accent hover:bg-accent/80 text-foreground font-bold text-xs transition-colors cursor-pointer"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={savingAction}
                    className={`px-5 py-2 rounded-xl font-bold text-xs text-white shadow-md transition-all cursor-pointer flex items-center gap-1.5 ${
                      actionType === 'forward'
                        ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                        : actionType === 'missed'
                        ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-600/20'
                        : 'bg-primary hover:bg-primary/90 shadow-primary/20'
                    }`}
                  >
                    {savingAction ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Kaydediliyor...
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Arama Sonucunu Kaydet
                      </>
                    )}
                  </button>
                </div>

              </form>
            )}

          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

    </div>
  )
}

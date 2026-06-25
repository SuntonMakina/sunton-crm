'use client'

import React, { useState, useEffect, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { 
  Phone, 
  MessageSquare, 
  Search, 
  RefreshCw, 
  Send, 
  Sliders, 
  MessageCircle, 
  User, 
  Shield,
  ChevronRight,
  UserCheck,
  CheckCircle,
  XCircle,
  ArrowRight,
  Check,
  UserPlus
} from 'lucide-react'
import { formatLeadId, getProgressiveCallSchedule, calculateNextWorkingTime } from '@/lib/utils'

function renderMessageContent(content: string) {
  if (!content) return null

  if (content.startsWith('[IMAGE]:')) {
    const mediaPart = content.substring(8)
    const pipeIndex = mediaPart.indexOf('|')
    let url = mediaPart
    let caption = ''
    if (pipeIndex !== -1) {
      url = mediaPart.substring(0, pipeIndex)
      caption = mediaPart.substring(pipeIndex + 1)
    }
    return (
      <div className="space-y-1.5 max-w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src={url} 
          alt="WhatsApp Görsel" 
          className="rounded-lg max-w-xs max-h-60 object-cover border border-border/50 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => window.open(url, '_blank')}
        />
        {caption && <p className="font-semibold whitespace-pre-wrap">{caption}</p>}
      </div>
    )
  }

  if (content.startsWith('[AUDIO]:')) {
    const url = content.substring(8)
    return (
      <div className="py-1 min-w-[240px]">
        <audio src={url} controls className="w-full max-w-xs outline-hidden" />
      </div>
    )
  }

  return <span className="whitespace-pre-wrap">{content}</span>
}

export default function WhatsAppWorkspacePage() {
  const supabase = createClient()

  const formatLastMessageTime = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    
    // Day zero calculation to prevent calendar mismatches
    const dateZero = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const nowZero = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const diffDays = Math.round((nowZero.getTime() - dateZero.getTime()) / 86400000)

    if (diffDays === 0) {
      return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    }
    if (diffDays === 1) {
      return 'Dün'
    }
    if (diffDays === 2) {
      return 'Evvelsi gün'
    }
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })
  }

  const getRelativeTime = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    
    // Reset times to compare calendar days
    const dateZero = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const nowZero = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const diffDays = Math.round((nowZero.getTime() - dateZero.getTime()) / 86400000)
    
    if (diffDays === 0) {
      // Today
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      if (diffMins < 1) return 'şimdi'
      if (diffMins < 60) return `${diffMins} dk önce`
      const diffHours = Math.floor(diffMins / 60)
      return `${diffHours} sa önce`
    } else if (diffDays === 1) {
      return 'Dün'
    } else if (diffDays === 2) {
      return 'Evvelsi gün'
    } else {
      return `${diffDays} gün önce`
    }
  }

  const formatDividerDate = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const dateZero = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const nowZero = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const diffDays = Math.round((nowZero.getTime() - dateZero.getTime()) / 86400000)

    if (diffDays === 0) return 'Bugün'
    if (diffDays === 1) return 'Dün'
    if (diffDays === 2) return 'Evvelsi gün'
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const [matchingLeads, setMatchingLeads] = useState<Record<string, any>>({})

  const getSidebarNameDisplay = (lead: any) => {
    const isRawChat = lead.status_id === '22222222-0000-0000-0000-000000000020'
    const matched = isRawChat ? matchingLeads[lead.phone_normalized] : null
    
    if (isRawChat && !matched) {
      return (
        <span className="flex items-center gap-1.5 truncate">
          <span className="font-bold text-foreground truncate">{lead.phone}</span>
        </span>
      )
    } else {
      const displayLead = matched || lead
      const hasLeadNumber = displayLead.lead_number || displayLead.legacy_lead_id
      const formattedId = formatLeadId(displayLead.legacy_lead_id || displayLead.lead_number)
      
      let displayName = `${displayLead.first_name || ''} ${displayLead.last_name || ''}`.trim()
      if (!displayName || displayName.includes('Yeni Müşteri') || displayName.includes('Müşterisi')) {
        displayName = displayLead.phone || displayName
      }

      return (
        <span className="flex items-center gap-1.5 truncate">
          {hasLeadNumber && (
            <span className="px-1.5 py-0.5 text-[8px] font-black bg-amber-500/10 text-amber-600 rounded border border-amber-500/20 uppercase tracking-wider shrink-0">{formattedId}</span>
          )}
          <span className="font-bold text-foreground truncate">{displayName}</span>
        </span>
      )
    }
  }
  
  // App/Profile States
  const [profile, setProfile] = useState<any>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [loadingData, setLoadingData] = useState(true)
  
  // Leads, Messages & Options
  const [whatsappLeads, setWhatsappLeads] = useState<any[]>([])
  const [salesReps, setSalesReps] = useState<any[]>([])
  const [selectedLead, setSelectedLead] = useState<any>(null)
  const [wpMessages, setWpMessages] = useState<any[]>([])
  const [loadingWpMessages, setLoadingWpMessages] = useState(false)
  const [wpMessageText, setWpMessageText] = useState('')
  const [sendingWpMessage, setSendingWpMessage] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [queueModalOpen, setQueueModalOpen] = useState(false)
  const [queueForm, setQueueForm] = useState({
    product: '',
    note: ''
  })
  const [convertModalOpen, setConvertModalOpen] = useState(false)
  const [convertForm, setConvertForm] = useState({
    firstName: '',
    lastName: '',
    companyName: ''
  })
  const [autoOpenQueueAfterConvert, setAutoOpenQueueAfterConvert] = useState(false)


  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const isScheduledForToday = (lead: any) => {
    if (!lead) return false
    const isRawChat = lead.status_id === '22222222-0000-0000-0000-000000000020'
    const matched = isRawChat ? matchingLeads[lead.phone_normalized] : null
    const displayLead = matched || lead

    if (displayLead.callback_status === 'pending') return true
    if (displayLead.next_contact_at) {
      const d = new Date(displayLead.next_contact_at)
      const now = new Date()
      return d <= now || (
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      )
    }
    return false
  }


  // Scroll to bottom of chat
  useEffect(() => {
    if (wpMessages.length > 0 && !loadingWpMessages) {
      const scroll = () => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
        } else {
          chatEndRef.current?.scrollIntoView({ behavior: 'auto' })
        }
      }
      
      // Scroll immediately
      scroll()
      
      // Scroll after render ticks
      const timer1 = setTimeout(scroll, 50)
      const timer2 = setTimeout(scroll, 150)
      const timer3 = setTimeout(scroll, 300)
      
      return () => {
        clearTimeout(timer1)
        clearTimeout(timer2)
        clearTimeout(timer3)
      }
    }
  }, [wpMessages, selectedLead, loadingWpMessages])

  // Initial Auth & Data load
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (prof) {
          setProfile(prof)
          fetchData(prof.id)
        }
      }
      setLoadingProfile(false)
    }

    async function loadSalesReps() {
      const { data: reps } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'sales_specialist')
        .eq('is_active', true)
        .order('full_name')
      if (reps) {
        setSalesReps(reps)
      }
    }

    init()
    loadSalesReps()
  }, [supabase])

  // Load WhatsApp leads
  const fetchData = async (userId: string) => {
    setLoadingData(true)
    try {
      const { data: convsData, error } = await supabase
        .from('conversations')
        .select(`
          id,
          unread_count,
          last_message_at,
          lead_id,
          leads!inner (
            *,
            lead_statuses(name, color),
            lead_sources(name)
          )
        `)
        .eq('channel', 'whatsapp')
        .eq('leads.is_active', true)
        .order('last_message_at', { ascending: false, nullsFirst: false })

      if (error) throw error

      if (convsData) {
        const initialLeadsList = convsData.map((c: any) => ({
          ...c.leads,
          conversation_id: c.id,
          unread_count: c.unread_count,
          last_contact_at: c.last_message_at || c.leads.last_contact_at
        }))

        const excludedSalesPhones = new Set([
          '905335745839',
          '905416003432',
          '905061122350',
          '905452733802',
          '905366507583',
          '905070471333',
          '905379527983',
          '905345743401',
          '905379527977'
        ])

        const leadsList = initialLeadsList.filter((l: any) => {
          const cleanPhone = l.phone_normalized || (l.phone ? l.phone.replace(/\D/g, '') : '')
          return !excludedSalesPhones.has(cleanPhone)
        })

        // Fetch matching registered leads by phone for raw chats
        const rawChatPhones = leadsList
          .filter((l: any) => l.status_id === '22222222-0000-0000-0000-000000000020')
          .map((l: any) => l.phone_normalized)
          .filter(Boolean)

        const matchedLeadsMap: Record<string, any> = {}
        if (rawChatPhones.length > 0) {
          const { data: matches } = await supabase
            .from('leads')
            .select('id, lead_number, legacy_lead_id, first_name, last_name, phone_normalized, status_id')
            .in('phone_normalized', rawChatPhones)
            .neq('status_id', '22222222-0000-0000-0000-000000000020')
            .eq('is_active', true)

          if (matches) {
            matches.forEach((m: any) => {
              if (!matchedLeadsMap[m.phone_normalized] || m.lead_number) {
                matchedLeadsMap[m.phone_normalized] = m
              }
            })
          }
        }
        setMatchingLeads(matchedLeadsMap)
        setWhatsappLeads(leadsList)

        // Keep selected lead sync'd if already selected
        if (selectedLead) {
          const updated = leadsList.find((l: any) => l.id === selectedLead.id)
          if (updated) setSelectedLead(updated)
        }
        return leadsList
      }
      return []
    } catch (err) {
      console.error('Error fetching WhatsApp leads:', err)
      return []
    } finally {
      setLoadingData(false)
    }
  }

  // Effect to load messages and listen to realtime updates when selected lead changes
  useEffect(() => {
    if (!selectedLead) {
      setWpMessages([])
      return
    }

    let activeConvId: string | null = null
    let channel: any = null

    async function loadWpMessages() {
      setLoadingWpMessages(true)
      try {
        const { data: conv } = await supabase
          .from('conversations')
          .select('id')
          .eq('lead_id', selectedLead.id)
          .eq('channel', 'whatsapp')
          .single()

        if (conv) {
          activeConvId = conv.id
          const { data: msgs } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('sent_at', { ascending: true })

          if (msgs) {
            setWpMessages(msgs)
          }

          // Mark messages as read
          await supabase
            .from('conversations')
            .update({ unread_count: 0 })
            .eq('id', conv.id)

          // Subscribe to message inserts for this conversation
          channel = supabase
            .channel(`wp_messages:${conv.id}`)
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${conv.id}`
              },
              (payload: any) => {
                setWpMessages(prev => {
                  if (prev.some(m => m.id === payload.new.id)) return prev
                  return [...prev, payload.new]
                })
              }
            )
            .subscribe()
        } else {
          setWpMessages([])
        }
      } catch (err) {
        console.error('Error loading WhatsApp messages:', err)
      } finally {
        setLoadingWpMessages(false)
      }
    }

    loadWpMessages()

    if (selectedLead && !selectedLead.avatar_url) {
      fetch('/api/whatsapp/fetch-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: selectedLead.phone })
      }).catch(err => console.error('Failed to trigger avatar fetch:', err))
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [selectedLead, supabase])

  // Listen to realtime changes on conversations and leads tables to auto-refresh sidebar list
  useEffect(() => {
    if (!profile) return

    const channel = supabase
      .channel('workspace_conversations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations'
        },
        () => {
          fetchData(profile.id)
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads'
        },
        () => {
          fetchData(profile.id)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile, supabase])

  // Send message
  const sendWhatsAppMessage = async (lead: any, content: string) => {
    if (!content.trim() || !profile) return
    setSendingWpMessage(true)
    try {
      let { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('lead_id', lead.id)
        .eq('channel', 'whatsapp')
        .single()

      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          leadId: lead.id,
          phone: lead.phone,
          content: content,
          conversationId: conv?.id || null
        })
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Mesaj gönderilirken hata oluştu.')
      }

      const newMsg = result.message

      setWpMessages(prev => [...prev, newMsg])
      setWpMessageText('')

      fetchData(profile.id)
    } catch (err: any) {
      alert('Mesaj gönderilemedi: ' + err.message)
    } finally {
      setSendingWpMessage(false)
    }
  }

  // Quick Action: Arama Yapıldı (Ulaşıldı)
  const logWhatsAppCallAnswered = async (lead: any, note: string) => {
    if (!profile) return
    try {
      // 1. Log completed call
      const { error: callErr } = await supabase.from('calls').insert({
        lead_id: lead.id,
        user_id: profile.id,
        direction: 'outgoing',
        phone_number: lead.phone,
        status: 'answered',
        duration_seconds: 0,
        notes: note || 'Arama Yapıldı (WhatsApp Panelinden arandı - Görüşüldü)'
      })
      if (callErr) throw callErr

      // 2. Update lead status to "Görüşme Yapıldı" (22222222-0000-0000-0000-000000000007)
      await supabase
        .from('leads')
        .update({
          status_id: '22222222-0000-0000-0000-000000000007',
          last_contact_at: new Date().toISOString(),
          whatsapp_step: 'called_1'
        })
        .eq('id', lead.id)

      // 3. Log activity
      await supabase.from('activities').insert({
        entity_type: 'lead',
        entity_id: lead.id,
        activity_type: 'whatsapp_step_changed',
        title: 'WhatsApp Araması: Görüşüldü',
        description: `${profile.full_name} müşteriyle görüştü. Not: ${note || 'Görüşme Yapıldı'}`,
        user_id: profile.id
      })

      alert('Arama başarıyla loglandı. Müşteri durumu "Görüşme Yapıldı" olarak güncellendi.')
      fetchData(profile.id)
    } catch (err: any) {
      alert('Arama logu kaydedilemedi: ' + err.message)
    }
  }

  // Quick Action: Cevap Vermedi (Ulaşılamadı)
  const logWhatsAppCallMissed = async (lead: any) => {
    if (!profile) return
    try {
      // 1. Fetch count of calls logged for the lead
      const { count: callCount } = await supabase
        .from('calls')
        .select('*', { count: 'exact', head: true })
        .eq('lead_id', lead.id)

      const actualCount = callCount || 0
      const { nextContactAt, callbackStatus, attemptInfo } = getProgressiveCallSchedule(actualCount)

      const noteText = 'Cevap Vermedi / Açmadı (WhatsApp Panelinden arandı)' + attemptInfo
      const timeStr = new Date().toLocaleString('tr-TR')
      const finalNotes = lead.extra_notes ? `[${timeStr}] - ${noteText}\n` + lead.extra_notes : `[${timeStr}] - ${noteText}`

      // 2. Log missed call
      const { error: callErr } = await supabase.from('calls').insert({
        lead_id: lead.id,
        user_id: profile.id,
        direction: 'outgoing',
        phone_number: lead.phone,
        status: 'missed',
        duration_seconds: 0,
        notes: noteText
      })
      if (callErr) throw callErr

      // 3. Update lead status to "Ulaşılamadı" (22222222-0000-0000-0000-000000000005)
      await supabase
        .from('leads')
        .update({
          status_id: '22222222-0000-0000-0000-000000000005',
          last_contact_at: new Date().toISOString(),
          next_contact_at: nextContactAt,
          callback_status: callbackStatus,
          whatsapp_step: 'no_answer',
          extra_notes: finalNotes
        })
        .eq('id', lead.id)

      // 3. Log activity
      await supabase.from('activities').insert({
        entity_type: 'lead',
        entity_id: lead.id,
        activity_type: 'whatsapp_step_changed',
        title: 'WhatsApp Araması: Ulaşılamadı',
        description: `${profile.full_name} aradı fakat müşteri cevap vermedi (Açmadı).`,
        user_id: profile.id
      })

      alert('Ulaşılamadı araması loglandı. Müşteri durumu "Ulaşılamadı" olarak güncellendi.')
      fetchData(profile.id)
    } catch (err: any) {
      alert('Arama logu kaydedilemedi: ' + err.message)
    }
  }

  // Quick Action: Satış Temsilcisine Yönlendir
  const logWhatsAppForward = async (lead: any, salesRepId: string) => {
    if (!profile) return
    const selectedRep = salesReps.find(r => r.id === salesRepId)
    try {
      // 1. Update lead status and assignee
      await supabase
        .from('leads')
        .update({
          assigned_sales_user_id: salesRepId,
          status_id: '22222222-0000-0000-0000-000000000009', // Satış Uzmanına İletildi
          whatsapp_step: 'completed',
          extra_notes: lead.extra_notes ? lead.extra_notes + '\n(WhatsApp Panelinden Yönlendirildi)' : 'WhatsApp üzerinden yönlendirildi.'
        })
        .eq('id', lead.id)

      // 2. Create notification for the Sales Specialist
      await supabase.from('notifications').insert({
        user_id: salesRepId,
        type: 'lead_assigned',
        title: 'Yeni Lead Yönlendirildi (WhatsApp)',
        message: `${profile.full_name} temsilcisi, WhatsApp üzerinden gelen ${lead.first_name} ${lead.last_name} isimli lead'i size yönlendirdi.`,
        entity_type: 'lead',
        entity_id: lead.id
      })

      // 3. Log activity
      await supabase.from('activities').insert({
        entity_type: 'lead',
        entity_id: lead.id,
        activity_type: 'whatsapp_step_changed',
        title: 'WhatsApp: Satış Danışmanına Yönlendirildi',
        description: `Müşteri, WhatsApp görüşmeleri sonrası ${selectedRep?.full_name || 'Satış Uzmanı'} danışmanına yönlendirildi.`,
        user_id: profile.id
      })

      alert(`Lead başarıyla ${selectedRep?.full_name || 'Satış Uzmanı'} danışmanına yönlendirildi.`)
      setSelectedLead(null)
      fetchData(profile.id)
    } catch (err: any) {
      alert('Yönlendirme işlemi yapılamadı: ' + err.message)
    }
  }

  const handleOpenQueueModal = () => {
    if (!selectedLead) return
    setQueueForm({
      product: selectedLead.requested_product || '',
      note: ''
    })
    setQueueModalOpen(true)
  }

  const handleCallTodayClick = () => {
    if (!selectedLead) return
    
    const isRawChat = selectedLead.status_id === '22222222-0000-0000-0000-000000000020'
    const matched = isRawChat ? matchingLeads[selectedLead.phone_normalized] : null
    
    if (isRawChat && !matched) {
      setConvertForm({
        firstName: '',
        lastName: '',
        companyName: ''
      })
      setAutoOpenQueueAfterConvert(true)
      setConvertModalOpen(true)
    } else {
      handleOpenQueueModal()
    }
  }


  // Quick Action: Gün içinde aranacaklara ekle (onaylı)
  const logWhatsAppCallQueueSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLead || !profile) return
    try {
      let finalNotes = selectedLead.extra_notes || ''
      if (queueForm.note.trim()) {
        const timeStr = new Date().toLocaleString('tr-TR')
        finalNotes = `[${timeStr}] - ${queueForm.note.trim()}\n` + finalNotes
      }

      // 1. Fetch current calling queue size
      const { data: queueLeads } = await supabase
        .from('leads')
        .select('id, legacy_source_file, next_contact_at')
        .eq('is_active', true)
        .eq('assigned_call_center_user_id', profile.id)
        .not('status_id', 'eq', '22222222-0000-0000-0000-000000000009') // Satış Uzmanına İletildi
        .not('status_id', 'eq', '22222222-0000-0000-0000-000000000012') // İlgilenmiyor
        .not('status_id', 'eq', '22222222-0000-0000-0000-000000000007');  // Görüşme Yapıldı

      const isTodayOrPast = (dateStr: string) => {
        const d = new Date(dateStr);
        const now = new Date();
        return d <= now || (d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear());
      };

      const bugunAranacakCount = queueLeads
        ? queueLeads.filter(l => l.next_contact_at ? isTodayOrPast(l.next_contact_at) : !l.legacy_source_file).length
        : 0;

      let delayMinutes = 0;
      if (bugunAranacakCount >= 10) {
        delayMinutes = 120; // 2 saat sonra
      } else if (bugunAranacakCount === 9) {
        delayMinutes = 105;
      } else if (bugunAranacakCount === 8) {
        delayMinutes = 90;
      } else if (bugunAranacakCount === 7) {
        delayMinutes = 75;
      } else if (bugunAranacakCount === 6) {
        delayMinutes = 60;  // 1 saat sonra
      } else if (bugunAranacakCount === 5) {
        delayMinutes = 50;
      } else if (bugunAranacakCount === 4) {
        delayMinutes = 40;
      } else if (bugunAranacakCount === 3) {
        delayMinutes = 30;  // Yarım saat sonra
      } else if (bugunAranacakCount === 2) {
        delayMinutes = 20;
      } else if (bugunAranacakCount === 1) {
        delayMinutes = 10;  // 10 dakika sonra
      }

      const targetDate = calculateNextWorkingTime(new Date(), delayMinutes * 60 * 1000);
      const nextContactAt = targetDate.toISOString();

      // Update requested_product, next_contact_at, and callback_status
      const { error } = await supabase
        .from('leads')
        .update({
          requested_product: queueForm.product.trim() || selectedLead.requested_product,
          next_contact_at: nextContactAt,
          callback_status: 'pending',
          extra_notes: finalNotes
        })
        .eq('id', selectedLead.id)

      if (error) throw error

      // Log activity
      await supabase.from('activities').insert({
        entity_type: 'lead',
        entity_id: selectedLead.id,
        activity_type: 'task_created',
        title: 'Gün İçinde Arama Listesine Eklendi',
        description: `${profile.full_name} bu WhatsApp lead'ini gün içinde aranacaklar listesine ekledi. Ürün: ${queueForm.product.trim() || 'Belirtilmemiş'}${queueForm.note.trim() ? `, Not: ${queueForm.note.trim()}` : ''}`,
        user_id: profile.id
      })

      alert('Lead başarıyla "Gün İçinde Aranacaklar" listesine eklendi.')
      setQueueModalOpen(false)
      setSelectedLead(null)
      fetchData(profile.id)
    } catch (err: any) {
      alert('Kuyruğa eklenemedi: ' + err.message)
    }
  }

  // Filter list by search query
  const getFilteredLeads = () => {
    if (!searchQuery.trim()) return whatsappLeads
    const q = searchQuery.toLowerCase().trim()
    const cleanQ = q.replace(/\D/g, '')

    return whatsappLeads.filter(l => {
      const matchesText = 
        (l.company_name && l.company_name.toLowerCase().includes(q)) ||
        (l.full_name && l.full_name.toLowerCase().includes(q)) ||
        (l.first_name && l.first_name.toLowerCase().includes(q)) ||
        (l.last_name && l.last_name.toLowerCase().includes(q))
      
      const matchesPhone = cleanQ && (
        (l.phone && l.phone.replace(/\D/g, '').includes(cleanQ)) ||
        (l.phone_normalized && l.phone_normalized.replace(/\D/g, '').includes(cleanQ))
      )
      
      return matchesText || matchesPhone
    })
  }

  // Convert WhatsApp Chat to a New Lead with interactive fields
  const handleConvertSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !selectedLead) return
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          first_name: convertForm.firstName.trim() || 'WhatsApp',
          last_name: convertForm.lastName.trim() || 'Müşterisi',
          company_name: convertForm.companyName.trim() || null,
          status_id: '22222222-0000-0000-0000-000000000001', // Yeni Lead
          assigned_call_center_user_id: profile.id, // Assign to Ebru
          whatsapp_step: 'viewed',
          next_contact_at: null,
          callback_status: 'none'
        })
        .eq('id', selectedLead.id)

      if (error) throw error

      // Log activity
      await supabase.from('activities').insert({
        entity_type: 'lead',
        entity_id: selectedLead.id,
        activity_type: 'status_changed',
        title: 'WhatsApp Sohbeti Adaya Dönüştürüldü',
        description: `${profile.full_name} bu sohbeti yeni aday (${convertForm.firstName} ${convertForm.lastName}) olarak kaydetti.`,
        user_id: profile.id
      })

      alert('Aday kartı başarıyla oluşturuldu!')
      setConvertModalOpen(false)
      await fetchData(profile.id)

      if (autoOpenQueueAfterConvert) {
        setAutoOpenQueueAfterConvert(false)
        setQueueForm({
          product: '',
          note: ''
        })
        setQueueModalOpen(true)
      }
    } catch (err: any) {
      alert('Aday kartı oluşturulamadı: ' + err.message)
    }
  }

  // Lead status mapped to user friendly badges
  const getStatusBadge = (statusId: string) => {
    if (statusId === '22222222-0000-0000-0000-000000000001') {
      return <span className="px-2.5 py-1 text-[10px] font-extrabold rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">Yeni Lead</span>
    }
    if (statusId === '22222222-0000-0000-0000-000000000020') {
      return <span className="px-2.5 py-1 text-[10px] font-extrabold rounded-full bg-slate-500/10 text-slate-600 border border-slate-500/20">WhatsApp Sohbeti</span>
    }
    if (statusId === '22222222-0000-0000-0000-000000000009') {
      return <span className="px-2.5 py-1 text-[10px] font-extrabold rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/20">Satışa Yönlendirildi</span>
    }
    if (statusId === '22222222-0000-0000-0000-000000000005') {
      return <span className="px-2.5 py-1 text-[10px] font-extrabold rounded-full bg-red-500/10 text-red-600 border border-red-500/20">Ulaşılamadı</span>
    }
    if (statusId === '22222222-0000-0000-0000-000000000007') {
      return <span className="px-2.5 py-1 text-[10px] font-extrabold rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Görüşme Yapıldı / Ulaşıldı</span>
    }
    return <span className="px-2.5 py-1 text-[10px] font-extrabold rounded-full bg-slate-500/10 text-slate-600 border border-slate-500/20">Aktif</span>
  }

  if (loadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-4 rounded-2xl shadow-xs">
        <div>
          <h2 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
            <MessageCircle className="h-5.5 w-5.5 text-emerald-500" />
            WhatsApp Mesajlaşma Merkezi
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 font-semibold">
            Reklamlardan ve diğer kanallardan yazan müşterilerle doğrudan iletişim kurun ve durumlarını güncelleyin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/whatsapp/gateway-redirect"
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 px-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer shadow-xs"
            title="WhatsApp Bağlantısını Yenile / QR Kodu Okut"
          >
            <MessageCircle className="h-4 w-4" />
            Bağlantıyı Tazele / QR Kod
          </a>
          <button 
            onClick={() => profile && fetchData(profile.id)}
            className="h-9 w-9 bg-card border border-border rounded-lg flex items-center justify-center cursor-pointer transition-colors hover:bg-accent"
            title="Yenile"
          >
            <RefreshCw className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      </div>

      {/* Main Dual-Pane Section */}
      <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[600px] divide-y lg:divide-y-0 lg:divide-x divide-border">
          
          {/* Left Pane: Chats Directory */}
          <div className="col-span-1 lg:col-span-4 flex flex-col justify-between bg-muted/5 h-[600px] select-none">
            <div className="p-4 border-b border-border flex flex-col gap-2 shrink-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <MessageSquare className="h-3 w-3 text-emerald-500" />
                Sohbet Rehberi ({getFilteredLeads().length})
              </span>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="İsim veya telefon numarası ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 bg-card border border-border rounded-lg text-[10px] focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border/50">
              {loadingData ? (
                <div className="flex justify-center py-16">
                  <RefreshCw className="h-5 w-5 animate-spin text-emerald-500" />
                </div>
              ) : getFilteredLeads().length === 0 ? (
                <div className="text-center py-16 text-[10px] text-muted-foreground">WhatsApp kaydı bulunamadı.</div>
              ) : (
                getFilteredLeads().map((lead) => {
                  const isSelected = selectedLead?.id === lead.id
                  const statusName = lead.lead_statuses?.name || 'Yeni Lead'
                  const statusColor = lead.lead_statuses?.color || '#3b82f6'
                  const lastMsg = lead.last_message_content || ''
                  const truncatedMsg = lastMsg.length > 25 ? lastMsg.substring(0, 25) + '...' : lastMsg
                  
                  return (
                    <button
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className={`w-full text-left p-3.5 flex items-center gap-3 transition-all border-l-4 ${
                        isSelected 
                          ? 'bg-emerald-500/[0.03] border-l-emerald-500 bg-emerald-500/5' 
                          : lead.unread_count > 0
                            ? 'bg-blue-50/70 dark:bg-blue-950/20 border-l-blue-500 font-bold'
                            : 'border-l-transparent hover:bg-muted/30'
                      }`}
                    >
                      {/* Avatar */}
                      {lead.avatar_url ? (
                        <img src={lead.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="h-9 w-9 bg-primary/10 text-primary rounded-full flex items-center justify-center shrink-0">
                          <User className="h-4.5 w-4.5" />
                        </div>
                      )}
                      
                      {/* Text details */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex justify-between items-center text-xs w-full overflow-hidden">
                          {getSidebarNameDisplay(lead)}
                          <span className={`text-[9px] font-semibold ${lead.unread_count > 0 ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-muted-foreground'}`}>
                            {formatLastMessageTime(lead.last_contact_at)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                          <span className={`truncate max-w-[140px] ${lead.unread_count > 0 ? 'text-blue-800 dark:text-blue-300 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                            {truncatedMsg || 'Mesaj bulunmuyor'}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {lead.unread_count > 0 && (
                              <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                            )}
                            <span className="text-[8px] font-extrabold px-1.5 py-0.2 rounded" style={{
                              backgroundColor: statusColor + '15',
                              color: statusColor
                            }}>
                              {statusName}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Right Pane: Chat Window & Controls */}
          <div className="col-span-1 lg:col-span-8 flex flex-col h-[600px] overflow-hidden bg-slate-50/20 dark:bg-slate-900/10">
            {selectedLead ? (
              <div className="flex flex-col h-full overflow-hidden">
                {/* Lead Status Header info */}
                <div className="p-4 bg-card border-b border-border shrink-0 space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* Avatar in header */}
                      {selectedLead.avatar_url ? (
                        <img src={selectedLead.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="h-10 w-10 bg-primary/10 text-primary rounded-full flex items-center justify-center shrink-0">
                          <User className="h-5 w-5" />
                        </div>
                      )}
                      
                      <div>
                        <h4 className="font-extrabold text-sm text-foreground flex items-center gap-2">
                          {(() => {
                            const isRawChat = selectedLead.status_id === '22222222-0000-0000-0000-000000000020'
                            const matched = isRawChat ? matchingLeads[selectedLead.phone_normalized] : null

                            if (isRawChat && !matched) {
                              return (
                                <>
                                  <span>{selectedLead.phone}</span>
                                </>
                              )
                            } else {
                              const displayLead = matched || selectedLead
                              const hasLeadNumber = displayLead.lead_number || displayLead.legacy_lead_id
                              const formattedId = formatLeadId(displayLead.legacy_lead_id || displayLead.lead_number)
                              
                              let displayName = `${displayLead.first_name || ''} ${displayLead.last_name || ''}`.trim()
                              if (!displayName || displayName.includes('Yeni Müşteri') || displayName.includes('Müşterisi') || displayName.includes('Belirtilmemiş')) {
                                displayName = displayLead.phone || displayName
                              }

                              return (
                                <>
                                  {hasLeadNumber && (
                                    <span className="px-2 py-0.5 text-[9px] font-black bg-amber-500/10 text-amber-600 rounded-md border border-amber-500/20 uppercase tracking-wider">
                                      {formattedId}
                                    </span>
                                  )}
                                  <span>{displayName}</span>
                                  <Link 
                                    href={`/workspace?tab=totalIncoming&id=${displayLead.id}`}
                                    className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded border border-border flex items-center gap-1.5 transition-colors cursor-pointer"
                                  >
                                    📂 Aday Kartına Git
                                  </Link>
                                </>
                              )
                            }
                          })()}
                        </h4>
                        <div className="flex flex-wrap gap-2 mt-1 items-center">
                          <a href={`tel:${selectedLead.phone}`} className="text-[10px] text-primary font-bold hover:underline flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {selectedLead.phone}
                          </a>
                          {selectedLead.requested_product && (
                            <span className="text-[10px] text-muted-foreground">• Ürün: <strong className="text-foreground">{selectedLead.requested_product}</strong></span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Simplified status indicator badge instead of 7-step stepper */}
                    <div className="flex items-center gap-3 select-none">
                      <span className="text-[10px] font-bold text-muted-foreground">İşlem Durumu:</span>
                      {getStatusBadge(selectedLead.status_id)}
                      
                      {selectedLead.status_id === '22222222-0000-0000-0000-000000000020' && !matchingLeads[selectedLead.phone_normalized] && (
                        <button
                          type="button"
                          onClick={() => {
                            setConvertForm({
                              firstName: '',
                              lastName: '',
                              companyName: ''
                            })
                            setConvertModalOpen(true)
                          }}
                          className="h-7 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold shadow-xs transition-colors cursor-pointer"
                        >
                          Aday Kartı Oluştur
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* WhatsApp Chat Scroll area */}
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingWpMessages ? (
                    <div className="flex items-center justify-center py-10">
                      <RefreshCw className="h-5 w-5 animate-spin text-emerald-500" />
                    </div>
                  ) : wpMessages.length === 0 ? (
                    <div className="text-center text-[10px] text-muted-foreground py-10">WhatsApp sohbet geçmişi bulunmuyor. Mesaj göndererek sohbeti başlatın.</div>
                  ) : (
                    wpMessages.map((m, index) => {
                      const isOwn = m.sender_type === 'user'
                      const currentDate = new Date(m.sent_at).toLocaleDateString('tr-TR')
                      const prevDate = index > 0 ? new Date(wpMessages[index - 1].sent_at).toLocaleDateString('tr-TR') : null
                      const showDateDivider = currentDate !== prevDate

                      return (
                        <React.Fragment key={m.id}>
                          {showDateDivider && (
                            <div className="flex justify-center my-4">
                              <span className="px-3 py-1 bg-slate-200 dark:bg-slate-800 text-[10px] text-muted-foreground rounded-lg font-bold select-none shadow-xs">
                                {formatDividerDate(m.sent_at)}
                              </span>
                            </div>
                          )}
                          <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[70%] p-3 rounded-xl text-xs leading-relaxed ${
                              isOwn 
                                ? 'bg-emerald-600 text-white rounded-tr-none shadow-xs' 
                                : 'bg-card border border-border text-foreground rounded-tl-none shadow-xs'
                            }`}>
                              <div className="font-semibold text-[11px]">{renderMessageContent(m.content)}</div>
                              <span className={`block text-[8px] text-right mt-1.5 font-medium ${isOwn ? 'text-white/75' : 'text-muted-foreground'}`}>
                                {new Date(m.sent_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                {' • '}
                                {getRelativeTime(m.sent_at)}
                              </span>
                            </div>
                          </div>
                        </React.Fragment>
                      )
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Messaging Reply form & Templates */}
                <div className="p-3 border-t border-border bg-card shrink-0 space-y-2 select-none">
                  {/* Messaging Templates */}
                  <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin select-none">
                    {[
                      'Merhaba, Sunton Makina reklamlarımız üzerinden bilgi talep etmiştiniz. Sac Lazer Kesim makinemizin detaylı teknik kataloğunu iletmemi ister misiniz?',
                      'Merhaba, WhatsApp üzerinden bize ulaştınız. Size telefondan ulaşarak detaylı bütçenize uygun makine seçimi yapalım, müsait misiniz?',
                      'Merhaba, talep ettiğiniz Lazer Kaynak makinesi fiyat teklifimizi hazırladım. Uygun zamanınızda telefondan görüşmek isterim.'
                    ].map((tpl, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setWpMessageText(tpl)}
                        className="px-2.5 py-1 bg-muted hover:bg-accent text-[9px] font-bold text-slate-500 hover:text-slate-800 rounded-lg border border-border/60 shrink-0 cursor-pointer max-w-[200px] truncate"
                        title={tpl}
                      >
                        Şablon {i + 1}
                      </button>
                    ))}
                  </div>

                  {/* Chat Reply Form */}
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault()
                      sendWhatsAppMessage(selectedLead, wpMessageText)
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={wpMessageText}
                      onChange={(e) => setWpMessageText(e.target.value)}
                      placeholder="WhatsApp mesajı yazın..."
                      className="flex-1 h-9 px-3.5 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
                    />
                    <button
                      type="submit"
                      disabled={sendingWpMessage || !wpMessageText.trim()}
                      className="h-9 w-9 bg-emerald-600 text-white hover:bg-emerald-500 rounded-lg flex items-center justify-center cursor-pointer transition-colors shadow-xs disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </form>

                  {/* Action box: Gün İçinde Ara */}
                  <div className="pt-2 border-t border-border/50">
                    <button
                      type="button"
                      disabled={isScheduledForToday(selectedLead)}
                      onClick={handleCallTodayClick}
                      className={`w-full h-10 rounded-lg text-xs font-black flex items-center justify-center gap-2 shadow-md transition-colors ${
                        isScheduledForToday(selectedLead)
                          ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed shadow-none'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                      }`}
                    >
                      <Phone className="h-4 w-4" />
                      {isScheduledForToday(selectedLead) ? 'Gün İçinde Arama Listesinde' : 'Gün İçinde Ara'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2 select-none">
                <MessageSquare className="h-8 w-8 text-emerald-500/50" />
                <p className="text-xs font-semibold">Görüşmeyi görüntülemek için sol rehberden bir WhatsApp sohbeti seçin.</p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Gün İçinde Arama Onay Modalı */}
      <Dialog.Root open={queueModalOpen} onOpenChange={setQueueModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-md z-50 animate-in fade-in zoom-in-95 duration-150 select-none">
            <Dialog.Title className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
              <Phone className="h-4.5 w-4.5 text-emerald-500" />
              Gün İçinde Aranacaklara Ekle
            </Dialog.Title>

            <form onSubmit={logWhatsAppCallQueueSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">İlgi Duyulan Ürün / Cihaz *</label>
                <input
                  type="text"
                  required
                  value={queueForm.product}
                  onChange={(e) => setQueueForm({ ...queueForm, product: e.target.value })}
                  placeholder="Örn: Plaka Lazer Kesim Makinesi 3kW"
                  className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Görüşme / Arama Öncesi Notu</label>
                <textarea
                  value={queueForm.note}
                  onChange={(e) => setQueueForm({ ...queueForm, note: e.target.value })}
                  placeholder="Görüşme öncesi eklemek istediğiniz detaylar..."
                  rows={3}
                  className="w-full p-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Dialog.Close asChild>
                  <button type="button" className="px-4 py-2 border border-border hover:bg-accent rounded-lg text-xs font-bold cursor-pointer">
                    Vazgeç
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-500 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-sm"
                >
                  Kuyruğa Ekle
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Aday Kartı Dönüştürme Modalı */}
      <Dialog.Root open={convertModalOpen} onOpenChange={setConvertModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-md z-50 animate-in fade-in zoom-in-95 duration-150 select-none">
            <Dialog.Title className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
              <UserPlus className="h-4.5 w-4.5 text-emerald-500" />
              Yeni Aday Kartı Oluştur
            </Dialog.Title>

            <form onSubmit={handleConvertSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Ad *</label>
                  <input
                    type="text"
                    required
                    value={convertForm.firstName}
                    onChange={(e) => setConvertForm({ ...convertForm, firstName: e.target.value })}
                    placeholder="Ad"
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Soyad *</label>
                  <input
                    type="text"
                    required
                    value={convertForm.lastName}
                    onChange={(e) => setConvertForm({ ...convertForm, lastName: e.target.value })}
                    placeholder="Soyad"
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Firma Adı (Opsiyonel)</label>
                <input
                  type="text"
                  value={convertForm.companyName}
                  onChange={(e) => setConvertForm({ ...convertForm, companyName: e.target.value })}
                  placeholder="Firma Adı"
                  className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none font-semibold"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Dialog.Close asChild>
                  <button type="button" className="px-4 py-2 border border-border hover:bg-accent rounded-lg text-xs font-bold cursor-pointer">
                    Vazgeç
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-500 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-sm"
                >
                  Oluştur
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

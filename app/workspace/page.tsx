'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  Phone, 
  User, 
  MapPin, 
  Briefcase, 
  AlertCircle, 
  Clock, 
  CheckCircle,
  HelpCircle,
  Play,
  FileText,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  Sliders,
  Filter,
  Search,
  Send,
  MessageSquare,
  PlusCircle,
  ArrowRight,
  Smile,
  Shield,
  Clock3,
  Calendar
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { formatLeadId, getProgressiveCallSchedule } from '@/lib/utils'

export default function WorkspacePage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const leadIdParam = searchParams.get('id')

  // Profile and active status state
  const [profile, setProfile] = useState<any>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [status, setStatus] = useState('active') // active, inactive, away

  // Leads and tasks states
  const [leads, setLeads] = useState<any[]>([])

  const [tasks, setTasks] = useState<any[]>([])
  const [callsToday, setCallsToday] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)



  // Lookups
  const [outcomes, setOutcomes] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [salesReps, setSalesReps] = useState<any[]>([])
  const [provinces, setProvinces] = useState<any[]>([])
  const [sources, setSources] = useState<any[]>([])

  const [selectedLead, setSelectedLead] = useState<any>(null)
  const [editFormOpen, setEditFormOpen] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    phone: '',
    secondaryPhone: '',
    email: '',
    provinceId: '',
    district: '',
    requestedProduct: '',
    assignedSalesUserId: '',
    statusId: '',
    sourceId: '',
    priority: 'normal',
    temperature: 'warm',
    note: '',
    leadQualityStatus: '',
    callbackStatus: 'none',
    callbackDate: '',
    callbackTime: '',
    callbackNotes: ''
  })

  // Lead detail modal
  const [selectedLeadDetail, setSelectedLeadDetail] = useState<any>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [adminTimeline, setAdminTimeline] = useState<any[]>([])
  const [loadingTimeline, setLoadingTimeline] = useState(false)

  // Filter state for prioritized list
  const [searchQuery, setSearchQuery] = useState('')
  const [totalCalls, setTotalCalls] = useState(0)
  const [activeTab, setActiveTab] = useState<'toCall' | 'neverCalled' | 'calledToday' | 'calledTotal' | 'totalIncoming'>('toCall')
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
  const [calendarView, setCalendarView] = useState<'horizontal' | 'grid'>('horizontal')
  const [copiedForwardText, setCopiedForwardText] = useState(false)
  const [editMode, setEditMode] = useState<'outcome' | 'full'>('outcome')
  const [quickStatus, setQuickStatus] = useState<'reached' | 'missed' | 'forward'>('reached')
  const [quickNotes, setQuickNotes] = useState('')
  const [quickSalesUserId, setQuickSalesUserId] = useState('')
  const [quickCallbackDate, setQuickCallbackDate] = useState('')
  const [quickCallbackTime, setQuickCallbackTime] = useState('')
  const [messagedTodayLeads, setMessagedTodayLeads] = useState<Set<string>>(new Set())
  const [selectedLeadCalls, setSelectedLeadCalls] = useState<any[]>([])
  const [isRetryAttempt, setIsRetryAttempt] = useState(false)
  const [sortCriteria, setSortCriteria] = useState<'default' | 'last_contact' | 'created_at' | 'name' | 'id_desc' | 'id_asc'>('default')

  // Live time tracking & alert states
  const [currentTime, setCurrentTime] = useState<Date>(new Date())
  const [isAlertCollapsed, setIsAlertCollapsed] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 15000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    async function init() {
      // 1. Fetch current profile
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (prof) {
          setProfile(prof)
          setStatus(prof.status || 'active')
          
          // 2. Fetch lookups & user data
          fetchData(prof.id, prof.role)
        }
      }
      setLoadingProfile(false)
    }

    async function loadLookups() {
      const { data: outcomesList } = await supabase.from('call_outcomes').select('*').eq('is_active', true).order('sort_order', { ascending: true })
      const { data: productsList } = await supabase.from('products').select('*').eq('is_active', true)
      const { data: reps } = await supabase.from('profiles').select('id, full_name').eq('role', 'sales_specialist').eq('is_active', true).order('full_name')
      const { data: provs } = await supabase.from('provinces').select('id, name').eq('is_active', true).order('name')
      const { data: sourcesList } = await supabase.from('lead_sources').select('id, name').eq('is_active', true).order('name')
      
      if (outcomesList) setOutcomes(outcomesList)
      if (productsList) setProducts(productsList)
      if (reps) {
        const EXCEL_REPS = ["Yunus Emre", "Onur", "Kaan", "Sefa", "Mustafa", "Anıl", "Batucan", "Kerem", "Emre", "Osman", "Black Sea", "Berke", "Anıl ve Onur"]
        const filtered = reps.filter(r => 
          EXCEL_REPS.some(er => 
            r.full_name.toLowerCase().includes(er.toLowerCase()) || 
            er.toLowerCase().includes(r.full_name.toLowerCase())
          )
        )
        setSalesReps(filtered)
      }
      if (provs) setProvinces(provs)
      if (sourcesList) setSources(sourcesList)
    }

    init()
    loadLookups()
  }, [supabase])

  // Listen to realtime updates to auto-refresh lists
  useEffect(() => {
    if (!profile) return

    const channel = supabase
      .channel('workspace_realtime_refreshes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads'
        },
        () => {
          fetchData(profile.id, profile.role)
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls'
        },
        () => {
          fetchData(profile.id, profile.role)
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          fetchData(profile.id, profile.role)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile, supabase])

  // Fetch detailed administrative log history (timeline) for selected lead
  useEffect(() => {
    const activeLead = selectedLeadDetail || selectedLead
    const isModalOpen = detailModalOpen || editFormOpen

    if (!activeLead || !isModalOpen || !(profile?.role === 'super_admin' || profile?.role === 'admin')) {
      setAdminTimeline([])
      return
    }

    async function fetchTimeline() {
      setLoadingTimeline(true)
      try {
        // 1. Fetch activities
        const { data: activities } = await supabase
          .from('activities')
          .select('*')
          .eq('entity_id', activeLead.id)
          .eq('entity_type', 'lead')

        // 2. Fetch calls
        const { data: calls } = await supabase
          .from('calls')
          .select('*')
          .eq('lead_id', activeLead.id)

        // 3. Fetch messages from WhatsApp conversation
        const { data: conv } = await supabase
          .from('conversations')
          .select('id')
          .eq('lead_id', activeLead.id)
          .eq('channel', 'whatsapp')
          .single()

        let messages: any[] = []
        if (conv) {
          const { data: msgs } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conv.id)
          if (msgs) messages = msgs
        }

        const timelineItems: any[] = []

        if (activities) {
          activities.forEach((act: any) => {
            timelineItems.push({
              id: act.id,
              timestamp: new Date(act.created_at),
              type: 'activity',
              title: act.title,
              description: act.description,
              badge: 'İşlem'
            })
          })
        }

        if (calls) {
          calls.forEach((c: any) => {
            timelineItems.push({
              id: c.id,
              timestamp: new Date(c.created_at || c.started_at),
              type: 'call',
              title: c.direction === 'incoming' ? 'Gelen Arama' : 'Giden Arama',
              description: `${(c.status === 'completed' || c.status === 'answered') ? '✅ Konuşuldu' : '❌ Cevap Yok'} - ${c.notes || ''}`,
              badge: 'Arama'
            })
          })
        }

        if (messages) {
          messages.forEach((m: any) => {
            timelineItems.push({
              id: m.id,
              timestamp: new Date(m.sent_at || m.created_at),
              type: 'message',
              title: m.direction === 'outgoing' ? 'WhatsApp Mesajı Gönderildi' : 'WhatsApp Mesajı Alındı',
              description: m.content,
              badge: 'WhatsApp'
            })
          })
        }

        timelineItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        setAdminTimeline(timelineItems)
      } catch (err) {
        console.error('Error fetching admin timeline:', err)
      } finally {
        setLoadingTimeline(false)
      }
    }

    fetchTimeline()
  }, [selectedLeadDetail, selectedLead, detailModalOpen, editFormOpen, profile, supabase])

  useEffect(() => {
    if (leads && leads.length > 0) {
      if (tabParam) {
        setActiveTab(tabParam as any)
      }
      if (leadIdParam) {
        const found = leads.find(l => l.id === leadIdParam)
        if (found) {
          setSelectedLeadDetail(found)
          setDetailModalOpen(true)
        }
      }
    }
  }, [leads, tabParam, leadIdParam])

  const fetchData = async (userId: string, role: string) => {
    setLoadingData(true)
    try {
      const todayStart = new Date()
      todayStart.setHours(0,0,0,0)

      // Determine query filter based on role (call center rep or sales rep)
      const isSales = role === 'sales_specialist'

      // A. Fetch Assigned Leads
      let query = supabase
        .from('leads')
        .select(`
          *,
          lead_statuses(name, color),
          lead_sources(name, code),
          calls(id, status, created_at)
        `)
        .eq('is_active', true)

      if (isSales) {
        query = query.eq('assigned_sales_user_id', userId)
      } else {
        query = query.or(`assigned_call_center_user_id.eq.${userId},legacy_source_file.not.is.null,source_id.eq.11111111-0000-0000-0000-000000000005`)
      }

      const { data: assignedLeads } = await query

      if (assignedLeads) {
        setLeads(assignedLeads)
      }

      // B. Fetch Tasks
      const { data: userTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', userId)
        .eq('is_active', true)
        .in('status', ['pending', 'ongoing'])

      if (userTasks) {
        setTasks(userTasks)
      }

      // C. Fetch Calls logged today by user
      const { data: userCalls } = await supabase
        .from('calls')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', todayStart.toISOString())

      if (userCalls) {
        setCallsToday(userCalls)
      }

      // C2. Fetch WhatsApp Messages sent today by user
      const { data: userMessages } = await supabase
        .from('messages')
        .select('conversation:conversations(lead_id)')
        .eq('sender_user_id', userId)
        .eq('channel', 'whatsapp')
        .gte('created_at', todayStart.toISOString())

      if (userMessages) {
        const ids = new Set<string>(
          userMessages
            .map((m: any) => m.conversation?.lead_id)
            .filter(Boolean)
        )
        setMessagedTodayLeads(ids)
      } else {
        setMessagedTodayLeads(new Set())
      }

      // D. Fetch Total calls logged by user
      const { count: totalCallsCount, error: totalCallsErr } = await supabase
        .from('calls')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      if (!totalCallsErr && totalCallsCount !== null) {
        setTotalCalls(totalCallsCount)
      }

    } catch (err) {
      console.error('Data fetch error:', err)
    } finally {
      setLoadingData(false)
    }
  }

  // Helper to identify WhatsApp leads
  const isWhatsAppLead = (l: any) => {
    return (
      l.source_id === '474b7a22-c53f-43ba-a8bd-75ce0977a798' || 
      l.source_id === '11111111-0000-0000-0000-000000000005' ||
      l.status_id === '22222222-0000-0000-0000-000000000020' ||
      l.lead_sources?.code === 'META_WA'
    ) && l.legacy_source_file === null;
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!profile) return
    setStatus(newStatus)
    try {
      await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', profile.id)
    } catch (err) {
      console.error(err)
    }
  }

  // Helper date matches
  const isToday = (dateStr: string) => {
    if (!dateStr) return false
    const d = new Date(dateStr)
    const today = new Date()
    return d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
  }

  const isPast = (dateStr: string) => {
    if (!dateStr) return false
    const d = new Date(dateStr)
    const now = new Date()
    return d < now && !isToday(dateStr)
  }

  const getUpcomingCallbacksGrouped = () => {
    const activeCallbacks = leads.filter(l => {
      if (!l.next_contact_at) return false

      // Exclude WhatsApp leads that have not had any calls logged yet
      const isWa = (l.source_id === '474b7a22-c53f-43ba-a8bd-75ce0977a798' || l.lead_sources?.code === 'META_WA') && l.legacy_source_file === null;
      if (isWa && (!l.calls || l.calls.length === 0)) {
        return false;
      }

      const isUnresolved = l.status_id !== '22222222-0000-0000-0000-000000000009' && // Satış Uzmanına İletildi
                           l.status_id !== '22222222-0000-0000-0000-000000000012' && // İlgilenmiyor
                           l.status_id !== '22222222-0000-0000-0000-000000000007';   // Görüşme Yapıldı
      return isUnresolved
    })

    const groups: { [key: string]: any[] } = {}
    activeCallbacks.forEach(l => {
      const d = new Date(l.next_contact_at)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const dateKey = `${year}-${month}-${day}`
      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(l)
    })

    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => new Date(a.next_contact_at).getTime() - new Date(b.next_contact_at).getTime())
    })

    const sortedKeys = Object.keys(groups).sort()
    
    return sortedKeys.map(key => {
      return {
        dateStr: key,
        leads: groups[key]
      }
    })
  }

  const formatGroupDateHeader = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    
    const tomorrow = new Date()
    tomorrow.setDate(now.getDate() + 1)
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

    const formattedDate = d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const dayName = d.toLocaleDateString('tr-TR', { weekday: 'long' })

    if (dateStr === todayStr) {
      return `Bugün (${formattedDate} - ${dayName})`
    } else if (dateStr === tomorrowStr) {
      return `Yarın (${formattedDate} - ${dayName})`
    } else {
      return `${dayName} (${formattedDate})`
    }
  }

  const getNextContactBadge = (lead: any) => {
    if (!lead.next_contact_at) return null;
    const date = new Date(lead.next_contact_at);
    const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const isPastVal = date.getTime() < Date.now();
    
    if (isPastVal) {
      const diffMs = Date.now() - date.getTime();
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      let timeLabel = '';
      if (diffHrs >= 24) {
        const diffDays = Math.floor(diffHrs / 24);
        const remainingHrs = diffHrs % 24;
        timeLabel = `${diffDays} gün ${remainingHrs} sa ${diffMins} dk önce`;
      } else if (diffHrs > 0) {
        timeLabel = `${diffHrs} sa ${diffMins} dk önce`;
      } else {
        timeLabel = `${diffMins} dk önce`;
      }
      return (
        <span className="inline-flex items-center gap-1 text-[9px] font-black bg-rose-500/10 text-rose-600 px-2 py-0.5 rounded-full select-none" title={`Planlanan: ${date.toLocaleString('tr-TR')}`}>
          ⏱️ Gecikti: {timeStr} ({timeLabel})
        </span>
      );
    } else {
      const diffMs = date.getTime() - Date.now();
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      let timeLabel = '';
      if (diffHrs >= 24) {
        const diffDays = Math.floor(diffHrs / 24);
        const remainingHrs = diffHrs % 24;
        timeLabel = `${diffDays} gün ${remainingHrs} sa ${diffMins} dk sonra`;
      } else if (diffHrs > 0) {
        timeLabel = `${diffHrs} sa ${diffMins} dk sonra`;
      } else {
        timeLabel = `${diffMins} dk sonra`;
      }
      const attemptCount = lead.calls?.length || 0;
      const label = attemptCount > 0 ? 'Yeniden Arama' : 'İlk Arama';
      return (
        <span className="inline-flex items-center gap-1 text-[9px] font-black bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full select-none" title={`Planlanan: ${date.toLocaleString('tr-TR')}`}>
          ⏱️ {label}: {timeStr} ({timeLabel})
        </span>
      );
    }
  }

  // Categorize and filter leads
  const now = new Date()
  const categorizedLeads = leads.map(l => {
    let priorityGroup = 5 // 1: Overdue, 2: Today, 3: New, 4: Geri arama, 5: Upcoming/Normal
    let statusClass = 'text-slate-500'
    let bgClass = 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
    
    // 1. Overdue
    if (l.next_contact_at && isPast(l.next_contact_at)) {
      priorityGroup = 1
      statusClass = 'text-red-500 font-bold'
      bgClass = 'bg-red-500/5 border-red-500/30'
    } 
    // 2. Today
    else if (l.next_contact_at && isToday(l.next_contact_at)) {
      priorityGroup = 2
      statusClass = 'text-amber-500 font-bold'
      bgClass = 'bg-amber-500/5 border-amber-500/30'
    }
    // 3. New
    else if ((l.lead_statuses?.name === 'Yeni Lead' || l.lead_statuses?.name === 'Yeni' || !l.next_contact_at) && !l.legacy_source_file) {
      priorityGroup = 3
      statusClass = 'text-blue-500 font-bold'
      bgClass = 'bg-blue-500/5 border-blue-500/30'
    }

    return { ...l, priorityGroup, bgClass, statusClass }
  })

  // Sorting: group priority first
  const sortedLeads = [...categorizedLeads].sort((a, b) => a.priorityGroup - b.priorityGroup)

  // 1. Bugün Aranacaklar: not forwarded or disinterested
  // - Legacy leads (imported from Excel) must have a next_contact_at scheduled for today or past to show up.
  // - CRM leads can have no schedule (next_contact_at is null, meaning needs first call) or scheduled for today or past.
  // 1. Bugün Aranacaklar: not forwarded, disinterested or already talked
  // - Legacy leads (imported from Excel) must have a next_contact_at scheduled in the past or present to show up.
  // - CRM leads can have no schedule (next_contact_at is null, meaning needs first call) or scheduled in the past or present.
  const bugunAranacakLeads = sortedLeads.filter(l => 
    !isWhatsAppLead(l) && 
    l.status_id !== '22222222-0000-0000-0000-000000000009' && 
    l.status_id !== '22222222-0000-0000-0000-000000000012' &&
    l.status_id !== '22222222-0000-0000-0000-000000000007' &&
    !l.sales_representative_text &&
    (
      l.next_contact_at 
        ? (isToday(l.next_contact_at) || isPast(l.next_contact_at))
        : (!l.legacy_source_file)
    )
  )

  // 2. Bugün Yapılan Aramalar: matched by lead ids in calls logged today OR WhatsApp messages sent today
  const leadIdsCalledToday = new Set(callsToday.map(c => c.lead_id))
  const bugunYapilanLeads = sortedLeads.filter(l => 
    !isWhatsAppLead(l) && (leadIdsCalledToday.has(l.id) || messagedTodayLeads.has(l.id))
  )

  // 3. Toplam Yapılmış Aramalar: called at least once (last_contact_at is not null) or legacy leads (Excel imported data) where conversation was completed
  // For real-time WhatsApp leads, only count them if they have been added to the call queue (next_contact_at is not null or callback_status is 'pending') OR if they have logged calls.
  const toplamYapilanLeads = sortedLeads.filter(l => {
    if (isWhatsAppLead(l)) {
      return l.next_contact_at !== null || l.callback_status === 'pending' || (l.calls && l.calls.length > 0);
    }
    return l.last_contact_at !== null || (l.legacy_source_file !== null && l.conversation_completed !== null) || !!l.sales_representative_text;
  })

  // 4. Toplam Ulaşan: all leads that have been converted/registered (excluding raw WhatsApp chats)
  const toplamUlasanLeads = sortedLeads.filter(l => 
    l.status_id !== '22222222-0000-0000-0000-000000000020'
  )

  // 5. Hiç Aranmamışlar: not forwarded, disinterested or already talked, AND last_contact_at is null AND calls.length is 0
  const hicAranmamisLeads = sortedLeads.filter(l => 
    !isWhatsAppLead(l) && 
    l.status_id !== '22222222-0000-0000-0000-000000000009' && 
    l.status_id !== '22222222-0000-0000-0000-000000000012' &&
    l.status_id !== '22222222-0000-0000-0000-000000000007' &&
    (l.last_contact_at === null || !l.calls || l.calls.length === 0) &&
    !l.sales_representative_text
  )

  // Overdue callbacks filter logic
  const overdueCallbackLeads = leads.filter(l => {
    if (!l.next_contact_at) return false;
    const isUnresolved = l.status_id !== '22222222-0000-0000-0000-000000000009' && // Satış Uzmanına İletildi
                         l.status_id !== '22222222-0000-0000-0000-000000000012' && // İlgilenmiyor
                         l.status_id !== '22222222-0000-0000-0000-000000000007';   // Görüşme Yapıldı
    if (!isUnresolved) return false;
    const nextContactDate = new Date(l.next_contact_at);
    return nextContactDate <= currentTime;
  });

  // Apply search query to helper lists
  const applySearch = (list: any[]) => {
    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase().trim()
    const cleanQ = q.replace(/\D/g, '')

    return list.filter(l => {
      const matchesText = 
        (l.company_name && l.company_name.toLowerCase().includes(q)) ||
        (l.full_name && l.full_name.toLowerCase().includes(q)) ||
        (l.first_name && l.first_name.toLowerCase().includes(q)) ||
        (l.last_name && l.last_name.toLowerCase().includes(q))
      
      const matchesPhone = cleanQ && (
        (l.phone && l.phone.replace(/\D/g, '').includes(cleanQ)) ||
        (l.phone_normalized && l.phone_normalized.replace(/\D/g, '').includes(cleanQ)) ||
        (l.secondary_phone && l.secondary_phone.replace(/\D/g, '').includes(cleanQ))
      )
      
      return matchesText || matchesPhone
    })
  }

  const filteredBugunAranacak = applySearch(bugunAranacakLeads)
  const filteredBugunYapilan = applySearch(bugunYapilanLeads)
  const filteredToplamYapilan = applySearch(toplamYapilanLeads)
  const filteredToplamUlasan = applySearch(toplamUlasanLeads)

  const getSortedAndFilteredLeads = (list: any[]) => {
    const sorted = [...list]
    if (sortCriteria === 'id_desc') {
      return sorted.sort((a, b) => {
        const idA = a.legacy_lead_id || a.lead_number || ''
        const idB = b.legacy_lead_id || b.lead_number || ''
        return idB.localeCompare(idA, undefined, { numeric: true, sensitivity: 'base' })
      })
    }
    if (sortCriteria === 'id_asc') {
      return sorted.sort((a, b) => {
        const idA = a.legacy_lead_id || a.lead_number || ''
        const idB = b.legacy_lead_id || b.lead_number || ''
        return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' })
      })
    }
    if (sortCriteria === 'last_contact') {
      return sorted.sort((a, b) => {
        const dateA = a.last_contact_at ? new Date(a.last_contact_at).getTime() : 0
        const dateB = b.last_contact_at ? new Date(b.last_contact_at).getTime() : 0
        return dateB - dateA
      })
    }
    if (sortCriteria === 'created_at') {
      return sorted.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
        return dateB - dateA
      })
    }
    if (sortCriteria === 'name') {
      return sorted.sort((a, b) => {
        const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim().toLocaleLowerCase('tr-TR')
        const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim().toLocaleLowerCase('tr-TR')
        return nameA.localeCompare(nameB, 'tr-TR')
      })
    }
    return sorted
  }

  const getActiveLeads = () => {
    if (activeTab === 'toCall') return filteredBugunAranacak
    if (activeTab === 'neverCalled') return applySearch(hicAranmamisLeads)
    if (activeTab === 'calledToday') return filteredBugunYapilan
    if (activeTab === 'calledTotal') return getSortedAndFilteredLeads(filteredToplamYapilan)
    return getSortedAndFilteredLeads(filteredToplamUlasan)
  }

  // Counters calculations
  const overdueCount = categorizedLeads.filter(l => l.priorityGroup === 1).length
  const todayCount = categorizedLeads.filter(l => l.priorityGroup === 2).length
  const newCount = categorizedLeads.filter(l => l.priorityGroup === 3).length
  const openTasksCount = tasks.length
  const completedCallsToday = callsToday.length

  const statusIdToName = (statusId: string) => {
    if (statusId === '22222222-0000-0000-0000-000000000001') return 'Yeni Lead'
    if (statusId === '22222222-0000-0000-0000-000000000009') return 'Satış Uzmanına İletildi'
    if (statusId === '22222222-0000-0000-0000-000000000005') return 'Ulaşılamadı'
    if (statusId === '22222222-0000-0000-0000-000000000006') return 'Geri Aranacak'
    if (statusId === '22222222-0000-0000-0000-000000000007') return 'Görüşme Yapıldı'
    if (statusId === '22222222-0000-0000-0000-000000000012') return 'İlgilenmiyor'
    if (statusId === '22222222-0000-0000-0000-000000000016') return 'Veri Yok'
    return 'Görüşme Yapıldı'
  }

  // Phone normalization helper
  const normalizePhone = (phone: string): string => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length === 10 && digits.startsWith('5')) {
      return '90' + digits
    } else if (digits.length === 11 && digits.startsWith('05')) {
      return '90' + digits.substring(1)
    } else if (digits.length === 12 && digits.startsWith('90')) {
      return digits
    }
    return digits
  }

  const handleCopyForwardText = () => {
    if (!selectedLead) return
    const id = formatLeadId(selectedLead.legacy_lead_id || selectedLead.lead_number)
    const name = `${selectedLead.first_name} ${selectedLead.last_name}`
    const company = selectedLead.company_name || 'Şahıs Firması'
    const phone = selectedLead.phone
    const location = selectedLead.city || selectedLead.province || 'Belirtilmemiş'
    const product = selectedLead.requested_product || 'Cihaz belirtilmemiş'
    
    const text = `${id} - ${name} - ${company} - ${phone} - ${location} - ${product} talep ediyor.`
    
    navigator.clipboard.writeText(text)
    setCopiedForwardText(true)
    setTimeout(() => setCopiedForwardText(false), 2000)
  }

  // Edit Allowed Fields
  const handleOpenEdit = async (lead: any) => {
    setEditMode('outcome')
    setQuickNotes('')
    setQuickSalesUserId(lead.assigned_sales_user_id || '')
    setQuickStatus('reached')
    setQuickCallbackDate('')
    setQuickCallbackTime('')
    setSelectedLead(lead)
    setSelectedLeadCalls([])
    
    // Automatically check the retry attempt flag if lead has a pending callback or next contact time set
    setIsRetryAttempt(lead.callback_status === 'pending' || !!lead.next_contact_at)

    // Fetch previous calls history
    const { data: leadCalls } = await supabase
      .from('calls')
      .select('*, call_outcomes(name)')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
    if (leadCalls) {
      setSelectedLeadCalls(leadCalls)
    }

    setEditForm({
      firstName: lead.first_name || '',
      lastName: lead.last_name || '',
      companyName: lead.company_name || '',
      phone: lead.phone || '',
      secondaryPhone: lead.secondary_phone || '',
      email: lead.email || '',
      provinceId: lead.province_id || '',
      district: lead.district || '',
      requestedProduct: lead.requested_product || '',
      assignedSalesUserId: lead.assigned_sales_user_id || '',
      statusId: lead.status_id || '',
      sourceId: lead.source_id || '',
      priority: lead.priority || 'normal',
      temperature: lead.temperature || 'warm',
      note: '',
      leadQualityStatus: lead.lead_quality_category || '',
      callbackStatus: lead.callback_status || 'none',
      callbackDate: lead.callback_date || '',
      callbackTime: lead.callback_time ? lead.callback_time.substring(0, 5) : '',
      callbackNotes: lead.callback_notes || ''
    })
    setEditFormOpen(true)
  }

  const handleLeadQualityChange = (val: string) => {
    const nextForm = { ...editForm, leadQualityStatus: val }
    if (val === 'not_interested') {
      nextForm.statusId = '22222222-0000-0000-0000-000000000012' // İlgilenmiyor
      nextForm.callbackStatus = 'none'
    } else if (val === 'unreachable') {
      nextForm.statusId = '22222222-0000-0000-0000-000000000005' // Ulaşılamadı
      nextForm.callbackStatus = 'none'
    } else if (val === 'callback') {
      nextForm.statusId = '22222222-0000-0000-0000-000000000006' // Geri Aranacak
      nextForm.callbackStatus = 'pending'
      if (!nextForm.callbackDate) {
        nextForm.callbackDate = new Date().toISOString().split('T')[0]
      }
    }
    setEditForm(nextForm)
  }

  const handleStatusIdChange = (val: string) => {
    const nextForm = { ...editForm, statusId: val }
    if (val === '22222222-0000-0000-0000-000000000012') {
      nextForm.leadQualityStatus = 'not_interested'
      nextForm.callbackStatus = 'none'
    } else if (val === '22222222-0000-0000-0000-000000000005') {
      nextForm.leadQualityStatus = 'unreachable'
      nextForm.callbackStatus = 'none'
    } else if (val === '22222222-0000-0000-0000-000000000009') {
      nextForm.leadQualityStatus = 'potential'
      nextForm.callbackStatus = 'none'
    } else if (val === '22222222-0000-0000-0000-000000000006') {
      nextForm.callbackStatus = 'pending'
      nextForm.leadQualityStatus = 'callback'
      if (!nextForm.callbackDate) {
        nextForm.callbackDate = new Date().toISOString().split('T')[0]
      }
    }
    setEditForm(nextForm)
  }

  const handleQuickOutcomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLead || !profile) return
    setSavingEdit(true)
    try {
      const nowStr = new Date().toISOString()
      let finalNotes = selectedLead.extra_notes || ''
      const attemptPrefix = isRetryAttempt ? `[Yeniden Arama - ${selectedLeadCalls.length + 1}. Deneme] ` : ''

      if (quickStatus === 'reached') {
        let callbackDateStr = null
        let callbackStatus = 'none'
        let targetStatusId = '22222222-0000-0000-0000-000000000007' // Görüşme Yapıldı
        
        let noteText = attemptPrefix + (quickNotes.trim() || 'Arama Yapıldı (Görüşme Yapıldı)')

        if (quickCallbackDate && quickCallbackTime) {
          const targetDate = new Date(`${quickCallbackDate}T${quickCallbackTime}`)
          callbackDateStr = targetDate.toISOString()
          callbackStatus = 'pending'
          targetStatusId = '22222222-0000-0000-0000-000000000006' // Geri Aranacak
          
          noteText += ` (Geri Arama Planlandı: ${targetDate.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })})`
        }
        
        finalNotes = `[${new Date().toLocaleString('tr-TR')}] - ${noteText}\n` + finalNotes

        // 1. Update Lead
        const { error } = await supabase
          .from('leads')
          .update({
            status_id: targetStatusId,
            last_contact_at: nowStr,
            next_contact_at: callbackDateStr,
            callback_status: callbackStatus,
            extra_notes: finalNotes
          })
          .eq('id', selectedLead.id)
        if (error) throw error

        // 2. Insert Call Log
        const outcome = outcomes.find(o => o.name.toLowerCase().includes('görüşme') || o.name.toLowerCase().includes('ulaşıldı'))
        const { error: callErr } = await supabase.from('calls').insert({
          lead_id: selectedLead.id,
          user_id: profile.id,
          direction: 'outgoing',
          phone_number: selectedLead.phone,
          outcome_id: outcome?.id || null,
          notes: noteText,
          duration_seconds: 60,
          status: 'completed'
        })
        if (callErr) throw callErr

      } else if (quickStatus === 'missed') {
        const noteText = 'Cevap Vermedi / Açmadı (Arama Yapıldı)'
        const actualCount = selectedLeadCalls.length
        const { nextContactAt, callbackStatus, attemptInfo } = getProgressiveCallSchedule(actualCount)
        const noteTextWithAttempt = noteText + attemptInfo
        finalNotes = `[${new Date().toLocaleString('tr-TR')}] - ${noteTextWithAttempt}\n` + (selectedLead.extra_notes || '')

        // 2. Update Lead
        const { error } = await supabase
          .from('leads')
          .update({
            status_id: '22222222-0000-0000-0000-000000000005', // Ulaşılamadı
            last_contact_at: nowStr,
            next_contact_at: nextContactAt,
            callback_status: callbackStatus,
            extra_notes: finalNotes
          })
          .eq('id', selectedLead.id)
        if (error) throw error

        // 3. Insert Call Log
        const outcome = outcomes.find(o => o.name.toLowerCase().includes('ulaşılmadı') || o.name.toLowerCase().includes('açmadı'))
        const { error: callErr } = await supabase.from('calls').insert({
          lead_id: selectedLead.id,
          user_id: profile.id,
          direction: 'outgoing',
          phone_number: selectedLead.phone,
          outcome_id: outcome?.id || null,
          notes: noteTextWithAttempt,
          duration_seconds: 0,
          status: 'missed'
        })
        if (callErr) throw callErr

      } else if (quickStatus === 'forward') {
        if (!quickSalesUserId) {
          alert('Lütfen bir Satış Danışmanı seçin.')
          setSavingEdit(false)
          return
        }
        const selectedRep = salesReps.find(r => r.id === quickSalesUserId)
        const noteText = attemptPrefix + (quickNotes.trim() ? `Satış Danışmanına Yönlendirildi. Not: ${quickNotes.trim()}` : 'Satış Danışmanına Yönlendirildi')
        finalNotes = `[${new Date().toLocaleString('tr-TR')}] - ${noteText}\n` + finalNotes

        // 1. Update Lead
        const { error } = await supabase
          .from('leads')
          .update({
            status_id: '22222222-0000-0000-0000-000000000009', // Satış Uzmanına İletildi
            assigned_sales_user_id: quickSalesUserId,
            sales_representative_text: selectedRep ? selectedRep.full_name : null,
            forwarded_to_sales_at: nowStr,
            next_contact_at: null, // Clear call queue schedule
            callback_status: 'none',
            lead_quality_category: 'potential',
            lead_quality_manually_overridden: true,
            lead_quality_overridden_by: profile.id,
            lead_quality_overridden_at: nowStr,
            lead_quality_reason: 'Satış uzmanına iletildiği için otomatik potansiyel yapıldı',
            extra_notes: finalNotes
          })
          .eq('id', selectedLead.id)
        if (error) throw error

        // 2. Send Notification
        await supabase.from('notifications').insert({
          user_id: quickSalesUserId,
          type: 'assigned_lead',
          title: 'Yeni Lead Yönlendirildi',
          message: `${profile.full_name} temsilcisi, ${selectedLead.first_name} ${selectedLead.last_name} isimli lead'i size yönlendirdi.`,
          entity_type: 'lead',
          entity_id: selectedLead.id
        })

        // 3. Log Activity
        await supabase.from('activities').insert({
          entity_type: 'lead',
          entity_id: selectedLead.id,
          activity_type: 'forwarded_to_sales',
          title: 'Satış Danışmanına Yönlendirildi',
          description: `Müşteri, ${selectedRep?.full_name || 'Satış Uzmanı'} danışmanına yönlendirildi.`,
          user_id: profile.id
        })
      }

      alert('Arama sonucu başarıyla kaydedildi.')
      fetchData(profile.id, profile.role)
      setEditFormOpen(false)
    } catch (err: any) {
      alert('İşlem kaydedilemedi: ' + err.message)
    } finally {
      setSavingEdit(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLead || !profile) return

    // Validation: If status is 'Satış Uzmanına İletildi' (statusId = 22222222-0000-0000-0000-000000000009),
    // they must select a sales rep.
    if (editForm.statusId === '22222222-0000-0000-0000-000000000009' && !editForm.assignedSalesUserId) {
      alert('Lütfen makine talebi için bir Satış Danışmanı seçin.')
      return
    }

    setSavingEdit(true)
    try {
      const selectedProvince = provinces.find(p => p.id === editForm.provinceId)
      const selectedRep = salesReps.find(r => r.id === editForm.assignedSalesUserId)

      let finalNotes = selectedLead.extra_notes || ''
      if (editForm.note.trim()) {
        const timeStr = new Date().toLocaleString('tr-TR')
        const attemptPrefix = isRetryAttempt ? `[Yeniden Arama - ${selectedLeadCalls.length + 1}. Deneme] ` : ''
        finalNotes = `[${timeStr}] - ${attemptPrefix}${editForm.note.trim()}\n` + finalNotes
      }

      const updatePayload: any = {
        first_name: editForm.firstName,
        last_name: editForm.lastName,
        company_name: editForm.companyName,
        phone: editForm.phone,
        phone_normalized: normalizePhone(editForm.phone),
        secondary_phone: editForm.secondaryPhone,
        email: editForm.email,
        province_id: editForm.provinceId || null,
        province: selectedProvince ? selectedProvince.name : selectedLead.province,
        district: editForm.district || null,
        requested_product: editForm.requestedProduct,
        assigned_sales_user_id: editForm.assignedSalesUserId || null,
        sales_representative_text: selectedRep ? selectedRep.full_name : null,
        status_id: editForm.statusId || selectedLead.status_id,
        source_id: editForm.sourceId || null,
        priority: editForm.priority || 'normal',
        temperature: editForm.temperature || 'warm',
        extra_notes: finalNotes,
        lead_quality_category: editForm.leadQualityStatus || null,
        callback_status: editForm.callbackStatus,
        callback_date: editForm.callbackDate || null,
        callback_time: editForm.callbackTime || null,
        callback_notes: editForm.callbackNotes || null
      }

      if (editForm.leadQualityStatus) {
        updatePayload.lead_quality_manually_overridden = true;
        updatePayload.lead_quality_overridden_by = profile.id;
        updatePayload.lead_quality_overridden_at = new Date().toISOString();
        updatePayload.lead_quality_reason = editForm.note.trim() ? `Temsilci güncellemesi: ${editForm.note.trim()}` : 'Temsilci güncellemesi';
      }

      // If a call note is registered, also update last_contact_at
      if (editForm.note.trim()) {
        updatePayload.last_contact_at = new Date().toISOString()
      }

      // If assigned sales user is set or status is updated to Satış Uzmanına İletildi
      if (editForm.assignedSalesUserId && (!selectedLead.assigned_sales_user_id || editForm.statusId === '22222222-0000-0000-0000-000000000009')) {
        updatePayload.status_id = '22222222-0000-0000-0000-000000000009' // Satış Uzmanına İletildi
        updatePayload.forwarded_to_sales_at = new Date().toISOString()
        updatePayload.lead_quality_category = 'potential' // Auto-set to potential when forwarding!
        updatePayload.lead_quality_manually_overridden = true;
        updatePayload.lead_quality_overridden_by = profile.id;
        updatePayload.lead_quality_overridden_at = new Date().toISOString();
        updatePayload.lead_quality_reason = 'Satış uzmanına iletildiği için otomatik potansiyel yapıldı';
      }

      // If status is updated to Ulaşılamadı and no callback date is specified manually, calculate progressive next_contact_at
      if (updatePayload.status_id === '22222222-0000-0000-0000-000000000005' && !editForm.callbackDate) {
        const actualCount = selectedLeadCalls.length
        const { nextContactAt, callbackStatus } = getProgressiveCallSchedule(actualCount)
        updatePayload.next_contact_at = nextContactAt
        updatePayload.callback_status = callbackStatus
      }

      const { error: updateErr } = await supabase
        .from('leads')
        .update(updatePayload)
        .eq('id', selectedLead.id)

      if (updateErr) throw new Error(updateErr.message)

      // B. Create a Call Record if a note was added or status changed to unreachable (Ulaşılamadı)
      const isUnreachableStatus = updatePayload.status_id === '22222222-0000-0000-0000-000000000005'
      if (editForm.note.trim() || isUnreachableStatus) {
        const currentStatus = editForm.statusId || selectedLead.status_id
        const statusName = statusIdToName(currentStatus)
        const outcome = outcomes.find(o => o.name.toLowerCase().includes(statusName.toLowerCase()))
        
        let callNotes = editForm.note.trim()
        let callStatus = 'completed'
        let callDuration = 60
        
        if (isUnreachableStatus) {
          const actualCount = selectedLeadCalls.length
          const { attemptInfo } = getProgressiveCallSchedule(actualCount)
          callNotes = (callNotes ? `${callNotes} - ` : '') + `Cevap Vermedi / Açmadı (Arama Yapıldı)${attemptInfo}`
          callStatus = 'missed'
          callDuration = 0
        } else if (isRetryAttempt) {
          callNotes = `[Yeniden Arama - ${selectedLeadCalls.length + 1}. Deneme] ${callNotes}`
        }
        
        const { error: callErr } = await supabase.from('calls').insert({
          lead_id: selectedLead.id,
          user_id: profile.id,
          direction: 'outgoing',
          phone_number: selectedLead.phone,
          outcome_id: outcome?.id || outcomes[0]?.id || null,
          notes: callNotes,
          duration_seconds: callDuration,
          status: callStatus
        })
        if (callErr) throw callErr
      }

      // C. Trigger a notification if forwarded to sales
      if (editForm.assignedSalesUserId && editForm.assignedSalesUserId !== selectedLead.assigned_sales_user_id) {
        await supabase.from('notifications').insert({
          user_id: editForm.assignedSalesUserId,
          type: 'assigned_lead',
          title: 'Yeni Lead Yönlendirildi',
          message: `${profile.full_name} temsilcisi, ${editForm.firstName} ${editForm.lastName} isimli lead'i size yönlendirdi.`,
          entity_type: 'lead',
          entity_id: selectedLead.id
        })
      }

      fetchData(profile.id, profile.role)
      setEditFormOpen(false)
    } catch (err: any) {
      alert('Güncelleme kaydedilemedi: ' + err.message)
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <div className="space-y-6 select-none pb-8">
      
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {profile ? `Hoş geldiniz, ${profile.full_name}` : 'Hoş geldiniz'}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-semibold">Durumunuz:</span>
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="h-9 text-xs bg-card border border-border rounded-lg px-2.5 font-bold focus:outline-none cursor-pointer"
          >
            <option value="active">🟢 Aktif / Çalışıyor</option>
            <option value="away">🟡 Dışarıda / Molada</option>
            <option value="inactive">🔴 Meşgul / Toplantıda</option>
          </select>
          <button 
            onClick={() => profile && fetchData(profile.id, profile.role)}
            className="h-9 w-9 bg-card border border-border rounded-lg flex items-center justify-center cursor-pointer transition-colors"
            title="Yenile"
          >
            <RefreshCw className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      </div>

      {/* 2. Operations Counters Area */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Counter: Bugün Aranacak */}
        <button
          onClick={() => setActiveTab('toCall')}
          className={`bg-card border rounded-xl p-4 shadow-xs flex flex-col justify-between h-20 text-left cursor-pointer transition-all ${
            activeTab === 'toCall'
              ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/[0.02]'
              : 'border-border hover:border-amber-500/50'
          }`}
        >
          <span className="text-[9px] font-bold text-muted-foreground uppercase">Bugün Aranacaklar</span>
          <h3 className="text-xl font-extrabold text-amber-500">{bugunAranacakLeads.length}</h3>
        </button>

        {/* Counter: Hiç Aranmamışlar */}
        <button
          onClick={() => setActiveTab('neverCalled')}
          className={`bg-card border rounded-xl p-4 shadow-xs flex flex-col justify-between h-20 text-left cursor-pointer transition-all ${
            activeTab === 'neverCalled'
              ? 'border-violet-500 ring-2 ring-violet-500/20 bg-violet-500/[0.02]'
              : 'border-border hover:border-violet-500/50'
          }`}
        >
          <span className="text-[9px] font-bold text-muted-foreground uppercase">Hiç Aranmamışlar</span>
          <h3 className="text-xl font-extrabold text-violet-500">{hicAranmamisLeads.length}</h3>
        </button>

        {/* Counter: Bugün Yapılan Aramalar */}
        <button
          onClick={() => setActiveTab('calledToday')}
          className={`bg-card border rounded-xl p-4 shadow-xs flex flex-col justify-between h-20 text-left cursor-pointer transition-all ${
            activeTab === 'calledToday'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/[0.02]'
              : 'border-border hover:border-emerald-500/50'
          }`}
        >
          <span className="text-[9px] font-bold text-muted-foreground uppercase">Bugün Yapılan Aramalar</span>
          <h3 className="text-xl font-extrabold text-emerald-500">{bugunYapilanLeads.length}</h3>
        </button>

        {/* Counter: Toplam Yapılmış Aramalar */}
        <button
          onClick={() => setActiveTab('calledTotal')}
          className={`bg-card border rounded-xl p-4 shadow-xs flex flex-col justify-between h-20 text-left cursor-pointer transition-all ${
            activeTab === 'calledTotal'
              ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-500/[0.02]'
              : 'border-border hover:border-indigo-500/50'
          }`}
        >
          <span className="text-[9px] font-bold text-muted-foreground uppercase">Toplam Yapılmış Aramalar</span>
          <h3 className="text-xl font-extrabold text-indigo-500">{toplamYapilanLeads.length}</h3>
        </button>

        {/* Counter: Toplam Ulaşan */}
        <button
          onClick={() => setActiveTab('totalIncoming')}
          className={`bg-card border rounded-xl p-4 shadow-xs flex flex-col justify-between h-20 text-left cursor-pointer transition-all ${
            activeTab === 'totalIncoming'
              ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-500/[0.02]'
              : 'border-border hover:border-blue-500/50'
          }`}
        >
          <span className="text-[9px] font-bold text-muted-foreground uppercase">Toplam Ulaşan</span>
          <h3 className="text-xl font-extrabold text-blue-500">{toplamUlasanLeads.length}</h3>
        </button>
      </div>

      {/* 3. Call priority calling list */}
      
        <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-border bg-accent/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Phone className="h-4.5 w-4.5 text-primary" />
              Çağrı Takip Listesi
            </h3>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
              {/* Search Bar */}
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Telefon veya firma adı ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 bg-card border border-border rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent transition-all font-semibold"
                />
              </div>

              {(activeTab === 'calledTotal' || activeTab === 'totalIncoming') && (
                <div className="flex items-center gap-1.5 shrink-0 bg-muted/50 p-1.5 border border-border rounded-lg">
                  <span className="text-[10px] font-extrabold text-muted-foreground whitespace-nowrap uppercase tracking-wider">Sırala:</span>
                  <select
                    value={sortCriteria}
                    onChange={(e) => setSortCriteria(e.target.value as any)}
                    className="h-6 text-[10px] font-bold bg-card border border-border rounded-md px-1.5 focus:outline-none cursor-pointer text-foreground"
                  >
                    <option value="default">Öncelik Sırası</option>
                    <option value="id_desc">ID (Büyük-Küçük)</option>
                    <option value="id_asc">ID (Küçük-Büyük)</option>
                    <option value="last_contact">Son İletişim (Yeni-Eski)</option>
                    <option value="created_at">Kayıt Tarihi (Yeni-Eski)</option>
                    <option value="name">İsim (A-Z)</option>
                  </select>
                </div>
              )}

              {/* View Mode Switcher */}
              <div className="flex items-center bg-muted p-0.5 rounded-lg border border-border shrink-0">
                <button
                  onClick={() => setViewMode('table')}
                  className={`h-7 px-3 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Excel Görünümü
                </button>
                <button
                  onClick={() => setViewMode('card')}
                  className={`h-7 px-3 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                    viewMode === 'card'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Kart Görünümü
                </button>
              </div>
            </div>
          </div>

          {/* Tab Content Container */}
          <div className="p-4 overflow-x-auto">
            {loadingData ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-xs">Verileriniz yükleniyor...</p>
              </div>
            ) : getActiveLeads().length === 0 ? (
              <div className="text-center py-16 text-xs text-muted-foreground">
                Seçili listede aktif kriterlere uygun kayıt bulunmuyor.
              </div>
            ) : (
              viewMode === 'table' ? (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-accent/20 border-b border-border/70 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      <th className="p-3.5 whitespace-nowrap">ID</th>
                      <th className="p-3.5 whitespace-nowrap">Ad Soyad</th>
                      <th className="p-3.5 whitespace-nowrap">Telefon (Ana)</th>
                      <th className="p-3.5 whitespace-nowrap">Cihaz/Ürün</th>
                      <th className="p-3.5 whitespace-nowrap">İl</th>
                      <th className="p-3.5 whitespace-nowrap">İletilen Satışçı</th>
                      <th className="p-3.5 whitespace-nowrap">Durum</th>
                      <th className="p-3.5 text-center whitespace-nowrap">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {getActiveLeads().map((lead) => (
                      <tr key={lead.id} className={`hover:bg-muted/30 transition-colors font-medium border-l-4 ${
                        activeTab === 'calledToday' && lead.status_id === '22222222-0000-0000-0000-000000000005'
                          ? 'border-l-rose-500 bg-rose-500/[0.02]'
                          : (!lead.last_contact_at && (!lead.calls || lead.calls.length === 0) && !lead.sales_representative_text)
                            ? 'border-l-violet-500 bg-violet-500/[0.02]'
                            : lead.priorityGroup === 1 ? 'border-l-red-500 bg-red-500/[0.01]' :
                              lead.priorityGroup === 2 ? 'border-l-amber-500 bg-amber-500/[0.01]' :
                              lead.priorityGroup === 3 ? 'border-l-blue-500 bg-blue-500/[0.01]' : 'border-l-transparent'
                      }`}>
                        <td className="p-3.5 font-mono text-[10px] text-muted-foreground whitespace-nowrap">{formatLeadId(lead.legacy_lead_id || lead.lead_number)}</td>
                        <td className="p-3.5 whitespace-nowrap" title={`${lead.first_name} ${lead.last_name}`}>
                          <div className="flex items-center gap-1.5 truncate max-w-[250px]">
                            <span className="font-bold text-foreground truncate">{lead.first_name} {lead.last_name}</span>
                            {(lead.lead_sources?.code === 'APIFY' || lead.source_id === '11111111-0000-0000-0000-000000000015') && (
                              <span className="inline-flex items-center text-[8px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25 px-1.5 py-0.5 rounded select-none uppercase tracking-wide shrink-0">
                                Script Müşterisi
                              </span>
                            )}
                          </div>
                          {!lead.last_contact_at && (!lead.calls || lead.calls.length === 0) && !lead.sales_representative_text && (
                            <div className="mt-1">
                              <span className="inline-flex items-center gap-1 text-[9px] font-black bg-violet-500/10 text-violet-600 px-2 py-0.5 rounded-full select-none">
                                ✨ HİÇ ARANMADI
                              </span>
                            </div>
                          )}
                          {lead.next_contact_at && (
                            <div className="mt-1">{getNextContactBadge(lead)}</div>
                          )}
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <a href={`tel:${lead.phone}`} className="text-primary hover:underline flex items-center gap-1 font-semibold whitespace-nowrap">
                            <Phone className="h-3.5 w-3.5 shrink-0" />
                            {lead.phone}
                          </a>
                        </td>
                        <td className="p-3.5 font-semibold text-foreground truncate max-w-[120px] whitespace-nowrap">{lead.requested_product || '-'}</td>
                        <td className="p-3.5 text-muted-foreground whitespace-nowrap">{lead.province || lead.city || '-'}</td>
                        <td className="p-3.5 font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                          {lead.sales_representative_text || '-'}
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded" style={{
                            backgroundColor: lead.lead_statuses?.color + '15' || '#eaeaea',
                            color: lead.lead_statuses?.color || '#555'
                          }}>
                            {lead.lead_statuses?.name}
                          </span>
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            {activeTab !== 'calledTotal' && activeTab !== 'totalIncoming' && (
                              <button
                                onClick={() => {
                                  setSelectedLeadDetail(lead)
                                  setDetailModalOpen(true)
                                }}
                                className="h-7 px-2 border border-border hover:bg-accent rounded-md text-[10px] font-semibold cursor-pointer"
                              >
                                Detay
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenEdit(lead)}
                              className="h-7 px-2.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-md text-[10px] font-bold cursor-pointer flex items-center gap-1 shadow-sm whitespace-nowrap"
                            >
                              <Sliders className="h-3 w-3" />
                              {lead.status_id === '22222222-0000-0000-0000-000000000005'
                                ? `${(lead.calls?.length || 0) + 1}. Arama Yap`
                                : 'Güncelle'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
                  {getActiveLeads().map((lead) => {
                    const attemptCount = lead.calls?.length || 0;
                    if (activeTab === 'neverCalled') {
                      return (
                        <div 
                          key={lead.id} 
                          className="bg-muted/30 border border-violet-500/35 bg-violet-500/[0.01] hover:border-violet-500 rounded-xl p-3.5 flex flex-col justify-between space-y-3.5 hover:shadow-xs transition-all duration-200 relative group animate-in fade-in duration-200"
                        >
                          <div className="space-y-2.5">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-muted-foreground font-mono">{formatLeadId(lead.legacy_lead_id || lead.lead_number)}</span>
                                {(lead.lead_sources?.code === 'APIFY' || lead.source_id === '11111111-0000-0000-0000-000000000015') && (
                                  <span className="inline-flex items-center text-[8px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25 px-1 rounded select-none uppercase tracking-wide">
                                    Script Müşterisi
                                  </span>
                                )}
                              </div>
                              <span className="inline-flex items-center gap-0.5 text-[8px] font-bold bg-violet-500/10 text-violet-600 px-1.5 py-0.5 rounded-full select-none uppercase tracking-wider">
                                ✨ HİÇ ARANMADI
                              </span>
                            </div>
                            
                            <div>
                              <h5 className="font-extrabold text-foreground text-xs">{lead.first_name} {lead.last_name}</h5>
                              <p className="text-[10px] font-semibold text-muted-foreground truncate">{lead.company_name || 'Şahıs Firması'}</p>
                              {lead.requested_product && (
                                <span className="inline-block mt-1.5 text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                                  {lead.requested_product}
                                </span>
                              )}
                            </div>

                            <a 
                              href={`tel:${lead.phone}`} 
                              className="text-xs font-bold text-primary hover:underline flex items-center gap-1 whitespace-nowrap"
                            >
                              <Phone className="h-3.5 w-3.5 shrink-0" />
                              {lead.phone}
                            </a>
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => {
                                setSelectedLeadDetail(lead)
                                setDetailModalOpen(true)
                              }}
                              className="flex-1 h-7 border border-border hover:bg-accent rounded-md text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              Detay
                            </button>
                            <button
                              onClick={() => handleOpenEdit(lead)}
                              className="flex-1 h-7 bg-violet-600 hover:bg-violet-700 text-white rounded-md text-[10px] font-black cursor-pointer transition-colors flex items-center justify-center gap-1 shadow-xs"
                            >
                              <Sliders className="h-3.5 w-3.5" />
                              Arama Yap
                            </button>
                          </div>
                        </div>
                      )
                    }

                    if (activeTab === 'toCall') {
                      const isUncalled = !lead.last_contact_at && (!lead.calls || lead.calls.length === 0) && !lead.sales_representative_text;
                      return (
                        <div 
                          key={lead.id} 
                          className={`bg-muted/30 border rounded-xl p-3.5 flex flex-col justify-between space-y-3.5 hover:shadow-xs transition-all duration-200 relative group ${
                            isUncalled 
                              ? 'border-violet-500/35 bg-violet-500/[0.01] hover:border-violet-500/50' 
                              : lead.priorityGroup === 1 ? 'border-rose-500/30 bg-rose-500/[0.01] hover:border-rose-500/50' :
                                lead.priorityGroup === 2 ? 'border-amber-500/30 bg-amber-500/[0.01] hover:border-amber-500/50' :
                                lead.priorityGroup === 3 ? 'border-blue-500/30 bg-blue-500/[0.01] hover:border-blue-500/50' :
                                'border-border/80 hover:border-primary/50'
                          }`}
                        >
                          <div className="space-y-2.5">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-muted-foreground font-mono">{formatLeadId(lead.legacy_lead_id || lead.lead_number)}</span>
                                {(lead.lead_sources?.code === 'APIFY' || lead.source_id === '11111111-0000-0000-0000-000000000015') && (
                                  <span className="inline-flex items-center text-[8px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25 px-1 rounded select-none uppercase tracking-wide">
                                    Script Müşterisi
                                  </span>
                                )}
                              </div>
                              {isUncalled ? (
                                <span className="inline-flex items-center gap-0.5 text-[8px] font-bold bg-violet-500/10 text-violet-600 px-1.5 py-0.5 rounded-full select-none uppercase tracking-wider">
                                  ✨ HİÇ ARANMADI
                                </span>
                              ) : lead.next_contact_at && getNextContactBadge(lead)}
                            </div>
                            
                            <div>
                              <h5 className="font-extrabold text-foreground text-xs">{lead.first_name} {lead.last_name}</h5>
                              <p className="text-[10px] font-semibold text-muted-foreground truncate">{lead.company_name || 'Şahıs Firması'}</p>
                              {lead.requested_product && (
                                <span className="inline-block mt-1.5 text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                                  {lead.requested_product}
                                </span>
                              )}
                            </div>

                            <a 
                              href={`tel:${lead.phone}`} 
                              className="text-xs font-bold text-primary hover:underline flex items-center gap-1 whitespace-nowrap"
                            >
                              <Phone className="h-3.5 w-3.5 shrink-0" />
                              {lead.phone}
                            </a>
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => {
                                setSelectedLeadDetail(lead)
                                setDetailModalOpen(true)
                              }}
                              className="flex-1 h-7 border border-border hover:bg-accent rounded-md text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              Detay
                            </button>
                            <button
                              onClick={() => handleOpenEdit(lead)}
                              className={`flex-1 h-7 rounded-md text-[10px] font-black cursor-pointer transition-colors flex items-center justify-center gap-1 shadow-xs ${
                                isUncalled ? 'bg-violet-600 hover:bg-violet-700 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'
                              }`}
                            >
                              <Sliders className="h-3.5 w-3.5" />
                              {lead.status_id === '22222222-0000-0000-0000-000000000005'
                                ? `${(lead.calls?.length || 0) + 1}. Arama`
                                : 'Arama Yap'}
                            </button>
                          </div>
                        </div>
                      )
                    } else if (activeTab === 'calledToday') {
                      const isUnreachable = lead.status_id === '22222222-0000-0000-0000-000000000005';
                      return (
                        <div 
                          key={lead.id} 
                          className={`bg-muted/30 border rounded-xl p-3.5 flex flex-col justify-between space-y-3.5 hover:shadow-xs transition-all duration-200 relative group ${
                            isUnreachable 
                              ? 'border-rose-500/35 bg-rose-500/[0.01] hover:border-rose-500' 
                              : 'border-border/80 hover:border-emerald-500/50'
                          }`}
                        >
                          <div className="space-y-2.5">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-muted-foreground font-mono">{formatLeadId(lead.legacy_lead_id || lead.lead_number)}</span>
                                {(lead.lead_sources?.code === 'APIFY' || lead.source_id === '11111111-0000-0000-0000-000000000015') && (
                                  <span className="inline-flex items-center text-[8px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25 px-1 rounded select-none uppercase tracking-wide">
                                    Script Müşterisi
                                  </span>
                                )}
                              </div>
                              {isUnreachable ? (
                                <span className="inline-flex items-center gap-0.5 text-[8px] font-bold bg-rose-500/10 text-rose-600 px-1.5 py-0.5 rounded-full select-none animate-pulse">
                                  🔇 Ulaşılamadı ({(lead.calls?.length || 0)} Arama)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-[8px] font-bold bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded-full select-none">
                                  ✓ Bugün Arandı
                                </span>
                              )}
                            </div>
                            
                            <div>
                              <h5 className="font-extrabold text-foreground text-xs">{lead.first_name} {lead.last_name}</h5>
                              <p className="text-[10px] font-semibold text-muted-foreground truncate">{lead.company_name || 'Şahıs Firması'}</p>
                              {lead.requested_product && (
                                <span className="inline-block mt-1.5 text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                                  {lead.requested_product}
                                </span>
                              )}
                            </div>

                            <a 
                              href={`tel:${lead.phone}`} 
                              className="text-xs font-bold text-primary hover:underline flex items-center gap-1 whitespace-nowrap"
                            >
                              <Phone className="h-3.5 w-3.5 shrink-0" />
                              {lead.phone}
                            </a>
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => {
                                setSelectedLeadDetail(lead)
                                setDetailModalOpen(true)
                              }}
                              className="flex-1 h-7 border border-border hover:bg-accent rounded-md text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              Detay
                            </button>
                            <button
                              onClick={() => handleOpenEdit(lead)}
                              className={`flex-1 h-7 rounded-md text-[10px] font-black cursor-pointer transition-colors flex items-center justify-center gap-1 ${
                                isUnreachable 
                                  ? 'bg-rose-500 hover:bg-rose-600 text-white' 
                                  : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                              }`}
                            >
                              <Sliders className="h-3.5 w-3.5" />
                              {isUnreachable
                                ? `${(lead.calls?.length || 0) + 1}. Arama`
                                : 'Tekrar Güncelle'}
                            </button>
                          </div>
                        </div>
                      )
                    } else {
                      const isUnreachable = lead.status_id === '22222222-0000-0000-0000-000000000005';
                      return (
                        <div 
                          key={lead.id} 
                          className="bg-muted/30 border border-border/80 rounded-xl p-3.5 flex flex-col justify-between space-y-3.5 hover:border-primary/50 hover:shadow-xs transition-all duration-200 relative group"
                        >
                          <div className="space-y-2.5">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-muted-foreground font-mono">{formatLeadId(lead.legacy_lead_id || lead.lead_number)}</span>
                                {(lead.lead_sources?.code === 'APIFY' || lead.source_id === '11111111-0000-0000-0000-000000000015') && (
                                  <span className="inline-flex items-center text-[8px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25 px-1 rounded select-none uppercase tracking-wide">
                                    Script Müşterisi
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded" style={{
                                  backgroundColor: lead.lead_statuses?.color + '15' || '#eaeaea',
                                  color: lead.lead_statuses?.color || '#555'
                                }}>
                                  {lead.lead_statuses?.name}
                                </span>
                                <span className="text-[9px] font-bold text-muted-foreground bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{lead.province || lead.city || '-'}</span>
                              </div>
                            </div>
                            
                            <div>
                              <h5 className="font-extrabold text-foreground text-xs">{lead.first_name} {lead.last_name}</h5>
                              <p className="text-[10px] font-semibold text-muted-foreground truncate">{lead.company_name || 'Şahıs Firması'}</p>
                              {lead.requested_product && (
                                <span className="inline-block mt-1.5 text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                                  {lead.requested_product}
                                </span>
                              )}
                            </div>
                            <a 
                              href={`tel:${lead.phone}`} 
                              className="text-xs font-bold text-primary hover:underline flex items-center gap-1 whitespace-nowrap"
                            >
                              <Phone className="h-3.5 w-3.5 shrink-0" />
                              {lead.phone}
                            </a>
                          </div>
                          
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => {
                                setSelectedLeadDetail(lead)
                                setDetailModalOpen(true)
                              }}
                              className="flex-1 h-7 border border-border hover:bg-accent rounded-md text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              Detay
                            </button>
                            <button
                              onClick={() => handleOpenEdit(lead)}
                              className="flex-1 h-7 bg-primary text-primary-foreground hover:bg-primary/95 rounded-md text-[10px] font-black cursor-pointer transition-colors flex items-center justify-center gap-1"
                            >
                              <Sliders className="h-3.5 w-3.5" />
                              {isUnreachable
                                ? `${(lead.calls?.length || 0) + 1}. Arama`
                                : 'Güncelle'}
                            </button>
                          </div>
                        </div>
                      )
                    }
                  })}
                </div>
              )
            )}
          </div>
        </div>

      {/* GÜN GÜN YENİDEN ARANACAKLAR ALANI */}
      {activeTab === 'toCall' && (
        <div className="mt-6 bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-border bg-accent/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Calendar className="h-4.5 w-4.5 text-amber-500" />
                Gün Gün Yeniden Aranacaklar Takvimi
              </h3>
              <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">Planlanmış ileri tarihli tüm geri aramalarınızın günlük dökümü</p>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-muted p-0.5 rounded-lg border border-border shrink-0 select-none">
              <button
                onClick={() => setCalendarView('horizontal')}
                className={`h-7 px-3 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                  calendarView === 'horizontal'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Yatay Görünüm
              </button>
              <button
                onClick={() => setCalendarView('grid')}
                className={`h-7 px-3 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                  calendarView === 'grid'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Kutu Görünümü
              </button>
            </div>
          </div>

          <div className="p-4">
            {getUpcomingCallbacksGrouped().length === 0 ? (
              <div className="text-center py-10 text-xs text-muted-foreground font-semibold">
                Planlanmış ileri tarihli arama bulunmuyor.
              </div>
            ) : (
              calendarView === 'horizontal' ? (
                <div className="flex overflow-x-auto gap-6 pb-4 scrollbar-thin select-none items-start">
                  {getUpcomingCallbacksGrouped().map((group) => (
                    <div key={group.dateStr} className="min-w-[280px] sm:min-w-[320px] max-w-[350px] bg-muted/10 border border-border/70 rounded-xl p-3.5 flex flex-col space-y-3 shrink-0">
                      {/* Day Header */}
                      <h4 className="text-[11px] font-black text-amber-600 bg-amber-500/10 px-3 py-1.5 rounded-lg inline-block uppercase tracking-wide w-full text-center">
                        {formatGroupDateHeader(group.dateStr)}
                      </h4>
                      
                      {/* List of Leads - Stacked vertically */}
                      <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
                        {group.leads.map((lead: any) => {
                          const attemptCount = lead.calls?.length || 0;
                          const nextContactDate = new Date(lead.next_contact_at);
                          const timeStr = nextContactDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                          const isOverdue = nextContactDate < currentTime;

                          return (
                            <div
                              key={lead.id}
                              className={`bg-card border border-border/80 rounded-xl p-3.5 flex flex-col justify-between space-y-3.5 hover:border-amber-500/50 hover:shadow-xs transition-all duration-200 relative group ${
                                isOverdue ? 'border-rose-500/30 bg-rose-500/[0.01]' : ''
                              }`}
                            >
                              <div className="space-y-2.5">
                                <div className="flex justify-between items-start">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-bold text-muted-foreground font-mono">
                                      {formatLeadId(lead.legacy_lead_id || lead.lead_number)}
                                    </span>
                                    {(lead.lead_sources?.code === 'APIFY' || lead.source_id === '11111111-0000-0000-0000-000000000015') && (
                                      <span className="inline-flex items-center text-[8px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25 px-1 rounded select-none uppercase tracking-wide">
                                        Script Müşterisi
                                      </span>
                                    )}
                                  </div>
                                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                    isOverdue 
                                      ? 'bg-rose-500/10 text-rose-600 animate-pulse' 
                                      : 'bg-amber-500/10 text-amber-600'
                                  }`}>
                                    <Clock3 className="h-3 w-3" />
                                    {timeStr} {isOverdue && '(Gecikti)'}
                                  </span>
                                </div>

                                <div>
                                  <h5 className="font-extrabold text-foreground text-xs">{lead.first_name} {lead.last_name}</h5>
                                  <p className="text-[10px] font-semibold text-muted-foreground truncate">{lead.company_name || 'Şahıs Firması'}</p>
                                  {lead.requested_product && (
                                    <span className="inline-block mt-1.5 text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                                      {lead.requested_product}
                                    </span>
                                  )}
                                </div>

                                <a
                                  href={`tel:${lead.phone}`}
                                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1 whitespace-nowrap"
                                >
                                  <Phone className="h-3.5 w-3.5 shrink-0" />
                                  {lead.phone}
                                </a>
                              </div>

                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  onClick={() => {
                                    setSelectedLeadDetail(lead)
                                    setDetailModalOpen(true)
                                  }}
                                  className="flex-1 h-7 border border-border hover:bg-accent rounded-md text-[10px] font-bold cursor-pointer transition-colors"
                                >
                                  Detay
                                </button>
                                <button
                                  onClick={() => handleOpenEdit(lead)}
                                  className="flex-1 h-7 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-[10px] font-black cursor-pointer transition-colors flex items-center justify-center gap-1"
                                >
                                  <Sliders className="h-3 w-3" />
                                  {attemptCount > 0 ? `${attemptCount + 1}. Arama` : 'Arama Yap'}
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  {getUpcomingCallbacksGrouped().map((group) => (
                    <div key={group.dateStr} className="space-y-3">
                      {/* Day Header */}
                      <h4 className="text-[11px] font-black text-amber-600 bg-amber-500/10 px-3 py-1.5 rounded-lg inline-block uppercase tracking-wide">
                        {formatGroupDateHeader(group.dateStr)}
                      </h4>

                      {/* List of Leads - Grid layout */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-2 select-none">
                        {group.leads.map((lead: any) => {
                          const attemptCount = lead.calls?.length || 0;
                          const nextContactDate = new Date(lead.next_contact_at);
                          const timeStr = nextContactDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                          const isOverdue = nextContactDate < currentTime;

                          return (
                            <div
                              key={lead.id}
                              className={`bg-muted/30 border border-border/80 rounded-xl p-3.5 flex flex-col justify-between space-y-3.5 hover:border-amber-500/50 hover:shadow-xs transition-all duration-200 relative group ${
                                isOverdue ? 'border-rose-500/30 bg-rose-500/[0.01]' : ''
                              }`}
                            >
                              <div className="space-y-2.5">
                                <div className="flex justify-between items-start">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-bold text-muted-foreground font-mono">
                                      {formatLeadId(lead.legacy_lead_id || lead.lead_number)}
                                    </span>
                                    {(lead.lead_sources?.code === 'APIFY' || lead.source_id === '11111111-0000-0000-0000-000000000015') && (
                                      <span className="inline-flex items-center text-[8px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25 px-1 rounded select-none uppercase tracking-wide">
                                        Script Müşterisi
                                      </span>
                                    )}
                                  </div>
                                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                    isOverdue 
                                      ? 'bg-rose-500/10 text-rose-600 animate-pulse' 
                                      : 'bg-amber-500/10 text-amber-600'
                                  }`}>
                                    <Clock3 className="h-3 w-3" />
                                    {timeStr} {isOverdue && '(Gecikti)'}
                                  </span>
                                </div>

                                <div>
                                  <h5 className="font-extrabold text-foreground text-xs">{lead.first_name} {lead.last_name}</h5>
                                  <p className="text-[10px] font-semibold text-muted-foreground truncate">{lead.company_name || 'Şahıs Firması'}</p>
                                  {lead.requested_product && (
                                    <span className="inline-block mt-1.5 text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                                      {lead.requested_product}
                                    </span>
                                  )}
                                </div>

                                <a
                                  href={`tel:${lead.phone}`}
                                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1 whitespace-nowrap"
                                >
                                  <Phone className="h-3.5 w-3.5 shrink-0" />
                                  {lead.phone}
                                </a>
                              </div>

                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  onClick={() => {
                                    setSelectedLeadDetail(lead)
                                    setDetailModalOpen(true)
                                  }}
                                  className="flex-1 h-7 border border-border hover:bg-accent rounded-md text-[10px] font-bold cursor-pointer transition-colors"
                                >
                                  Detay
                                </button>
                                <button
                                  onClick={() => handleOpenEdit(lead)}
                                  className="flex-1 h-7 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-[10px] font-black cursor-pointer transition-colors flex items-center justify-center gap-1"
                                >
                                  <Sliders className="h-3 w-3" />
                                  {attemptCount > 0 ? `${attemptCount + 1}. Arama` : 'Arama Yap'}
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      )}
      

      {/* 4. UNIFIED CALL RESULT & EDIT & FORWARD DIALOG */}
      <Dialog.Root open={editFormOpen} onOpenChange={setEditFormOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-lg z-50 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto select-none">
            <div className="flex justify-between items-center mb-4 border-b border-border/50 pb-2">
              <Dialog.Title className="text-xs font-black text-foreground uppercase tracking-wider">
                {editMode === 'outcome' ? 'Hızlı Çağrı Sonuçlandır' : 'Müşteri Bilgilerini Düzenle'}
              </Dialog.Title>
              
              <button
                type="button"
                onClick={() => setEditMode(editMode === 'outcome' ? 'full' : 'outcome')}
                className="text-[10px] font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
              >
                {editMode === 'outcome' ? '⚙️ Detaylı Düzenleme' : '📞 Hızlı Sonuçlandırma'}
              </button>
            </div>
            
            {editMode === 'outcome' ? (
              <form onSubmit={handleQuickOutcomeSubmit} className="space-y-4">
                {selectedLead && (
                  <div className="p-3 bg-muted/40 border border-border/60 rounded-xl space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono">
                      <span>NO: {formatLeadId(selectedLead.legacy_lead_id || selectedLead.lead_number)}</span>
                      <span className="font-sans font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {selectedLead.requested_product || 'Cihaz Belirtilmemiş'}
                      </span>
                    </div>
                    <h4 className="font-extrabold text-foreground text-sm">
                      {selectedLead.first_name} {selectedLead.last_name}
                    </h4>
                    <p className="text-xs text-muted-foreground font-semibold flex items-center justify-between">
                      <span>{selectedLead.company_name || 'Şahıs Firması'}</span>
                      <span className="text-primary font-bold">{selectedLead.phone}</span>
                    </p>
                  </div>
                )}

                {/* Yeniden Arama Checkbox & Saatleri Listesi */}
                <div className="space-y-2.5">


                  {selectedLeadCalls.length > 0 && (
                    <div className="bg-muted/30 border border-border rounded-xl p-3 max-h-24 overflow-y-auto select-none space-y-1.5">
                      <span className="block text-[9px] font-black text-muted-foreground uppercase tracking-wider">⏳ Önceki Arama Saatleri ({selectedLeadCalls.length})</span>
                      <div className="space-y-1 text-[10px] font-semibold">
                        {selectedLeadCalls.map((call, idx) => (
                          <div key={call.id} className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                            <span>
                              {selectedLeadCalls.length - idx}. Deneme: {call.call_outcomes?.name || (call.status === 'no_answer' ? 'Cevap Vermedi' : 'Arama Yapıldı')}
                            </span>
                            <span className="font-mono text-muted-foreground text-[9px]">
                              {new Date(call.created_at || call.started_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Arama Sonucu Seçin</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setQuickStatus('reached')}
                      className={`h-11 rounded-lg border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center ${
                        quickStatus === 'reached'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 font-extrabold shadow-sm'
                          : 'border-border hover:bg-accent text-slate-600'
                      }`}
                    >
                      <span>📞 {selectedLeadCalls.length + 1}. Arama</span>
                      <span className="text-[9px] opacity-80 mt-0.5 font-medium">Ulaşıldı</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setQuickStatus('missed')}
                      className={`h-11 rounded-lg border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center ${
                        quickStatus === 'missed'
                          ? 'border-rose-500 bg-rose-500/10 text-rose-600 font-extrabold shadow-sm'
                          : 'border-border hover:bg-accent text-slate-600'
                      }`}
                    >
                      <span>🔇 {selectedLeadCalls.length + 1}. Arama</span>
                      <span className="text-[9px] opacity-80 mt-0.5 font-medium">Cevap Vermedi</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setQuickStatus('forward')}
                      className={`h-11 rounded-lg border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center ${
                        quickStatus === 'forward'
                          ? 'border-blue-500 bg-blue-500/10 text-blue-600 font-extrabold shadow-sm'
                          : 'border-border hover:bg-accent text-slate-600'
                      }`}
                    >
                      <span>➡️ Yönlendir</span>
                      <span className="text-[9px] opacity-80 mt-0.5 font-medium">Satışçı Listesi</span>
                    </button>
                  </div>
                </div>

                {quickStatus === 'reached' && (
                  <div className="space-y-3.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Arama Notu *</label>
                      <textarea
                        required
                        value={quickNotes}
                        onChange={(e) => setQuickNotes(e.target.value)}
                        placeholder="Müşteriyle yapılan görüşme detaylarını buraya girin..."
                        rows={3}
                        className="w-full p-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none font-medium"
                      />
                    </div>

                    {/* Optional Callback inputs */}
                    <div className="p-3 bg-amber-500/[0.03] border border-amber-500/20 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-wide">📅 Tekrar Aranmak İstiyor mu? (Opsiyonel)</span>
                        {(quickCallbackDate || quickCallbackTime) && (
                          <button
                            type="button"
                            onClick={() => {
                              setQuickCallbackDate('')
                              setQuickCallbackTime('')
                            }}
                            className="text-[9px] font-extrabold text-rose-500 hover:underline cursor-pointer"
                          >
                            Temizle
                          </button>
                        )}
                      </div>
                      <p className="text-[9px] text-muted-foreground font-semibold">Müşteri daha sonra tekrar aranmak isterse tarih ve saat seçin. Boş bırakırsanız arama olumlu sonuçlanarak kapatılır.</p>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Geri Arama Günü</label>
                          <input
                            type="date"
                            value={quickCallbackDate}
                            onChange={(e) => setQuickCallbackDate(e.target.value)}
                            className="w-full h-8 px-2.5 bg-background border border-border rounded-lg text-[10px] focus:ring-1 focus:ring-amber-500 focus:outline-none font-bold text-amber-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Geri Arama Saati</label>
                          <input
                            type="time"
                            value={quickCallbackTime}
                            onChange={(e) => setQuickCallbackTime(e.target.value)}
                            className="w-full h-8 px-2.5 bg-background border border-border rounded-lg text-[10px] focus:ring-1 focus:ring-amber-500 focus:outline-none font-bold text-amber-600"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {quickStatus === 'missed' && (
                  <div className="p-3.5 bg-rose-500/5 border border-rose-500/10 rounded-xl text-rose-600 text-xs leading-relaxed animate-in fade-in slide-in-from-top-1 duration-150">
                    <p className="font-bold">Müşteri "Ulaşılamadı (Cevap Vermedi / Açmadı)" olarak loglanacaktır.</p>
                    <p className="text-[10px] text-rose-500/80 mt-1 font-semibold">Bu işlem, lead'i bugünün aranacaklar listesinden çıkaracak ve bir cevapsız arama kaydı ekleyecektir.</p>
                  </div>
                )}

                {quickStatus === 'forward' && (
                  <div className="space-y-3.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    {selectedLead && (
                      <div className="p-3 bg-indigo-500/[0.03] border border-indigo-500/20 rounded-xl flex items-center justify-between gap-3">
                        <div className="text-[10px] text-muted-foreground font-semibold flex-1 truncate">
                          <span className="block font-bold text-[9px] uppercase tracking-wide mb-1 text-indigo-600 dark:text-indigo-400">Kopyalanacak Metin Taslağı</span>
                          <span className="font-mono text-[9.5px] text-slate-700 dark:text-slate-300 block truncate">
                            {formatLeadId(selectedLead.legacy_lead_id || selectedLead.lead_number)} - {selectedLead.first_name} {selectedLead.last_name} - {selectedLead.company_name || 'Şahıs Firması'} - {selectedLead.phone} - {selectedLead.city || selectedLead.province || 'Belirtilmemiş'} - {selectedLead.requested_product || 'Cihaz belirtilmemiş'} talep ediyor.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyForwardText}
                          className={`px-3 py-2 rounded-lg text-[10px] font-black cursor-pointer transition-all shrink-0 select-none flex items-center gap-1 ${
                            copiedForwardText
                              ? 'bg-emerald-500 text-white shadow-sm'
                              : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-sm'
                          }`}
                        >
                          {copiedForwardText ? '✓ Kopyalandı' : '📋 Kopyala'}
                        </button>
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Satış Danışmanı Seçin *</label>
                      <select
                        required
                        value={quickSalesUserId}
                        onChange={(e) => setQuickSalesUserId(e.target.value)}
                        className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer font-bold text-indigo-600 dark:text-indigo-400"
                      >
                        <option value="">Seçiniz...</option>
                        {salesReps.map(r => (
                          <option key={r.id} value={r.id}>{r.full_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Yönlendirme Notu</label>
                      <textarea
                        value={quickNotes}
                        onChange={(e) => setQuickNotes(e.target.value)}
                        placeholder="Satış temsilcisinin bilmesi gereken cihaz talebi detayları..."
                        rows={2.5}
                        className="w-full p-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none font-medium"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
                  <Dialog.Close asChild>
                    <button type="button" className="px-4 py-2 border border-border hover:bg-accent rounded-lg text-xs font-semibold cursor-pointer">Vazgeç</button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-lg text-xs hover:bg-primary/95 flex items-center gap-1 cursor-pointer shadow-md"
                  >
                    {savingEdit && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Kaydet ve Sonuçlandır
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleEditSubmit} className="space-y-4">
                {selectedLead && (
                  <div className="p-3 bg-muted/40 border border-border/60 rounded-xl space-y-1.5 text-xs">
                    <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono">
                      <span>NO: {formatLeadId(selectedLead.legacy_lead_id || selectedLead.lead_number)}</span>
                      <span className="font-sans font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {selectedLead.requested_product || 'Cihaz Belirtilmemiş'}
                      </span>
                    </div>
                    <h4 className="font-bold text-foreground">{selectedLead.first_name} {selectedLead.last_name}</h4>
                    <p className="text-muted-foreground font-semibold flex items-center justify-between">
                      <span>{selectedLead.company_name || 'Şahıs Firması'}</span>
                      <span className="text-primary font-bold">{selectedLead.phone}</span>
                    </p>
                    {selectedLead.extra_notes && (
                      <div className="pt-2 border-t border-border mt-1 text-[10px]">
                        <span className="block font-bold text-muted-foreground uppercase mb-1">Önceki Görüşme Geçmişi</span>
                        <div className="max-h-24 overflow-y-auto bg-card p-2 rounded border border-border text-slate-600 dark:text-slate-300 space-y-1 scrollbar-thin select-text font-medium">
                          {selectedLead.extra_notes.split('\n').filter((line: string) => line.trim()).map((line: string, idx: number) => (
                            <div key={idx} className="flex items-start gap-1">
                              <span className="text-amber-500 mt-1 select-none text-[8px]">•</span>
                              <span className="leading-tight">{line}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Ad *</label>
                  <input
                    type="text"
                    required
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Soyad *</label>
                  <input
                    type="text"
                    required
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Firma Adı</label>
                <input
                  type="text"
                  value={editForm.companyName}
                  onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                  className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Telefon (Ana) *</label>
                  <input
                    type="text"
                    required
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none font-semibold"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Diğer Tel</label>
                  <input
                    type="text"
                    value={editForm.secondaryPhone}
                    onChange={(e) => setEditForm({ ...editForm, secondaryPhone: e.target.value })}
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none font-semibold"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">E-posta</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Şehir / İl</label>
                  <select
                    value={editForm.provinceId}
                    onChange={(e) => setEditForm({ ...editForm, provinceId: e.target.value })}
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                  >
                    <option value="">İl seçin...</option>
                    {provinces.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">İlçe</label>
                  <input
                    type="text"
                    value={editForm.district}
                    onChange={(e) => setEditForm({ ...editForm, district: e.target.value })}
                    placeholder="İlçe girin..."
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Talep Ettiği Cihaz</label>
                  <select
                    value={editForm.requestedProduct}
                    onChange={(e) => setEditForm({ ...editForm, requestedProduct: e.target.value })}
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                  >
                    <option value="">Cihaz seçin...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Müşteri Sıcaklığı</label>
                  <select
                    value={editForm.temperature}
                    onChange={(e) => setEditForm({ ...editForm, temperature: e.target.value })}
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                  >
                    <option value="cold">❄️ Soğuk</option>
                    <option value="warm">🔥 Ilık</option>
                    <option value="hot">💥 Sıcak</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Lead Kaynağı</label>
                  <select
                    value={editForm.sourceId}
                    onChange={(e) => setEditForm({ ...editForm, sourceId: e.target.value })}
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                  >
                    <option value="">Kaynak seçin...</option>
                    {sources.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Görüşme Önceliği</label>
                  <select
                    value={editForm.priority}
                    onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer font-bold"
                  >
                    <option value="low">Düşük</option>
                    <option value="normal">Normal</option>
                    <option value="high">Yüksek</option>
                    <option value="critical">Kritik</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Satış Danışmanı</label>
                  <select
                    value={editForm.assignedSalesUserId}
                    onChange={(e) => setEditForm({ ...editForm, assignedSalesUserId: e.target.value })}
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer font-bold text-indigo-600 dark:text-indigo-400"
                  >
                    <option value="">Satış Danışmanına yönlendir...</option>
                    {salesReps.map(r => (
                      <option key={r.id} value={r.id}>{r.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Görüşme Durumu</label>
                  <select
                    value={editForm.statusId}
                    onChange={(e) => handleStatusIdChange(e.target.value)}
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer font-bold"
                  >
                    <option value="22222222-0000-0000-0000-000000000001">Yeni Lead</option>
                    <option value="22222222-0000-0000-0000-000000000007">Görüşme Yapıldı</option>
                    <option value="22222222-0000-0000-0000-000000000005">Ulaşılamadı</option>
                    <option value="22222222-0000-0000-0000-000000000006">Geri Aranacak</option>
                    <option value="22222222-0000-0000-0000-000000000012">İlgilenmiyor</option>
                    <option value="22222222-0000-0000-0000-000000000009">Satış Uzmanına İletildi</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Lead Kalitesi</label>
                <select
                  value={editForm.leadQualityStatus}
                  onChange={(e) => handleLeadQualityChange(e.target.value)}
                  className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer font-bold text-amber-600 dark:text-amber-400"
                >
                  <option value="">Belirtilmemiş (Veri Yok)</option>
                  <option value="unrelated">Alakasız / Konu Dışı Lead</option>
                  <option value="accidental_click">Yanlışlıkla Tıklayan / "Elim Çarptı"</option>
                  <option value="unreachable">Ulaşılamayan / Açmayan / Cevap Vermeyen</option>
                  <option value="not_interested">İlgilenmeyen / Vazgeçen / Başka Yerden Alan</option>
                  <option value="callback">Geri Aranacak / Bizi Arayacak (Callback)</option>
                  <option value="potential">Geriye Kalan Potansiyel Kayıt</option>
                </select>
              </div>

              {/* Geri Arama (Callback) Bilgileri */}
              <div className="bg-muted/30 p-3.5 rounded-xl border border-border/80 space-y-3">
                <span className="block text-[10px] font-extrabold text-foreground uppercase tracking-wider">Geri Arama (Callback) Bilgileri</span>
                
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="block text-[9px] font-bold text-muted-foreground mb-1 uppercase">Durum</label>
                    <select
                      value={editForm.callbackStatus}
                      onChange={(e) => setEditForm({ ...editForm, callbackStatus: e.target.value })}
                      className="w-full h-8 px-2 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                    >
                      <option value="none">Yok</option>
                      <option value="pending">Bekliyor</option>
                      <option value="completed">Tamamlandı</option>
                    </select>
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[9px] font-bold text-muted-foreground mb-1 uppercase">Tarih</label>
                    <input
                      type="date"
                      value={editForm.callbackDate}
                      onChange={(e) => setEditForm({ ...editForm, callbackDate: e.target.value })}
                      className="w-full h-8 px-2 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[9px] font-bold text-muted-foreground mb-1 uppercase">Saat</label>
                    <input
                      type="time"
                      value={editForm.callbackTime}
                      onChange={(e) => setEditForm({ ...editForm, callbackTime: e.target.value })}
                      className="w-full h-8 px-2 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-muted-foreground mb-1 uppercase">Geri Arama Notu</label>
                  <input
                    type="text"
                    value={editForm.callbackNotes}
                    onChange={(e) => setEditForm({ ...editForm, callbackNotes: e.target.value })}
                    placeholder="Geri arama hakkında kısa not..."
                    className="w-full h-8 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Yeniden Arama Checkbox & Saatleri Listesi */}
              <div className="space-y-2.5 my-3">


                {selectedLeadCalls.length > 0 && (
                  <div className="bg-muted/30 border border-border rounded-xl p-3 max-h-24 overflow-y-auto select-none space-y-1.5">
                    <span className="block text-[9px] font-black text-muted-foreground uppercase tracking-wider">⏳ Önceki Arama Saatleri ({selectedLeadCalls.length})</span>
                    <div className="space-y-1 text-[10px] font-semibold">
                      {selectedLeadCalls.map((call, idx) => (
                        <div key={call.id} className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                          <span>
                            {selectedLeadCalls.length - idx}. Deneme: {call.call_outcomes?.name || (call.status === 'no_answer' ? 'Cevap Vermedi' : 'Arama Yapıldı')}
                          </span>
                          <span className="font-mono text-muted-foreground text-[9px]">
                            {new Date(call.created_at || call.started_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Arama / Görüşme Notu</label>
                <textarea
                  value={editForm.note}
                  onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                  placeholder="Görüşme detaylarını girin (Not eklenirse görüşme logu otomatik yazılır)..."
                  rows={3}
                  className="w-full p-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none font-medium"
                />
              </div>

              {/* Yönetici İşlem Günlüğü (Timeline) */}
              {(profile?.role === 'super_admin' || profile?.role === 'admin') && (
                <div className="pt-3 border-t border-border space-y-2 select-text">
                  <span className="block text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase mb-1 tracking-wider">🔒 Yönetici İşlem Günlüğü (Timeline)</span>
                  <div className="max-h-40 overflow-y-auto bg-slate-50 dark:bg-slate-900 border border-border rounded-xl p-3 space-y-3.5 scrollbar-thin">
                    {loadingTimeline ? (
                      <div className="text-center py-4 text-[10px] text-muted-foreground font-bold">Yükleniyor...</div>
                    ) : adminTimeline.length === 0 ? (
                      <div className="text-center py-4 text-[10px] text-muted-foreground">Kayıtlı işlem geçmişi bulunmuyor.</div>
                    ) : (
                      adminTimeline.map((item, idx) => {
                        const badgeColor = 
                          item.type === 'call' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' :
                          item.type === 'message' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                          'bg-amber-500/10 text-amber-600 border-amber-500/20';

                        return (
                          <div key={item.id || idx} className="text-[10px] space-y-0.5 border-b border-border/40 pb-2 last:border-0 last:pb-0 font-medium">
                            <div className="flex justify-between items-center">
                              <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded-md border uppercase tracking-wider ${badgeColor}`}>
                                {item.badge}
                              </span>
                              <span className="text-[8px] text-muted-foreground font-mono font-bold">
                                {item.timestamp.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="font-extrabold text-foreground mt-1">{item.title}</p>
                            {item.description && (
                              <p className="text-slate-600 dark:text-slate-400 leading-normal mt-0.5 whitespace-pre-wrap break-words">
                                {item.description}
                              </p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                <Dialog.Close asChild>
                  <button type="button" className="px-4 py-2 border border-border hover:bg-accent rounded-lg text-xs font-semibold cursor-pointer">Vazgeç</button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-lg text-xs hover:bg-primary/95 flex items-center gap-1 cursor-pointer shadow-md"
                >
                  {savingEdit && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Değişiklikleri Kaydet
                </button>
              </div>
            </form>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {/* 5. LEAD DETAIL DIALOG */}
      <Dialog.Root open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-lg z-50 animate-in fade-in zoom-in-95 duration-150 select-none">
            <Dialog.Title className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">Lead Detay Kartı</Dialog.Title>
            
            {selectedLeadDetail && (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-muted rounded-lg space-y-1 relative">
                  <span className="text-[8px] font-bold text-muted-foreground uppercase font-mono">{formatLeadId(selectedLeadDetail.legacy_lead_id || selectedLeadDetail.lead_number)}</span>
                  <h4 className="font-bold text-foreground text-sm">{selectedLeadDetail.first_name} {selectedLeadDetail.last_name}</h4>
                  <p className="text-muted-foreground">{selectedLeadDetail.company_name || 'Şahıs Firması'}</p>
                  {(selectedLeadDetail.lead_sources?.code === 'APIFY' || selectedLeadDetail.source_id === '11111111-0000-0000-0000-000000000015') && (
                    <span className="absolute top-3 right-3 inline-flex items-center text-[9px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded uppercase tracking-wide select-none">
                      Script Müşterisi
                    </span>
                  )}
                </div>

                {/* Script Müşterisi Özel Bilgilendirme Notu */}
                {(selectedLeadDetail.lead_sources?.code === 'APIFY' || selectedLeadDetail.source_id === '11111111-0000-0000-0000-000000000015') && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-700 dark:text-amber-300 space-y-1 select-text">
                    <span className="font-black uppercase text-[9px] tracking-wide flex items-center gap-1 select-none">
                      ⚠️ Script Müşterisi Bilgilendirmesi
                    </span>
                    <p className="text-[10px] font-semibold leading-relaxed">
                      Bu kayıt Apify Google Maps üzerinden çekilmiştir. Arama esnasında müşteriye mutlaka **Lazer Kesim veya Abkant Büküm makinesine ihtiyacı olup olmadığı** sorulmalıdır.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-[9px] font-bold text-muted-foreground uppercase">Telefon</span>
                    <a href={`tel:${selectedLeadDetail.phone}`} className="text-primary hover:underline font-semibold block mt-0.5">{selectedLeadDetail.phone}</a>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-muted-foreground uppercase">E-Posta</span>
                    <span className="text-foreground block mt-0.5 truncate">{selectedLeadDetail.email || 'Belirtilmemiş'}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-muted-foreground uppercase">Şehir</span>
                    <span className="text-foreground block mt-0.5">{selectedLeadDetail.city || 'Belirtilmemiş'}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-muted-foreground uppercase">İlgi Duyulan Ürün</span>
                    <span className="text-foreground font-semibold block mt-0.5">{selectedLeadDetail.requested_product || 'Belirtilmemiş'}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-muted-foreground uppercase">Lead Kaynağı</span>
                    <span className="text-foreground block mt-0.5">{selectedLeadDetail.lead_sources?.name || 'Reklam'}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-muted-foreground uppercase">Görüşme Önceliği</span>
                    <span className="text-foreground block mt-0.5">{selectedLeadDetail.priority || 'Normal'}</span>
                  </div>
                </div>

                {selectedLeadDetail.message && (
                  <div className="pt-2 border-t border-border">
                    <span className="block text-[9px] font-bold text-muted-foreground uppercase mb-1">Müşteri Açıklaması / Talep Detayı</span>
                    <div className="p-3 bg-muted/50 rounded-lg text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed whitespace-pre-line select-text font-medium max-h-36 overflow-y-auto scrollbar-thin">
                      {selectedLeadDetail.message}
                    </div>
                  </div>
                )}

                 {selectedLeadDetail.extra_notes && (
                  <div className="pt-2 border-t border-border">
                    <span className="block text-[9px] font-bold text-muted-foreground uppercase mb-1">Açıklama / Görüşme Geçmişi</span>
                    <div className="p-3 bg-muted/50 rounded-lg text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed space-y-1.5 select-text font-medium">
                      {selectedLeadDetail.extra_notes.split('\n').filter((line: string) => line.trim()).map((line: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="text-amber-500 mt-1 select-none text-[8px]">•</span>
                          <span>{line}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Yönetici İşlem Günlüğü (Timeline) */}
                {(profile?.role === 'super_admin' || profile?.role === 'admin') && (
                  <div className="pt-3 border-t border-border space-y-2">
                    <span className="block text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase mb-1 tracking-wider">🔒 Yönetici İşlem Günlüğü (Timeline)</span>
                    <div className="max-h-48 overflow-y-auto bg-slate-50 dark:bg-slate-900 border border-border rounded-xl p-3.5 space-y-3 scrollbar-thin select-text">
                      {loadingTimeline ? (
                        <div className="text-center py-4 text-[10px] text-muted-foreground font-bold">Yükleniyor...</div>
                      ) : adminTimeline.length === 0 ? (
                        <div className="text-center py-4 text-[10px] text-muted-foreground">Kayıtlı işlem geçmişi bulunmuyor.</div>
                      ) : (
                        adminTimeline.map((item, idx) => {
                          const badgeColor = 
                            item.type === 'call' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' :
                            item.type === 'message' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                            'bg-amber-500/10 text-amber-600 border-amber-500/20';

                          return (
                            <div key={item.id || idx} className="text-[10px] space-y-0.5 border-b border-border/40 pb-2 last:border-0 last:pb-0 font-medium">
                              <div className="flex justify-between items-center">
                                <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded-md border uppercase tracking-wider ${badgeColor}`}>
                                  {item.badge}
                                </span>
                                <span className="text-[8px] text-muted-foreground font-mono font-bold">
                                  {item.timestamp.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="font-extrabold text-foreground mt-1">{item.title}</p>
                              {item.description && (
                                <p className="text-muted-foreground leading-normal mt-0.5 whitespace-pre-wrap break-words">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button 
                    onClick={() => {
                      setDetailModalOpen(false)
                      handleOpenEdit(selectedLeadDetail)
                      setEditMode('full')
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg text-xs cursor-pointer flex items-center gap-1.5 animate-pulse"
                  >
                    ✏️ Güncelle / Düzenle
                  </button>
                  <Dialog.Close asChild>
                    <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg text-xs cursor-pointer">Kapat</button>
                  </Dialog.Close>
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* OVERDUE CALLBACK FLOATING POPUP */}
      {overdueCallbackLeads.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40 transition-all duration-300">
          {isAlertCollapsed ? (
            <button
              onClick={() => setIsAlertCollapsed(false)}
              className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-extrabold rounded-full shadow-lg shadow-rose-500/20 hover:scale-105 transition-all select-none cursor-pointer group"
            >
              <div className="relative flex h-3.5 w-3.5 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <Clock3 className="h-3.5 w-3.5 relative text-white" />
              </div>
              <span className="text-xs uppercase tracking-wider">{overdueCallbackLeads.length} Bekleyen Arama</span>
            </button>
          ) : (
            <div className="w-80 sm:w-96 bg-card/95 backdrop-blur-md border-2 border-rose-500/35 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 slide-in-from-right-5 duration-300">
              {/* Header */}
              <div className="p-4 bg-gradient-to-r from-rose-500/10 to-rose-600/5 border-b border-border/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-rose-500/20 p-1.5 rounded-lg text-rose-500 animate-pulse">
                    <Clock3 className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-foreground uppercase tracking-wide">Arama Zamanı Geldi!</h4>
                    <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 mt-0.5">{overdueCallbackLeads.length} arama planlanmış saatini geçti</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAlertCollapsed(true)}
                  className="h-7 w-7 rounded-lg border border-border hover:bg-accent flex items-center justify-center cursor-pointer transition-colors text-muted-foreground hover:text-foreground"
                  title="Simge Durumuna Küçült"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-3.5 space-y-2.5 max-h-[300px] overflow-y-auto">
                {overdueCallbackLeads.slice(0, 3).map((lead) => {
                  const diffMs = currentTime.getTime() - new Date(lead.next_contact_at).getTime();
                  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                  const diffMins = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)));
                  const elapsedText = diffHrs > 0 ? `${diffHrs} sa ${diffMins} dk önce` : `${diffMins} dk önce`;
                  const attemptCount = lead.calls?.length || 0;

                  return (
                    <div
                      key={lead.id}
                      className="p-3 bg-muted/40 border border-border/60 hover:border-rose-500/30 rounded-xl space-y-2 transition-all group"
                    >
                      <div className="flex justify-between items-center text-[9px] text-muted-foreground font-mono">
                        <span>NO: {formatLeadId(lead.legacy_lead_id || lead.lead_number)}</span>
                        <span className="font-sans font-bold text-rose-600 bg-rose-500/10 px-1.5 py-0.5 rounded-full select-none animate-pulse">
                          ⏱️ {elapsedText}
                        </span>
                      </div>
                      <div>
                        <h5 className="font-extrabold text-foreground text-xs leading-none">
                          {lead.first_name} {lead.last_name}
                        </h5>
                        <p className="text-[10px] text-muted-foreground font-semibold mt-1 truncate">
                          {lead.company_name || 'Şahıs Firması'} • <span className="font-bold text-slate-500">{lead.requested_product || 'Cihaz Belirtilmemiş'}</span>
                        </p>
                      </div>
                      <div className="flex items-center justify-between pt-1 gap-2">
                        <a
                          href={`tel:${lead.phone}`}
                          className="text-[11px] font-extrabold text-primary hover:underline flex items-center gap-1"
                        >
                          <Phone className="h-3 w-3 shrink-0" />
                          {lead.phone}
                        </a>
                        <button
                          onClick={() => handleOpenEdit(lead)}
                          className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-[10px] font-black cursor-pointer shadow-sm flex items-center gap-1.5 transition-colors"
                        >
                          <Sliders className="h-3 w-3" />
                          {attemptCount > 0 ? `${attemptCount + 1}. Arama Yap` : 'Arama Yap'}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {overdueCallbackLeads.length > 3 && (
                  <div className="text-center text-[10px] font-black text-muted-foreground bg-muted/20 border border-border/40 py-2 rounded-xl uppercase tracking-wider select-none animate-pulse">
                    + {overdueCallbackLeads.length - 3} arama daha sırada bekliyor
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}

// Simple loader helper inline
function Loader2({ className }: { className?: string }) {
  return <RefreshCw className={`${className} animate-spin`} />
}

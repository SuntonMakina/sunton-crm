'use client'

import React, { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Lead, Profile, LeadSource, LeadStatus } from '@/types/crm'
import {
  Plus,
  Search,
  SlidersHorizontal,
  Table,
  Kanban,
  CreditCard,
  Phone,
  Calendar,
  AlertCircle,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle,
  Trash2,
  Share2,
  FolderMinus,
  Edit2,
  FileText,
  Clock,
  Briefcase,
  History,
  ClipboardList,
  MessageSquare,
  ChevronDown,
  UserPlus,
  Loader2,
  X
} from 'lucide-react'

// 81 Turkish Cities (Iller) preset
const TURKISH_PROVINCES = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Amasya", "Ankara", "Antalya", "Artvin", "Aydın", "Balıkesir",
  "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli",
  "Diyarbakır", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari",
  "Hatay", "Isparta", "Mersin", "İstanbul", "İzmir", "Kars", "Kastamonu", "Kayseri", "Kırklareli", "Kırşehir",
  "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Kahramanmaraş", "Mardin", "Muğla", "Muş", "Nevşehir",
  "Niğde", "Ordu", "Rize", "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas", "Tekirdağ", "Tokat",
  "Trabzon", "Tunceli", "Şanlıurfa", "Uşak", "Van", "Yozgat", "Zonguldak", "Aksaray", "Bayburt", "Karaman",
  "Kırıkkale", "Batman", "Şırnak", "Bartın", "Ardahan", "Iğdır", "Yalova", "Karabük", "Kilis", "Osmaniye", "Düzce"
]

export default function LeadsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Navigation parameter options
  const viewModeParam = searchParams.get('view') || 'table'
  const detailIdParam = searchParams.get('id') || null

  // View states
  const [viewMode, setViewMode] = useState<'table' | 'kanban' | 'card'>(viewModeParam as any)
  const [activeLeadId, setActiveLeadId] = useState<string | null>(detailIdParam)

  // Data states
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [totalLeads, setTotalLeads] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [provinceFilter, setProvinceFilter] = useState('all')
  
  // Lookups
  const [statuses, setStatuses] = useState<LeadStatus[]>([])
  const [sources, setSources] = useState<LeadSource[]>([])
  const [ccAgents, setCcAgents] = useState<Profile[]>([])
  const [salesReps, setSalesReps] = useState<Profile[]>([])

  // Modal and detail states
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isBulkOpen, setIsBulkOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'calls' | 'tasks' | 'notes' | 'history'>('info')
  const [bulkAction, setBulkAction] = useState({ type: 'assign_cc', value: '' })
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])

  // Add lead form states
  const [leadForm, setLeadForm] = useState({
    first_name: '', last_name: '', phone: '', secondary_phone: '', email: '',
    company_name: '', province: '', district: '', source_id: '', status_id: '',
    priority: 'normal', temperature: 'warm', requested_product: '', message: '',
    assigned_call_center_user_id: '', assigned_sales_user_id: '',
    consent_kvkk: false, consent_marketing: false, note: ''
  })
  
  // Duplicate lead prompt state
  const [duplicateCheck, setDuplicateCheck] = useState<Lead | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Activity, call logs, notes, and task lists inside details drawer
  const [drawerCalls, setDrawerCalls] = useState<any[]>([])
  const [drawerTasks, setDrawerTasks] = useState<any[]>([])
  const [drawerNotes, setDrawerNotes] = useState<any[]>([])
  const [drawerHistory, setDrawerHistory] = useState<any[]>([])
  const [newNoteText, setNewNoteText] = useState('')
  const [newCallForm, setNewCallForm] = useState({ outcome: '', duration: 0, notes: '', followUp: false, followUpAt: '' })
  const [callOutcomesList, setCallOutcomesList] = useState<any[]>([])

  // Synchronize URL query parameters
  const updateUrlParams = (params: Record<string, string | null>) => {
    const nextParams = new URLSearchParams(searchParams.toString())
    Object.entries(params).forEach(([key, val]) => {
      if (val === null) {
        nextParams.delete(key)
      } else {
        nextParams.set(key, val)
      }
    })
    router.replace(`/dashboard/leads?${nextParams.toString()}`)
  }

  // Handle URL change detection
  useEffect(() => {
    setViewMode(viewModeParam as any)
    setActiveLeadId(detailIdParam)
  }, [viewModeParam, detailIdParam])

  // Load configuration and lookups
  useEffect(() => {
    async function loadLookups() {
      const { data: ls } = await supabase.from('lead_sources').select('*').eq('is_active', true).order('sort_order')
      const { data: st } = await supabase.from('lead_statuses').select('*').eq('is_active', true).order('sort_order')
      const { data: cc } = await supabase.from('profiles').select('*').eq('role', 'call_center_rep').eq('is_active', true)
      const { data: sl } = await supabase.from('profiles').select('*').eq('role', 'sales_specialist').eq('is_active', true)
      const { data: co } = await supabase.from('call_outcomes').select('*').eq('is_active', true).order('sort_order')

      if (ls) setSources(ls)
      if (st) {
        setStatuses(st)
        // Set default status in creation form to first status (e.g. Yeni Lead)
        if (st.length > 0) setLeadForm(f => ({ ...f, status_id: st[0].id }))
      }
      if (cc) setCcAgents(cc)
      if (sl) setSalesReps(sl)
      if (co) setCallOutcomesList(co)
    }
    loadLookups()
  }, [supabase])

  // Fetch leads with server-side filters & pagination
  const loadLeadsData = async () => {
    setLoading(true)
    try {
      let query = supabase.from('leads').select(`
        *,
        lead_sources(name, color),
        lead_statuses(name, color),
        cc_profile:profiles!leads_assigned_call_center_user_id_fkey(full_name),
        sales_profile:profiles!leads_assigned_sales_user_id_fkey(full_name)
      `, { count: 'exact' })

      // Apply Filters
      query = query.eq('is_active', true)

      if (searchQuery.trim()) {
        const term = searchQuery.trim()
        query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,company_name.ilike.%${term}%,lead_number.ilike.%${term}%,phone.ilike.%${term}%`)
      }

      if (statusFilter !== 'all') {
        query = query.eq('status_id', statusFilter)
      }

      if (sourceFilter !== 'all') {
        query = query.eq('source_id', sourceFilter)
      }

      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter)
      }

      if (provinceFilter !== 'all') {
        query = query.eq('province', provinceFilter)
      }

      // Pagination setup
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to)

      if (!error && data) {
        setLeads(data as any[])
        setTotalLeads(count || 0)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLeadsData()
  }, [page, pageSize, searchQuery, statusFilter, sourceFilter, priorityFilter, provinceFilter])

  // Load details drawer content on activeLeadId changes
  useEffect(() => {
    if (!activeLeadId) return

    async function loadDrawerDetails() {
      // Calls list
      const { data: calls } = await supabase
        .from('calls')
        .select('*, call_outcomes(name)')
        .eq('lead_id', activeLeadId)
        .order('created_at', { ascending: false })
      if (calls) setDrawerCalls(calls)

      // Tasks list
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('lead_id', activeLeadId)
        .order('due_at', { ascending: true })
      if (tasks) setDrawerTasks(tasks)

      // Notes list
      const { data: notes } = await supabase
        .from('notes')
        .select('*, profiles:created_by(full_name)')
        .eq('entity_type', 'lead')
        .eq('entity_id', activeLeadId)
        .order('created_at', { ascending: false })
      if (notes) setDrawerNotes(notes)

      // Status history & assignment history mapped as activities timeline
      const { data: statusHist } = await supabase
        .from('lead_status_history')
        .select('*, profiles:changed_by(full_name), prev_status:lead_statuses!lead_status_history_previous_status_id_fkey(name), new_status:lead_statuses!lead_status_history_new_status_id_fkey(name)')
        .eq('lead_id', activeLeadId)

      const { data: assignHist } = await supabase
        .from('lead_assignment_history')
        .select('*, profiles:assigned_by(full_name), prev_cc:profiles!lead_assignment_history_previous_call_center_user_id_fkey(full_name), new_cc:profiles!lead_assignment_history_new_call_center_user_id_fkey(full_name)')
        .eq('lead_id', activeLeadId)

      const formattedActivities: any[] = []
      if (statusHist) {
        statusHist.forEach(s => formattedActivities.push({
          type: 'status',
          title: 'Durum Değişikliği',
          desc: `Lead durumu ${s.prev_status?.name || 'Yok'} aşamasından ${s.new_status?.name} aşamasına getirildi.`,
          user: s.profiles?.full_name || 'Sistem',
          date: s.changed_at
        }))
      }
      if (assignHist) {
        assignHist.forEach(a => formattedActivities.push({
          type: 'assignment',
          title: 'Atama İşlemi',
          desc: `Temsilci ataması yapıldı: ${a.prev_cc?.full_name || 'Atanmamış'} → ${a.new_cc?.full_name || 'Atanmamış'}.`,
          user: a.profiles?.full_name || 'Sistem',
          date: a.assigned_at
        }))
      }
      formattedActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setDrawerHistory(formattedActivities)
    }

    loadDrawerDetails()
  }, [activeLeadId, activeTab, supabase])

  // Normalization logic for phone numbers
  const normalizePhoneNumber = (phone: string) => {
    let clean = phone.replace(/\D/g, '')
    // Remove lead 90, 0090, 0
    if (clean.startsWith('90')) clean = clean.substring(2)
    else if (clean.startsWith('090')) clean = clean.substring(3)
    else if (clean.startsWith('0')) clean = clean.substring(1)
    return '90' + clean
  }

  // Handle quick search typing with minor debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setPage(1)
  }

  // Create lead submit
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!leadForm.first_name || !leadForm.last_name || !leadForm.phone) {
      alert('Lütfen zorunlu alanları doldurun.')
      return
    }

    const normPhone = normalizePhoneNumber(leadForm.phone)

    // Check duplicate phone record
    if (!duplicateCheck) {
      setSubmitting(true)
      try {
        const { data: dups } = await supabase
          .from('leads')
          .select('*, lead_statuses(name)')
          .eq('phone_normalized', normPhone)
          .eq('is_active', true)
          .limit(1)
        
        if (dups && dups.length > 0) {
          setDuplicateCheck(dups[0] as Lead)
          setSubmitting(false)
          return
        }
      } catch (err) {
        console.error(err)
      }
    }

    // Procced with save
    setSubmitting(true)
    try {
      const { data: newLead, error } = await supabase
        .from('leads')
        .insert({
          first_name: leadForm.first_name,
          last_name: leadForm.last_name,
          full_name: `${leadForm.first_name} ${leadForm.last_name}`,
          phone: leadForm.phone,
          phone_normalized: normPhone,
          secondary_phone: leadForm.secondary_phone || null,
          email: leadForm.email || null,
          company_name: leadForm.company_name || null,
          province: leadForm.province || null,
          district: leadForm.district || null,
          source_id: leadForm.source_id || null,
          status_id: leadForm.status_id || null,
          priority: leadForm.priority,
          temperature: leadForm.temperature,
          requested_product: leadForm.requested_product || null,
          message: leadForm.message || null,
          assigned_call_center_user_id: leadForm.assigned_call_center_user_id || null,
          assigned_sales_user_id: leadForm.assigned_sales_user_id || null,
          consent_kvkk: leadForm.consent_kvkk,
          consent_marketing: leadForm.consent_marketing,
          consent_recorded_at: (leadForm.consent_kvkk || leadForm.consent_marketing) ? new Date().toISOString() : null
        })
        .select()
        .single()

      if (!error && newLead) {
        // If initial note is entered, insert it
        if (leadForm.note.trim()) {
          await supabase.from('notes').insert({
            entity_type: 'lead',
            entity_id: newLead.id,
            content: leadForm.note
          })
        }
        
        setIsAddOpen(false)
        setDuplicateCheck(null)
        setLeadForm({
          first_name: '', last_name: '', phone: '', secondary_phone: '', email: '',
          company_name: '', province: '', district: '', source_id: '', status_id: statuses[0]?.id || '',
          priority: 'normal', temperature: 'warm', requested_product: '', message: '',
          assigned_call_center_user_id: '', assigned_sales_user_id: '',
          consent_kvkk: false, consent_marketing: false, note: ''
        })
        loadLeadsData()
      } else {
        alert('Hata: ' + error?.message)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  // Add note inside detail panel
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNoteText.trim() || !activeLeadId) return

    try {
      const { error } = await supabase.from('notes').insert({
        entity_type: 'lead',
        entity_id: activeLeadId,
        content: newNoteText
      })

      if (!error) {
        setNewNoteText('')
        // Refresh notes list
        const { data: notes } = await supabase
          .from('notes')
          .select('*, profiles:created_by(full_name)')
          .eq('entity_type', 'lead')
          .eq('entity_id', activeLeadId)
          .order('created_at', { ascending: false })
        if (notes) setDrawerNotes(notes)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Add call log inside detail panel
  const handleAddCallLog = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCallForm.outcome || !activeLeadId) return

    try {
      const activeLead = leads.find(l => l.id === activeLeadId)
      const { error } = await supabase.from('calls').insert({
        lead_id: activeLeadId,
        direction: 'outgoing',
        phone_number: activeLead?.phone || '',
        status: 'completed',
        outcome_id: newCallForm.outcome,
        duration_seconds: newCallForm.duration,
        notes: newCallForm.notes,
        follow_up_required: newCallForm.followUp,
        follow_up_at: newCallForm.followUp && newCallForm.followUpAt ? new Date(newCallForm.followUpAt).toISOString() : null
      })

      if (!error) {
        // If follow-up checkbox is checked, create callback task
        if (newCallForm.followUp && newCallForm.followUpAt) {
          await supabase.from('tasks').insert({
            title: `${activeLead?.first_name} ${activeLead?.last_name} - Geri Arama Takibi`,
            task_type: 'callback',
            status: 'pending',
            lead_id: activeLeadId,
            due_at: new Date(newCallForm.followUpAt).toISOString()
          })
        }

        // Check if call outcome updates status automatically
        const selectedOutcomeObj = callOutcomesList.find(o => o.id === newCallForm.outcome)
        if (selectedOutcomeObj?.converts_to_qualified) {
          const qualifiedStatus = statuses.find(s => s.name === 'Nitelikli Lead')
          if (qualifiedStatus) {
            await supabase.from('leads').update({ status_id: qualifiedStatus.id }).eq('id', activeLeadId)
            loadLeadsData()
          }
        } else if (selectedOutcomeObj?.forwards_to_sales) {
          const forwardStatus = statuses.find(s => s.name === 'Satış Uzmanına İletildi')
          if (forwardStatus) {
            await supabase.from('leads').update({ status_id: forwardStatus.id, forwarded_to_sales_at: new Date().toISOString() }).eq('id', activeLeadId)
            loadLeadsData()
          }
        }

        setNewCallForm({ outcome: '', duration: 0, notes: '', followUp: false, followUpAt: '' })
        // Refresh calls list
        const { data: calls } = await supabase
          .from('calls')
          .select('*, call_outcomes(name)')
          .eq('lead_id', activeLeadId)
          .order('created_at', { ascending: false })
        if (calls) setDrawerCalls(calls)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Convert Lead to Customer action
  const handleConvertToCustomer = async (lead: Lead) => {
    if (!confirm(`${lead.first_name} ${lead.last_name} isimli ledi müşteriye dönüştürmek istediğinizden emin misiniz?`)) return

    try {
      // Create Customer
      const { data: customer, error: custErr } = await supabase
        .from('customers')
        .insert({
          type: lead.company_name ? 'corporate' : 'individual',
          first_name: lead.first_name,
          last_name: lead.last_name,
          full_name: `${lead.first_name} ${lead.last_name}`,
          company_name: lead.company_name || null,
          phone: lead.phone,
          phone_normalized: lead.phone_normalized,
          email: lead.email || null,
          province: lead.province || null,
          district: lead.district || null,
          source_id: lead.source_id || null,
          customer_status: 'active',
          lead_id: lead.id
        })
        .select()
        .single()

      if (!custErr && customer) {
        const convertedStatus = statuses.find(s => s.name === 'Satışa Dönüştü' || s.is_won)
        // Update lead converted status & customer reference
        await supabase
          .from('leads')
          .update({
            status_id: convertedStatus?.id || lead.status_id,
            converted_at: new Date().toISOString(),
            customer_id: customer.id
          })
          .eq('id', lead.id)

        // Log conversion activity
        await supabase.from('activities').insert({
          entity_type: 'lead',
          entity_id: lead.id,
          activity_type: 'converted_to_customer',
          title: 'Müşteriye Dönüştürüldü',
          description: `${lead.first_name} ${lead.last_name} başarıyla yeni müşteri (${customer.customer_number}) olarak kaydedildi.`
        })

        alert('Lead başarıyla müşteriye dönüştürüldü!')
        updateUrlParams({ id: null })
        loadLeadsData()
      } else {
        alert(custErr?.message)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Handle Bulk assignment submission
  const handleBulkSubmit = async () => {
    if (selectedLeadIds.length === 0 || !bulkAction.value) return
    setLoading(true)
    try {
      let updateFields: any = {}
      if (bulkAction.type === 'assign_cc') {
        updateFields.assigned_call_center_user_id = bulkAction.value
        updateFields.assigned_at = new Date().toISOString()
      } else if (bulkAction.type === 'assign_sales') {
        updateFields.assigned_sales_user_id = bulkAction.value
        updateFields.assigned_at = new Date().toISOString()
      } else if (bulkAction.type === 'change_status') {
        updateFields.status_id = bulkAction.value
      } else if (bulkAction.type === 'change_priority') {
        updateFields.priority = bulkAction.value
      }

      const { error } = await supabase
        .from('leads')
        .update(updateFields)
        .in('id', selectedLeadIds)

      if (!error) {
        setSelectedLeadIds([])
        setIsBulkOpen(false)
        loadLeadsData()
      } else {
        alert(error.message)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Select all table leads helper
  const handleSelectAllLeads = () => {
    if (selectedLeadIds.length === leads.length) {
      setSelectedLeadIds([])
    } else {
      setSelectedLeadIds(leads.map(l => l.id))
    }
  }

  // Select single lead checkbox helper
  const handleToggleSelectLead = (id: string) => {
    if (selectedLeadIds.includes(id)) {
      setSelectedLeadIds(selectedLeadIds.filter(x => x !== id))
    } else {
      setSelectedLeadIds([...selectedLeadIds, id])
    }
  }

  return (
    <div className="space-y-4">
      {/* Title & Toolbar Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Gelen Leadler</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Müşteri adayları takibi, dağıtımı ve nitelendirme.</p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggles */}
          <div className="flex bg-muted rounded-lg p-1 border border-border">
            <button
              onClick={() => updateUrlParams({ view: 'table' })}
              className={`h-7 px-2.5 rounded-md flex items-center justify-center cursor-pointer transition-colors ${viewMode === 'table' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
              title="Tablo Görünümü"
            >
              <Table className="h-4 w-4" />
            </button>
            <button
              onClick={() => updateUrlParams({ view: 'kanban' })}
              className={`h-7 px-2.5 rounded-md flex items-center justify-center cursor-pointer transition-colors ${viewMode === 'kanban' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
              title="Kanban Görünümü"
            >
              <Kanban className="h-4 w-4" />
            </button>
          </div>

          {/* Bulk Action button */}
          {selectedLeadIds.length > 0 && (
            <button
              onClick={() => setIsBulkOpen(true)}
              className="h-9 px-3 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <UserPlus className="h-4 w-4" />
              Toplu İşlem ({selectedLeadIds.length})
            </button>
          )}

          {/* Add New button */}
          <button
            onClick={() => setIsAddOpen(true)}
            className="h-9 px-3.5 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 flex items-center gap-1.5 cursor-pointer shadow-sm shadow-primary/10 transition-colors"
          >
            <Plus className="h-4.5 w-4.5" />
            Yeni Lead Ekle
          </button>
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="bg-card border border-border p-3.5 rounded-xl shadow-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
        {/* Search */}
        <div className="relative md:col-span-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Ara..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full h-9 pl-8.5 pr-3 bg-background border border-border rounded-lg text-xs focus:outline-none"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="h-9 text-xs bg-background border border-border rounded-lg px-2"
        >
          <option value="all">Tüm Durumlar</option>
          {statuses.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {/* Source filter */}
        <select
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value); setPage(1) }}
          className="h-9 text-xs bg-background border border-border rounded-lg px-2"
        >
          <option value="all">Tüm Kaynaklar</option>
          {sources.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {/* Priority filter */}
        <select
          value={priorityFilter}
          onChange={(e) => { setPriorityFilter(e.target.value); setPage(1) }}
          className="h-9 text-xs bg-background border border-border rounded-lg px-2"
        >
          <option value="all">Tüm Öncelikler</option>
          <option value="low">Düşük</option>
          <option value="normal">Normal</option>
          <option value="high">Yüksek</option>
          <option value="critical">Kritik</option>
        </select>

        {/* Province filter */}
        <select
          value={provinceFilter}
          onChange={(e) => { setProvinceFilter(e.target.value); setPage(1) }}
          className="h-9 text-xs bg-background border border-border rounded-lg px-2"
        >
          <option value="all">Tüm İller</option>
          {TURKISH_PROVINCES.map(city => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
      </div>

      {/* Main View Display */}
      {loading ? (
        <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground mt-3 font-medium">Veriler yükleniyor...</p>
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-sm text-muted-foreground">
          Arama kriterlerine uygun aktif bir lead kaydı bulunamadı.
        </div>
      ) : viewMode === 'kanban' ? (
        // Kanban board view
        <div className="flex gap-4 overflow-x-auto pb-4 max-h-[calc(100vh-260px)]">
          {statuses.slice(0, 8).map((status) => {
            const columnLeads = leads.filter(l => l.status_id === status.id)
            return (
              <div key={status.id} className="w-72 shrink-0 bg-muted/30 border border-border/80 rounded-xl p-3.5 flex flex-col max-h-full">
                {/* Column header */}
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color || '#cbd5e1' }} />
                    <span className="font-bold text-xs text-foreground truncate max-w-[160px]">{status.name}</span>
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {columnLeads.length}
                  </span>
                </div>

                {/* Column cards container */}
                <div className="flex-1 overflow-y-auto space-y-3 min-h-[150px]">
                  {columnLeads.map((lead) => (
                    <div
                      key={lead.id}
                      onClick={() => updateUrlParams({ id: lead.id })}
                      className="bg-card border border-border hover:border-primary/40 p-3.5 rounded-lg shadow-xs hover:shadow-md cursor-pointer transition-all duration-200"
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-[9px] font-bold font-mono text-muted-foreground">{lead.lead_number}</span>
                        <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          lead.priority === 'high' || lead.priority === 'critical' ? 'bg-red-500/10 text-red-600' : 'bg-blue-500/10 text-blue-600'
                        }`}>
                          {lead.priority}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-foreground mt-2">{lead.first_name} {lead.last_name}</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{lead.company_name || 'Şahıs'}</p>

                      <div className="flex items-center justify-between mt-3.5 pt-2.5 border-t border-border/60 text-[9px] text-muted-foreground">
                        <span className="flex items-center gap-1 font-semibold">
                          <Phone className="h-3 w-3 shrink-0 text-muted-foreground/75" />
                          {lead.phone}
                        </span>
                        <span>{lead.province}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        // Default Table view
        <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[10px] font-bold uppercase text-muted-foreground select-none">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.length === leads.length && leads.length > 0}
                      onChange={handleSelectAllLeads}
                      className="rounded cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4">Lead No</th>
                  <th className="py-3 px-4">Ad Soyad</th>
                  <th className="py-3 px-4">Firma</th>
                  <th className="py-3 px-4">Telefon</th>
                  <th className="py-3 px-4">İl</th>
                  <th className="py-3 px-4">Ürün Talebi</th>
                  <th className="py-3 px-4">Durum</th>
                  <th className="py-3 px-4">Atanan Temsilci</th>
                  <th className="py-3 px-4 text-center">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs text-foreground">
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.includes(lead.id)}
                        onChange={() => handleToggleSelectLead(lead.id)}
                        className="rounded cursor-pointer"
                      />
                    </td>
                    <td
                      onClick={() => updateUrlParams({ id: lead.id })}
                      className="py-3.5 px-4 font-mono font-semibold text-primary hover:underline cursor-pointer"
                    >
                      {lead.lead_number}
                    </td>
                    <td
                      onClick={() => updateUrlParams({ id: lead.id })}
                      className="py-3.5 px-4 font-bold cursor-pointer"
                    >
                      {lead.first_name} {lead.last_name}
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">{lead.company_name || '-'}</td>
                    <td className="py-3.5 px-4 font-medium">{lead.phone}</td>
                    <td className="py-3.5 px-4">{lead.province || '-'}</td>
                    <td className="py-3.5 px-4 text-muted-foreground max-w-[120px] truncate">{lead.requested_product || '-'}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border"
                        style={{
                          backgroundColor: `${lead.lead_statuses?.color}15` || '#cbd5e115',
                          color: lead.lead_statuses?.color || '#cbd5e1',
                          borderColor: `${lead.lead_statuses?.color}25` || '#cbd5e125'
                        }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: lead.lead_statuses?.color || '#cbd5e1' }} />
                        {lead.lead_statuses?.name}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-muted-foreground">
                      {lead.cc_profile?.full_name || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleConvertToCustomer(lead)}
                          className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white rounded text-[10px] font-bold transition-all cursor-pointer"
                          title="Müşteriye Dönüştür"
                        >
                          Dönüştür
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Paginator */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border select-none bg-muted/20">
            <span className="text-xs text-muted-foreground font-medium">
              Toplam: <strong>{totalLeads}</strong> kayıttan <strong>{leads.length}</strong> tanesi listeleniyor
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                disabled={page === 1}
                className="h-8 w-8 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-semibold text-foreground px-2">Sayfa {page}</span>
              <button
                onClick={() => setPage(prev => (prev * pageSize < totalLeads ? prev + 1 : prev))}
                disabled={page * pageSize >= totalLeads}
                className="h-8 w-8 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer: Detailed view side panel */}
      {activeLeadId && (
        <>
          <div className="fixed inset-0 bg-black/30 backdrop-blur-xs z-40" onClick={() => updateUrlParams({ id: null })} />
          <div className="fixed top-0 right-0 h-screen w-full max-w-xl bg-card border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer header */}
            {leads.filter(l => l.id === activeLeadId).map((lead) => (
              <React.Fragment key={lead.id}>
                <div className="p-4 border-b border-border bg-accent/30 flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold font-mono text-muted-foreground">{lead.lead_number}</span>
                    <h2 className="text-base font-bold text-foreground mt-0.5">{lead.first_name} {lead.last_name}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{lead.company_name || 'Şahıs Şirketi'}</p>
                  </div>
                  <button
                    onClick={() => updateUrlParams({ id: null })}
                    className="h-8 w-8 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Tabs selection */}
                <div className="flex border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground select-none">
                  <button onClick={() => setActiveTab('info')} className={`flex-1 py-3 border-b-2 hover:text-foreground ${activeTab === 'info' ? 'border-primary text-primary' : 'border-transparent'}`}>Genel Bilgi</button>
                  <button onClick={() => setActiveTab('calls')} className={`flex-1 py-3 border-b-2 hover:text-foreground ${activeTab === 'calls' ? 'border-primary text-primary' : 'border-transparent'}`}>Aramalar</button>
                  <button onClick={() => setActiveTab('tasks')} className={`flex-1 py-3 border-b-2 hover:text-foreground ${activeTab === 'tasks' ? 'border-primary text-primary' : 'border-transparent'}`}>Görevler</button>
                  <button onClick={() => setActiveTab('notes')} className={`flex-1 py-3 border-b-2 hover:text-foreground ${activeTab === 'notes' ? 'border-primary text-primary' : 'border-transparent'}`}>Notlar</button>
                  <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 border-b-2 hover:text-foreground ${activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent'}`}>Geçmiş</button>
                </div>

                {/* Drawer scroll content body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  {activeTab === 'info' && (
                    <div className="space-y-4">
                      {/* Grid info details */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-xs">
                        <div>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Telefon</span>
                          <p className="font-semibold text-foreground mt-0.5 flex items-center gap-1.5">
                            <a href={`tel:${lead.phone}`} className="hover:underline flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5 text-primary" />
                              {lead.phone}
                            </a>
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">E-Posta</span>
                          <p className="font-medium text-foreground mt-0.5">{lead.email || '-'}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">İl / İlçe</span>
                          <p className="font-semibold text-foreground mt-0.5">{lead.province || '-'} / {lead.district || '-'}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Lead Kaynağı</span>
                          <p className="font-semibold text-foreground mt-0.5">{lead.lead_sources?.name || '-'}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Öncelik / Sıcaklık</span>
                          <p className="font-semibold text-foreground mt-0.5 uppercase text-primary">{lead.priority} / {lead.temperature}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Kayıt Tarihi</span>
                          <p className="font-semibold text-foreground mt-0.5">{new Date(lead.created_at).toLocaleDateString('tr-TR')} {new Date(lead.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Atanan Call Center</span>
                          <p className="font-semibold text-foreground mt-0.5">{lead.cc_profile?.full_name || 'Atanmamış'}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Atanan Satış Uzmanı</span>
                          <p className="font-semibold text-foreground mt-0.5">{lead.sales_profile?.full_name || 'Atanmamış'}</p>
                        </div>
                      </div>

                      {/* Requested product category / description message */}
                      <div className="border-t border-border pt-4 space-y-3">
                        <div>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Talep Edilen Ürün</span>
                          <p className="text-xs font-semibold text-foreground mt-0.5">{lead.requested_product || '-'}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Müşteri Mesajı</span>
                          <p className="text-xs bg-muted/50 border border-border p-3 rounded-lg leading-relaxed text-muted-foreground mt-1">{lead.message || 'Mesaj bulunmuyor.'}</p>
                        </div>
                      </div>

                      {/* Convert to customer button bottom area */}
                      <div className="pt-4 border-t border-border">
                        <button
                          onClick={() => handleConvertToCustomer(lead)}
                          className="w-full py-2.5 bg-emerald-500 text-white font-bold rounded-lg text-xs hover:bg-emerald-600 transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <CheckCircle className="h-4.5 w-4.5" />
                          Müşteriye Dönüştür & Satış Fırsatı Yarat
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'calls' && (
                    <div className="space-y-4">
                      {/* Log Call Form */}
                      <form onSubmit={handleAddCallLog} className="bg-muted/40 border border-border p-4 rounded-xl space-y-3 text-xs">
                        <h4 className="font-bold text-foreground">Yeni Arama Görüşmesi Kaydet</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-semibold text-muted-foreground mb-1">ARAMA SONUCU *</label>
                            <select
                              required
                              value={newCallForm.outcome}
                              onChange={(e) => setNewCallForm({ ...newCallForm, outcome: e.target.value })}
                              className="w-full h-8 bg-background border border-border rounded px-2"
                            >
                              <option value="">Seçiniz</option>
                              {callOutcomesList.map(o => (
                                <option key={o.id} value={o.id}>{o.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-muted-foreground mb-1">GÖRÜŞME SÜRESİ (SN)</label>
                            <input
                              type="number"
                              min={0}
                              value={newCallForm.duration || ''}
                              onChange={(e) => setNewCallForm({ ...newCallForm, duration: parseInt(e.target.value) || 0 })}
                              className="w-full h-8 bg-background border border-border rounded px-2"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-muted-foreground mb-1">GÖRÜŞME NOTLARI</label>
                          <textarea
                            rows={2}
                            value={newCallForm.notes}
                            onChange={(e) => setNewCallForm({ ...newCallForm, notes: e.target.value })}
                            className="w-full bg-background border border-border rounded p-2 text-xs focus:outline-none"
                            placeholder="Görüşme detaylarını girin..."
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="follow_up"
                            checked={newCallForm.followUp}
                            onChange={(e) => setNewCallForm({ ...newCallForm, followUp: e.target.checked })}
                            className="rounded h-3.5 w-3.5"
                          />
                          <label htmlFor="follow_up" className="text-[10px] font-bold text-muted-foreground cursor-pointer select-none">Takip Tarihi Belirle (Geri Arama)</label>
                        </div>

                        {newCallForm.followUp && (
                          <div>
                            <label className="block text-[10px] font-semibold text-muted-foreground mb-1">TAKİP TARİHİ VE SAATİ *</label>
                            <input
                              type="datetime-local"
                              required
                              value={newCallForm.followUpAt}
                              onChange={(e) => setNewCallForm({ ...newCallForm, followUpAt: e.target.value })}
                              className="w-full h-8 bg-background border border-border rounded px-2"
                            />
                          </div>
                        )}

                        <button type="submit" className="h-8 px-4 bg-primary text-primary-foreground font-semibold rounded text-xs hover:bg-primary/95 transition-colors cursor-pointer">Kaydet</button>
                      </form>

                      {/* Calls log list */}
                      <div className="space-y-3.5">
                        <h4 className="text-xs font-bold text-foreground">Yapılan Görüşmeler ({drawerCalls.length})</h4>
                        {drawerCalls.length === 0 ? (
                          <div className="text-center py-6 text-xs text-muted-foreground bg-muted/20 border border-border/50 rounded-lg">Arama geçmişi bulunmuyor.</div>
                        ) : (
                          drawerCalls.map((call) => (
                            <div key={call.id} className="p-3 border border-border bg-card rounded-lg flex flex-col gap-1 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-foreground">{call.call_outcomes?.name}</span>
                                <span className="text-[10px] text-muted-foreground">{new Date(call.started_at).toLocaleDateString('tr-TR')} {new Date(call.started_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              {call.notes && <p className="text-muted-foreground mt-1 font-medium bg-muted/30 p-2 rounded">{call.notes}</p>}
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1 border-t border-border/50 pt-1">
                                <span>Süre: {call.duration_seconds} sn</span>
                                {call.follow_up_required && <span className="text-primary font-semibold">Geri arama: {new Date(call.follow_up_at).toLocaleDateString('tr-TR')}</span>}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'tasks' && (
                    <div className="space-y-4">
                      {/* Tasks lists summary */}
                      <h4 className="text-xs font-bold text-foreground">İlişkili Görevler ({drawerTasks.length})</h4>
                      {drawerTasks.length === 0 ? (
                        <div className="text-center py-8 text-xs text-muted-foreground">Aktif bir görev bulunmamaktadır.</div>
                      ) : (
                        <div className="space-y-2.5">
                          {drawerTasks.map((t) => (
                            <div key={t.id} className="p-3 border border-border bg-card rounded-lg flex items-center justify-between text-xs">
                              <div>
                                <span className="font-semibold text-foreground">{t.title}</span>
                                {t.due_at && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">Son Gün: {new Date(t.due_at).toLocaleDateString('tr-TR')}</p>
                                )}
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                                t.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                              }`}>
                                {t.status === 'completed' ? 'Tamamlandı' : 'Bekliyor'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'notes' && (
                    <div className="space-y-4">
                      {/* Add note field */}
                      <form onSubmit={handleAddNote} className="flex gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Not ekleyin..."
                          value={newNoteText}
                          onChange={(e) => setNewNoteText(e.target.value)}
                          className="flex-1 h-9 px-3 bg-background border border-border rounded-lg text-xs focus:outline-none"
                        />
                        <button type="submit" className="h-9 px-4 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 transition-colors cursor-pointer">Ekle</button>
                      </form>

                      {/* Notes list */}
                      <div className="space-y-3">
                        {drawerNotes.length === 0 ? (
                          <div className="text-center py-6 text-xs text-muted-foreground bg-muted/20 border border-border/50 rounded-lg">Kayıtlı not bulunmuyor.</div>
                        ) : (
                          drawerNotes.map((note) => (
                            <div key={note.id} className="p-3 border border-border bg-card rounded-lg text-xs relative">
                              <p className="text-foreground leading-relaxed font-medium">{note.content}</p>
                              <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-2 pt-1 border-t border-border/60">
                                <span>Ekleyen: <strong>{note.profiles?.full_name || 'Bilinmeyen'}</strong></span>
                                <span>{new Date(note.created_at).toLocaleDateString('tr-TR')}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'history' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-foreground">Aktivite Zaman Çizelgesi</h4>
                      {drawerHistory.length === 0 ? (
                        <div className="text-center py-8 text-xs text-muted-foreground">Herhangi bir hareket kaydı bulunmuyor.</div>
                      ) : (
                        <div className="relative border-l border-border pl-4 ml-2 space-y-5 py-2">
                          {drawerHistory.map((act, idx) => (
                            <div key={idx} className="relative text-xs">
                              {/* Circle pin indicator */}
                              <span className="absolute -left-[21px] top-0.5 h-3.5 w-3.5 rounded-full border border-border bg-card flex items-center justify-center">
                                <span className={`h-1.5 w-1.5 rounded-full ${act.type === 'status' ? 'bg-primary' : 'bg-amber-500'}`} />
                              </span>
                              <div className="font-semibold text-foreground">{act.title}</div>
                              <p className="text-muted-foreground mt-0.5 leading-relaxed font-medium">{act.desc}</p>
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                                <span>İşlem: {act.user}</span>
                                <span>{new Date(act.date).toLocaleString('tr-TR')}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </React.Fragment>
            ))}
          </div>
        </>
      )}

      {/* Modal: Add Lead Form wizard */}
      {isAddOpen && (
        <Dialog.Root open={isAddOpen} onOpenChange={setIsAddOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto z-50 animate-in fade-in zoom-in-95 duration-150">
              <Dialog.Title className="text-base font-bold text-foreground mb-4">Yeni Lead Ekle</Dialog.Title>
              
              {duplicateCheck ? (
                // Duplicate alert layout
                <div className="space-y-4 p-4 border border-amber-500/30 bg-amber-500/10 rounded-lg text-xs leading-relaxed">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-amber-700 dark:text-amber-400">Mükerrer Kayıt Uyarısı!</h4>
                      <p className="text-muted-foreground mt-1">
                        Girdiğiniz telefon numarasıyla eşleşen bir kayıt sistemde zaten bulunuyor.
                      </p>
                      <div className="mt-3.5 bg-card/75 border border-border p-3 rounded space-y-1 text-[11px]">
                        <div><strong>Kayıtlı Ad Soyad:</strong> {duplicateCheck.first_name} {duplicateCheck.last_name}</div>
                        <div><strong>Müşteri/Firma:</strong> {duplicateCheck.company_name || 'Şahıs'}</div>
                        <div><strong>Kayıt Durumu:</strong> {duplicateCheck.lead_statuses?.name}</div>
                        <div><strong>Lead No:</strong> {duplicateCheck.lead_number}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2.5 border-t border-border pt-3.5">
                    <button
                      type="button"
                      onClick={() => setDuplicateCheck(null)}
                      className="px-4 py-2 border border-border hover:bg-accent rounded text-xs font-semibold cursor-pointer"
                    >
                      Vazgeç
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateUrlParams({ id: duplicateCheck.id })
                        setIsAddOpen(false)
                        setDuplicateCheck(null)
                      }}
                      className="px-4 py-2 bg-blue-500 text-white rounded text-xs font-semibold cursor-pointer hover:bg-blue-600"
                    >
                      Mevcut Kaydı Görüntüle
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleCreateLead} // Will skip duplicate check next time since duplicateCheck is set
                      className="px-4 py-2 bg-amber-500 text-white rounded text-xs font-semibold cursor-pointer hover:bg-amber-600"
                    >
                      Yine de Yeni Kayıt Oluştur
                    </button>
                  </div>
                </div>
              ) : (
                // Registration form fields
                <form onSubmit={handleCreateLead} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground mb-1">AD *</label>
                      <input
                        type="text"
                        required
                        value={leadForm.first_name}
                        onChange={(e) => setLeadForm({ ...leadForm, first_name: e.target.value })}
                        className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground mb-1">SOYAD *</label>
                      <input
                        type="text"
                        required
                        value={leadForm.last_name}
                        onChange={(e) => setLeadForm({ ...leadForm, last_name: e.target.value })}
                        className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground mb-1">TELEFON *</label>
                      <input
                        type="text"
                        required
                        placeholder="0 (5XX) XXX XX XX"
                        value={leadForm.phone}
                        onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                        className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground mb-1">E-POSTA</label>
                      <input
                        type="email"
                        value={leadForm.email}
                        onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                        className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground mb-1">FİRMA ADI</label>
                      <input
                        type="text"
                        value={leadForm.company_name}
                        onChange={(e) => setLeadForm({ ...leadForm, company_name: e.target.value })}
                        className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground mb-1">İL</label>
                      <select
                        value={leadForm.province}
                        onChange={(e) => setLeadForm({ ...leadForm, province: e.target.value })}
                        className="w-full h-9 px-2 bg-background border border-border rounded-lg focus:outline-none"
                      >
                        <option value="">Seçiniz</option>
                        {TURKISH_PROVINCES.map(city => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground mb-1">İLÇE</label>
                      <input
                        type="text"
                        value={leadForm.district}
                        onChange={(e) => setLeadForm({ ...leadForm, district: e.target.value })}
                        className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground mb-1">KAYNAK</label>
                      <select
                        value={leadForm.source_id}
                        onChange={(e) => setLeadForm({ ...leadForm, source_id: e.target.value })}
                        className="w-full h-9 px-2 bg-background border border-border rounded-lg focus:outline-none"
                      >
                        <option value="">Seçiniz</option>
                        {sources.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground mb-1">DURUM</label>
                      <select
                        value={leadForm.status_id}
                        onChange={(e) => setLeadForm({ ...leadForm, status_id: e.target.value })}
                        className="w-full h-9 px-2 bg-background border border-border rounded-lg focus:outline-none"
                      >
                        {statuses.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground mb-1">TALEP EDİLEN ÜRÜN</label>
                      <input
                        type="text"
                        value={leadForm.requested_product}
                        onChange={(e) => setLeadForm({ ...leadForm, requested_product: e.target.value })}
                        className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground mb-1">ÖNCELİK</label>
                      <select
                        value={leadForm.priority}
                        onChange={(e) => setLeadForm({ ...leadForm, priority: e.target.value })}
                        className="w-full h-9 px-2 bg-background border border-border rounded-lg focus:outline-none"
                      >
                        <option value="low">Düşük</option>
                        <option value="normal">Normal</option>
                        <option value="high">Yüksek</option>
                        <option value="critical">Kritik</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground mb-1">SICAKLIK</label>
                      <select
                        value={leadForm.temperature}
                        onChange={(e) => setLeadForm({ ...leadForm, temperature: e.target.value })}
                        className="w-full h-9 px-2 bg-background border border-border rounded-lg focus:outline-none"
                      >
                        <option value="cold">Soğuk</option>
                        <option value="warm">Ilık</option>
                        <option value="hot">Sıcak</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground mb-1">ATANAN CALL CENTER</label>
                      <select
                        value={leadForm.assigned_call_center_user_id}
                        onChange={(e) => setLeadForm({ ...leadForm, assigned_call_center_user_id: e.target.value })}
                        className="w-full h-9 px-2 bg-background border border-border rounded-lg focus:outline-none"
                      >
                        <option value="">Seçiniz</option>
                        {ccAgents.map(cc => (
                          <option key={cc.id} value={cc.id}>{cc.full_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground mb-1">ATANAN SATIŞ UZMANI</label>
                      <select
                        value={leadForm.assigned_sales_user_id}
                        onChange={(e) => setLeadForm({ ...leadForm, assigned_sales_user_id: e.target.value })}
                        className="w-full h-9 px-2 bg-background border border-border rounded-lg focus:outline-none"
                      >
                        <option value="">Seçiniz</option>
                        {salesReps.map(sr => (
                          <option key={sr.id} value={sr.id}>{sr.full_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">NOT</label>
                    <textarea
                      rows={2}
                      value={leadForm.note}
                      onChange={(e) => setLeadForm({ ...leadForm, note: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg p-2 focus:outline-none"
                      placeholder="Müşteri adayı hakkında açıklayıcı ilk not..."
                    />
                  </div>

                  {/* Consents checkboxes */}
                  <div className="space-y-1.5 bg-muted/40 p-3 rounded-lg border border-border/60">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="consent_kvkk"
                        checked={leadForm.consent_kvkk}
                        onChange={(e) => setLeadForm({ ...leadForm, consent_kvkk: e.target.checked })}
                        className="rounded h-4 w-4 shrink-0"
                      />
                      <label htmlFor="consent_kvkk" className="font-medium text-muted-foreground select-none cursor-pointer">
                        KVKK Bilgilendirme ve Açık Rıza Metnini kabul ediyor.
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="consent_marketing"
                        checked={leadForm.consent_marketing}
                        onChange={(e) => setLeadForm({ ...leadForm, consent_marketing: e.target.checked })}
                        className="rounded h-4 w-4 shrink-0"
                      />
                      <label htmlFor="consent_marketing" className="font-medium text-muted-foreground select-none cursor-pointer">
                        Ticari Elektronik İleti gönderim iznini onaylıyor.
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-border">
                    <Dialog.Close asChild>
                      <button type="button" className="px-4 py-2 border border-border hover:bg-accent rounded-lg text-xs font-semibold cursor-pointer">Vazgeç</button>
                    </Dialog.Close>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                      Kaydet
                    </button>
                  </div>
                </form>
              )}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {/* Dialog: Bulk Actions Panel */}
      {isBulkOpen && (
        <Dialog.Root open={isBulkOpen} onOpenChange={setIsBulkOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-md z-50 animate-in fade-in zoom-in-95 duration-150">
              <Dialog.Title className="text-base font-bold text-foreground mb-4">Toplu Lead Güncelleme</Dialog.Title>
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">İşlem Türü</label>
                  <select
                    value={bulkAction.type}
                    onChange={(e) => setBulkAction({ type: e.target.value, value: '' })}
                    className="w-full h-9 px-2 bg-background border border-border rounded-lg"
                  >
                    <option value="assign_cc">Call Center Temsilcisi Ata</option>
                    <option value="assign_sales">Satış Uzmanı Ata</option>
                    <option value="change_status">Durum Değiştir</option>
                    <option value="change_priority">Öncelik Değiştir</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">Değer Seçin</label>
                  {bulkAction.type === 'assign_cc' && (
                    <select
                      value={bulkAction.value}
                      onChange={(e) => setBulkAction({ ...bulkAction, value: e.target.value })}
                      className="w-full h-9 px-2 bg-background border border-border rounded-lg"
                    >
                      <option value="">Seçiniz</option>
                      {ccAgents.map(a => (
                        <option key={a.id} value={a.id}>{a.full_name}</option>
                      ))}
                    </select>
                  )}
                  {bulkAction.type === 'assign_sales' && (
                    <select
                      value={bulkAction.value}
                      onChange={(e) => setBulkAction({ ...bulkAction, value: e.target.value })}
                      className="w-full h-9 px-2 bg-background border border-border rounded-lg"
                    >
                      <option value="">Seçiniz</option>
                      {salesReps.map(a => (
                        <option key={a.id} value={a.id}>{a.full_name}</option>
                      ))}
                    </select>
                  )}
                  {bulkAction.type === 'change_status' && (
                    <select
                      value={bulkAction.value}
                      onChange={(e) => setBulkAction({ ...bulkAction, value: e.target.value })}
                      className="w-full h-9 px-2 bg-background border border-border rounded-lg"
                    >
                      <option value="">Seçiniz</option>
                      {statuses.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  )}
                  {bulkAction.type === 'change_priority' && (
                    <select
                      value={bulkAction.value}
                      onChange={(e) => setBulkAction({ ...bulkAction, value: e.target.value })}
                      className="w-full h-9 px-2 bg-background border border-border rounded-lg"
                    >
                      <option value="">Seçiniz</option>
                      <option value="low">Düşük</option>
                      <option value="normal">Normal</option>
                      <option value="high">Yüksek</option>
                      <option value="critical">Kritik</option>
                    </select>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Dialog.Close asChild>
                    <button type="button" className="px-4 py-2 border border-border hover:bg-accent rounded-lg text-xs font-semibold cursor-pointer">Vazgeç</button>
                  </Dialog.Close>
                  <button
                    onClick={handleBulkSubmit}
                    className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 cursor-pointer"
                  >
                    Uygula
                  </button>
                </div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

    </div>
  )
}

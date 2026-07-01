'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  Search, 
  Phone, 
  FileText, 
  MapPin, 
  Briefcase, 
  Clock, 
  Plus, 
  Loader2, 
  Info,
  Calendar,
  AlertCircle
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { formatLeadId, getProgressiveCallSchedule } from '@/lib/utils'

export default function WorkspaceLeadsPage() {
  const supabase = createClient()
  const router = useRouter()

  // Common UI states
  const [profile, setProfile] = useState<any>(null)
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Lookups
  const [products, setProducts] = useState<any[]>([])
  const [outcomes, setOutcomes] = useState<any[]>([])
  const [salesReps, setSalesReps] = useState<any[]>([])
  const [provinces, setProvinces] = useState<any[]>([])

  // Modal and Form states
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<any>(null)

  // Quick call form state
  const [callFormOpen, setCallFormOpen] = useState(false)
  const [savingCall, setSavingCall] = useState(false)
  const [callForm, setCallForm] = useState({
    outcomeId: '',
    note: '',
    productId: '',
    customerWarmth: 'warm',
    requiresFollowUp: false,
    nextCallDate: '',
    nextCallTime: '',
    forwardToSales: false,
    createTask: false
  })

  // Quick Task form state
  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [savingTask, setSavingTask] = useState(false)
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    taskType: 'general',
    priority: 'normal',
    dueAtDate: '',
    dueAtTime: ''
  })

  // Edit fields form state
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
    requestedProduct: '',
    assignedSalesUserId: '',
    statusId: '',
    note: '',
    leadQualityStatus: '',
    callbackStatus: 'none',
    callbackDate: '',
    callbackTime: '',
    callbackNotes: ''
  })

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (prof) {
          setProfile(prof)
          fetchLeads(prof.id, prof.role)
        }
      }
    }

    async function loadLookups() {
      const { data: productsList } = await supabase.from('products').select('*').eq('is_active', true)
      const { data: outcomesList } = await supabase.from('call_outcomes').select('*').eq('is_active', true).order('sort_order', { ascending: true })
      const { data: reps } = await supabase.from('profiles').select('id, full_name').eq('role', 'sales_specialist').eq('is_active', true).order('full_name')
      const { data: provs } = await supabase.from('provinces').select('id, name').eq('is_active', true).order('name')
      
      if (productsList) setProducts(productsList)
      if (outcomesList) setOutcomes(outcomesList)
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
    }

    init()
    loadLookups()
  }, [supabase])

  const fetchLeads = async (userId: string, role: string) => {
    setLoading(true)
    try {
      const isSales = role === 'sales_specialist'
      
      let query = supabase
        .from('leads')
        .select(`
          *,
          lead_statuses(name, color),
          lead_sources(name)
        `)
        .eq('is_active', true)

      if (isSales) {
        query = query.eq('assigned_sales_user_id', userId)
      } else {
        query = query.or(`assigned_call_center_user_id.eq.${userId},legacy_source_file.not.is.null`)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (!error && data) {
        setLeads(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Search filter
  const filteredLeads = leads.filter(l => {
    const query = searchQuery.toLowerCase()
    return (
      l.first_name?.toLowerCase().includes(query) ||
      l.last_name?.toLowerCase().includes(query) ||
      l.company_name?.toLowerCase().includes(query) ||
      l.phone?.includes(query) ||
      l.lead_number?.toLowerCase().includes(query) ||
      l.city?.toLowerCase().includes(query)
    )
  })

  // Open Quick Call outcome trigger
  const handleOpenCallLog = (lead: any) => {
    setSelectedLead(lead)
    setCallForm({
      outcomeId: outcomes[0]?.id || '',
      note: '',
      productId: lead.requested_product || '',
      customerWarmth: 'warm',
      requiresFollowUp: false,
      nextCallDate: '',
      nextCallTime: '',
      forwardToSales: false,
      createTask: false
    })
    setCallFormOpen(true)
  }

  const handleOutcomeChange = (outcomeId: string) => {
    const outcome = outcomes.find(o => o.id === outcomeId)
    const name = outcome?.name || ''
    
    let reqFollow = false
    let forSales = false
    
    if (name === 'Daha Sonra Aranacak' || name === 'İlgileniyor' || name === 'Teklif Talep Ediyor' || name === 'Satın Alma Planı Var') {
      reqFollow = true
    }
    
    if (name === 'Satış Uzmanına İletildi' || name === 'Satın Alma Planı Var') {
      forSales = true
    }

    setCallForm(prev => ({
      ...prev,
      outcomeId,
      requiresFollowUp: reqFollow,
      forwardToSales: forSales,
      createTask: reqFollow
    }))
  }

  const handleQuickFollowUp = (minutes: number) => {
    const d = new Date()
    d.setMinutes(d.getMinutes() + minutes)
    setCallForm(prev => ({
      ...prev,
      nextCallDate: d.toISOString().split('T')[0],
      nextCallTime: d.toTimeString().split(' ')[0].substring(0, 5)
    }))
  }

  const handleQuickFollowUpDays = (days: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    setCallForm(prev => ({
      ...prev,
      nextCallDate: d.toISOString().split('T')[0],
      nextCallTime: '10:00'
    }))
  }

  const handleSaveCallResult = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLead || !profile) return

    const outcome = outcomes.find(o => o.id === callForm.outcomeId)
    const outcomeName = outcome?.name || 'Arama'

    if (outcomeName === 'Daha Sonra Aranacak' && (!callForm.nextCallDate || !callForm.nextCallTime)) {
      alert('Lütfen sonraki arama zamanını girin.')
      return
    }

    setSavingCall(true)
    try {
      const nextCallAt = callForm.nextCallDate && callForm.nextCallTime 
        ? new Date(`${callForm.nextCallDate}T${callForm.nextCallTime}`).toISOString()
        : null

      // A. Insert Call
      const { error: callErr } = await supabase.from('calls').insert({
        lead_id: selectedLead.id,
        user_id: profile.id,
        direction: 'outgoing',
        phone_number: selectedLead.phone,
        outcome_id: callForm.outcomeId,
        notes: callForm.note,
        follow_up_at: nextCallAt,
        follow_up_required: nextCallAt !== null,
        duration_seconds: 60,
        status: 'completed'
      })

      if (callErr) throw new Error(callErr.message)

      // B. Update Lead Status
      let updatedStatusId = selectedLead.status_id
      if (outcomeName === 'Ulaşılamadı' || outcomeName === 'Cevap Vermedi' || outcomeName === 'Meşgul') {
        updatedStatusId = '22222222-0000-0000-0000-000000000005'
      } else if (outcomeName === 'Daha Sonra Aranacak' || outcomeName === 'İlgileniyor') {
        updatedStatusId = '22222222-0000-0000-0000-000000000006'
      } else if (outcomeName === 'Satış Uzmanına İletildi') {
        updatedStatusId = '22222222-0000-0000-0000-000000000009'
      } else if (outcomeName === 'Ulaşıldı' || outcomeName === 'Bilgi Verildi') {
        updatedStatusId = '22222222-0000-0000-0000-000000000007'
      } else if (outcomeName === 'İlgilenmiyor') {
        updatedStatusId = '22222222-0000-0000-0000-000000000012'
      }

      let finalNextContactAt = nextCallAt
      let finalCallbackStatus = selectedLead.callback_status || 'none'

      if (updatedStatusId === '22222222-0000-0000-0000-000000000005' && !nextCallAt) {
        const { count: callCount } = await supabase
          .from('calls')
          .select('*', { count: 'exact', head: true })
          .eq('lead_id', selectedLead.id)

        const actualCount = callCount || 0
        const { nextContactAt, callbackStatus } = getProgressiveCallSchedule(actualCount)
        finalNextContactAt = nextContactAt
        finalCallbackStatus = callbackStatus
      }

      const isCallbackOutcome = outcomeName === 'Daha Sonra Aranacak'
      const leadUpdatePayload: any = {
        status_id: updatedStatusId,
        next_contact_at: finalNextContactAt,
        callback_status: finalCallbackStatus,
        last_contact_at: new Date().toISOString(),
        extra_notes: callForm.note || selectedLead.extra_notes
      }
      if (isCallbackOutcome) {
        leadUpdatePayload.callback_status = 'pending'
        leadUpdatePayload.callback_date = callForm.nextCallDate || null
        leadUpdatePayload.callback_time = callForm.nextCallTime || null
        leadUpdatePayload.callback_notes = callForm.note || null
        leadUpdatePayload.final_quality_category = 'callback'
      }
      await supabase.from('leads').update(leadUpdatePayload).eq('id', selectedLead.id)

      // C. Task & Forwarding
      if ((outcomeName === 'Daha Sonra Aranacak' || callForm.createTask) && nextCallAt) {
        await supabase.from('tasks').insert({
          title: `${selectedLead.first_name} ${selectedLead.last_name} Geri Arama Görevi`,
          description: `Görüşme sonucu: ${callForm.note}`,
          task_type: 'callback',
          priority: 'normal',
          status: 'pending',
          due_at: nextCallAt,
          assigned_to: profile.id,
          created_by: profile.id,
          lead_id: selectedLead.id
        })
      }

      if (outcomeName === 'Satış Uzmanına İletildi' || callForm.forwardToSales) {
        const { data: managers } = await supabase.from('profiles').select('id').in('role', ['super_admin', 'admin'])
        if (managers) {
          const notificationsPayload = managers.map(m => ({
            user_id: m.id,
            type: 'forwarded_to_sales',
            title: 'Yeni Satış İletim Talebi',
            message: `${profile.full_name} temsilcisi, ${selectedLead.first_name} ${selectedLead.last_name} isimli lead'i satışa yönlendirdi.`,
            entity_type: 'lead',
            entity_id: selectedLead.id
          }))
          await supabase.from('notifications').insert(notificationsPayload)
        }
      }

      fetchLeads(profile.id, profile.role)
      setCallFormOpen(false)
    } catch (err: any) {
      alert('Arama kaydedilemedi: ' + err.message)
    } finally {
      setSavingCall(false)
    }
  }

  // Create Quick Task associated with lead
  const handleOpenAddTask = (lead: any) => {
    setSelectedLead(lead)
    setTaskForm({
      title: '',
      description: '',
      taskType: 'general',
      priority: 'normal',
      dueAtDate: '',
      dueAtTime: ''
    })
    setTaskFormOpen(true)
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLead || !profile) return

    setSavingTask(true)
    try {
      const dueAt = taskForm.dueAtDate && taskForm.dueAtTime
        ? new Date(`${taskForm.dueAtDate}T${taskForm.dueAtTime}`).toISOString()
        : null

      const { error } = await supabase.from('tasks').insert({
        title: taskForm.title,
        description: taskForm.description,
        task_type: taskForm.taskType,
        priority: taskForm.priority,
        status: 'pending',
        due_at: dueAt,
        assigned_to: profile.id,
        created_by: profile.id,
        lead_id: selectedLead.id
      })

      if (error) {
        alert(error.message)
      } else {
        alert('Görev başarıyla oluşturuldu.')
        setTaskFormOpen(false)
      }
    } catch (err: any) {
      console.error(err)
    } finally {
      setSavingTask(false)
    }
  }

  const statusIdToName = (statusId: string) => {
    if (statusId === '22222222-0000-0000-0000-000000000009') return 'Satış Uzmanına İletildi'
    if (statusId === '22222222-0000-0000-0000-000000000005') return 'Ulaşılamadı'
    if (statusId === '22222222-0000-0000-0000-000000000006') return 'Geri Aranacak'
    if (statusId === '22222222-0000-0000-0000-000000000007') return 'Görüşme Yapıldı'
    if (statusId === '22222222-0000-0000-0000-000000000012') return 'İlgilenmiyor'
    return 'Görüşme Yapıldı'
  }

  // Edit Allowed Fields
  const handleOpenEdit = (lead: any) => {
    setSelectedLead(lead)
    setEditForm({
      firstName: lead.first_name || '',
      lastName: lead.last_name || '',
      companyName: lead.company_name || '',
      phone: lead.phone || '',
      secondaryPhone: lead.secondary_phone || '',
      email: lead.email || '',
      provinceId: lead.province_id || '',
      requestedProduct: lead.requested_product || '',
      assignedSalesUserId: lead.assigned_sales_user_id || '',
      statusId: lead.status_id || '',
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

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLead || !profile) return

    setSavingEdit(true)
    try {
      const selectedProvince = provinces.find(p => p.id === editForm.provinceId)
      const selectedRep = salesReps.find(r => r.id === editForm.assignedSalesUserId)

      let finalNotes = selectedLead.extra_notes || ''
      if (editForm.note.trim()) {
        const timeStr = new Date().toLocaleString('tr-TR')
        finalNotes = `[${timeStr}] - ${editForm.note.trim()}\n` + finalNotes
      }

      const updatePayload: any = {
        first_name: editForm.firstName,
        last_name: editForm.lastName,
        company_name: editForm.companyName,
        phone: editForm.phone,
        secondary_phone: editForm.secondaryPhone,
        email: editForm.email,
        province_id: editForm.provinceId || null,
        province: selectedProvince ? selectedProvince.name : selectedLead.province,
        requested_product: editForm.requestedProduct,
        assigned_sales_user_id: editForm.assignedSalesUserId || null,
        sales_representative_text: selectedRep ? selectedRep.full_name : null,
        status_id: editForm.statusId || selectedLead.status_id,
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

      const { error: updateErr } = await supabase
        .from('leads')
        .update(updatePayload)
        .eq('id', selectedLead.id)

      if (updateErr) throw new Error(updateErr.message)

      // B. Create a Call Record if a note was added
      if (editForm.note.trim()) {
        const currentStatus = editForm.statusId || selectedLead.status_id
        const statusName = statusIdToName(currentStatus)
        const outcome = outcomes.find(o => o.name.toLowerCase().includes(statusName.toLowerCase()))
        
        const { error: callErr } = await supabase.from('calls').insert({
          lead_id: selectedLead.id,
          user_id: profile.id,
          direction: 'outgoing',
          phone_number: selectedLead.phone,
          outcome_id: outcome?.id || outcomes[0]?.id || null,
          notes: editForm.note.trim(),
          duration_seconds: 60,
          status: 'completed'
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

      fetchLeads(profile.id, profile.role)
      setEditFormOpen(false)
    } catch (err: any) {
      alert('Güncelleme kaydedilemedi: ' + err.message)
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <div className="space-y-6 select-none pb-8">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground">Lead Listem</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Sadece şahsınıza atanmış olan kurşunların listesi.</p>
        </div>

        {/* Search Bar & Actions */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="İsim, firma, telefon veya şehir ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-4 bg-card border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
          
          <button 
            type="button"
            onClick={() => router.push('/workspace/leads/new')}
            className="h-9 px-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg flex items-center gap-1.5 text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0"
            title="Manuel Lead Ekle"
          >
            <Plus className="h-4 w-4" />
            <span>Manuel Lead Ekle</span>
          </button>
        </div>
      </div>

      {/* Leads Table Container */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs">Lead listeniz yükleniyor...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-20 text-xs text-muted-foreground">
            Arama kriterlerine uygun atanmış lead bulunmamaktadır.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-accent/20 border-b border-border/70 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  <th className="p-3.5">No</th>
                  <th className="p-3.5">Ad Soyad</th>
                  <th className="p-3.5">Telefon (Ana)</th>
                  <th className="p-3.5">Diğer Tel</th>
                  <th className="p-3.5">E-posta</th>
                  <th className="p-3.5">Cihaz/Ürün</th>
                  <th className="p-3.5">İl</th>
                  <th className="p-3.5">İletilen Satışçı</th>
                  <th className="p-3.5">Durum</th>
                  <th className="p-3.5 text-center">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-muted/30 transition-colors font-medium">
                    <td className="p-3.5 font-mono text-[10px] text-muted-foreground">{formatLeadId(lead.lead_number)}</td>
                    <td className="p-3.5 font-bold text-foreground">{lead.first_name} {lead.last_name}</td>
                    <td className="p-3.5">
                      <a href={`tel:${lead.phone}`} className="text-primary hover:underline flex items-center gap-1 font-semibold">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        {lead.phone}
                      </a>
                    </td>
                    <td className="p-3.5">
                      {lead.secondary_phone ? (
                        <a href={`tel:${lead.secondary_phone}`} className="text-primary hover:underline flex items-center gap-1 font-semibold">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          {lead.secondary_phone}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3.5 text-muted-foreground">
                      {lead.email || '-'}
                    </td>
                    <td className="p-3.5 font-semibold text-foreground truncate max-w-[120px]">{lead.requested_product || '-'}</td>
                    <td className="p-3.5 text-muted-foreground">{lead.province || lead.city || '-'}</td>
                    <td className="p-3.5 font-semibold text-indigo-600 dark:text-indigo-400">
                      {lead.sales_representative_text || '-'}
                    </td>
                    <td className="p-3.5">
                      <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded" style={{
                        backgroundColor: lead.lead_statuses?.color + '15' || '#eaeaea',
                        color: lead.lead_statuses?.color || '#555'
                      }}>
                        {lead.lead_statuses?.name}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedLead(lead)
                            setDetailModalOpen(true)
                          }}
                          className="h-7 px-2 border border-border hover:bg-accent rounded-md text-[10px] font-semibold cursor-pointer"
                        >
                          Detay
                        </button>
                        <button
                          onClick={() => handleOpenEdit(lead)}
                          className="h-7 px-2.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-md text-[10px] font-bold cursor-pointer flex items-center gap-1 shadow-sm"
                        >
                          <Phone className="h-3 w-3" />
                          Görüşme & Yönlendir
                        </button>
                        <button
                          onClick={() => handleOpenAddTask(lead)}
                          className="h-7 px-2 border border-border hover:bg-accent rounded-md text-[10px] font-semibold cursor-pointer"
                        >
                          Görev Ekle
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 1. LEAD DETAIL DIALOG */}
      <Dialog.Root open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-lg z-50 animate-in fade-in zoom-in-95 duration-150 select-none">
            <Dialog.Title className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">Lead Detay Kartı</Dialog.Title>
            {selectedLead && (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-muted rounded-lg space-y-1">
                  <span className="text-[8px] font-bold text-muted-foreground uppercase font-mono">{formatLeadId(selectedLead.lead_number)}</span>
                  <h4 className="font-bold text-foreground text-sm">{selectedLead.first_name} {selectedLead.last_name}</h4>
                  <p className="text-muted-foreground">{selectedLead.company_name || 'Şahıs Firması'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-[9px] font-bold text-muted-foreground uppercase">Telefon</span>
                    <a href={`tel:${selectedLead.phone}`} className="text-primary hover:underline font-semibold block mt-0.5">{selectedLead.phone}</a>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-muted-foreground uppercase">E-Posta</span>
                    <span className="text-foreground block mt-0.5 truncate">{selectedLead.email || 'Belirtilmemiş'}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-muted-foreground uppercase">Şehir</span>
                    <span className="text-foreground block mt-0.5">{selectedLead.city || 'Belirtilmemiş'}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-muted-foreground uppercase">İlgi Duyulan Ürün</span>
                    <span className="text-foreground font-semibold block mt-0.5">{selectedLead.requested_product || 'Belirtilmemiş'}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-muted-foreground uppercase">Lead Kaynağı</span>
                    <span className="text-foreground block mt-0.5">{selectedLead.lead_sources?.name || '-'}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-muted-foreground uppercase">Görüşme Önceliği</span>
                    <span className="text-foreground block mt-0.5">{selectedLead.priority || 'Normal'}</span>
                  </div>
                </div>
                {selectedLead.extra_notes && (
                  <div className="pt-2 border-t border-border">
                    <span className="block text-[9px] font-bold text-muted-foreground uppercase mb-1">Açıklama / Görüşme Geçmişi</span>
                    <p className="p-3 bg-muted/50 rounded-lg text-slate-600 dark:text-slate-300 italic leading-relaxed">
                      {selectedLead.extra_notes}
                    </p>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Dialog.Close asChild>
                    <button className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 cursor-pointer">Kapat</button>
                  </Dialog.Close>
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* 2. CALL LOG outcome DIALOG */}
      <Dialog.Root open={callFormOpen} onOpenChange={setCallFormOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-lg z-50 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto select-none">
            <Dialog.Title className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">Hızlı Görüşme Sonucu Kaydı</Dialog.Title>
            {selectedLead && (
              <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg text-xs">
                <p className="font-bold text-foreground">{selectedLead.first_name} {selectedLead.last_name}</p>
                <p className="text-muted-foreground mt-0.5">{selectedLead.company_name} | {selectedLead.phone}</p>
              </div>
            )}
            <form onSubmit={handleSaveCallResult} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Arama Sonucu *</label>
                <select
                  required
                  value={callForm.outcomeId}
                  onChange={(e) => handleOutcomeChange(e.target.value)}
                  className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                >
                  <option value="" disabled>Arama sonucunu seçin...</option>
                  {outcomes.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>

              {(outcomes.find(o => o.id === callForm.outcomeId)?.name === 'Ulaşılamadı' ||
                outcomes.find(o => o.id === callForm.outcomeId)?.name === 'Cevap Vermedi' ||
                outcomes.find(o => o.id === callForm.outcomeId)?.name === 'Meşgul') && (
                <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg space-y-2">
                  <span className="block text-[9px] font-bold text-amber-600 uppercase">Hızlı Takip Saati Belirle:</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => handleQuickFollowUp(30)} className="px-2.5 py-1 bg-card hover:bg-accent text-[9px] font-semibold border border-border rounded-md cursor-pointer">30 Dk Sonra</button>
                    <button type="button" onClick={() => handleQuickFollowUp(60)} className="px-2.5 py-1 bg-card hover:bg-accent text-[9px] font-semibold border border-border rounded-md cursor-pointer">1 Saat Sonra</button>
                    <button type="button" onClick={() => handleQuickFollowUp(180)} className="px-2.5 py-1 bg-card hover:bg-accent text-[9px] font-semibold border border-border rounded-md cursor-pointer">3 Saat Sonra</button>
                    <button type="button" onClick={() => handleQuickFollowUpDays(1)} className="px-2.5 py-1 bg-card hover:bg-accent text-[9px] font-semibold border border-border rounded-md cursor-pointer">Yarın</button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Arama Notu</label>
                <textarea
                  value={callForm.note}
                  onChange={(e) => setCallForm({ ...callForm, note: e.target.value })}
                  placeholder="Görüşme notları..."
                  rows={3}
                  className="w-full p-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">İlgilenilen Ürün</label>
                  <select
                    value={callForm.productId}
                    onChange={(e) => setCallForm({ ...callForm, productId: e.target.value })}
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                  >
                    <option value="">Ürün seçin...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Müşteri Sıcaklığı</label>
                  <select
                    value={callForm.customerWarmth}
                    onChange={(e) => setCallForm({ ...callForm, customerWarmth: e.target.value })}
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                  >
                    <option value="cold">❄️ Soğuk</option>
                    <option value="warm">🔥 Ilık</option>
                    <option value="hot">💥 Sıcak</option>
                  </select>
                </div>
              </div>

              {callForm.requiresFollowUp && (
                <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-lg space-y-3">
                  <span className="block text-[9px] font-bold text-indigo-600 uppercase">Sonraki Takip Arama Bilgileri (Zorunlu)</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[8px] font-bold text-muted-foreground mb-1">Arama Tarihi</label>
                      <input
                        type="date"
                        required
                        value={callForm.nextCallDate}
                        onChange={(e) => setCallForm({ ...callForm, nextCallDate: e.target.value })}
                        className="w-full h-9 px-3.5 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-muted-foreground mb-1">Arama Saati</label>
                      <input
                        type="time"
                        required
                        value={callForm.nextCallTime}
                        onChange={(e) => setCallForm({ ...callForm, nextCallTime: e.target.value })}
                        className="w-full h-9 px-3.5 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="create_task_leads"
                      type="checkbox"
                      checked={callForm.createTask}
                      onChange={(e) => setCallForm({ ...callForm, createTask: e.target.checked })}
                      className="h-4 w-4 rounded border-border"
                    />
                    <label htmlFor="create_task_leads" className="text-[10px] text-muted-foreground font-semibold cursor-pointer">Geri arama görevi ekle</label>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-border/60 pt-3">
                <div className="flex items-center gap-2">
                  <input
                    id="forward_sales_leads"
                    type="checkbox"
                    checked={callForm.forwardToSales}
                    onChange={(e) => setCallForm({ ...callForm, forwardToSales: e.target.checked })}
                    className="h-4 w-4 rounded border-border cursor-pointer"
                  />
                  <label htmlFor="forward_sales_leads" className="text-[10px] text-muted-foreground font-bold cursor-pointer">Satış Uzmanına Yönlendir</label>
                </div>
                <div className="flex gap-2">
                  <Dialog.Close asChild>
                    <button type="button" className="px-4 py-2 border border-border hover:bg-accent rounded-lg text-xs font-semibold cursor-pointer">Vazgeç</button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={savingCall}
                    className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 flex items-center gap-1 cursor-pointer"
                  >
                    {savingCall && <Loader2 className="h-3 w-3 animate-spin" />}
                    Kaydet
                  </button>
                </div>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* 3. ADD TASK DIALOG */}
      <Dialog.Root open={taskFormOpen} onOpenChange={setTaskFormOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-lg z-50 animate-in fade-in zoom-in-95 duration-150 select-none">
            <Dialog.Title className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">Görev Ekle</Dialog.Title>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Görev Başlığı *</label>
                <input
                  type="text"
                  required
                  placeholder="Arama takibi, teklif hazırlama vb."
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Açıklama</label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  placeholder="Görev açıklaması..."
                  rows={2}
                  className="w-full p-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Tür</label>
                  <select
                    value={taskForm.taskType}
                    onChange={(e) => setTaskForm({ ...taskForm, taskType: e.target.value })}
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                  >
                    <option value="general">Genel Görev</option>
                    <option value="call">Arama</option>
                    <option value="callback">Geri Arama</option>
                    <option value="meeting">Toplantı</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Öncelik</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
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
                  <label className="block text-[8px] font-bold text-muted-foreground mb-1">Son Tarih</label>
                  <input
                    type="date"
                    required
                    value={taskForm.dueAtDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueAtDate: e.target.value })}
                    className="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-bold text-muted-foreground mb-1">Son Saat</label>
                  <input
                    type="time"
                    required
                    value={taskForm.dueAtTime}
                    onChange={(e) => setTaskForm({ ...taskForm, dueAtTime: e.target.value })}
                    className="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Dialog.Close asChild>
                  <button type="button" className="px-4 py-2 border border-border hover:bg-accent rounded-lg text-xs font-semibold cursor-pointer">Vazgeç</button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={savingTask}
                  className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 flex items-center gap-1 cursor-pointer"
                >
                  {savingTask && <Loader2 className="h-3 w-3 animate-spin" />}
                  Kaydet
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* 4. UNIFIED CALL RESULT & EDIT & FORWARD DIALOG */}
      <Dialog.Root open={editFormOpen} onOpenChange={setEditFormOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-lg z-50 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto select-none">
            <Dialog.Title className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">Görüşme Kaydet & Satışa Yönlendir</Dialog.Title>
            
            <form onSubmit={handleEditSubmit} className="space-y-4">
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
                <span className="block text-[10px] font-extrabold text-foreground uppercase tracking-wider font-bold">Geri Arama (Callback) Bilgileri</span>
                
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
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

    </div>
  )
}

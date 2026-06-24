'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Search, 
  Filter, 
  MapPin, 
  Briefcase, 
  User, 
  Calendar, 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Loader2,
  Phone,
  Sliders,
  Send,
  MoreHorizontal,
  Bookmark
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'

export default function LegacyLeadsPage() {
  const supabase = createClient()

  // State
  const [leads, setLeads] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [statuses, setStatuses] = useState<any[]>([])
  const [sources, setSources] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])

  // Filters
  const [monthFilter, setMonthFilter] = useState<string>('all') // all, may, june
  const [cityFilter, setCityFilter] = useState<string>('all')
  const [productFilter, setProductFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [repFilter, setRepFilter] = useState<string>('all')
  const [mappingFilter, setMappingFilter] = useState<string>('all') // all, mapped, unmapped
  const [flagFilter, setFlagFilter] = useState<string>('all')

  // Assignment Modal
  const [assignOpen, setAssignOpen] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [assignmentForm, setAssignmentForm] = useState({
    userId: '',
    assignmentType: 'call', // call, callback, sales, quote, follow, info
    dueAtDate: '',
    dueAtTime: '10:00',
    priority: 'normal',
    managerMessage: '',
    createTask: true,
    onlyFollowUp: false
  })

  // Selected lead for detail check
  const [activeLead, setActiveLead] = useState<any>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Lookups data arrays
  const [uniqueCities, setUniqueCities] = useState<string[]>([])
  const [uniqueProducts, setUniqueProducts] = useState<string[]>([])
  const [uniqueReps, setUniqueReps] = useState<string[]>([])

  useEffect(() => {
    async function init() {
      setLoading(true)
      try {
        await Promise.all([
          fetchLeads(),
          fetchUsers(),
          fetchLookups()
        ])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const fetchLeads = async () => {
    const { data, error } = await supabase
      .from('leads')
      .select(`
        *,
        lead_statuses(name, color),
        lead_sources(name),
        communication_channels(name),
        assigned_sales:assigned_sales_user_id(full_name, role),
        assigned_call_center:assigned_call_center_user_id(full_name, role)
      `)
      .eq('legacy_source_file', '2026 - Mayıs Haziran Verileri.xlsx')
      .order('legacy_excel_row', { ascending: true })

    if (!error && data) {
      setLeads(data)
      
      // Calculate unique filters list
      const cities = Array.from(new Set(data.map(l => l.province).filter(Boolean))) as string[]
      const products = Array.from(new Set(data.map(l => l.requested_product).filter(Boolean))) as string[]
      const reps = Array.from(new Set(data.map(l => l.sales_representative_text).filter(Boolean))) as string[]
      
      setUniqueCities(cities.sort())
      setUniqueProducts(products.sort())
      setUniqueReps(reps.sort())
    }
  }

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('is_active', true)
      .eq('role', 'call_center_rep')
      .order('full_name')
    if (!error && data) {
      const filtered = data.filter(u => u.full_name.toLowerCase().includes('ebru'))
      setUsers(filtered)
      if (filtered.length > 0) {
        setAssignmentForm(prev => ({ ...prev, userId: filtered[0].id }))
      }
    }
  }

  const fetchLookups = async () => {
    const { data: st } = await supabase.from('lead_statuses').select('*')
    const { data: sr } = await supabase.from('lead_sources').select('*')
    if (st) setStatuses(st)
    if (sr) setSources(sr)
  }

  // Filtering leads list
  const filteredLeads = leads.filter(lead => {
    // Search
    const searchVal = searchQuery.toLowerCase()
    const matchesSearch = 
      (lead.full_name || '').toLowerCase().includes(searchVal) ||
      (lead.phone || '').includes(searchVal) ||
      (lead.legacy_lead_id || '').toLowerCase().includes(searchVal) ||
      (lead.company_name || '').toLowerCase().includes(searchVal)

    if (!matchesSearch) return false

    // Month
    if (monthFilter !== 'all') {
      const contactDate = lead.first_contact_date ? new Date(lead.first_contact_date) : null
      if (!contactDate) return false
      const m = contactDate.getMonth() + 1 // 1-indexed
      if (monthFilter === 'may' && m !== 5) return false
      if (monthFilter === 'june' && m !== 6) return false
    }

    // City
    if (cityFilter !== 'all' && lead.province !== cityFilter) return false

    // Product
    if (productFilter !== 'all' && lead.requested_product !== productFilter) return false

    // Source
    if (sourceFilter !== 'all' && lead.lead_sources?.name !== sourceFilter) return false

    // Rep Text
    if (repFilter !== 'all' && lead.sales_representative_text !== repFilter) return false

    // Mappings Filter
    if (mappingFilter !== 'all') {
      const hasMappedUser = !!lead.assigned_sales_user_id || !!lead.assigned_call_center_user_id
      if (mappingFilter === 'mapped' && !hasMappedUser) return false
      if (mappingFilter === 'unmapped' && hasMappedUser) return false
    }

    // Quality Flags Filter
    if (flagFilter !== 'all') {
      const flags = lead.data_quality_flags || []
      if (!flags.includes(flagFilter)) return false
    }

    return true
  })

  // Bulk Assignment Handler
  const handleBulkAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedLeads.length === 0 || !assignmentForm.userId) return

    setAssigning(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Yönetici oturumu bulunamadı.')

      // Find user details
      const targetUser = users.find(u => u.id === assignmentForm.userId)
      const userRole = targetUser?.role || 'sales_specialist'

      const isCallCenter = userRole === 'call_center_rep'

      // Formulate target datetime
      const targetDt = assignmentForm.dueAtDate && assignmentForm.dueAtTime
        ? new Date(`${assignmentForm.dueAtDate}T${assignmentForm.dueAtTime}`).toISOString()
        : null

      // Iterate and assign each lead
      for (const leadId of selectedLeads) {
        const leadObj = leads.find(l => l.id === leadId)
        if (!leadObj) continue

        const prevUserId = isCallCenter 
          ? leadObj.assigned_call_center_user_id 
          : leadObj.assigned_sales_user_id

        // 1. Update Lead
        const updatePayload: any = {}
        if (isCallCenter) {
          updatePayload.assigned_call_center_user_id = assignmentForm.userId
        } else {
          updatePayload.assigned_sales_user_id = assignmentForm.userId
        }

        if (targetDt) {
          updatePayload.next_contact_at = targetDt
        }

        // Add manager note to lead details
        if (assignmentForm.managerMessage) {
          updatePayload.notes = `Yönetici Notu (${new Date().toLocaleDateString('tr-TR')}): ${assignmentForm.managerMessage}\n` + (leadObj.notes || '')
        }

        // If assignment type dictates status change
        if (assignmentForm.assignmentType === 'call') {
          // Atama Bekliyor / Call Center'a atandı status matches
          const callCenterAssignedStatus = statuses.find(s => s.name === 'Call Center’a Atandı')?.id
          if (callCenterAssignedStatus) {
            updatePayload.status_id = callCenterAssignedStatus
          }
        } else if (assignmentForm.assignmentType === 'sales') {
          const salesAssignedStatus = statuses.find(s => s.name === 'Satış Sürecinde')?.id
          if (salesAssignedStatus) {
            updatePayload.status_id = salesAssignedStatus
          }
        }

        const { error: leadErr } = await supabase
          .from('leads')
          .update(updatePayload)
          .eq('id', leadId)

        if (leadErr) throw new Error(`Lead (${leadObj.full_name}) atanamadı: ${leadErr.message}`)

        // 2. Insert Assignment History
        await supabase.from('lead_assignment_history').insert({
          lead_id: leadId,
          assigned_by: user.id,
          previous_user_id: prevUserId || null,
          new_user_id: assignmentForm.userId,
          notes: assignmentForm.managerMessage || 'Yönetici tarafından atama gerçekleştirildi.'
        })

        // 3. Create Task
        if (assignmentForm.createTask && targetDt) {
          const taskTitle = 
            assignmentForm.assignmentType === 'call' ? 'Çağrı Arama Görevi' :
            assignmentForm.assignmentType === 'callback' ? 'Geri Arama Takibi' :
            assignmentForm.assignmentType === 'sales' ? 'Satış Uzmanı Görüşmesi' :
            assignmentForm.assignmentType === 'quote' ? 'Teklif İletim ve Takibi' : 'Genel Takip Görevi'

          await supabase.from('tasks').insert({
            title: `${taskTitle}: ${leadObj.full_name}`,
            description: `Yönetici atama notu: ${assignmentForm.managerMessage || 'Belirtilmemiş'}\nTelefon: ${leadObj.phone}`,
            task_type: assignmentForm.assignmentType === 'callback' ? 'callback' : 'general',
            priority: assignmentForm.priority,
            status: 'pending',
            due_at: targetDt,
            assigned_to: assignmentForm.userId,
            created_by: user.id,
            lead_id: leadId
          })
        }

        // 4. Create Notification for rep
        await supabase.from('notifications').insert({
          user_id: assignmentForm.userId,
          type: 'task_assigned',
          title: 'Yeni Lead Atandı',
          message: `${leadObj.full_name} isimli geçmiş lead size yönlendirildi. ${assignmentForm.managerMessage ? `Not: ${assignmentForm.managerMessage}` : ''}`,
          entity_type: 'lead',
          entity_id: leadId
        })

        // 5. Send Manager Message
        if (assignmentForm.managerMessage) {
          await supabase.from('admin_messages').insert({
            sender_user_id: user.id,
            recipient_user_id: assignmentForm.userId,
            target_type: 'user',
            title: `Eski Veri Ataması: ${leadObj.full_name}`,
            content: `Aşağıdaki lead size yönlendirilmiştir:\nAd Soyad: ${leadObj.full_name}\nTelefon: ${leadObj.phone}\nİlgilenilen Ürün: ${leadObj.requested_product}\n\nYönetici Görev Talimatı:\n${assignmentForm.managerMessage}`,
            priority: assignmentForm.priority === 'critical' ? 'urgent' : assignmentForm.priority === 'high' ? 'important' : 'normal',
            related_entity_type: 'lead',
            related_entity_id: leadObj.id
          })
        }
      }

      alert(`${selectedLeads.length} lead başarıyla atandı ve ilgili görev/bildirimler oluşturuldu.`)
      setSelectedLeads([])
      setAssignOpen(false)
      fetchLeads()
    } catch (err: any) {
      alert('Atama sırasında hata: ' + err.message)
    } finally {
      setAssigning(false)
    }
  }

  // Toggle selection
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeads(filteredLeads.map(l => l.id))
    } else {
      setSelectedLeads([])
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedLeads(prev => [...prev, id])
    } else {
      setSelectedLeads(prev => prev.filter(item => item !== id))
    }
  }

  return (
    <div className="space-y-6 select-none pb-8 text-xs">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground">Geçmiş Veriler (Mayıs & Haziran 2026)</h1>
          <p className="text-xs text-muted-foreground mt-0.5">302 eski Excel kaydını görüntüleyin, filtreleyin ve temsilcilere toplu/tekil atayın.</p>
        </div>

        {/* Bulk Assignment Button */}
        {selectedLeads.length > 0 && (
          <button
            onClick={() => setAssignOpen(true)}
            className="h-9 px-4.5 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/95 flex items-center gap-2 cursor-pointer transition-colors shadow-sm animate-pulse"
          >
            <Send className="h-4 w-4" />
            Toplu Ata ({selectedLeads.length} Lead)
          </button>
        )}
      </div>

      {/* FILTER PANEL BAR */}
      <div className="bg-card border border-border p-4 rounded-xl shadow-xs space-y-3">
        <div className="flex items-center gap-2 font-bold text-foreground uppercase tracking-wider text-[10px] pb-1 border-b border-border/50">
          <Filter className="h-4 w-4 text-primary" />
          Filtreleme Seçenekleri
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {/* Search Bar */}
          <div className="col-span-2 relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="İsim, firma, tel, no ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3.5 bg-background border border-border rounded-lg"
            />
          </div>

          {/* Month */}
          <div>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-full h-8 px-2.5 bg-background border border-border rounded-lg cursor-pointer"
            >
              <option value="all">🗓️ Tüm Aylar</option>
              <option value="may">Mayıs 2026 (109)</option>
              <option value="june">Haziran 2026 (193)</option>
            </select>
          </div>

          {/* City */}
          <div>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full h-8 px-2.5 bg-background border border-border rounded-lg cursor-pointer"
            >
              <option value="all">📍 Tüm Şehirler</option>
              {uniqueCities.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Product */}
          <div>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="w-full h-8 px-2.5 bg-background border border-border rounded-lg cursor-pointer"
            >
              <option value="all">⚙️ Tüm Ürünler</option>
              {uniqueProducts.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Source */}
          <div>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full h-8 px-2.5 bg-background border border-border rounded-lg cursor-pointer"
            >
              <option value="all">📣 Tüm Reklamlar</option>
              {sources.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Excel Rep */}
          <div>
            <select
              value={repFilter}
              onChange={(e) => setRepFilter(e.target.value)}
              className="w-full h-8 px-2.5 bg-background border border-border rounded-lg cursor-pointer"
            >
              <option value="all">🧑‍💼 Eski Temsilci</option>
              {uniqueReps.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Mapping status */}
          <div>
            <select
              value={mappingFilter}
              onChange={(e) => setMappingFilter(e.target.value)}
              className="w-full h-8 px-2.5 bg-background border border-border rounded-lg cursor-pointer"
            >
              <option value="all">🔗 Eşleşme Durumu</option>
              <option value="mapped">Eşleşen Kullanıcılar</option>
              <option value="unmapped">Eşleşmemiş/Eski Temsilciler</option>
            </select>
          </div>

          {/* Quality flags */}
          <div className="col-span-2 sm:col-span-1">
            <select
              value={flagFilter}
              onChange={(e) => setFlagFilter(e.target.value)}
              className="w-full h-8 px-2 bg-background border border-border rounded-lg cursor-pointer text-red-500 font-bold"
            >
              <option value="all" className="text-foreground font-normal">⚠️ Veri Kalitesi Bayrağı</option>
              <option value="missing_phone">Telefonu Olmayanlar</option>
              <option value="invalid_phone">Hatalı Telefonlar</option>
              <option value="missing_name">İsimsiz Kayıtlar</option>
              <option value="missing_city">Şehir Belirtilmemiş</option>
              <option value="unknown_city">Bilinmeyen Şehirler</option>
              <option value="missing_product">Ürün Seçilmemiş</option>
              <option value="unassigned_sales_specialist">Temsilci Atanmamış</option>
              <option value="duplicate_phone">Mükerrer Telefonlar</option>
            </select>
          </div>
        </div>
      </div>

      {/* LEADS LIST TABLE */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs">Veriler yükleniyor...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            Arama kriterlerine uygun geçmiş veri bulunamadı.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-accent/20 border-b border-border/70 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-border cursor-pointer h-3.5 w-3.5"
                    />
                  </th>
                  <th className="p-3.5 w-16">ID</th>
                  <th className="p-3.5">Temas Tarihi</th>
                  <th className="p-3.5">Ad Soyad / Firma</th>
                  <th className="p-3.5">Telefon</th>
                  <th className="p-3.5">Şehir</th>
                  <th className="p-3.5">İlgi Duyulan Ürün</th>
                  <th className="p-3.5">Eski Temsilci</th>
                  <th className="p-3.5">CRM Atanan</th>
                  <th className="p-3.5 text-center">Veri Kalitesi</th>
                  <th className="p-3.5 text-center">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredLeads.map((lead) => {
                  const isSelected = selectedLeads.includes(lead.id)
                  const hasFlags = lead.data_quality_flags && lead.data_quality_flags.length > 0
                  const mappedUser = lead.assigned_sales?.full_name || lead.assigned_call_center?.full_name || '-'
                  
                  return (
                    <tr key={lead.id} className={`hover:bg-muted/20 transition-colors font-medium ${isSelected ? 'bg-primary/[0.02]' : ''}`}>
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleSelectOne(lead.id, e.target.checked)}
                          className="rounded border-border cursor-pointer h-3.5 w-3.5"
                        />
                      </td>
                      <td className="p-3.5 font-mono text-[10px] text-muted-foreground">{lead.legacy_lead_id}</td>
                      <td className="p-3.5 text-muted-foreground whitespace-nowrap">
                        {lead.first_contact_date ? new Date(lead.first_contact_date).toLocaleDateString('tr-TR') : '-'}
                        {lead.first_contact_time ? ` ${lead.first_contact_time.substring(0, 5)}` : ''}
                      </td>
                      <td className="p-3.5 font-bold text-foreground">
                        {lead.full_name}
                      </td>
                      <td className="p-3.5">
                        <a href={`tel:${lead.phone}`} className="text-primary hover:underline flex items-center gap-1.5 whitespace-nowrap">
                          <Phone className="h-3 w-3 shrink-0" />
                          {lead.phone}
                        </a>
                      </td>
                      <td className="p-3.5 text-muted-foreground">{lead.province}</td>
                      <td className="p-3.5 text-foreground truncate max-w-[140px]" title={lead.requested_product}>
                        {lead.requested_product}
                      </td>
                      <td className="p-3.5 text-muted-foreground">{lead.sales_representative_text}</td>
                      <td className="p-3.5 text-foreground font-semibold">{mappedUser}</td>
                      <td className="p-3.5 text-center">
                        {hasFlags ? (
                          <span className="inline-flex items-center justify-center h-5 px-1.5 bg-red-500/10 border border-red-500/20 text-red-500 text-[9px] font-extrabold rounded-md uppercase" title={lead.data_quality_flags.join(', ')}>
                            Hata ({lead.data_quality_flags.length})
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center h-5 px-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[9px] font-extrabold rounded-md uppercase">
                            Temiz
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setActiveLead(lead)
                              setDetailOpen(true)
                            }}
                            className="h-7 px-2 bg-card border border-border hover:bg-accent rounded-md font-semibold cursor-pointer"
                          >
                            Detay
                          </button>
                          <button
                            onClick={() => {
                              setSelectedLeads([lead.id])
                              setAssignOpen(true)
                            }}
                            className="h-7 px-2 bg-primary text-primary-foreground font-semibold rounded-md hover:bg-primary/95 cursor-pointer"
                          >
                            Yönlendir
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 1. LEAD DETAIL MODAL */}
      <Dialog.Root open={detailOpen} onOpenChange={setDetailOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-xl z-50 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] overflow-y-auto select-none">
            <Dialog.Title className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
              <Bookmark className="h-4.5 w-4.5 text-primary" />
              Eski Lead Detay Kartı
            </Dialog.Title>

            {activeLead && (
              <div className="space-y-4">
                {/* ID Header */}
                <div className="p-3 bg-muted rounded-lg flex justify-between items-center text-xs">
                  <div>
                    <span className="text-[8px] font-bold text-muted-foreground uppercase font-mono">{activeLead.legacy_lead_id} ({activeLead.legacy_source_file})</span>
                    <h4 className="font-bold text-foreground text-sm mt-0.5">{activeLead.full_name}</h4>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-bold font-mono">Row: #{activeLead.legacy_excel_row}</span>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div>
                    <span className="block text-[8px] font-bold text-muted-foreground uppercase">Telefon</span>
                    <a href={`tel:${activeLead.phone}`} className="text-primary hover:underline font-bold block mt-0.5">{activeLead.phone}</a>
                  </div>
                  <div>
                    <span className="block text-[8px] font-bold text-muted-foreground uppercase">Şehir</span>
                    <span className="text-foreground font-semibold block mt-0.5">{activeLead.province}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] font-bold text-muted-foreground uppercase">İlk Temas Tarihi & Saati</span>
                    <span className="text-foreground block mt-0.5">
                      {activeLead.first_contact_date ? new Date(activeLead.first_contact_date).toLocaleDateString('tr-TR') : '-'}
                      {activeLead.first_contact_time ? ` ${activeLead.first_contact_time}` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[8px] font-bold text-muted-foreground uppercase">İlgi Duyulan Ürün</span>
                    <span className="text-foreground font-bold block mt-0.5">{activeLead.requested_product}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] font-bold text-muted-foreground uppercase">İletişim Kanalı</span>
                    <span className="text-foreground block mt-0.5">{activeLead.communication_channels?.name || '-'}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] font-bold text-muted-foreground uppercase">Reklam Kaynağı</span>
                    <span className="text-foreground block mt-0.5">{activeLead.lead_sources?.name || '-'}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] font-bold text-muted-foreground uppercase">Excel Temsilcisi</span>
                    <span className="text-foreground block mt-0.5 font-bold">{activeLead.sales_representative_text}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] font-bold text-muted-foreground uppercase">Eşleşen CRM Temsilcisi</span>
                    <span className="text-foreground block mt-0.5 font-bold">
                      {activeLead.assigned_sales?.full_name || activeLead.assigned_call_center?.full_name || 'Atanmamış'}
                    </span>
                  </div>
                </div>

                {/* Excel Row Details */}
                <div className="border-t border-border pt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="block text-[8px] font-bold text-muted-foreground uppercase">Konuşma Yapıldı mı?</span>
                      <span className="text-foreground font-semibold block mt-0.5">{activeLead.conversation_completed ? '🟢 Evet' : '🔴 Hayır'}</span>
                    </div>
                    <div>
                      <span className="block text-[8px] font-bold text-muted-foreground uppercase">Görüşme Zamanı</span>
                      <span className="text-foreground block mt-0.5">
                        {activeLead.conversation_date ? new Date(activeLead.conversation_date).toLocaleDateString('tr-TR') : '-'}
                        {activeLead.conversation_time ? ` ${activeLead.conversation_time}` : ''}
                      </span>
                    </div>
                  </div>

                  {activeLead.conversation_summary && (
                    <div className="bg-muted/40 p-2.5 rounded-lg border border-border/60">
                      <span className="block text-[8px] font-bold text-muted-foreground uppercase">Görüşme Özeti</span>
                      <p className="text-foreground italic mt-0.5 leading-relaxed">{activeLead.conversation_summary}</p>
                    </div>
                  )}

                  {/* Sales/Quote stats */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-card border border-border p-2 rounded-lg">
                      <span className="block text-[7px] font-bold text-muted-foreground uppercase">Teklif Durumu</span>
                      <span className="text-foreground font-bold block mt-0.5">{activeLead.quote_status || 'Hayır'}</span>
                    </div>
                    <div className="bg-card border border-border p-2 rounded-lg">
                      <span className="block text-[7px] font-bold text-muted-foreground uppercase">Satış Durumu</span>
                      <span className="text-foreground font-bold block mt-0.5">{activeLead.sale_status || 'Fırsat'}</span>
                    </div>
                    <div className="bg-card border border-border p-2 rounded-lg">
                      <span className="block text-[7px] font-bold text-muted-foreground uppercase">Satış Tutarı</span>
                      <span className="text-emerald-500 font-extrabold block mt-0.5">
                        {activeLead.sale_amount ? `${activeLead.sale_amount.toLocaleString('tr-TR')} TL` : '-'}
                      </span>
                    </div>
                  </div>

                  {/* Quality flags */}
                  {activeLead.data_quality_flags && activeLead.data_quality_flags.length > 0 && (
                    <div className="p-3 bg-red-500/5 border border-red-500/20 text-red-600 rounded-lg">
                      <span className="block text-[8px] font-extrabold uppercase mb-1">Tespit Edilen Veri Kalitesi Sorunları:</span>
                      <div className="flex flex-wrap gap-1">
                        {activeLead.data_quality_flags.map((flag: string) => (
                          <span key={flag} className="px-2 py-0.5 bg-red-500/10 border border-red-500/10 rounded text-[9px] font-extrabold uppercase">
                            {flag.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeLead.first_message_note && (
                    <div>
                      <span className="block text-[8px] font-bold text-muted-foreground uppercase mb-0.5">Müşteri Talebi / Mesajı</span>
                      <p className="p-3 bg-muted rounded-lg text-foreground leading-relaxed italic">{activeLead.first_message_note}</p>
                    </div>
                  )}

                  {activeLead.extra_notes && (
                    <div>
                      <span className="block text-[8px] font-bold text-muted-foreground uppercase mb-0.5">Ekstra Notlar</span>
                      <p className="p-3 bg-muted rounded-lg text-foreground leading-relaxed whitespace-pre-wrap">{activeLead.extra_notes}</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 border-t border-border pt-4">
                  <Dialog.Close asChild>
                    <button className="px-4 py-2 border border-border hover:bg-accent rounded-lg font-bold cursor-pointer">Kapat</button>
                  </Dialog.Close>
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* 2. ASSIGN / REDIRECT MODAL */}
      <Dialog.Root open={assignOpen} onOpenChange={setAssignOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-lg z-50 animate-in fade-in zoom-in-95 duration-150 select-none">
            <Dialog.Title className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">
              Lead Yönlendir / Görev Ata
            </Dialog.Title>

            <form onSubmit={handleBulkAssign} className="space-y-4">
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                Seçilen Kurşun Sayısı: <strong className="text-primary">{selectedLeads.length} Lead</strong>
              </div>

              {/* User Selector */}
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Temsilci / Atanacak Kişi *</label>
                <select
                  required
                  value={assignmentForm.userId}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, userId: e.target.value })}
                  className="w-full h-10 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                >
                  <option value="" disabled>Lütfen bir kullanıcı seçin...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role === 'sales_specialist' ? 'Satış Uzmanı' : u.role === 'call_center_rep' ? 'Call Center Temsilcisi' : u.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Assignment Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">İşlem / Atama Türü</label>
                  <select
                    value={assignmentForm.assignmentType}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, assignmentType: e.target.value })}
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="call">Call Center Araması</option>
                    <option value="callback">Geri Arama Takibi</option>
                    <option value="sales">Satış Uzmanı Görüşmesi</option>
                    <option value="quote">Teklif İletim Takibi</option>
                    <option value="follow">Genel Takip</option>
                    <option value="info">Bilgi Güncelleme</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Görev Önceliği</label>
                  <select
                    value={assignmentForm.priority}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, priority: e.target.value })}
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="low">Düşük</option>
                    <option value="normal">Normal</option>
                    <option value="high">Yüksek</option>
                    <option value="critical">Kritik</option>
                  </select>
                </div>
              </div>

              {/* Manager note */}
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Temsilciye Yönlendirme Notu / Talimatı</label>
                <textarea
                  value={assignmentForm.managerMessage}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, managerMessage: e.target.value })}
                  placeholder="Kullanıcının ekranında görünecek yönlendirme notunu buraya yazın..."
                  rows={3}
                  className="w-full p-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Dialog.Close asChild>
                  <button type="button" className="px-4 py-2 border border-border hover:bg-accent rounded-lg font-bold cursor-pointer">Vazgeç</button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={assigning}
                  className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/95 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {assigning && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Yönlendir ve Ata
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

    </div>
  )
}

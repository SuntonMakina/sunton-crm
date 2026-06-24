'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Customer, Profile, LeadSource, Opportunity, Call, Task } from '@/types/crm'
import {
  Users,
  Search,
  Phone,
  Mail,
  MapPin,
  TrendingUp,
  Award,
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  X,
  PlusCircle,
  Building,
  User,
  Activity,
  FileText,
  CheckSquare
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'

export default function CustomersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // URL parameters
  const detailIdParam = searchParams.get('id') || null
  const [activeCustId, setActiveCustId] = useState<string | null>(detailIdParam)

  // Data list states
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [totalRecords, setTotalRecords] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [segmentFilter, setSegmentFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  // Creation form modal states
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [custForm, setCustForm] = useState({
    type: 'individual' as 'individual' | 'corporate',
    first_name: '', last_name: '', company_name: '', phone: '', email: '',
    province: '', district: '', address: '', segment: 'standard' as any, notes: '',
    tax_office: '', tax_number: ''
  })

  // Drawer detail tabs states
  const [activeTab, setActiveTab] = useState<'details' | 'contacts' | 'deals' | 'notes'>('details')
  const [detailOpp, setDetailOpp] = useState<Opportunity[]>([])
  const [detailContacts, setDetailContacts] = useState<any[]>([])
  const [detailNotes, setDetailNotes] = useState<any[]>([])
  
  // Quick sub-resource forms
  const [contactForm, setContactForm] = useState({ firstName: '', lastName: '', title: '', phone: '', email: '', isPrimary: false })
  const [noteForm, setNoteForm] = useState({ content: '' })

  const updateUrlParams = (params: Record<string, string | null>) => {
    const nextParams = new URLSearchParams(searchParams.toString())
    Object.entries(params).forEach(([key, val]) => {
      if (val === null) nextParams.delete(key)
      else nextParams.set(key, val)
    })
    router.replace(`/dashboard/customers?${nextParams.toString()}`)
  }

  useEffect(() => {
    setActiveCustId(detailIdParam)
  }, [detailIdParam])

  // Load Customers
  const loadCustomersList = async () => {
    setLoading(true)
    try {
      let query = supabase.from('customers').select(`
        *,
        assigned_profile:profiles!customers_assigned_user_id_fkey(full_name),
        lead_sources(name)
      `, { count: 'exact' })

      query = query.eq('is_active', true)

      if (searchQuery.trim()) {
        const q = searchQuery.trim()
        query = query.or(`full_name.ilike.%${q}%,company_name.ilike.%${q}%,phone.ilike.%${q}%,customer_number.ilike.%${q}%`)
      }

      if (segmentFilter !== 'all') {
        query = query.eq('segment', segmentFilter)
      }

      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter)
      }

      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to)

      if (!error && data) {
        setCustomers(data as any[])
        setTotalRecords(count || 0)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCustomersList()
  }, [page, pageSize, searchQuery, segmentFilter, typeFilter])

  // Load Sub-Resources for drawer panel
  useEffect(() => {
    if (!activeCustId) return

    async function loadDrawerDetails() {
      // Opportunities
      const { data: opps } = await supabase
        .from('opportunities')
        .select('*, pipeline_stages(name)')
        .eq('customer_id', activeCustId)
        .eq('is_active', true)
      if (opps) setDetailOpp(opps)

      // Contacts list
      const { data: contacts } = await supabase
        .from('customer_contacts')
        .select('*')
        .eq('customer_id', activeCustId)
        .order('is_primary', { ascending: false })
      if (contacts) setDetailContacts(contacts)

      // Notes list
      const { data: notes } = await supabase
        .from('notes')
        .select('*, profiles:created_by(full_name)')
        .eq('entity_type', 'customer')
        .eq('entity_id', activeCustId)
        .order('created_at', { ascending: false })
      if (notes) setDetailNotes(notes)
    }

    loadDrawerDetails()
  }, [activeCustId, activeTab, supabase])

  // Add new customer form submit
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (custForm.type === 'corporate' && !custForm.company_name) {
      alert('Lütfen firma adını girin.')
      return
    }
    if (custForm.type === 'individual' && !custForm.first_name) {
      alert('Lütfen ad alanını girin.')
      return
    }

    setAdding(true)
    try {
      const fullName = custForm.type === 'corporate' 
        ? custForm.company_name 
        : `${custForm.first_name} ${custForm.last_name}`

      const { error } = await supabase.from('customers').insert({
        type: custForm.type,
        first_name: custForm.type === 'individual' ? custForm.first_name : null,
        last_name: custForm.type === 'individual' ? custForm.last_name : null,
        company_name: custForm.type === 'corporate' ? custForm.company_name : null,
        full_name: fullName,
        phone: custForm.phone || null,
        phone_normalized: custForm.phone ? custForm.phone.replace(/\D/g, '') : null,
        email: custForm.email || null,
        province: custForm.province || null,
        district: custForm.district || null,
        address: custForm.address || null,
        segment: custForm.segment,
        notes: custForm.notes || null,
        tax_office: custForm.type === 'corporate' ? custForm.tax_office : null,
        tax_number: custForm.type === 'corporate' ? custForm.tax_number : null
      })

      if (!error) {
        setIsAddOpen(false)
        setCustForm({
          type: 'individual', first_name: '', last_name: '', company_name: '', phone: '', email: '',
          province: '', district: '', address: '', segment: 'standard', notes: '', tax_office: '', tax_number: ''
        })
        loadCustomersList()
      } else {
        alert('Hata: ' + error.message)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setAdding(false)
    }
  }

  // Create Sub-Contact inside drawer panel
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contactForm.firstName || !contactForm.lastName || !activeCustId) return

    try {
      const { error } = await supabase.from('customer_contacts').insert({
        customer_id: activeCustId,
        first_name: contactForm.firstName,
        last_name: contactForm.lastName,
        title: contactForm.title || null,
        phone: contactForm.phone || null,
        email: contactForm.email || null,
        is_primary: contactForm.isPrimary
      })

      if (!error) {
        setContactForm({ firstName: '', lastName: '', title: '', phone: '', email: '', isPrimary: false })
        // Refresh contacts
        const { data: contacts } = await supabase
          .from('customer_contacts')
          .select('*')
          .eq('customer_id', activeCustId)
          .order('is_primary', { ascending: false })
        if (contacts) setDetailContacts(contacts)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Create Customer Note inside drawer panel
  const handleAddCustomerNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteForm.content.trim() || !activeCustId) return

    try {
      const { error } = await supabase.from('notes').insert({
        entity_type: 'customer',
        entity_id: activeCustId,
        content: noteForm.content
      })

      if (!error) {
        setNoteForm({ content: '' })
        // Refresh notes list
        const { data: notes } = await supabase
          .from('notes')
          .select('*, profiles:created_by(full_name)')
          .eq('entity_type', 'customer')
          .eq('entity_id', activeCustId)
          .order('created_at', { ascending: false })
        if (notes) setDetailNotes(notes)
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="space-y-4">
      {/* Title & Actions toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Müşteriler</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Müşteri portföy yönetimi ve 360° müşteri detayları.</p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="h-9 px-3.5 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 flex items-center gap-1.5 cursor-pointer shadow-sm shadow-primary/10 transition-colors"
        >
          <Plus className="h-4.5 w-4.5" />
          Yeni Müşteri Ekle
        </button>
      </div>

      {/* Filters bar */}
      <div className="bg-card border border-border p-3.5 rounded-xl shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Müşteri adı veya numarası ara..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
            className="w-full h-9 pl-8.5 pr-3 bg-background border border-border rounded-lg text-xs focus:outline-none"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
          className="h-9 text-xs bg-background border border-border rounded-lg px-2"
        >
          <option value="all">Tüm Tipler</option>
          <option value="individual">Bireysel Müşteriler</option>
          <option value="corporate">Kurumsal Müşteriler</option>
        </select>

        <select
          value={segmentFilter}
          onChange={(e) => { setSegmentFilter(e.target.value); setPage(1) }}
          className="h-9 text-xs bg-background border border-border rounded-lg px-2"
        >
          <option value="all">Tüm Segmentler</option>
          <option value="standard">Standart</option>
          <option value="bronze">Bronz</option>
          <option value="silver">Gümüş</option>
          <option value="gold">Altın</option>
          <option value="platinum">Platin</option>
        </select>
      </div>

      {/* Main Customers List display */}
      {loading ? (
        <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground mt-3 font-medium">Müşteri listesi yükleniyor...</p>
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-sm text-muted-foreground">
          Kayıtlı aktif müşteri bulunmamaktadır.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[10px] font-bold uppercase text-muted-foreground select-none">
                  <th className="py-3 px-4">Müşteri No</th>
                  <th className="py-3 px-4">Adı / Unvanı</th>
                  <th className="py-3 px-4">Tür</th>
                  <th className="py-3 px-4">Telefon</th>
                  <th className="py-3 px-4">İl</th>
                  <th className="py-3 px-4">Segment</th>
                  <th className="py-3 px-4">Toplam Ciro</th>
                  <th className="py-3 px-4">Sorumlu Uzman</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs text-foreground">
                {customers.map((cust) => (
                  <tr
                    key={cust.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td
                      onClick={() => updateUrlParams({ id: cust.id })}
                      className="py-3.5 px-4 font-mono font-semibold text-primary hover:underline cursor-pointer"
                    >
                      {cust.customer_number}
                    </td>
                    <td
                      onClick={() => updateUrlParams({ id: cust.id })}
                      className="py-3.5 px-4 font-bold text-foreground cursor-pointer flex items-center gap-1.5"
                    >
                      {cust.type === 'corporate' ? <Building className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      {cust.full_name}
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">
                      {cust.type === 'corporate' ? 'Kurumsal' : 'Bireysel'}
                    </td>
                    <td className="py-3.5 px-4 font-medium">{cust.phone || '-'}</td>
                    <td className="py-3.5 px-4">{cust.province || '-'}</td>
                    <td className="py-3.5 px-4 uppercase font-semibold text-[10px]">
                      <span className={`px-2 py-0.5 rounded-full ${
                        cust.segment === 'platinum' ? 'bg-purple-100 text-purple-700' :
                        cust.segment === 'gold' ? 'bg-amber-100 text-amber-700' :
                        cust.segment === 'silver' ? 'bg-slate-200 text-slate-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {cust.segment}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold">{cust.lifetime_value?.toLocaleString('tr-TR')} TRY</td>
                    <td className="py-3.5 px-4 text-muted-foreground font-semibold">{cust.assigned_profile?.full_name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table paginator */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border select-none bg-muted/20">
            <span className="text-xs text-muted-foreground font-medium">
              Toplam: <strong>{totalRecords}</strong> kayıttan <strong>{customers.length}</strong> tanesi listeleniyor
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
                onClick={() => setPage(prev => (prev * pageSize < totalRecords ? prev + 1 : prev))}
                disabled={page * pageSize >= totalRecords}
                className="h-8 w-8 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer: Detailed customer view panel */}
      {activeCustId && (
        <>
          <div className="fixed inset-0 bg-black/30 backdrop-blur-xs z-40" onClick={() => updateUrlParams({ id: null })} />
          <div className="fixed top-0 right-0 h-screen w-full max-w-xl bg-card border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer header */}
            {customers.filter(c => c.id === activeCustId).map((cust) => (
              <React.Fragment key={cust.id}>
                <div className="p-4 border-b border-border bg-accent/30 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
                      {cust.type === 'corporate' ? <Building className="h-5 w-5" /> : <User className="h-5 w-5" />}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold font-mono text-muted-foreground">{cust.customer_number}</span>
                      <h2 className="text-base font-bold text-foreground mt-0.5">{cust.full_name}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">{cust.type === 'corporate' ? 'Kurumsal Müşteri' : 'Bireysel Müşteri'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateUrlParams({ id: null })}
                    className="h-8 w-8 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground select-none">
                  <button onClick={() => setActiveTab('details')} className={`flex-1 py-3 border-b-2 hover:text-foreground ${activeTab === 'details' ? 'border-primary text-primary' : 'border-transparent'}`}>360° Özet</button>
                  <button onClick={() => setActiveTab('contacts')} className={`flex-1 py-3 border-b-2 hover:text-foreground ${activeTab === 'contacts' ? 'border-primary text-primary' : 'border-transparent'}`}>Yetkililer</button>
                  <button onClick={() => setActiveTab('deals')} className={`flex-1 py-3 border-b-2 hover:text-foreground ${activeTab === 'deals' ? 'border-primary text-primary' : 'border-transparent'}`}>Satış Fırsatları</button>
                  <button onClick={() => setActiveTab('notes')} className={`flex-1 py-3 border-b-2 hover:text-foreground ${activeTab === 'notes' ? 'border-primary text-primary' : 'border-transparent'}`}>Müşteri Notları</button>
                </div>

                {/* Content body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  {activeTab === 'details' && (
                    <div className="space-y-4">
                      {/* Grid info details */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-xs">
                        <div>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Telefon</span>
                          <p className="font-semibold text-foreground mt-0.5 flex items-center gap-1.5">
                            <a href={`tel:${cust.phone || ''}`} className="hover:underline flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5 text-primary" />
                              {cust.phone || '-'}
                            </a>
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">E-Posta</span>
                          <p className="font-medium text-foreground mt-0.5">{cust.email || '-'}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">İl / İlçe</span>
                          <p className="font-semibold text-foreground mt-0.5">{cust.province || '-'} / {cust.district || '-'}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Müşteri Segmenti</span>
                          <p className="font-semibold text-foreground mt-0.5 uppercase text-primary">{cust.segment}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Toplam Alışveriş Tutarı</span>
                          <p className="font-bold text-emerald-600 mt-0.5">{cust.lifetime_value?.toLocaleString('tr-TR')} TRY</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Sorumlu Uzman</span>
                          <p className="font-semibold text-foreground mt-0.5">{cust.assigned_profile?.full_name || 'Atanmamış'}</p>
                        </div>
                      </div>

                      {cust.type === 'corporate' && (
                        <div className="border-t border-border pt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Vergi Dairesi</span>
                            <p className="font-semibold text-foreground mt-0.5">{cust.tax_office || '-'}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Vergi Numarası</span>
                            <p className="font-semibold text-foreground mt-0.5">{cust.tax_number || '-'}</p>
                          </div>
                        </div>
                      )}

                      <div className="border-t border-border pt-4">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Adres</span>
                        <p className="text-xs text-foreground mt-0.5 leading-relaxed bg-muted/30 p-2.5 rounded border border-border/60">{cust.address || 'Kayıtlı adres bulunmuyor.'}</p>
                      </div>
                    </div>
                  )}

                  {activeTab === 'contacts' && (
                    <div className="space-y-4">
                      {/* Add contact form */}
                      <form onSubmit={handleAddContact} className="bg-muted/40 border border-border p-4 rounded-xl space-y-3 text-xs">
                        <h4 className="font-bold text-foreground">Yeni Yetkili / İrtibat Kişisi Ekle</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-semibold text-muted-foreground mb-1">AD *</label>
                            <input
                              type="text"
                              required
                              value={contactForm.firstName}
                              onChange={(e) => setContactForm({ ...contactForm, firstName: e.target.value })}
                              className="w-full h-8 bg-background border border-border rounded px-2"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-muted-foreground mb-1">SOYAD *</label>
                            <input
                              type="text"
                              required
                              value={contactForm.lastName}
                              onChange={(e) => setContactForm({ ...contactForm, lastName: e.target.value })}
                              className="w-full h-8 bg-background border border-border rounded px-2"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-semibold text-muted-foreground mb-1">ÜNVAN / ROL</label>
                            <input
                              type="text"
                              placeholder="Örn: Satınalma Müdürü"
                              value={contactForm.title}
                              onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })}
                              className="w-full h-8 bg-background border border-border rounded px-2"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-muted-foreground mb-1">TELEFON</label>
                            <input
                              type="text"
                              value={contactForm.phone}
                              onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                              className="w-full h-8 bg-background border border-border rounded px-2"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="is_primary"
                            checked={contactForm.isPrimary}
                            onChange={(e) => setContactForm({ ...contactForm, isPrimary: e.target.checked })}
                            className="rounded"
                          />
                          <label htmlFor="is_primary" className="text-[10px] font-bold text-muted-foreground cursor-pointer select-none">Birincil irtibat kişisi olarak ayarla</label>
                        </div>
                        <button type="submit" className="h-8 px-4 bg-primary text-primary-foreground font-semibold rounded text-xs hover:bg-primary/95 transition-colors cursor-pointer">Kaydet</button>
                      </form>

                      {/* Contacts list */}
                      <div className="space-y-3.5">
                        <h4 className="text-xs font-bold text-foreground">Kayıtlı Yetkililer ({detailContacts.length})</h4>
                        {detailContacts.length === 0 ? (
                          <div className="text-center py-6 text-xs text-muted-foreground bg-muted/20 border border-border/50 rounded-lg">Kayıtlı yetkili bulunmuyor.</div>
                        ) : (
                          detailContacts.map((c) => (
                            <div key={c.id} className="p-3 border border-border bg-card rounded-lg flex items-center justify-between text-xs">
                              <div>
                                <div className="font-semibold text-foreground flex items-center gap-1.5">
                                  {c.first_name} {c.last_name}
                                  {c.is_primary && <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[8px] font-bold">BİRİNCİL</span>}
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">{c.title || 'Rol belirtilmemiş'} • {c.phone || 'Telefon yok'}</div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'deals' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-foreground">Açık / Kazanılan Satış Fırsatları ({detailOpp.length})</h4>
                      {detailOpp.length === 0 ? (
                        <div className="text-center py-8 text-xs text-muted-foreground bg-muted/20 border border-border/50 rounded-lg">Satış fırsatı kaydı bulunmamaktadır.</div>
                      ) : (
                        <div className="space-y-3">
                          {detailOpp.map((o) => (
                            <div key={o.id} className="p-3.5 border border-border bg-card rounded-xl flex items-center justify-between text-xs">
                              <div>
                                <span className="text-[9px] font-bold font-mono text-muted-foreground">{o.opportunity_number}</span>
                                <h4 className="font-bold text-foreground mt-0.5">{o.title}</h4>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Aşama: {o.pipeline_stages?.name || 'Yeni Fırsat'}</p>
                              </div>
                              <div className="text-right">
                                <span className="font-extrabold text-foreground">{o.amount.toLocaleString('tr-TR')} TRY</span>
                                <span className={`block text-[9px] font-bold uppercase mt-1 ${
                                  o.status === 'won' ? 'text-emerald-500' : o.status === 'lost' ? 'text-red-500' : 'text-primary'
                                }`}>
                                  {o.status === 'won' ? 'Kazanıldı' : o.status === 'lost' ? 'Kaybedildi' : 'Açık'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'notes' && (
                    <div className="space-y-4">
                      {/* Add customer note */}
                      <form onSubmit={handleAddCustomerNote} className="flex gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Müşteri notu ekleyin..."
                          value={noteForm.content}
                          onChange={(e) => setNoteForm({ content: e.target.value })}
                          className="flex-1 h-9 px-3 bg-background border border-border rounded-lg text-xs focus:outline-none"
                        />
                        <button type="submit" className="h-9 px-4 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 cursor-pointer">Ekle</button>
                      </form>

                      {/* Notes list */}
                      <div className="space-y-3">
                        {detailNotes.length === 0 ? (
                          <div className="text-center py-6 text-xs text-muted-foreground bg-muted/20 border border-border/50 rounded-lg">Müşteri notu bulunmuyor.</div>
                        ) : (
                          detailNotes.map((note) => (
                            <div key={note.id} className="p-3 border border-border bg-card rounded-lg text-xs">
                              <p className="text-foreground font-medium">{note.content}</p>
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
                </div>
              </React.Fragment>
            ))}
          </div>
        </>
      )}

      {/* Dialog: Create Customer Form Modal */}
      {isAddOpen && (
        <Dialog.Root open={isAddOpen} onOpenChange={setIsAddOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto z-50 animate-in fade-in zoom-in-95 duration-150">
              <Dialog.Title className="text-base font-bold text-foreground mb-4">Yeni Müşteri Ekle</Dialog.Title>
              <form onSubmit={handleCreateCustomer} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">MÜŞTERİ TİPİ</label>
                  <div className="flex gap-4">
                    <label className="flex items-center text-xs font-semibold cursor-pointer">
                      <input
                        type="radio"
                        checked={custForm.type === 'individual'}
                        onChange={() => setCustForm({ ...custForm, type: 'individual' })}
                        className="mr-1.5 h-3.5 w-3.5"
                      />
                      Bireysel Müşteri
                    </label>
                    <label className="flex items-center text-xs font-semibold cursor-pointer">
                      <input
                        type="radio"
                        checked={custForm.type === 'corporate'}
                        onChange={() => setCustForm({ ...custForm, type: 'corporate' })}
                        className="mr-1.5 h-3.5 w-3.5"
                      />
                      Kurumsal Müşteri (Firma)
                    </label>
                  </div>
                </div>

                {custForm.type === 'corporate' ? (
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">FİRMA ADI / UNVANI *</label>
                    <input
                      type="text"
                      required
                      value={custForm.company_name}
                      onChange={(e) => setCustForm({ ...custForm, company_name: e.target.value })}
                      className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground mb-1">AD *</label>
                      <input
                        type="text"
                        required
                        value={custForm.first_name}
                        onChange={(e) => setCustForm({ ...custForm, first_name: e.target.value })}
                        className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground mb-1">SOYAD *</label>
                      <input
                        type="text"
                        required
                        value={custForm.last_name}
                        onChange={(e) => setCustForm({ ...custForm, last_name: e.target.value })}
                        className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">TELEFON</label>
                    <input
                      type="text"
                      placeholder="0 (5XX) XXX XX XX"
                      value={custForm.phone}
                      onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })}
                      className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">E-POSTA</label>
                    <input
                      type="email"
                      value={custForm.email}
                      onChange={(e) => setCustForm({ ...custForm, email: e.target.value })}
                      className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </div>

                {custForm.type === 'corporate' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground mb-1">VERGİ DAİRESİ</label>
                      <input
                        type="text"
                        value={custForm.tax_office}
                        onChange={(e) => setCustForm({ ...custForm, tax_office: e.target.value })}
                        className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground mb-1">VERGİ NUMARASI</label>
                      <input
                        type="text"
                        value={custForm.tax_number}
                        onChange={(e) => setCustForm({ ...custForm, tax_number: e.target.value })}
                        className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">İL</label>
                    <input
                      type="text"
                      placeholder="Örn: Kayseri"
                      value={custForm.province}
                      onChange={(e) => setCustForm({ ...custForm, province: e.target.value })}
                      className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">İLÇE</label>
                    <input
                      type="text"
                      value={custForm.district}
                      onChange={(e) => setCustForm({ ...custForm, district: e.target.value })}
                      className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">SEGMENT</label>
                    <select
                      value={custForm.segment}
                      onChange={(e) => setCustForm({ ...custForm, segment: e.target.value as any })}
                      className="w-full h-9 px-2 bg-background border border-border rounded-lg focus:outline-none"
                    >
                      <option value="standard">Standart</option>
                      <option value="bronze">Bronz</option>
                      <option value="silver">Gümüş</option>
                      <option value="gold">Altın</option>
                      <option value="platinum">Platin</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">ADRES</label>
                  <input
                    type="text"
                    value={custForm.address}
                    onChange={(e) => setCustForm({ ...custForm, address: e.target.value })}
                    className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">AÇIKLAMA / İÇ NOTLAR</label>
                  <textarea
                    rows={2}
                    value={custForm.notes}
                    onChange={(e) => setCustForm({ ...custForm, notes: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg p-2 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Dialog.Close asChild>
                    <button type="button" className="px-4 py-2 border border-border hover:bg-accent rounded-lg text-xs font-semibold cursor-pointer">Vazgeç</button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={adding}
                    className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {adding && <Loader2 className="h-3 w-3 animate-spin" />}
                    Kaydet
                  </button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Search, 
  Check, 
  Trash2, 
  ExternalLink, 
  Globe, 
  Phone, 
  MapPin, 
  Loader2, 
  Download, 
  AlertCircle, 
  Filter,
  CheckSquare
} from 'lucide-react'

const supabase = createClient()

// Turkish normalization helper to resolve dotted/dotless I lowercasing issues
const normalizeTurkish = (str: string): string => {
  if (!str) return ''
  return str
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/Ğ/g, 'g')
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/ü/g, 'u')
    .replace(/Ş/g, 's')
    .replace(/ş/g, 's')
    .replace(/Ö/g, 'o')
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'c')
    .replace(/ç/g, 'c')
    .toLowerCase()
}

export default function ScriptLeadsPage() {
  const [potentialLeads, setPotentialLeads] = useState<any[]>([])
  const [reps, setReps] = useState<any[]>([])
  const [selectedRep, setSelectedRep] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [provinceFilter, setProvinceFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const local = new Date()
    const offset = local.getTimezoneOffset()
    const localDate = new Date(local.getTime() - (offset * 60 * 1000))
    return localDate.toISOString().split('T')[0]
  })
  const [selectedTime, setSelectedTime] = useState<string>('10:30')

  const calculateNextContactSlot = (existingDates: Date[], baseDate: Date): Date => {
    const afterBase = existingDates.filter(d => d >= baseDate)
    if (afterBase.length === 0) {
      return baseDate
    }
    const maxDate = new Date(Math.max(...afterBase.map(d => d.getTime())))
    let nextSlot = new Date(maxDate.getTime() + 7 * 60 * 1000)
    
    const hour = nextSlot.getHours()
    const minute = nextSlot.getMinutes()
    const totalMins = hour * 60 + minute
    const lunchStart = 12 * 60 + 30
    const lunchEnd = 13 * 60 + 30
    
    if (totalMins >= lunchStart && totalMins < lunchEnd) {
      nextSlot.setHours(13, 30, 0, 0)
    }
    return nextSlot
  }

  // Apify form state
  const [apiToken, setApiToken] = useState('')
  const [datasetId, setDatasetId] = useState('')
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // 1. Fetch pending potential leads (sorted by AI Score descending)
      const { data: leadsData, error: leadsErr } = await supabase
        .from('potential_leads')
        .select('*')
        .eq('status', 'pending')
        .order('ai_score', { ascending: false })
        .order('created_at', { ascending: false })

      if (leadsErr) throw leadsErr
      setPotentialLeads(leadsData || [])

      // 2. Fetch active call center reps
      const { data: repsData, error: repsErr } = await supabase
        .from('profiles')
        .select('id, full_name, role, status')
        .eq('role', 'call_center_rep')
        .eq('is_active', true)

      if (repsErr) throw repsErr
      setReps(repsData || [])
      
      // Default select the representative containing "ebru" in their name, otherwise first rep
      if (repsData && repsData.length > 0) {
        const ebruRep = repsData.find(rep => 
          rep.full_name && rep.full_name.toLowerCase().includes('ebru')
        )
        setSelectedRep(ebruRep ? ebruRep.id : repsData[0].id)
      }
    } catch (err: any) {
      console.error('Error fetching dashboard script leads data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Handle Apify data fetch
  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!apiToken.trim() || !datasetId.trim()) {
      setImportStatus({ type: 'error', message: 'Lütfen hem API Token hem de Dataset ID alanlarını doldurun.' })
      return
    }

    setImporting(true)
    setImportStatus(null)

    try {
      const res = await fetch('/api/apify/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiToken: apiToken.trim(),
          datasetId: datasetId.trim()
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'İthalat işlemi sırasında bir hata oluştu.')
      }

      setImportStatus({
        type: data.count > 0 ? 'success' : 'error',
        message: data.message
      })

      if (data.count > 0) {
        // Refresh leads list
        fetchData()
      }
    } catch (err: any) {
      setImportStatus({
        type: 'error',
        message: err.message || 'Apify verileri çekilirken bir hata oluştu.'
      })
    } finally {
      setImporting(false)
    }
  }

  // Assign lead to call center rep
  const handleAssign = async (lead: any) => {
    if (!selectedRep) {
      alert('Lütfen atama yapabilmek için bir Müşteri Temsilcisi seçin.')
      return
    }
    if (!selectedDate) {
      alert('Lütfen arama planlanacak bir tarih seçin.')
      return
    }

    setActionLoading(lead.id)
    try {
      // Fetch current scheduled next_contact_at values for the representative on the selected date to space them out
      const startOfDay = `${selectedDate}T00:00:00.000`
      const endOfDay = `${selectedDate}T23:59:59.999`
      
      const { data: existingLeads, error: fetchErr } = await supabase
        .from('leads')
        .select('next_contact_at')
        .eq('assigned_call_center_user_id', selectedRep)
        .gte('next_contact_at', new Date(startOfDay).toISOString())
        .lte('next_contact_at', new Date(endOfDay).toISOString())
        .eq('is_active', true)

      if (fetchErr) throw fetchErr

      const existingDates = (existingLeads || [])
        .map(l => l.next_contact_at ? new Date(l.next_contact_at) : null)
        .filter((d): d is Date => d !== null)

      // Base date is user selected date + time
      const baseDate = new Date(`${selectedDate}T${selectedTime || '10:30'}:00`)
      
      // Calculate progressive slot
      const targetDate = calculateNextContactSlot(existingDates, baseDate)
      const nextContactAt = targetDate.toISOString()

      // 1. Create lead in public.leads table
      const leadPayload = {
        first_name: lead.company_name,
        last_name: '-',
        company_name: lead.company_name,
        phone: lead.phone,
        phone_normalized: lead.phone,
        province: lead.province,
        district: lead.district,
        message: `Sitesi: ${lead.website || '-'}\n\nNe İş Yapıyorlar?\n${lead.description || '-'}`,
        status_id: '22222222-0000-0000-0000-000000000001', // Yeni Lead
        source_id: '11111111-0000-0000-0000-000000000015', // Apify Harita
        assigned_call_center_user_id: selectedRep,
        assigned_at: new Date().toISOString(),
        // Plan next contact on the selected day
        next_contact_at: nextContactAt,
        is_active: true
      }

      const { error: insertErr } = await supabase
        .from('leads')
        .insert(leadPayload)

      if (insertErr) throw insertErr

      // 2. Update potential_leads status to 'assigned'
      const { error: updateErr } = await supabase
        .from('potential_leads')
        .update({ status: 'assigned' })
        .eq('id', lead.id)

      if (updateErr) throw updateErr

      // Update local state
      setPotentialLeads(prev => prev.filter(l => l.id !== lead.id))
    } catch (err: any) {
      console.error('Error assigning lead:', err)
      alert(`Atama yapılırken hata oluştu: ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  // Reject lead
  const handleReject = async (leadId: string) => {
    if (!confirm('Bu firmayı reddetmek ve listeden kaldırmak istediğinize emin misiniz?')) {
      return
    }

    setActionLoading(leadId)
    try {
      const { error: updateErr } = await supabase
        .from('potential_leads')
        .update({ status: 'rejected' })
        .eq('id', leadId)

      if (updateErr) throw updateErr

      // Update local state
      setPotentialLeads(prev => prev.filter(l => l.id !== leadId))
    } catch (err: any) {
      console.error('Error rejecting lead:', err)
      alert(`Reddetme sırasında hata oluştu: ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  // Filters logic
  const filteredLeads = potentialLeads.filter(l => {
    const matchesSearch = 
      l.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.phone.includes(searchQuery)
    
    const matchesProvince = provinceFilter === 'all' || l.province === provinceFilter

    return matchesSearch && matchesProvince
  })

  // Get unique provinces for filter dropdown
  const provinces = Array.from(new Set(potentialLeads.map(l => l.province).filter(Boolean)))

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 font-sans">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Script Müşteriler (Harita Havuzu)</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Apify Google Maps Scraper üzerinden çekilen verileri onaylayıp temsilcilere atadığınız havuz.
          </p>
        </div>
      </div>

      {/* Grid: Left - Import tool, Right - Representatives selector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Import Form Card */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 shadow-xs">
          <h3 className="text-sm font-black text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" /> Apify Verilerini İçe Aktar
          </h3>
          <form onSubmit={handleImport} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">Apify API Token</label>
              <input
                type="password"
                placeholder="apify_api_xxxxxxxxxxxxxxxxx"
                value={apiToken}
                onChange={e => setApiToken(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">Dataset ID (Veri Seti)</label>
              <input
                type="text"
                placeholder="3oA9d72Jxxxxxxxx"
                value={datasetId}
                onChange={e => setDatasetId(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
            <div className="md:col-span-2 flex justify-between items-center pt-2 gap-4">
              {importStatus && (
                <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg ${
                  importStatus.type === 'success' 
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                }`}>
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{importStatus.message}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={importing}
                className="ml-auto h-10 px-5 bg-primary hover:bg-primary/95 text-primary-foreground font-bold rounded-lg text-sm cursor-pointer shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Veriler Çekiliyor...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" /> Verileri Çek ve Aktar
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Representative Selector Card */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-black text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-violet-500" /> Temsilci Atama Ayarı
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Aşağıdaki listeden onayladığınız firmaların hangi Çağrı Merkezi Temsilcisinin (Ebru vb.) arama planına ekleneceğini seçin.
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">Seçili Temsilci</label>
              <select
                value={selectedRep}
                onChange={e => setSelectedRep(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {reps.length === 0 ? (
                  <option value="">Aktif Temsilci Bulunamadı</option>
                ) : (
                  reps.map(rep => (
                    <option key={rep.id} value={rep.id}>
                      {rep.full_name} ({rep.status === 'active' ? '🟢 Aktif' : '🟡 Dışarıda'})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">Arama Planlanacak Tarih</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">Arama Saati</label>
                <input
                  type="time"
                  value={selectedTime}
                  onChange={e => setSelectedTime(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-muted/40 p-4 border border-border rounded-xl">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Şirket adı veya açıklama ile ara..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-4 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <select
            value={provinceFilter}
            onChange={e => setProvinceFilter(e.target.value)}
            className="w-full md:w-48 h-10 px-3 border border-border rounded-lg bg-background text-sm focus:outline-none"
          >
            <option value="all">Tüm Şehirler</option>
            {provinces.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <span className="text-xs font-bold text-muted-foreground shrink-0 whitespace-nowrap">
            Toplam: {filteredLeads.length} Sonuç
          </span>
        </div>
      </div>

      {/* Leads List Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 border border-dashed border-border rounded-xl">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <h4 className="text-sm font-bold text-foreground">Onay Bekleyen Firma Bulunmuyor</h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Apify üzerinden yeni veri seti aktarabilir veya arama kriterlerinizi değiştirebilirsiniz.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredLeads.map(lead => (
            <div 
              key={lead.id}
              className="bg-card border border-border hover:border-violet-500/50 hover:shadow-xs rounded-xl p-5 flex flex-col justify-between space-y-4 transition-all duration-200"
            >
               <div className="space-y-3">
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-extrabold text-foreground text-sm line-clamp-2" title={lead.company_name}>
                      {lead.company_name}
                    </h4>
                    {(lead.province || lead.district) && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded-full select-none shrink-0">
                        <MapPin className="h-2.5 w-2.5" />
                        {lead.province}{lead.district ? `, ${lead.district}` : ''}
                      </span>
                    )}
                  </div>
                  {(() => {
                    const text = normalizeTurkish(`${lead.company_name} ${lead.description || ''}`);
                    const suspectedKeywords = ['makine imalat', 'makina imalat', 'makine sanayi', 'makina sanayi', 'cnc', 'lazer makine', 'lazer makina', 'lazer sistem', 'lazer teknoloji'];
                    const isSuspected = suspectedKeywords.some(kw => text.includes(kw));
                    if (isSuspected) {
                      return (
                        <div className="inline-flex items-center gap-1 text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md w-fit select-none">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          <span>Rakip / Üretici Şüphesi</span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {lead.ai_score !== undefined && lead.ai_score > 0 && (
                    <div className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-md w-fit select-none ${
                      lead.ai_score >= 80 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15' 
                        : lead.ai_score >= 60 
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/15'
                          : 'bg-muted text-muted-foreground border border-border/40'
                    }`}>
                      <span>🤖 AI Potansiyel: {lead.ai_score >= 80 ? 'Çok Yüksek' : lead.ai_score >= 60 ? 'Yüksek' : 'Orta'} ({lead.ai_score}/100)</span>
                    </div>
                  )}
                </div>

                {/* Company Details Links */}
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold">
                  <a 
                    href={`tel:${lead.phone}`}
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {lead.phone}
                  </a>
                  {lead.website && (
                    <a 
                      href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline flex items-center gap-1"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Web Sitesi <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                {/* Description of What They Do */}
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Ne İş Yapıyorlar? / Firma Bilgisi</span>
                  <div className="text-xs text-muted-foreground bg-muted/40 border border-border/60 p-3 rounded-lg leading-relaxed max-h-36 overflow-y-auto whitespace-pre-line">
                    {lead.description || 'Açıklama belirtilmemiş.'}
                  </div>
                </div>

                {/* AI Analysis Notes */}
                {lead.ai_notes && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400">🤖 Yapay Zeka Analizi</span>
                    <div className="text-xs text-emerald-800 dark:text-emerald-200 bg-emerald-500/5 border border-emerald-500/15 p-3 rounded-lg leading-relaxed max-h-36 overflow-y-auto whitespace-pre-line font-medium">
                      {lead.ai_notes.replace(/\*\*(.*?)\*\*/g, '$1')}
                    </div>
                  </div>
                )}
              </div>

              {/* Approval Actions */}
              <div className="flex items-center gap-3 pt-2 border-t border-border/60">
                <button
                  disabled={actionLoading !== null}
                  onClick={() => handleReject(lead.id)}
                  className="flex-1 h-9 border border-border hover:bg-rose-500/5 hover:border-rose-500/40 hover:text-rose-600 rounded-lg text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {actionLoading === lead.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" /> Reddet
                    </>
                  )}
                </button>
                <button
                  disabled={actionLoading !== null}
                  onClick={() => handleAssign(lead)}
                  className="flex-1 h-9 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg text-xs font-extrabold cursor-pointer transition-colors flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
                >
                  {actionLoading === lead.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" /> Ata
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

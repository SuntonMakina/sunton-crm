'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Opportunity, Customer, PipelineStage, Product, LostReason } from '@/types/crm'
import {
  Layers,
  Plus,
  DollarSign,
  TrendingUp,
  Award,
  ArrowRight,
  TrendingDown,
  Loader2,
  X,
  Building,
  User,
  ArrowLeftRight
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'

export default function PipelinePage() {
  const supabase = createClient()

  // State
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [loading, setLoading] = useState(true)

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isWonOpen, setIsWonOpen] = useState(false)
  const [isLostOpen, setIsLostOpen] = useState(false)
  
  // Transition target
  const [transitioningOpp, setTransitioningOpp] = useState<Opportunity | null>(null)
  const [targetStageId, setTargetStageId] = useState<string>('')

  // Form states
  const [oppForm, setOppForm] = useState({
    title: '', customer_id: '', product_id: '', amount: 0, priority: 'normal' as any, description: ''
  })
  
  const [wonForm, setWonForm] = useState({ actual_amount: 0, close_date: '', notes: '' })
  const [lostForm, setLostForm] = useState({ lost_reason_id: '', notes: '' })
  const [saving, setSaving] = useState(false)

  // Lookups
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [lostReasons, setLostReasons] = useState<LostReason[]>([])

  // Load Lookups
  useEffect(() => {
    async function loadLookups() {
      const { data: st } = await supabase.from('pipeline_stages').select('*').eq('is_active', true).order('sort_order')
      const { data: custs } = await supabase.from('customers').select('*').eq('is_active', true)
      const { data: prs } = await supabase.from('products').select('*').eq('is_active', true)
      const { data: lrs } = await supabase.from('lost_reasons').select('*').eq('is_active', true).eq('type', 'opportunity')

      if (st) setStages(st)
      if (custs) setCustomers(custs)
      if (prs) setProducts(prs)
      if (lrs) setLostReasons(lrs)
    }
    loadLookups()
  }, [supabase])

  // Load Opportunities
  const loadOpportunities = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          *,
          customers(full_name, type, company_name),
          pipeline_stages(name, stage_type)
        `)
        .eq('is_active', true)

      if (!error && data) {
        setOpportunities(data as any[])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOpportunities()
  }, [])

  // Create new opportunity
  const handleCreateOpportunity = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!oppForm.title || !oppForm.customer_id) {
      alert('Lütfen başlık ve müşteri alanlarını doldurun.')
      return
    }

    setSaving(true)
    try {
      const selectedProd = products.find(p => p.id === oppForm.product_id)
      const defaultStage = stages[0]?.id

      const { error } = await supabase.from('opportunities').insert({
        title: oppForm.title,
        customer_id: oppForm.customer_id,
        product_id: oppForm.product_id || null,
        product_name: selectedProd?.name || null,
        amount: oppForm.amount,
        priority: oppForm.priority,
        stage_id: defaultStage,
        pipeline_id: '66666666-0000-0000-0000-000000000001', // Default makine pipeline
        status: 'open',
        probability: stages[0]?.probability || 10
      })

      if (!error) {
        setIsAddOpen(false)
        setOppForm({ title: '', customer_id: '', product_id: '', amount: 0, priority: 'normal', description: '' })
        loadOpportunities()
      } else {
        alert(error.message)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // Handle stage change action (opens modal or updates database immediately)
  const handleStageChange = async (opp: Opportunity, targetStage: PipelineStage) => {
    setTransitioningOpp(opp)
    setTargetStageId(targetStage.id)

    if (targetStage.stage_type === 'won') {
      setWonForm({ actual_amount: opp.amount, close_date: new Date().toISOString().split('T')[0], notes: '' })
      setIsWonOpen(true)
    } else if (targetStage.stage_type === 'lost') {
      setLostForm({ lost_reason_id: '', notes: '' })
      setIsLostOpen(true)
    } else {
      // Direct move for standard stages
      await moveOpportunity(opp.id, targetStage.id, 'open', opp.amount, null, null)
    }
  }

  // Database move logic
  const moveOpportunity = async (
    oppId: string,
    stageId: string,
    status: 'open' | 'won' | 'lost',
    amount: number,
    lostReasonId: string | null,
    notes: string | null
  ) => {
    setSaving(true)
    try {
      const stageObj = stages.find(s => s.id === stageId)

      // Fetch previous stage to register history
      const { data: currentOpp } = await supabase.from('opportunities').select('stage_id').eq('id', oppId).single()

      // Update Opportunity
      const { error } = await supabase
        .from('opportunities')
        .update({
          stage_id: stageId,
          status: status,
          amount: amount,
          lost_reason_id: lostReasonId,
          lost_notes: notes,
          actual_close_date: status !== 'open' ? new Date().toISOString().split('T')[0] : null,
          probability: stageObj?.probability || 50
        })
        .eq('id', oppId)

      if (!error) {
        // Register stage history
        if (currentOpp && currentOpp.stage_id !== stageId) {
          await supabase.from('opportunity_stage_history').insert({
            opportunity_id: oppId,
            previous_stage_id: currentOpp.stage_id,
            new_stage_id: stageId
          })
        }

        // Add activity timeline record
        await supabase.from('activities').insert({
          entity_type: 'opportunity',
          entity_id: oppId,
          activity_type: 'pipeline_changed',
          title: 'Aşama Güncellendi',
          description: `Fırsat aşaması ${stageObj?.name} olarak güncellendi.`
        })

        // Close modals
        setIsWonOpen(false)
        setIsLostOpen(false)
        setTransitioningOpp(null)
        loadOpportunities()
      } else {
        alert(error.message)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // Handle Won deal submit
  const handleWonSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!transitioningOpp) return
    moveOpportunity(transitioningOpp.id, targetStageId, 'won', wonForm.actual_amount, null, wonForm.notes)
  }

  // Handle Lost deal submit
  const handleLostSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!transitioningOpp || !lostForm.lost_reason_id) {
      alert('Lütfen kayıp nedenini seçin.')
      return
    }
    moveOpportunity(transitioningOpp.id, targetStageId, 'lost', transitioningOpp.amount, lostForm.lost_reason_id, lostForm.notes)
  }

  // Summary widgets selectors
  const openDeals = opportunities.filter(o => o.status === 'open')
  const totalOpenValue = openDeals.reduce((sum, o) => sum + Number(o.amount), 0)
  const wonDeals = opportunities.filter(o => o.status === 'won')
  const totalWonValue = wonDeals.reduce((sum, o) => sum + Number(o.amount), 0)
  const lostDeals = opportunities.filter(o => o.status === 'lost')
  const totalLostValue = lostDeals.reduce((sum, o) => sum + Number(o.amount), 0)
  
  const winRate = opportunities.length > 0 
    ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length || 1)) * 100)
    : 0

  return (
    <div className="space-y-6">
      
      {/* Title & Actions toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Satış Pipeline</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Satış fırsatları Kanban panosu, aşama takipleri ve teklifler.</p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="h-9 px-3.5 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 flex items-center gap-1.5 cursor-pointer shadow-sm shadow-primary/10 transition-colors"
        >
          <Plus className="h-4.5 w-4.5" />
          Yeni Fırsat Oluştur
        </button>
      </div>

      {/* Summary headers widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI: Open volume */}
        <div className="bg-card border border-border p-4 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Açık Fırsatlar</span>
            <h4 className="text-lg font-extrabold text-foreground mt-1 truncate">{totalOpenValue.toLocaleString('tr-TR')} TRY</h4>
            <span className="text-[10px] text-muted-foreground mt-1 block">Adet: {openDeals.length}</span>
          </div>
          <div className="h-9 w-9 bg-blue-500/10 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <Layers className="h-4.5 w-4.5" />
          </div>
        </div>

        {/* KPI: Won deals */}
        <div className="bg-card border border-border p-4 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Kazanılan Satış</span>
            <h4 className="text-lg font-extrabold text-emerald-600 mt-1 truncate">{totalWonValue.toLocaleString('tr-TR')} TRY</h4>
            <span className="text-[10px] text-muted-foreground mt-1 block">Adet: {wonDeals.length}</span>
          </div>
          <div className="h-9 w-9 bg-emerald-500/10 text-emerald-600 rounded-lg flex items-center justify-center shrink-0">
            <Award className="h-4.5 w-4.5" />
          </div>
        </div>

        {/* KPI: Lost deals */}
        <div className="bg-card border border-border p-4 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Kaybedilen Fırsatlar</span>
            <h4 className="text-lg font-extrabold text-red-500 mt-1 truncate">{totalLostValue.toLocaleString('tr-TR')} TRY</h4>
            <span className="text-[10px] text-muted-foreground mt-1 block">Adet: {lostDeals.length}</span>
          </div>
          <div className="h-9 w-9 bg-red-500/10 text-red-600 rounded-lg flex items-center justify-center shrink-0">
            <TrendingDown className="h-4.5 w-4.5" />
          </div>
        </div>

        {/* KPI: Win Rate */}
        <div className="bg-card border border-border p-4 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Kazanma Başarı Oranı</span>
            <h4 className="text-lg font-extrabold text-foreground mt-1">{winRate}%</h4>
            <span className="text-[10px] text-muted-foreground mt-1 block">Kazanılan / Kaybedilen oranı</span>
          </div>
          <div className="h-9 w-9 bg-purple-500/10 text-purple-600 rounded-lg flex items-center justify-center shrink-0">
            <TrendingUp className="h-4.5 w-4.5" />
          </div>
        </div>

      </div>

      {/* Kanban Board columns wrapper */}
      {loading ? (
        <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground mt-3 font-medium">Satış boru hattı yükleniyor...</p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 max-h-[calc(100vh-270px)]">
          {stages.map((stage) => {
            const columnOpps = opportunities.filter(o => o.stage_id === stage.id)
            const columnSum = columnOpps.reduce((sum, o) => sum + Number(o.amount), 0)

            return (
              <div key={stage.id} className="w-72 shrink-0 bg-muted/30 border border-border/80 rounded-xl p-3.5 flex flex-col max-h-full">
                
                {/* Column header */}
                <div className="flex flex-col gap-1.5 mb-4 select-none">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground truncate max-w-[200px]">{stage.name}</span>
                    <span className="text-[10px] font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded">
                      {columnOpps.length}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-semibold">
                    Ciro: {columnSum.toLocaleString('tr-TR')} TRY
                  </div>
                </div>

                {/* Cards stack */}
                <div className="flex-1 overflow-y-auto space-y-3 min-h-[150px]">
                  {columnOpps.map((opp) => (
                    <div
                      key={opp.id}
                      className="bg-card border border-border hover:border-primary/40 p-4 rounded-xl shadow-xs hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex items-center justify-between text-[9px] text-muted-foreground font-bold">
                        <span className="font-mono">{opp.opportunity_number}</span>
                        <span className="uppercase text-primary">{opp.priority}</span>
                      </div>
                      
                      <h4 className="text-xs font-bold text-foreground mt-2 line-clamp-1">{opp.title}</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        {opp.customers?.type === 'corporate' ? <Building className="h-3 w-3" /> : <User className="h-3 w-3" />}
                        <span className="truncate">{opp.customers?.full_name}</span>
                      </p>

                      <div className="text-xs font-extrabold text-foreground mt-3">
                        {opp.amount.toLocaleString('tr-TR')} TRY
                      </div>

                      {/* Moving action tools dropdown wrapper */}
                      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/60 text-[9px] text-muted-foreground">
                        <span>Olasılık: %{opp.probability}</span>
                        
                        {/* Selector to trigger step transitions */}
                        <div className="relative">
                          <select
                            value={opp.stage_id || ''}
                            onChange={(e) => {
                              const tgt = stages.find(s => s.id === e.target.value)
                              if (tgt) handleStageChange(opp, tgt)
                            }}
                            className="bg-background border border-border rounded text-[9px] px-1 py-0.5 font-semibold text-primary focus:outline-none cursor-pointer"
                          >
                            {stages.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            )
          })}
        </div>
      )}

      {/* Modal: Create Opportunity Form */}
      {isAddOpen && (
        <Dialog.Root open={isAddOpen} onOpenChange={setIsAddOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-md z-50 animate-in fade-in zoom-in-95 duration-150">
              <Dialog.Title className="text-base font-bold text-foreground mb-4">Yeni Fırsat Oluştur</Dialog.Title>
              <form onSubmit={handleCreateOpportunity} className="space-y-4 text-xs">
                
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">FIRSAT BAŞLIĞI *</label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: Özkan Lazer CNC Siparişi"
                    value={oppForm.title}
                    onChange={(e) => setOppForm({ ...oppForm, title: e.target.value })}
                    className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">MÜŞTERİ SEÇİN *</label>
                  <select
                    required
                    value={oppForm.customer_id}
                    onChange={(e) => setOppForm({ ...oppForm, customer_id: e.target.value })}
                    className="w-full h-9 px-2 bg-background border border-border rounded-lg"
                  >
                    <option value="">Seçiniz</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.full_name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">ÜRÜN SEÇİN</label>
                    <select
                      value={oppForm.product_id}
                      onChange={(e) => setOppForm({ ...oppForm, product_id: e.target.value })}
                      className="w-full h-9 px-2 bg-background border border-border rounded-lg"
                    >
                      <option value="">Seçiniz</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">TUTAR (TRY) *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={oppForm.amount || ''}
                      onChange={(e) => setOppForm({ ...oppForm, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">ÖNCELİK</label>
                  <select
                    value={oppForm.priority}
                    onChange={(e) => setOppForm({ ...oppForm, priority: e.target.value })}
                    className="w-full h-9 px-2 bg-background border border-border rounded-lg focus:outline-none"
                  >
                    <option value="low">Düşük</option>
                    <option value="normal">Normal</option>
                    <option value="high">Yüksek</option>
                    <option value="critical">Kritik</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Dialog.Close asChild>
                    <button type="button" className="px-4 py-2 border border-border hover:bg-accent rounded-lg text-xs font-semibold cursor-pointer">Vazgeç</button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                    Oluştur
                  </button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {/* Modal: Transition to WON Stage fields */}
      {isWonOpen && transitioningOpp && (
        <Dialog.Root open={isWonOpen} onOpenChange={setIsWonOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-md z-50 animate-in fade-in zoom-in-95 duration-150">
              <Dialog.Title className="text-base font-bold text-foreground mb-2 flex items-center gap-2">
                <Award className="h-5 w-5 text-emerald-500" />
                Fırsat Kazanıldı Olarak Kapatılsın mı?
              </Dialog.Title>
              <p className="text-xs text-muted-foreground mb-4">Müteakip makine teslimatını başlatmak için lütfen satış tutarını doğrulayın.</p>
              <form onSubmit={handleWonSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">GERÇEK SATIŞ TUTARI (TRY) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={wonForm.actual_amount}
                    onChange={(e) => setWonForm({ ...wonForm, actual_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">KAPANIŞ TARİHİ *</label>
                  <input
                    type="date"
                    required
                    value={wonForm.close_date}
                    onChange={(e) => setWonForm({ ...wonForm, close_date: e.target.value })}
                    className="w-full h-9 px-3 bg-background border border-border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">KAZANIM NOTLARI</label>
                  <textarea
                    rows={2}
                    value={wonForm.notes}
                    onChange={(e) => setWonForm({ ...wonForm, notes: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg p-2 focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Dialog.Close asChild>
                    <button type="button" className="px-4 py-2 border border-border hover:bg-accent rounded-lg text-xs font-semibold cursor-pointer">Vazgeç</button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-emerald-500 text-white font-semibold rounded-lg text-xs hover:bg-emerald-600 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                    Satışı Tamamla
                  </button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {/* Modal: Transition to LOST Stage fields */}
      {isLostOpen && transitioningOpp && (
        <Dialog.Root open={isLostOpen} onOpenChange={setIsLostOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-md z-50 animate-in fade-in zoom-in-95 duration-150">
              <Dialog.Title className="text-base font-bold text-foreground mb-2 flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-500" />
                Fırsat Kaybedildi Olarak Kapatılsın mı?
              </Dialog.Title>
              <p className="text-xs text-muted-foreground mb-4">Geri bildirim ve istatistik analizi için lütfen kayıp nedenini seçin.</p>
              <form onSubmit={handleLostSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">KAYIP NEDENİ *</label>
                  <select
                    required
                    value={lostForm.lost_reason_id}
                    onChange={(e) => setLostForm({ ...lostForm, lost_reason_id: e.target.value })}
                    className="w-full h-9 px-2 bg-background border border-border rounded-lg focus:outline-none"
                  >
                    <option value="">Seçiniz</option>
                    {lostReasons.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">KAYIP GEREKÇESİ AÇIKLAMA</label>
                  <textarea
                    rows={2}
                    value={lostForm.notes}
                    onChange={(e) => setLostForm({ ...lostForm, notes: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg p-2 focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Dialog.Close asChild>
                    <button type="button" className="px-4 py-2 border border-border hover:bg-accent rounded-lg text-xs font-semibold cursor-pointer">Vazgeç</button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-red-500 text-white font-semibold rounded-lg text-xs hover:bg-red-600 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                    Fırsatı Kapat
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

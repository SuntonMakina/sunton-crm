'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Call, Profile, CallOutcome } from '@/types/crm'
import {
  Phone,
  Search,
  Plus,
  Loader2,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  Calendar,
  X,
  Play,
  ArrowRight
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'

export default function CallsPage() {
  const supabase = createClient()

  // State
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [directionFilter, setDirectionFilter] = useState('all')
  const [outcomeFilter, setOutcomeFilter] = useState('all')

  // Log Call form states
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [callForm, setCallForm] = useState({
    entity_type: 'lead' as 'lead' | 'customer',
    entity_id: '',
    direction: 'outgoing' as 'incoming' | 'outgoing',
    phone_number: '',
    outcome_id: '',
    duration_seconds: 0,
    status: 'completed' as any,
    notes: '',
    follow_up_required: false,
    follow_up_at: '',
    assigned_sales_user_id: '' // For "Satış Uzmanına İletildi"
  })

  // Lookups
  const [leadsList, setLeadsList] = useState<any[]>([])
  const [customersList, setCustomersList] = useState<any[]>([])
  const [outcomes, setOutcomes] = useState<CallOutcome[]>([])
  const [salesReps, setSalesReps] = useState<Profile[]>([])

  // Load Lookups
  useEffect(() => {
    async function loadLookups() {
      const { data: leads } = await supabase.from('leads').select('id, first_name, last_name, phone').eq('is_active', true)
      const { data: custs } = await supabase.from('customers').select('id, full_name, phone').eq('is_active', true)
      const { data: outs } = await supabase.from('call_outcomes').select('*').eq('is_active', true).order('sort_order')
      const { data: sales } = await supabase.from('profiles').select('*').eq('role', 'sales_specialist').eq('is_active', true)

      if (leads) setLeadsList(leads)
      if (custs) setCustomersList(custs)
      if (outs) setOutcomes(outs)
      if (sales) setSalesReps(sales)
    }
    loadLookups()
  }, [supabase])

  // Load Calls List
  const loadCalls = async () => {
    setLoading(true)
    try {
      let query = supabase.from('calls').select(`
        *,
        profiles(full_name),
        call_outcomes(name, color),
        leads(first_name, last_name, lead_number),
        customers(full_name, customer_number)
      `)

      if (directionFilter !== 'all') {
        query = query.eq('direction', directionFilter)
      }

      if (outcomeFilter !== 'all') {
        query = query.eq('outcome_id', outcomeFilter)
      }

      const { data, error } = await query.order('started_at', { ascending: false }).limit(100)

      if (!error && data) {
        setCalls(data as any[])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCalls()
  }, [directionFilter, outcomeFilter])

  // Pre-fill phone number when selecting a Lead/Customer in form
  useEffect(() => {
    if (!callForm.entity_id) return

    if (callForm.entity_type === 'lead') {
      const selected = leadsList.find(l => l.id === callForm.entity_id)
      if (selected) setCallForm(f => ({ ...f, phone_number: selected.phone }))
    } else {
      const selected = customersList.find(c => c.id === callForm.entity_id)
      if (selected) setCallForm(f => ({ ...f, phone_number: selected.phone || '' }))
    }
  }, [callForm.entity_id, callForm.entity_type, leadsList, customersList])

  // Save new call log
  const handleLogCall = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!callForm.outcome_id || !callForm.phone_number) {
      alert('Lütfen zorunlu alanları doldurun.')
      return
    }

    const selectedOutcomeObj = outcomes.find(o => o.id === callForm.outcome_id)

    // Outcome conditional validations
    if (selectedOutcomeObj?.requires_follow_up && !callForm.follow_up_at) {
      alert('Bu arama sonucu için Takip Tarihi seçilmesi zorunludur.')
      return
    }
    if (selectedOutcomeObj?.forwards_to_sales && !callForm.assigned_sales_user_id) {
      alert('Bu arama sonucu için atanacak Satış Uzmanının seçilmesi zorunludur.')
      return
    }

    setSaving(true)
    try {
      const { data: newCall, error } = await supabase.from('calls').insert({
        lead_id: callForm.entity_type === 'lead' ? callForm.entity_id : null,
        customer_id: callForm.entity_type === 'customer' ? callForm.entity_id : null,
        direction: callForm.direction,
        phone_number: callForm.phone_number,
        outcome_id: callForm.outcome_id,
        duration_seconds: callForm.duration_seconds,
        status: callForm.status,
        notes: callForm.notes || null,
        follow_up_required: callForm.follow_up_required,
        follow_up_at: callForm.follow_up_required && callForm.follow_up_at ? new Date(callForm.follow_up_at).toISOString() : null
      }).select().single()

      if (!error && newCall) {
        // Create callback task if follow up set
        if (callForm.follow_up_required && callForm.follow_up_at) {
          const leadOrCustName = callForm.entity_type === 'lead'
            ? leadsList.find(l => l.id === callForm.entity_id)?.first_name + ' ' + leadsList.find(l => l.id === callForm.entity_id)?.last_name
            : customersList.find(c => c.id === callForm.entity_id)?.full_name

          await supabase.from('tasks').insert({
            title: `${leadOrCustName || ''} - Geri Arama Takibi`,
            task_type: 'callback',
            status: 'pending',
            lead_id: callForm.entity_type === 'lead' ? callForm.entity_id : null,
            customer_id: callForm.entity_type === 'customer' ? callForm.entity_id : null,
            due_at: new Date(callForm.follow_up_at).toISOString()
          })
        }

        // Forward lead/customer to sales specialist if configured
        if (selectedOutcomeObj?.forwards_to_sales && callForm.assigned_sales_user_id) {
          if (callForm.entity_type === 'lead') {
            await supabase.from('leads').update({
              assigned_sales_user_id: callForm.assigned_sales_user_id,
              forwarded_to_sales_at: new Date().toISOString(),
              status_id: '22222222-0000-0000-0000-000000000009' // Satış Uzmanına İletildi status
            }).eq('id', callForm.entity_id)
          } else {
            await supabase.from('customers').update({
              assigned_user_id: callForm.assigned_sales_user_id
            }).eq('id', callForm.entity_id)
          }
        }

        setIsAddOpen(false)
        setCallForm({
          entity_type: 'lead', entity_id: '', direction: 'outgoing', phone_number: '',
          outcome_id: '', duration_seconds: 0, status: 'completed', notes: '',
          follow_up_required: false, follow_up_at: '', assigned_sales_user_id: ''
        })
        loadCalls()
      } else {
        alert('Hata: ' + error?.message)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // Outcome change validator
  const handleOutcomeChange = (val: string) => {
    const outcomeObj = outcomes.find(o => o.id === val)
    setCallForm(f => ({
      ...f,
      outcome_id: val,
      follow_up_required: outcomeObj?.requires_follow_up || false
    }))
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Aramalar</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Müşteri arama geçmişleri, santral logları ve takip randevuları.</p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="h-9 px-3.5 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 flex items-center gap-1.5 cursor-pointer shadow-sm shadow-primary/10 transition-colors"
        >
          <Plus className="h-4.5 w-4.5" />
          Arama Kaydı Ekle
        </button>
      </div>

      {/* Filters bar */}
      <div className="bg-card border border-border p-3.5 rounded-xl shadow-xs flex flex-wrap items-center gap-3">
        <select
          value={directionFilter}
          onChange={(e) => setDirectionFilter(e.target.value)}
          className="h-9 text-xs bg-background border border-border rounded-lg px-2 focus:outline-none"
        >
          <option value="all">Tüm Yönler</option>
          <option value="incoming">Gelen Çağrılar</option>
          <option value="outgoing">Giden Çağrılar</option>
        </select>

        <select
          value={outcomeFilter}
          onChange={(e) => setOutcomeFilter(e.target.value)}
          className="h-9 text-xs bg-background border border-border rounded-lg px-2 focus:outline-none"
        >
          <option value="all">Tüm Arama Sonuçları</option>
          {outcomes.map(o => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>

      {/* Calls List display */}
      {loading ? (
        <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground mt-3 font-medium">Çağrı geçmişi yükleniyor...</p>
        </div>
      ) : calls.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-sm text-muted-foreground">
          Kayıtlı aktif arama bulunmamaktadır.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[10px] font-bold uppercase text-muted-foreground select-none">
                  <th className="py-3 px-4">Tarih</th>
                  <th className="py-3 px-4">Yön</th>
                  <th className="py-3 px-4">Müşteri / Lead</th>
                  <th className="py-3 px-4">Telefon</th>
                  <th className="py-3 px-4">Temsilci</th>
                  <th className="py-3 px-4">Sonuç</th>
                  <th className="py-3 px-4">Süre</th>
                  <th className="py-3 px-4">Notlar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs text-foreground">
                {calls.map((call) => {
                  const targetName = call.leads
                    ? `${call.leads.first_name} ${call.leads.last_name}`
                    : call.customers?.full_name || '-'
                  const targetNumber = call.leads?.lead_number || call.customers?.customer_number || ''

                  return (
                    <tr key={call.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-muted-foreground">
                        {new Date(call.started_at).toLocaleDateString('tr-TR')} {new Date(call.started_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-4">
                        {call.direction === 'incoming' ? (
                          <span className="flex items-center gap-1 text-sky-500 font-bold">
                            <PhoneIncoming className="h-3.5 w-3.5" />
                            Gelen
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-indigo-500 font-bold">
                            <PhoneOutgoing className="h-3.5 w-3.5" />
                            Giden
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-foreground">{targetName}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{targetNumber}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <a href={`tel:${call.phone_number}`} className="hover:underline flex items-center gap-1 text-primary font-medium">
                          <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                          {call.phone_number}
                        </a>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-muted-foreground">{call.profiles?.full_name || '-'}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-semibold border"
                          style={{
                            backgroundColor: `${call.call_outcomes?.color}15` || '#cbd5e115',
                            color: call.call_outcomes?.color || '#cbd5e1',
                            borderColor: `${call.call_outcomes?.color}25` || '#cbd5e125'
                          }}
                        >
                          {call.call_outcomes?.name}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold">{call.duration_seconds} sn</td>
                      <td className="py-3.5 px-4 text-muted-foreground max-w-xs truncate" title={call.notes || ''}>
                        {call.notes || '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dialog: Log Call Form Modal */}
      {isAddOpen && (
        <Dialog.Root open={isAddOpen} onOpenChange={setIsAddOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-md z-50 animate-in fade-in zoom-in-95 duration-150">
              <Dialog.Title className="text-base font-bold text-foreground mb-4">Arama Kaydı Ekle</Dialog.Title>
              <form onSubmit={handleLogCall} className="space-y-4 text-xs">
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">İLİŞKİLİ TÜR *</label>
                    <select
                      value={callForm.entity_type}
                      onChange={(e) => setCallForm({ ...callForm, entity_type: e.target.value as any, entity_id: '', phone_number: '' })}
                      className="w-full h-9 px-2 bg-background border border-border rounded-lg"
                    >
                      <option value="lead">Lead (Müşteri Adayı)</option>
                      <option value="customer">Müşteri</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">KAYIT SEÇİN *</label>
                    <select
                      required
                      value={callForm.entity_id}
                      onChange={(e) => setCallForm({ ...callForm, entity_id: e.target.value })}
                      className="w-full h-9 px-2 bg-background border border-border rounded-lg"
                    >
                      <option value="">Seçiniz</option>
                      {callForm.entity_type === 'lead' ? (
                        leadsList.map(l => (
                          <option key={l.id} value={l.id}>{l.first_name} {l.last_name}</option>
                        ))
                      ) : (
                        customersList.map(c => (
                          <option key={c.id} value={c.id}>{c.full_name}</option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">YÖN *</label>
                    <select
                      value={callForm.direction}
                      onChange={(e) => setCallForm({ ...callForm, direction: e.target.value as any })}
                      className="w-full h-9 px-2 bg-background border border-border rounded-lg"
                    >
                      <option value="outgoing">Giden Arama</option>
                      <option value="incoming">Gelen Arama</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">TELEFON NUMARASI *</label>
                    <input
                      type="text"
                      required
                      value={callForm.phone_number}
                      onChange={(e) => setCallForm({ ...callForm, phone_number: e.target.value })}
                      className="w-full h-9 px-3 bg-background border border-border rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">ARAMA SONUCU *</label>
                    <select
                      required
                      value={callForm.outcome_id}
                      onChange={(e) => handleOutcomeChange(e.target.value)}
                      className="w-full h-9 px-2 bg-background border border-border rounded-lg"
                    >
                      <option value="">Seçiniz</option>
                      {outcomes.map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">ARAMA SÜRESİ (SANİYE)</label>
                    <input
                      type="number"
                      min={0}
                      value={callForm.duration_seconds || ''}
                      onChange={(e) => setCallForm({ ...callForm, duration_seconds: parseInt(e.target.value) || 0 })}
                      className="w-full h-9 px-3 bg-background border border-border rounded-lg"
                    />
                  </div>
                </div>

                {/* Conditional fields based on outcomes */}
                {outcomes.find(o => o.id === callForm.outcome_id)?.requires_follow_up && (
                  <div>
                    <label className="block text-[10px] font-bold text-red-500 mb-1">TAKİP GERİ ARAMA ZAMANI *</label>
                    <input
                      type="datetime-local"
                      required
                      value={callForm.follow_up_at}
                      onChange={(e) => setCallForm({ ...callForm, follow_up_at: e.target.value, follow_up_required: true })}
                      className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                )}

                {outcomes.find(o => o.id === callForm.outcome_id)?.forwards_to_sales && (
                  <div>
                    <label className="block text-[10px] font-bold text-amber-500 mb-1">ATANACAK SATIŞ UZMANI *</label>
                    <select
                      required
                      value={callForm.assigned_sales_user_id}
                      onChange={(e) => setCallForm({ ...callForm, assigned_sales_user_id: e.target.value })}
                      className="w-full h-9 px-2 bg-background border border-border rounded-lg focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="">Seçiniz</option>
                      {salesReps.map(sr => (
                        <option key={sr.id} value={sr.id}>{sr.full_name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">GÖRÜŞME NOTLARI</label>
                  <textarea
                    rows={3}
                    value={callForm.notes}
                    onChange={(e) => setCallForm({ ...callForm, notes: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg p-2 focus:outline-none"
                    placeholder="Görüşme detaylarını, teklif talebini veya itirazları girin..."
                  />
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

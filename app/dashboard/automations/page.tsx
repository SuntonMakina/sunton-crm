'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Zap,
  Plus,
  Play,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Trash2,
  Clock,
  Settings,
  ArrowRight,
  Info
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'

export default function AutomationsPage() {
  const supabase = createClient()

  // States
  const [automations, setAutomations] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSubTab, setActiveSubTab] = useState<'rules' | 'logs'>('rules')

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Creation form state
  const [ruleName, setRuleName] = useState('')
  const [ruleDesc, setRuleDesc] = useState('')
  const [triggerType, setTriggerType] = useState('new_lead')
  const [condField, setCondField] = useState('province')
  const [condVal, setCondVal] = useState('')
  const [actionType, setActionType] = useState('assign_user')
  const [actionVal, setActionVal] = useState('')

  // Lookups
  const [users, setUsers] = useState<any[]>([])

  useEffect(() => {
    async function loadLookups() {
      const { data } = await supabase.from('profiles').select('id, full_name').eq('is_active', true)
      if (data) setUsers(data)
    }
    loadLookups()
    loadAutomations()
  }, [supabase])

  const loadAutomations = async () => {
    setLoading(true)
    try {
      const { data: rules } = await supabase.from('automations').select('*').eq('is_active', true)
      const { data: logItems } = await supabase.from('automation_logs').select('*, automations(name)').order('executed_at', { ascending: false }).limit(50)

      if (rules) setAutomations(rules)
      if (logItems) setLogs(logItems)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Create new rule submit
  const handleCreateAutomation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ruleName) {
      alert('Lütfen kural adı girin.')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('automations').insert({
        name: ruleName,
        description: ruleDesc || null,
        trigger_type: triggerType,
        trigger_config: { field: condField, value: condVal },
        condition_config: { field: condField, value: condVal },
        action_type: actionType,
        action_config: { target: actionVal },
        is_active: true
      })

      if (!error) {
        setIsAddOpen(false)
        setRuleName('')
        setRuleDesc('')
        setCondVal('')
        setActionVal('')
        loadAutomations()
      } else {
        alert(error.message)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // Delete rule
  const handleDeleteRule = async (id: string) => {
    if (!confirm('Bu otomasyon kuralını kalıcı olarak silmek istediğinizden emin misiniz?')) return
    try {
      const { error } = await supabase.from('automations').update({ is_active: false }).eq('id', id)
      if (!error) loadAutomations()
    } catch (err) {
      console.error(err)
    }
  }

  // Translate triggers
  const translateTrigger = (trig: string) => {
    const trigs: Record<string, string> = {
      new_lead: 'Yeni Lead Girişi',
      status_change: 'Lead Durumu Değiştiğinde',
      call_outcome: 'Arama Sonucu Kaydedildiğinde',
      deal_won: 'Fırsat Kazanıldığında'
    }
    return trigs[trig] || trig
  }

  // Translate actions
  const translateAction = (act: string) => {
    const acts: Record<string, string> = {
      assign_user: 'Kullanıcıya Ata',
      round_robin: 'Sırayla Dağıt (Round-Robin)',
      change_status: 'Durumu Güncelle',
      create_task: 'Takip Görevi Oluştur'
    }
    return acts[act] || act
  }

  return (
    <div className="space-y-4">
      
      {/* Title & Action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Otomasyonlar</h1>
          <p className="text-xs text-muted-foreground mt-0.5">İş akışlarını hızlandıran kodsuz tetikleyici, koşul ve aksiyon kuralları.</p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="h-9 px-3.5 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 flex items-center gap-1.5 cursor-pointer shadow-sm shadow-primary/10 transition-colors"
        >
          <Plus className="h-4.5 w-4.5" />
          Kural Oluştur
        </button>
      </div>

      {/* Sub tabs filter */}
      <div className="flex border-b border-border bg-card p-1.5 rounded-xl shadow-xs gap-1 select-none">
        <button
          onClick={() => setActiveSubTab('rules')}
          className={`px-4.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'rules' ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:bg-accent'
          }`}
        >
          Aktif Kurallar
        </button>
        <button
          onClick={() => setActiveSubTab('logs')}
          className={`px-4.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'logs' ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:bg-accent'
          }`}
        >
          Çalışma Günlükleri (Loglar)
        </button>
      </div>

      {loading ? (
        <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground mt-3 font-semibold">Kurallar yükleniyor...</p>
        </div>
      ) : activeSubTab === 'rules' ? (
        // Active rules cards list
        automations.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center text-sm text-muted-foreground">
            Kayıtlı aktif bir otomasyon kuralı bulunmamaktadır.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {automations.map((rule) => (
              <div key={rule.id} className="bg-card border border-border p-5 rounded-xl shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-sm text-foreground">{rule.name}</h3>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md cursor-pointer transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{rule.description || 'Açıklama girilmemiş.'}</p>
                  
                  {/* Visual trigger condition action chain */}
                  <div className="mt-4 p-3 bg-muted/40 rounded-lg border border-border/50 space-y-2 text-xs">
                    <div>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase">Tetikleyici</span>
                      <div className="font-semibold text-foreground mt-0.5">{translateTrigger(rule.trigger_type)}</div>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground my-1.5">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase">Aksiyon</span>
                      <div className="font-semibold text-primary mt-0.5">{translateAction(rule.action_type)}</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-4 pt-3 border-t border-border/60">
                  <span>Çalışma: <strong>{rule.run_count || 0} kez</strong></span>
                  {rule.last_run_at && (
                    <span>Son: {new Date(rule.last_run_at).toLocaleDateString('tr-TR')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        // Logs table view
        logs.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center text-sm text-muted-foreground">
            Henüz herhangi bir otomasyon tetiklenme kaydı bulunmuyor.
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[10px] font-bold uppercase text-muted-foreground">
                    <th className="py-3 px-4">Tarih</th>
                    <th className="py-3 px-4">Otomasyon Kuralı</th>
                    <th className="py-3 px-4">Tetiklenen Tür</th>
                    <th className="py-3 px-4">Durum</th>
                    <th className="py-3 px-4">Log Detayı</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs text-foreground">
                  {logs.map((l) => (
                    <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Date(l.executed_at).toLocaleString('tr-TR')}
                      </td>
                      <td className="py-3 px-4 font-bold">{l.automations?.name || 'Silinmiş Kural'}</td>
                      <td className="py-3 px-4 capitalize font-semibold text-muted-foreground">{l.entity_type}</td>
                      <td className="py-3 px-4">
                        {l.status === 'success' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                            <CheckCircle className="h-4 w-4" />
                            Başarılı
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-500 font-bold">
                            <AlertTriangle className="h-4 w-4" />
                            Hatalı
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground font-medium max-w-xs truncate" title={l.error_message || ''}>
                        {l.error_message || 'İşlem hatasız tamamlandı.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Dialog: Create Rule Modal */}
      {isAddOpen && (
        <Dialog.Root open={isAddOpen} onOpenChange={setIsAddOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-md z-50 animate-in fade-in zoom-in-95 duration-150">
              <Dialog.Title className="text-base font-bold text-foreground mb-4">Otomasyon Kuralı Tanımla</Dialog.Title>
              <form onSubmit={handleCreateAutomation} className="space-y-4 text-xs">
                
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">KURAL ADI *</label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: Kayseri İlindeki Leadleri Hakan'a Ata"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">KURAL AÇIKLAMASI</label>
                  <textarea
                    rows={2}
                    value={ruleDesc}
                    onChange={(e) => setRuleDesc(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg p-2 focus:outline-none"
                  />
                </div>

                <div className="border border-border/80 rounded-lg p-3.5 space-y-3 bg-muted/20">
                  <h4 className="font-bold text-[10px] text-muted-foreground uppercase">Tetikleyici ve Koşullar</h4>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground mb-1">TETİKLEYİCİ</label>
                      <select
                        value={triggerType}
                        onChange={(e) => setTriggerType(e.target.value)}
                        className="w-full h-8 px-2 bg-background border border-border rounded"
                      >
                        <option value="new_lead">Yeni Lead Kaydı</option>
                        <option value="status_change">Lead Durumu Değiştiğinde</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground mb-1">KOŞUL ALANI</label>
                      <select
                        value={condField}
                        onChange={(e) => setCondField(e.target.value)}
                        className="w-full h-8 px-2 bg-background border border-border rounded"
                      >
                        <option value="province">Lead İli Eşitse</option>
                        <option value="priority">Öncelik Eşitse</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1">KOŞUL DEĞERİ *</label>
                    <input
                      type="text"
                      required
                      placeholder="Örn: Kayseri veya high"
                      value={condVal}
                      onChange={(e) => setCondVal(e.target.value)}
                      className="w-full h-8 px-3 bg-background border border-border rounded"
                    />
                  </div>
                </div>

                <div className="border border-border/80 rounded-lg p-3.5 space-y-3 bg-muted/20">
                  <h4 className="font-bold text-[10px] text-muted-foreground uppercase font-sans">Hedef Aksiyon</h4>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground mb-1">AKSİYON</label>
                      <select
                        value={actionType}
                        onChange={(e) => setActionType(e.target.value)}
                        className="w-full h-8 px-2 bg-background border border-border rounded"
                      >
                        <option value="assign_user">Temsilciye Ata</option>
                        <option value="change_status">Lead Durumunu Değiştir</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground mb-1">HEDEF SEÇİMİ *</label>
                      {actionType === 'assign_user' ? (
                        <select
                          required
                          value={actionVal}
                          onChange={(e) => setActionVal(e.target.value)}
                          className="w-full h-8 px-2 bg-background border border-border rounded"
                        >
                          <option value="">Seçiniz</option>
                          {users.map(u => (
                            <option key={u.id} value={u.id}>{u.full_name}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          required
                          placeholder="Durum ID'si girin"
                          value={actionVal}
                          onChange={(e) => setActionVal(e.target.value)}
                          className="w-full h-8 px-3 bg-background border border-border rounded"
                        />
                      )}
                    </div>
                  </div>
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

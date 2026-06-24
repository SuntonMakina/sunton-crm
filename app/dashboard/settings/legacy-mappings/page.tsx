'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Users, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Database, 
  UploadCloud, 
  Loader2,
  Trash2,
  Settings,
  ArrowRight,
  TrendingUp,
  FileText
} from 'lucide-react'
import Link from 'next/link'

export default function LegacyMappingsPage() {
  const supabase = createClient()

  // Mappings and profiles states
  const [profiles, setProfiles] = useState<any[]>([])
  const [mappings, setMappings] = useState<any[]>([])
  const [unmappedCounts, setUnmappedCounts] = useState<Record<string, number>>({})
  const [importBatches, setImportBatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Mapping edit state
  const [selectedMappingUser, setSelectedMappingUser] = useState<Record<string, string>>({})
  const [savingRep, setSavingRep] = useState<string | null>(null)

  // Import states
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        await Promise.all([
          fetchProfiles(),
          fetchMappingsAndCounts(),
          fetchImportBatches()
        ])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('is_active', true)
      .order('full_name')
    if (!error && data) {
      setProfiles(data)
    }
  }

  const fetchMappingsAndCounts = async () => {
    // 1. Fetch current mappings
    const { data: mappingsData } = await supabase
      .from('legacy_sales_rep_mappings')
      .select('*')
      .order('legacy_name')

    // 2. Fetch counts of unmapped leads grouped by sales_representative_text
    const { data: countsData } = await supabase
      .from('leads')
      .select('sales_representative_text')
      .eq('legacy_source_file', '2026 - Mayıs Haziran Verileri.xlsx')
      .is('assigned_sales_user_id', null)

    const counts: Record<string, number> = {}
    countsData?.forEach(lead => {
      const rep = lead.sales_representative_text || '-'
      counts[rep] = (counts[rep] || 0) + 1
    })

    if (mappingsData) {
      setMappings(mappingsData)
      // Initialize edit state
      const initialEdit: Record<string, string> = {}
      mappingsData.forEach(m => {
        initialEdit[m.legacy_name] = m.mapped_user_id || ''
      })
      setSelectedMappingUser(initialEdit)
    }
    setUnmappedCounts(counts)
  }

  const fetchImportBatches = async () => {
    const { data, error } = await supabase
      .from('legacy_import_batches')
      .select(`
        *,
        creator:created_by(full_name)
      `)
      .order('started_at', { ascending: false })
      .limit(10)
    if (!error && data) {
      setImportBatches(data)
    }
  }

  // Handle Mapping Save
  const handleSaveMapping = async (legacyName: string) => {
    const mappedUserId = selectedMappingUser[legacyName] || null
    setSavingRep(legacyName)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      // 1. Save rep mapping
      const { error: mapErr } = await supabase
        .from('legacy_sales_rep_mappings')
        .upsert({
          legacy_name: legacyName,
          mapped_user_id: mappedUserId ? mappedUserId : null,
          mapped_at: new Date().toISOString(),
          mapped_by: user?.id || null
        })

      if (mapErr) throw new Error(mapErr.message)

      // 2. Bulk update matching leads
      const { error: updateErr } = await supabase
        .from('leads')
        .update({ assigned_sales_user_id: mappedUserId ? mappedUserId : null })
        .eq('legacy_source_file', '2026 - Mayıs Haziran Verileri.xlsx')
        .eq('sales_representative_text', legacyName)

      if (updateErr) throw new Error(updateErr.message)

      // 3. Write audit log
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'update_legacy_mapping',
          entity_type: 'legacy_sales_rep_mappings',
          entity_id: legacyName,
          old_values: { legacy_name: legacyName },
          new_values: { mapped_user_id: mappedUserId },
          ip_address: '127.0.0.1',
          user_agent: 'Next.js Client'
        })
      }

      alert(`"${legacyName}" başarıyla eşleştirildi ve ilgili kayıtlar güncellendi.`)
      fetchMappingsAndCounts()
    } catch (err: any) {
      alert('Eşleştirme sırasında hata: ' + err.message)
    } finally {
      setSavingRep(null)
    }
  }

  const handleRemoveMapping = async (legacyName: string) => {
    if (!confirm(`"${legacyName}" eşleştirmesini kaldırmak istiyor musunuz?`)) return
    
    setSavingRep(legacyName)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      // 1. Clear mapped user
      const { error: mapErr } = await supabase
        .from('legacy_sales_rep_mappings')
        .update({ mapped_user_id: null })
        .eq('legacy_name', legacyName)

      if (mapErr) throw new Error(mapErr.message)

      // 2. Clear assigned_sales_user_id on leads
      const { error: updateErr } = await supabase
        .from('leads')
        .update({ assigned_sales_user_id: null })
        .eq('legacy_source_file', '2026 - Mayıs Haziran Verileri.xlsx')
        .eq('sales_representative_text', legacyName)

      if (updateErr) throw new Error(updateErr.message)

      // 3. Audit log
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'remove_legacy_mapping',
          entity_type: 'legacy_sales_rep_mappings',
          entity_id: legacyName,
          old_values: { legacy_name: legacyName },
          new_values: { mapped_user_id: null },
          ip_address: '127.0.0.1',
          user_agent: 'Next.js Client'
        })
      }

      // Reset state local
      setSelectedMappingUser(prev => ({ ...prev, [legacyName]: '' }))
      alert(`"${legacyName}" eşleştirmesi kaldırıldı.`)
      fetchMappingsAndCounts()
    } catch (err: any) {
      alert('Kaldırma sırasında hata: ' + err.message)
    } finally {
      setSavingRep(null)
    }
  }

  // Trigger Import Server Action via fetch
  const handleTriggerImport = async () => {
    setImporting(true)
    setImportResult(null)
    try {
      const res = await fetch('/api/import-legacy', {
        method: 'POST'
      })
      const data = await res.json()
      if (res.ok) {
        setImportResult({
          success: true,
          inserted: data.inserted,
          updated: data.updated,
          skipped: data.skipped,
          errors: data.errors
        })
        fetchMappingsAndCounts()
        fetchImportBatches()
      } else {
        setImportResult({
          success: false,
          error: data.error
        })
      }
    } catch (err: any) {
      setImportResult({
        success: false,
        error: err.message
      })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6 select-none pb-8 text-xs">
      
      {/* Header breadcrumbs */}
      <div className="flex items-center justify-between border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-1.5 text-muted-foreground font-semibold mb-1">
            <Link href="/dashboard/settings" className="hover:text-foreground">Ayarlar</Link>
            <ArrowRight className="h-3 w-3" />
            <span className="text-foreground">Eski Veri Eşleştirmeleri</span>
          </div>
          <h1 className="text-xl font-bold text-foreground">Eski Veri Eşleştirmeleri</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Eski Excel dosyasındaki Satış Uzmanlarını, CRM personelleri ile eşleştirin ve kayıtları aktarın.</p>
        </div>

        {/* Import execution button */}
        <button
          onClick={handleTriggerImport}
          disabled={importing}
          className="h-9 px-4.5 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/95 flex items-center gap-2 cursor-pointer transition-colors shadow-sm disabled:opacity-50"
        >
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          Excel'den Verileri Aktar / Güncelle
        </button>
      </div>

      {/* Import summary results alert */}
      {importResult && (
        <div className={`p-4 border rounded-xl flex items-start gap-3 ${
          importResult.success ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-600' : 'bg-red-500/5 border-red-500/30 text-red-600'
        }`}>
          {importResult.success ? <CheckCircle className="h-5 w-5 shrink-0" /> : <AlertTriangle className="h-5 w-5 shrink-0" />}
          <div className="space-y-1">
            <h4 className="font-bold">{importResult.success ? 'Aktarım İşlemi Tamamlandı!' : 'Aktarım Başarısız Oldu'}</h4>
            {importResult.success ? (
              <p className="font-medium">
                Aktarım Sonuçları: <strong>{importResult.inserted} yeni kayıt eklendi</strong>,{' '}
                <strong>{importResult.updated} kayıt güncellendi</strong>,{' '}
                <strong>{importResult.skipped} atlandı</strong> ve{' '}
                <strong>{importResult.errors} hatalı</strong> satır tespit edildi.
              </p>
            ) : (
              <p className="font-medium">{importResult.error}</p>
            )}
          </div>
        </div>
      )}

      {/* Content Grid: Left Mappings / Right Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Section: Representative Matching (Col span 2) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-border bg-accent/10 flex items-center justify-between">
              <h3 className="font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Excel Satış Uzmanı Eşleştirme Tablosu
              </h3>
              <button 
                onClick={fetchMappingsAndCounts}
                className="h-7 w-7 bg-card border border-border rounded-md flex items-center justify-center cursor-pointer transition-colors"
                title="Yenile"
              >
                <RefreshCw className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-xs">Veriler yükleniyor...</p>
              </div>
            ) : mappings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Eşleştirme tablosu boş veya veritabanı migrasyonu çalıştırılmadı.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {mappings.map((m) => {
                  const unmappedCount = unmappedCounts[m.legacy_name] || 0
                  const isSaving = savingRep === m.legacy_name
                  
                  return (
                    <div key={m.legacy_name} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                      {/* Name Details */}
                      <div className="space-y-1">
                        <span className="font-extrabold text-foreground text-xs">{m.legacy_name}</span>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-semibold">
                          <span>Excel İsmi</span>
                          <span>•</span>
                          <span className={`px-2 py-0.5 rounded border ${
                            unmappedCount > 0 ? 'bg-amber-500/10 border-amber-500/20 text-amber-600' : 'bg-slate-100 dark:bg-slate-900 text-slate-500 border-border'
                          }`}>
                            {unmappedCount} Eşleşmemiş Kayıt
                          </span>
                        </div>
                      </div>

                      {/* Dropdown Match Selector & Save Action */}
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedMappingUser[m.legacy_name] || ''}
                          onChange={(e) => setSelectedMappingUser(prev => ({ ...prev, [m.legacy_name]: e.target.value }))}
                          className="h-8 text-[11px] bg-background border border-border rounded-lg px-2.5 w-52 focus:outline-none cursor-pointer"
                        >
                          <option value="">Kullanıcı seçin (Eşleşmemiş)...</option>
                          {profiles.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.full_name} ({p.role === 'sales_specialist' ? 'Satış Uzmanı' : p.role === 'call_center_rep' ? 'Call Center' : p.role})
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={() => handleSaveMapping(m.legacy_name)}
                          disabled={isSaving}
                          className="h-8 px-3.5 bg-primary text-primary-foreground font-bold rounded-lg text-[10px] hover:bg-primary/95 flex items-center justify-center cursor-pointer transition-colors disabled:opacity-50"
                        >
                          {isSaving && savingRep === m.legacy_name ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Eşleştir'}
                        </button>

                        {m.mapped_user_id && (
                          <button
                            onClick={() => handleRemoveMapping(m.legacy_name)}
                            disabled={isSaving}
                            className="h-8 w-8 border border-red-200 hover:bg-red-500/5 text-red-500 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                            title="Eşleştirmeyi Kaldır"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Recent Import Batches (Col span 1) */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-border bg-accent/10 flex items-center justify-between">
              <h3 className="font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Son Aktarım Günlükleri
              </h3>
            </div>

            <div className="p-4 space-y-3.5 max-h-[500px] overflow-y-auto divide-y divide-border/50">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : importBatches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground font-medium">
                  Kayıtlı veri aktarım geçmişi bulunmuyor.
                </div>
              ) : (
                importBatches.map((batch, index) => {
                  const dateStr = new Date(batch.started_at).toLocaleString('tr-TR')
                  const isCompleted = batch.status === 'completed'
                  const isFailed = batch.status === 'failed'
                  
                  return (
                    <div key={batch.id} className={`pt-3.5 first:pt-0 space-y-1.5`}>
                      <div className="flex items-center justify-between">
                        <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase ${
                          isCompleted ? 'bg-emerald-500/10 text-emerald-600' :
                          isFailed ? 'bg-red-500/10 text-red-600' : 'bg-blue-500/10 text-blue-600'
                        }`}>
                          {batch.status === 'completed' ? 'Tamamlandı' : batch.status === 'failed' ? 'Başarısız' : 'Çalışıyor'}
                        </span>
                        <span className="text-[9px] text-muted-foreground">{dateStr}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-foreground">
                        <div>Eklenen: <strong className="text-emerald-500">{batch.inserted_rows}</strong></div>
                        <div>Güncellenen: <strong className="text-blue-500">{batch.updated_rows}</strong></div>
                        <div>Hata: <strong className="text-red-500">{batch.error_rows}</strong></div>
                        <div>Toplam: <strong>{batch.total_rows}</strong></div>
                      </div>

                      {batch.notes && (
                        <p className="text-[9px] text-muted-foreground bg-muted/40 p-2 rounded border border-border/40 italic">
                          {batch.notes}
                        </p>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

      </div>
      
    </div>
  )
}

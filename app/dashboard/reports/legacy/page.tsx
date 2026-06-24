'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  UserCheck, 
  Users, 
  PhoneCall, 
  FolderMinus, 
  CheckCircle,
  Clock,
  ArrowRight,
  TrendingUp as TrendIcon,
  RefreshCw,
  Loader2
} from 'lucide-react'
import Link from 'next/link'

export default function LegacyReportsPage() {
  const supabase = createClient()

  // State
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<any>(null)

  useEffect(() => {
    fetchReportData()
  }, [])

  const fetchReportData = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          lead_statuses(name),
          lead_sources(name),
          assigned_sales:assigned_sales_user_id(full_name)
        `)
        .eq('legacy_source_file', '2026 - Mayıs Haziran Verileri.xlsx')

      if (!error && data) {
        processMetrics(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const processMetrics = (data: any[]) => {
    // Separate by month
    const mayLeads = data.filter(l => {
      const d = l.first_contact_date ? new Date(l.first_contact_date) : null
      return d && d.getMonth() + 1 === 5
    })

    const juneLeads = data.filter(l => {
      const d = l.first_contact_date ? new Date(l.first_contact_date) : null
      return d && d.getMonth() + 1 === 6
    })

    // Helper to calculate statistics
    const getStats = (leads: any[], month: number) => {
      const total = leads.length
      
      // Daily Average
      let dailyAvg = 0
      if (total > 0) {
        const dates = leads.map(l => new Date(l.first_contact_date).getTime())
        const minTime = Math.min(...dates)
        const maxTime = Math.max(...dates)
        const diffDays = Math.max(1, Math.round((maxTime - minTime) / (1000 * 60 * 60 * 24)) + 1)
        dailyAvg = Number((total / diffDays).toFixed(1))
      }

      const assigned = leads.filter(l => l.assigned_sales_user_id || l.assigned_call_center_user_id).length
      const unassigned = total - assigned
      const contacted = leads.filter(l => l.conversation_completed).length
      const unreachable = leads.filter(l => {
        const name = (l.lead_statuses?.name || '').toLowerCase()
        return name === 'ulaşılamadı' || name === 'cevap vermedi'
      }).length
      const positive = leads.filter(l => l.response_positive).length
      
      const forwarded = leads.filter(l => 
        (l.sales_representative_text && l.sales_representative_text !== '-') || 
        l.assigned_sales_user_id ||
        l.lead_statuses?.name === 'Satış Uzmanına İletildi'
      ).length

      const pending = total - forwarded
      
      // Geciken takipler: next_follow_up_date is in past and not won
      const nowTime = new Date().getTime()
      const delayed = leads.filter(l => {
        if (!l.next_follow_up_date) return false
        const isWon = l.converted_to_sale || l.lead_statuses?.name === 'Satışa Dönüştü'
        const isLost = l.lead_statuses?.name === 'Olumsuz' || l.lead_statuses?.name === 'İlgileniyor'
        return new Date(l.next_follow_up_date).getTime() < nowTime && !isWon && !isLost
      }).length

      // Breakdowns
      const breakdown = (key: string, accessor = (x: any) => x[key]) => {
        const counts: Record<string, number> = {}
        leads.forEach(l => {
          const v = accessor(l) || 'Belirtilmemiş'
          counts[v] = (counts[v] || 0) + 1
        })
        return Object.entries(counts)
          .map(([name, val]) => ({ name, count: val }))
          .sort((a, b) => b.count - a.count)
      }

      return {
        total,
        dailyAvg,
        assigned,
        unassigned,
        contacted,
        unreachable,
        positive,
        forwarded,
        pending,
        delayed,
        cities: breakdown('province'),
        products: breakdown('requested_product'),
        sources: breakdown('lead_source', x => x.lead_sources?.name),
        reps: breakdown('sales_representative_text')
      }
    }

    const mayStats = getStats(mayLeads, 5)
    const juneStats = getStats(juneLeads, 6)

    // Calculate percentage changes
    const calcChange = (mayVal: number, juneVal: number) => {
      if (mayVal === 0) return juneVal > 0 ? 100 : 0
      return Number((((juneVal - mayVal) / mayVal) * 100).toFixed(1))
    }

    setMetrics({
      may: mayStats,
      june: juneStats,
      changes: {
        total: calcChange(mayStats.total, juneStats.total),
        dailyAvg: calcChange(mayStats.dailyAvg, juneStats.dailyAvg),
        assigned: calcChange(mayStats.assigned, juneStats.assigned),
        unassigned: calcChange(mayStats.unassigned, juneStats.unassigned),
        contacted: calcChange(mayStats.contacted, juneStats.contacted),
        unreachable: calcChange(mayStats.unreachable, juneStats.unreachable),
        positive: calcChange(mayStats.positive, juneStats.positive),
        forwarded: calcChange(mayStats.forwarded, juneStats.forwarded),
        pending: calcChange(mayStats.pending, juneStats.pending),
        delayed: calcChange(mayStats.delayed, juneStats.delayed)
      }
    })
  }

  // Render Trend indicator
  const renderTrend = (value: number) => {
    if (value > 0) {
      return (
        <span className="flex items-center gap-0.5 text-emerald-500 font-extrabold text-[10px]">
          <TrendingUp className="h-3.5 w-3.5" />
          +{value}%
        </span>
      )
    } else if (value < 0) {
      return (
        <span className="flex items-center gap-0.5 text-red-500 font-extrabold text-[10px]">
          <TrendingDown className="h-3.5 w-3.5" />
          {value}%
        </span>
      )
    }
    return <span className="text-muted-foreground text-[10px] font-bold">-%</span>
  }

  // Render horizontal bar chart helper
  const renderBarChart = (title: string, mayData: any[], juneData: any[]) => {
    // Merge names to compare
    const allNames = Array.from(new Set([
      ...mayData.slice(0, 5).map(x => x.name),
      ...juneData.slice(0, 5).map(x => x.name)
    ])).filter(x => x !== 'Belirtilmemiş' && x !== '-')

    return (
      <div className="bg-card border border-border rounded-xl p-4 shadow-xs space-y-4">
        <h4 className="font-bold text-foreground uppercase tracking-wider text-[10px] pb-1 border-b border-border/50">{title}</h4>
        
        <div className="space-y-3">
          {allNames.map(name => {
            const mayVal = mayData.find(x => x.name === name)?.count || 0
            const juneVal = juneData.find(x => x.name === name)?.count || 0
            const maxVal = Math.max(1, ...mayData.map(x => x.count), ...juneData.map(x => x.count))
            
            const mayPct = (mayVal / maxVal) * 100
            const junePct = (juneVal / maxVal) * 100

            return (
              <div key={name} className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-semibold text-foreground">
                  <span className="truncate pr-4">{name}</span>
                  <span className="text-muted-foreground">
                    May: <strong className="text-foreground">{mayVal}</strong> | Jun: <strong className="text-foreground">{juneVal}</strong>
                  </span>
                </div>
                
                <div className="space-y-1">
                  {/* May Bar */}
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-[8px] text-muted-foreground font-bold uppercase">Mayıs</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${mayPct}%` }} />
                    </div>
                  </div>
                  {/* June Bar */}
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-[8px] text-muted-foreground font-bold uppercase">Haziran</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${junePct}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 select-none pb-8 text-xs">
      
      {/* Header section */}
      <div className="flex items-center justify-between border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-1.5 text-muted-foreground font-semibold mb-1">
            <Link href="/dashboard/reports" className="hover:text-foreground">Raporlar</Link>
            <ArrowRight className="h-3 w-3" />
            <span className="text-foreground">Geçmiş Veriler Karşılaştırmalı Raporu</span>
          </div>
          <h1 className="text-xl font-bold text-foreground font-sans">Eski Veriler Kıyaslama Raporu (Mayıs vs Haziran)</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Mayıs (109) ve Haziran (193) aylarındaki Excel verileri üzerinden dinamik performans ve dönüşüm analizleri.</p>
        </div>

        <button 
          onClick={fetchReportData}
          className="h-9 w-9 bg-card border border-border rounded-lg flex items-center justify-center cursor-pointer transition-colors"
          title="Yenile"
        >
          <RefreshCw className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 text-muted-foreground gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs">Rapor verileri hesaplanıyor...</p>
        </div>
      ) : !metrics ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
          Raporlanacak eski veri bulunmamaktadır. Lütfen öncelikle verileri aktarın.
        </div>
      ) : (
        <>
          {/* 1. Comparison Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
            {[
              { title: 'Toplam Lead', mayVal: metrics.may.total, juneVal: metrics.june.total, trend: metrics.changes.total },
              { title: 'Günlük Ort. Lead', mayVal: metrics.may.dailyAvg, juneVal: metrics.june.dailyAvg, trend: metrics.changes.dailyAvg },
              { title: 'Görüşme Yapılan', mayVal: metrics.may.contacted, juneVal: metrics.june.contacted, trend: metrics.changes.contacted },
              { title: 'Temsilciye İletilen', mayVal: metrics.may.forwarded, juneVal: metrics.june.forwarded, trend: metrics.changes.forwarded },
              { title: 'İletilmeyi Bekleyen', mayVal: metrics.may.pending, juneVal: metrics.june.pending, trend: metrics.changes.pending }
            ].map(m => (
              <div key={m.title} className="bg-card border border-border rounded-xl p-4 shadow-xs flex flex-col justify-between h-24">
                <span className="text-[9px] font-bold text-muted-foreground uppercase">{m.title}</span>
                
                <div className="flex items-baseline justify-between mt-1">
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-muted-foreground">Mayıs: <strong className="text-foreground font-mono">{m.mayVal}</strong></span>
                    <h3 className="text-xl font-extrabold text-foreground font-mono">{m.juneVal} <span className="text-[10px] text-muted-foreground font-medium font-sans">Haz.</span></h3>
                  </div>
                  {renderTrend(m.trend)}
                </div>
              </div>
            ))}
          </div>

          {/* 2. Operations stats and quality flags */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Lead Assignments & Conversion */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-4">
              <h4 className="font-bold text-foreground uppercase tracking-wider text-[10px] pb-1 border-b border-border/50">Operasyonel İlerlemeler</h4>
              
              <div className="divide-y divide-border/50 text-[11px] font-semibold text-foreground space-y-3">
                <div className="flex justify-between items-center pb-2.5">
                  <span className="text-muted-foreground">Temsilciye Atanmış Leadler</span>
                  <span>May: <strong>{metrics.may.assigned}</strong> / Jun: <strong>{metrics.june.assigned}</strong> ({renderTrend(metrics.changes.assigned)})</span>
                </div>
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-muted-foreground">Görüşme Ulaşılamadı Oranı</span>
                  <span>
                    May: <strong>{((metrics.may.unreachable / (metrics.may.total || 1)) * 100).toFixed(0)}%</strong> /{' '}
                    Jun: <strong>{((metrics.june.unreachable / (metrics.june.total || 1)) * 100).toFixed(0)}%</strong>
                  </span>
                </div>
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-muted-foreground">Olumlu Geri Dönüş Oranı</span>
                  <span>
                    May: <strong>{((metrics.may.positive / (metrics.may.total || 1)) * 100).toFixed(0)}%</strong> /{' '}
                    Jun: <strong>{((metrics.june.positive / (metrics.june.total || 1)) * 100).toFixed(0)}%</strong>
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2.5">
                  <span className="text-muted-foreground">Geciken / Açık Takipler</span>
                  <span>May: <strong>{metrics.may.delayed}</strong> / Jun: <strong>{metrics.june.delayed}</strong> ({renderTrend(metrics.changes.delayed)})</span>
                </div>
              </div>
            </div>

            {/* Performance analysis chart summary */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-foreground uppercase tracking-wider text-[10px] pb-1 border-b border-border/50 mb-2">Genel Karşılaştırma Özeti</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Haziran ayında toplam müşteri adayı giriş hacminde <strong>{metrics.changes.total}%</strong> artış kaydedilmiş ve günlük lead ortalaması <strong>{metrics.changes.dailyAvg}%</strong> yükselmiştir. 
                  Ayrıca satış temsilcilerine iletilen lead sayısı <strong>{metrics.changes.forwarded}%</strong> artış göstererek operasyon verimliliğini desteklemiştir.
                </p>
              </div>

              <div className="flex items-center gap-6 border-t border-border pt-4 mt-4">
                <div className="text-center flex-1">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">Mayıs Toplam</span>
                  <h3 className="text-lg font-bold text-blue-500 mt-0.5">109</h3>
                </div>
                <div className="flex items-center text-muted-foreground">
                  <ArrowRight className="h-5 w-5" />
                </div>
                <div className="text-center flex-1">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">Haziran Toplam</span>
                  <h3 className="text-lg font-bold text-emerald-500 mt-0.5">193</h3>
                </div>
                <div className="text-center flex-1 bg-muted px-3 py-2 rounded-lg">
                  <span className="text-[8px] font-bold text-muted-foreground uppercase">Net Fark</span>
                  <h3 className="text-md font-bold text-foreground mt-0.5">+84 Lead</h3>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Breakdowns Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderBarChart('En Çok Lead Gelen Şehirler', metrics.may.cities, metrics.june.cities)}
            {renderBarChart('Talep Edilen Lazer Makinaları & Ürünler', metrics.may.products, metrics.june.products)}
            {renderBarChart('Reklam / Lead Kaynakları Karşılaştırması', metrics.may.sources, metrics.june.sources)}
            {renderBarChart('Eski Temsilci Yük Dağılımı', metrics.may.reps, metrics.june.reps)}
          </div>
        </>
      )}

    </div>
  )
}

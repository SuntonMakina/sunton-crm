'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import NextLink from 'next/link'
import {
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  Download,
  Calendar,
  Loader2,
  FileText,
  Phone,
  DollarSign,
  CheckSquare,
  Lock
} from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

export default function ReportsPage() {
  const supabase = createClient()

  // States
  const [activeTab, setActiveTab] = useState<'leads' | 'calls' | 'sales' | 'tasks'>('leads')
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)

  // Report data states
  const [leadsByDay, setLeadsByDay] = useState<any[]>([])
  const [leadsBySource, setLeadsBySource] = useState<any[]>([])
  const [leadsByStatus, setLeadsByStatus] = useState<any[]>([])
  const [callsByAgent, setCallsByAgent] = useState<any[]>([])
  const [callsOutcomes, setCallsOutcomes] = useState<any[]>([])
  const [salesPipeline, setSalesPipeline] = useState<any[]>([])
  const [taskStats, setTaskStats] = useState<any[]>([])

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#718096']

  const fetchReports = async () => {
    setLoading(true)
    try {
      // Fetch datasets based on active tab or fetch all to allow swift toggles
      if (activeTab === 'leads') {
        const { data: daily } = await supabase.rpc('rpc_leads_by_day', { p_start_date: startDate, p_end_date: endDate })
        const { data: source } = await supabase.rpc('rpc_leads_by_source', { p_start_date: startDate, p_end_date: endDate })
        const { data: status } = await supabase.rpc('rpc_leads_by_status', { p_start_date: startDate, p_end_date: endDate })
        
        if (daily) setLeadsByDay(daily)
        if (source) setLeadsBySource(source)
        if (status) setLeadsByStatus(status)
      } else if (activeTab === 'calls') {
        const { data: agent } = await supabase.rpc('rpc_calls_by_agent', { p_start_date: startDate, p_end_date: endDate })
        const { data: outcomes } = await supabase.rpc('rpc_call_outcomes', { p_start_date: startDate, p_end_date: endDate })
        
        if (agent) setCallsByAgent(agent)
        if (outcomes) setCallsOutcomes(outcomes)
      } else if (activeTab === 'sales') {
        const { data: pipe } = await supabase.rpc('rpc_pipeline_stage_stats')
        if (pipe) setSalesPipeline(pipe)
      } else if (activeTab === 'tasks') {
        // Simple client aggregation for task outcomes
        const { data: tasks } = await supabase.from('tasks').select('status, task_type')
        if (tasks) {
          const counts: Record<string, number> = {}
          tasks.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1 })
          const formatted = Object.entries(counts).map(([status, val]) => ({
            name: status === 'completed' ? 'Tamamlandı' : status === 'pending' ? 'Bekliyor' : status === 'ongoing' ? 'Devam Ediyor' : status,
            value: val
          }))
          setTaskStats(formatted)
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [activeTab, startDate, endDate])

  // CSV Exporter client utility
  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return

    const headers = Object.keys(data[0])
    const csvRows = [
      headers.join(','), // headers row
      ...data.map(row => 
        headers.map(fieldName => JSON.stringify(row[fieldName] || '')).join(',')
      )
    ]

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `${filename}_raporu.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Raporlar & Analizler</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Sistem geneli lead, görüşme süresi, dönüşüm oranları ve satış hedefleri raporları.</p>
        </div>

        {/* Date Filters & CSV Download buttons */}
        <div className="flex flex-wrap items-center gap-3 bg-card border border-border p-2 rounded-xl shadow-xs">
          <NextLink
            href="/dashboard/reports/legacy"
            className="h-8 px-3 border border-border hover:bg-accent text-foreground font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <BarChartIcon className="h-3.5 w-3.5 text-muted-foreground" />
            Eski Veri Raporu
          </NextLink>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 text-xs bg-background border border-border rounded-lg px-2 focus:outline-none"
            />
            <span className="text-muted-foreground text-xs font-semibold">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 text-xs bg-background border border-border rounded-lg px-2 focus:outline-none"
            />
          </div>

          <button
            onClick={() => {
              if (activeTab === 'leads') exportToCSV(leadsBySource, 'lead_kaynaklari')
              else if (activeTab === 'calls') exportToCSV(callsByAgent, 'temsilci_arama_sureleri')
              else if (activeTab === 'sales') exportToCSV(salesPipeline, 'satis_pipeline_hacmi')
              else if (activeTab === 'tasks') exportToCSV(taskStats, 'gorevler_istatistikleri')
            }}
            className="h-8 px-3 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 flex items-center gap-1.5 cursor-pointer shadow-sm shadow-primary/10 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            CSV İndir
          </button>

          {/* PDF Download Disabled Placeholder */}
          <button
            disabled
            className="h-8 px-3 border border-border bg-muted/50 text-muted-foreground font-semibold rounded-lg text-xs flex items-center gap-1.5 cursor-not-allowed opacity-60"
            title="PDF Modülü Geliştirme Aşamasındadır"
          >
            <Lock className="h-3.5 w-3.5 text-muted-foreground/60" />
            PDF İndir (Yakında)
          </button>
        </div>
      </div>

      {/* Primary Category Selector Tabs */}
      <div className="flex border-b border-border bg-card p-1.5 rounded-xl shadow-xs gap-1 select-none">
        <button
          onClick={() => setActiveTab('leads')}
          className={`flex items-center gap-2 px-4.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'leads' ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:bg-accent'
          }`}
        >
          <FileText className="h-4 w-4" />
          Lead Raporları
        </button>
        <button
          onClick={() => setActiveTab('calls')}
          className={`flex items-center gap-2 px-4.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'calls' ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:bg-accent'
          }`}
        >
          <Phone className="h-4 w-4" />
          Call Center Raporları
        </button>
        <button
          onClick={() => setActiveTab('sales')}
          className={`flex items-center gap-2 px-4.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'sales' ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:bg-accent'
          }`}
        >
          <DollarSign className="h-4 w-4" />
          Satış Raporları
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex items-center gap-2 px-4.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'tasks' ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:bg-accent'
          }`}
        >
          <CheckSquare className="h-4 w-4" />
          Görev Raporları
        </button>
      </div>

      {/* Graphs display body */}
      {loading ? (
        <div className="bg-card border border-border rounded-xl p-16 flex flex-col items-center justify-center min-h-[350px]">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground mt-3 font-semibold">Rapor oluşturuluyor...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {activeTab === 'leads' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily trend graph */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
                <h3 className="text-xs font-bold text-foreground mb-4 uppercase tracking-wider">Aylık Lead Giriş Grafiği</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={leadsByDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="lead_date" stroke="#94A3B8" fontSize={9} />
                      <YAxis stroke="#94A3B8" fontSize={9} />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="lead_count" stroke="#3B82F6" strokeWidth={2} name="Lead Giriş Sayısı" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Source Distribution donut graph */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
                <h3 className="text-xs font-bold text-foreground mb-4 uppercase tracking-wider">Müşteri Adayı Kaynak Oranları</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={leadsBySource}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="lead_count"
                        nameKey="source_name"
                      >
                        {leadsBySource.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Legend verticalAlign="bottom" height={36} iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'calls' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Calls by representative */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
                <h3 className="text-xs font-bold text-foreground mb-4 uppercase tracking-wider">Kullanıcı Bazlı Çağrı Sayıları</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={callsByAgent}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="agent_name" stroke="#94A3B8" fontSize={9} />
                      <YAxis stroke="#94A3B8" fontSize={9} />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Bar dataKey="call_count" fill="#10B981" radius={[4, 4, 0, 0]} name="Çağrı Adeti" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Call Outcomes pie */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
                <h3 className="text-xs font-bold text-foreground mb-4 uppercase tracking-wider">Arama Sonucu Yüzdelikleri</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={callsOutcomes}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="call_count"
                        nameKey="outcome_name"
                      >
                        {callsOutcomes.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Legend verticalAlign="bottom" height={36} iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sales' && (
            <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
              <h3 className="text-xs font-bold text-foreground mb-4 uppercase tracking-wider">Pipeline Satış Fırsat Hacimleri</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesPipeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="stage_name" stroke="#94A3B8" fontSize={8} />
                    <YAxis stroke="#94A3B8" fontSize={9} />
                    <Tooltip formatter={(value: any) => `${value.toLocaleString('tr-TR')} TRY`} contentStyle={{ fontSize: 11 }} />
                    <Bar dataKey="total_amount" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Ciro Hacmi (TRY)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="bg-card border border-border rounded-xl p-5 shadow-xs max-w-lg mx-auto">
              <h3 className="text-xs font-bold text-foreground mb-4 text-center uppercase tracking-wider">Görev Durumu Dağılımları</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={taskStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                    >
                      {taskStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Legend verticalAlign="bottom" height={36} iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}

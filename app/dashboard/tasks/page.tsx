'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Task, Profile } from '@/types/crm'
import {
  CheckSquare,
  Search,
  Plus,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle,
  MoreVertical,
  Loader2,
  ListTodo,
  User,
  X,
  Play
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'

export default function TasksPage() {
  const supabase = createClient()

  // States
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'assigned' | 'today' | 'overdue' | 'completed'>('all')

  // Form modals state
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [taskForm, setTaskForm] = useState({
    title: '', description: '', task_type: 'general' as any, priority: 'normal' as any,
    assigned_to: '', due_at: '', estimated_minutes: 0,
    lead_id: '', customer_id: '', opportunity_id: ''
  })

  // Lookups
  const [users, setUsers] = useState<Profile[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [myProfile, setMyProfile] = useState<Profile | null>(null)

  // Load Lookups
  useEffect(() => {
    async function loadLookups() {
      // Current User
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (prof) setMyProfile(prof as Profile)
      }

      const { data: usersList } = await supabase.from('profiles').select('*').eq('is_active', true)
      const { data: leadsList } = await supabase.from('leads').select('id, first_name, last_name').eq('is_active', true)
      const { data: custsList } = await supabase.from('customers').select('id, full_name').eq('is_active', true)

      if (usersList) setUsers(usersList)
      if (leadsList) setLeads(leadsList)
      if (custsList) setCustomers(custsList)
    }
    loadLookups()
  }, [supabase])

  // Load Tasks List
  const loadTasksList = async () => {
    setLoading(true)
    try {
      let query = supabase.from('tasks').select(`
        *,
        assignee:profiles!tasks_assigned_to_fkey(full_name),
        creator:profiles!tasks_created_by_fkey(full_name),
        leads(first_name, last_name),
        customers(full_name)
      `).eq('is_active', true)

      if (searchQuery.trim()) {
        query = query.ilike('title', `%${searchQuery.trim()}%`)
      }

      // Filter tabs logic
      const nowStr = new Date().toISOString()
      if (activeTab === 'my' && myProfile) {
        query = query.eq('assigned_to', myProfile.id)
      } else if (activeTab === 'assigned' && myProfile) {
        query = query.eq('assigned_by', myProfile.id)
      } else if (activeTab === 'today') {
        const startOfDay = new Date()
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date()
        endOfDay.setHours(23, 59, 59, 999)
        query = query.gte('due_at', startOfDay.toISOString()).lte('due_at', endOfDay.toISOString())
      } else if (activeTab === 'overdue') {
        query = query.lt('due_at', nowStr).not('status', 'eq', 'completed')
      } else if (activeTab === 'completed') {
        query = query.eq('status', 'completed')
      }

      const { data, error } = await query.order('due_at', { ascending: true })

      if (!error && data) {
        setTasks(data as any[])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTasksList()
  }, [activeTab, searchQuery, myProfile])

  // Handle Mark task completed toggling
  const handleToggleComplete = async (task: Task) => {
    const isCompleted = task.status === 'completed'
    const nextStatus = isCompleted ? 'pending' : 'completed'
    
    try {
      // Optimistic state update
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus, completed_at: isCompleted ? null : new Date().toISOString() } : t))
      
      const { error } = await supabase
        .from('tasks')
        .update({
          status: nextStatus,
          completed_at: isCompleted ? null : new Date().toISOString()
        })
        .eq('id', task.id)

      if (error) {
        alert(error.message)
        loadTasksList()
      } else {
        // Log activity timeline for related lead/customer
        if (!isCompleted) {
          if (task.lead_id) {
            await supabase.from('activities').insert({
              entity_type: 'lead',
              entity_id: task.lead_id,
              activity_type: 'task_completed',
              title: 'Görev Tamamlandı',
              description: `"${task.title}" başlıklı görev tamamlandı.`
            })
          }
          if (task.customer_id) {
            await supabase.from('activities').insert({
              entity_type: 'customer',
              entity_id: task.customer_id,
              activity_type: 'task_completed',
              title: 'Görev Tamamlandı',
              description: `"${task.title}" başlıklı görev tamamlandı.`
            })
          }
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Create Task form submit
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskForm.title) {
      alert('Lütfen görev başlığını girin.')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('tasks').insert({
        title: taskForm.title,
        description: taskForm.description || null,
        task_type: taskForm.task_type,
        priority: taskForm.priority,
        status: 'pending',
        assigned_to: taskForm.assigned_to || myProfile?.id || null,
        assigned_by: myProfile?.id || null,
        due_at: taskForm.due_at ? new Date(taskForm.due_at).toISOString() : null,
        lead_id: taskForm.lead_id || null,
        customer_id: taskForm.customer_id || null,
        estimated_minutes: taskForm.estimated_minutes
      })

      if (!error) {
        setIsAddOpen(false)
        setTaskForm({
          title: '', description: '', task_type: 'general', priority: 'normal',
          assigned_to: '', due_at: '', estimated_minutes: 0,
          lead_id: '', customer_id: '', opportunity_id: ''
        })
        loadTasksList()
      } else {
        alert(error.message)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // Task type Turkish translator helper
  const translateType = (type: string) => {
    const types: Record<string, string> = {
      general: 'Genel Görev',
      call: 'Arama',
      callback: 'Geri Arama',
      meeting: 'Toplantı',
      email: 'E-posta',
      offer: 'Teklif',
      visit: 'Ziyaret'
    }
    return types[type] || type
  }

  return (
    <div className="space-y-4">
      {/* Title & Add button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Görevler</h1>
          <p className="text-xs text-muted-foreground mt-0.5">İş takip listeleri, aramalar ve şirket içi görev dağılımı.</p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="h-9 px-3.5 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 flex items-center gap-1.5 cursor-pointer shadow-sm shadow-primary/10 transition-colors"
        >
          <Plus className="h-4.5 w-4.5" />
          Yeni Görev Ekle
        </button>
      </div>

      {/* Tabs / Filter switches */}
      <div className="flex flex-wrap border-b border-border bg-card p-1 rounded-xl shadow-xs gap-1 select-none">
        <button onClick={() => setActiveTab('all')} className={`px-4 py-2 rounded-lg text-xs font-semibold ${activeTab === 'all' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-accent'}`}>Tümü</button>
        <button onClick={() => setActiveTab('my')} className={`px-4 py-2 rounded-lg text-xs font-semibold ${activeTab === 'my' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-accent'}`}>Bana Atananlar</button>
        <button onClick={() => setActiveTab('assigned')} className={`px-4 py-2 rounded-lg text-xs font-semibold ${activeTab === 'assigned' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-accent'}`}>Atadıklarım</button>
        <button onClick={() => setActiveTab('today')} className={`px-4 py-2 rounded-lg text-xs font-semibold ${activeTab === 'today' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-accent'}`}>Bugün</button>
        <button onClick={() => setActiveTab('overdue')} className={`px-4 py-2 rounded-lg text-xs font-semibold ${activeTab === 'overdue' ? 'bg-primary text-white text-destructive' : 'text-muted-foreground hover:bg-accent'}`}>Gecikenler</button>
        <button onClick={() => setActiveTab('completed')} className={`px-4 py-2 rounded-lg text-xs font-semibold ${activeTab === 'completed' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-accent'}`}>Tamamlananlar</button>
      </div>

      {/* Search field */}
      <div className="bg-card border border-border p-3 rounded-xl shadow-xs">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Görev ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-8.5 pr-3 bg-background border border-border rounded-lg text-xs focus:outline-none"
          />
        </div>
      </div>

      {/* Tasks checklist panel */}
      {loading ? (
        <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center justify-center min-h-[250px]">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground mt-3 font-medium">Görevler listeleniyor...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-sm text-muted-foreground">
          Gösterilecek aktif bir görev kaydı bulunmamaktadır.
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const isCompleted = task.status === 'completed'
            const isOverdue = !isCompleted && task.due_at && new Date(task.due_at).getTime() < Date.now()
            
            return (
              <div
                key={task.id}
                className={`p-4 bg-card border rounded-xl flex items-center justify-between shadow-xs transition-all duration-150 ${
                  isOverdue ? 'border-red-500/30 bg-red-500/5' : 'border-border'
                }`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0 pr-4">
                  {/* Task completed trigger checkbox */}
                  <button
                    onClick={() => handleToggleComplete(task)}
                    className={`h-5 w-5 shrink-0 rounded border mt-0.5 flex items-center justify-center cursor-pointer transition-colors ${
                      isCompleted ? 'bg-emerald-500 border-emerald-600 text-white' : 'border-border hover:bg-accent'
                    }`}
                  >
                    {isCompleted && <CheckCircle className="h-4 w-4" />}
                  </button>

                  <div className="min-w-0">
                    <h3 className={`text-xs font-bold text-foreground truncate ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                      {task.title}
                    </h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{task.description || 'Açıklama girilmemiş.'}</p>
                    
                    {/* Related info triggers */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2.5 text-[9px] text-muted-foreground font-semibold">
                      <span className="flex items-center gap-1">
                        <ListTodo className="h-3.5 w-3.5" />
                        {translateType(task.task_type)}
                      </span>
                      {task.due_at && (
                        <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-bold' : ''}`}>
                          <Calendar className="h-3.5 w-3.5" />
                          Son Gün: {new Date(task.due_at).toLocaleDateString('tr-TR')} {new Date(task.due_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        Sorumlu: {task.assignee?.full_name || 'Atanmamış'}
                      </span>
                      {task.leads && (
                        <span className="bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded">
                          Lead: {task.leads.first_name} {task.leads.last_name}
                        </span>
                      )}
                      {task.customers && (
                        <span className="bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded">
                          Müşteri: {task.customers.full_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-3">
                  <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded ${
                    task.priority === 'high' || task.priority === 'critical' ? 'bg-red-500/10 text-red-600 border border-red-500/25' : 'bg-blue-500/10 text-blue-600 border border-blue-500/25'
                  }`}>
                    {task.priority}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Dialog: Create Task Modal */}
      {isAddOpen && (
        <Dialog.Root open={isAddOpen} onOpenChange={setIsAddOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-md z-50 animate-in fade-in zoom-in-95 duration-150">
              <Dialog.Title className="text-base font-bold text-foreground mb-4">Yeni Görev Ekle</Dialog.Title>
              <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
                
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">GÖREV BAŞLIĞI *</label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: Özkan Lazer teklif dosyalarını ilet"
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">GÖREV AÇIKLAMASI</label>
                  <textarea
                    rows={2}
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg p-2 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">GÖREV TÜRÜ</label>
                    <select
                      value={taskForm.task_type}
                      onChange={(e) => setTaskForm({ ...taskForm, task_type: e.target.value as any })}
                      className="w-full h-9 px-2 bg-background border border-border rounded-lg"
                    >
                      <option value="general">Genel Görev</option>
                      <option value="call">Arama</option>
                      <option value="callback">Geri Arama</option>
                      <option value="meeting">Toplantı</option>
                      <option value="offer">Teklif Hazırlama</option>
                      <option value="visit">Saha Ziyareti</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">ÖNCELİK</label>
                    <select
                      value={taskForm.priority}
                      onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as any })}
                      className="w-full h-9 px-2 bg-background border border-border rounded-lg"
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
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">SORUMLU ATAYIN</label>
                    <select
                      value={taskForm.assigned_to}
                      onChange={(e) => setTaskForm({ ...taskForm, assigned_to: e.target.value })}
                      className="w-full h-9 px-2 bg-background border border-border rounded-lg"
                    >
                      <option value="">Seçiniz</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">SON TARİH</label>
                    <input
                      type="datetime-local"
                      value={taskForm.due_at}
                      onChange={(e) => setTaskForm({ ...taskForm, due_at: e.target.value })}
                      className="w-full h-9 px-3 bg-background border border-border rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">LEAD BAĞLANTISI</label>
                    <select
                      value={taskForm.lead_id}
                      onChange={(e) => setTaskForm({ ...taskForm, lead_id: e.target.value, customer_id: '' })}
                      className="w-full h-9 px-2 bg-background border border-border rounded-lg"
                    >
                      <option value="">Seçiniz</option>
                      {leads.map(l => (
                        <option key={l.id} value={l.id}>{l.first_name} {l.last_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">MÜŞTERİ BAĞLANTISI</label>
                    <select
                      value={taskForm.customer_id}
                      onChange={(e) => setTaskForm({ ...taskForm, customer_id: e.target.value, lead_id: '' })}
                      className="w-full h-9 px-2 bg-background border border-border rounded-lg"
                    >
                      <option value="">Seçiniz</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.full_name}</option>
                      ))}
                    </select>
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

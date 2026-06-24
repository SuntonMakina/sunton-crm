'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  CheckSquare, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  MessageSquare, 
  User, 
  Play, 
  Eye, 
  Loader2,
  Calendar
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'

export default function WorkspaceTasksPage() {
  const supabase = createClient()

  // State
  const [profile, setProfile] = useState<any>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'today' | 'overdue' | 'upcoming' | 'completed' | 'all'>('today')

  // Modals state
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  
  // Note/comment state
  const [commentText, setCommentText] = useState('')
  const [comments, setComments] = useState<any[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [savingComment, setSavingComment] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (prof) {
          setProfile(prof)
          fetchTasks(prof.id)
        }
      }
    }
    init()
  }, [supabase])

  const fetchTasks = async (userId: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          leads(first_name, last_name, company_name),
          customers(full_name, company_name)
        `)
        .eq('assigned_to', userId)
        .eq('is_active', true)
        .order('due_at', { ascending: true })

      if (!error && data) {
        setTasks(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Task comments load
  const loadComments = async (taskId: string) => {
    setLoadingComments(true)
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .select(`
          *,
          profiles(full_name, avatar_url)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: true })

      if (!error && data) {
        setComments(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingComments(false)
    }
  }

  // Quick Action: Complete task
  const handleCompleteTask = async (taskId: string) => {
    if (!profile) return
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', taskId)

      if (error) {
        alert(error.message)
      } else {
        fetchTasks(profile.id)
        if (selectedTask && selectedTask.id === taskId) {
          setSelectedTask({ ...selectedTask, status: 'completed' })
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Quick Action: Start task
  const handleStartTask = async (taskId: string) => {
    if (!profile) return
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'ongoing' })
        .eq('id', taskId)

      if (error) {
        alert(error.message)
      } else {
        fetchTasks(profile.id)
        if (selectedTask && selectedTask.id === taskId) {
          setSelectedTask({ ...selectedTask, status: 'ongoing' })
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Save Task Note
  const handleSaveComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTask || !commentText.trim() || !profile) return

    setSavingComment(true)
    try {
      const { error } = await supabase.from('task_comments').insert({
        task_id: selectedTask.id,
        user_id: profile.id,
        comment: commentText.trim()
      })

      if (error) {
        alert(error.message)
      } else {
        setCommentText('')
        loadComments(selectedTask.id)
      }
    } catch (err: any) {
      console.error(err)
    } finally {
      setSavingComment(false)
    }
  }

  const handleOpenDetail = (task: any) => {
    setSelectedTask(task)
    setCommentText('')
    setComments([])
    setDetailModalOpen(true)
    loadComments(task.id)
  }

  // Filters logic
  const today = new Date()
  today.setHours(0,0,0,0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const filteredTasks = tasks.filter(t => {
    const isCompleted = t.status === 'completed'
    const due = t.due_at ? new Date(t.due_at) : null

    if (activeTab === 'completed') return isCompleted
    if (isCompleted && activeTab !== 'all') return false // Skip completed in active views

    if (activeTab === 'today') {
      return due && due >= today && due < tomorrow
    }
    if (activeTab === 'overdue') {
      return due && due < today
    }
    if (activeTab === 'upcoming') {
      return due && due >= tomorrow
    }
    return true // All
  })

  // Date check helpers
  const isTaskOverdue = (task: any) => {
    if (task.status === 'completed' || !task.due_at) return false
    return new Date(task.due_at) < new Date()
  }

  return (
    <div className="space-y-6 select-none pb-8">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground">Görevlerim</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Şahsınıza atanmış olan aktif ve geçmiş görevlerin listesi.</p>
        </div>

        {/* Tab filters switcher */}
        <div className="flex flex-wrap items-center gap-1 bg-muted p-1 rounded-lg">
          {[
            { id: 'today', name: 'Bugün' },
            { id: 'overdue', name: 'Gecikenler' },
            { id: 'upcoming', name: 'Yaklaşanlar' },
            { id: 'completed', name: 'Tamamlananlar' },
            { id: 'all', name: 'Tümü' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeTab === tab.id ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      {/* Task list container */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs">Görevleriniz yükleniyor...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center text-xs text-muted-foreground">
            Seçili kategoride atanmış bir göreviniz bulunmamaktadır.
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isOverdue = isTaskOverdue(task)
            const associatedName = task.leads 
              ? `${task.leads.first_name} ${task.leads.last_name} (Lead)`
              : task.customers?.full_name || '-'

            return (
              <div 
                key={task.id} 
                className={`bg-card border rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                  isOverdue ? 'border-red-500/30 bg-red-500/[0.01]' : 'border-border'
                }`}
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-xs text-foreground">{task.title}</h3>
                    
                    <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                      task.priority === 'high' || task.priority === 'critical' 
                        ? 'bg-red-500/10 text-red-600 border border-red-500/10' 
                        : 'bg-slate-500/10 text-slate-600 border border-border'
                    }`}>
                      {task.priority || 'Normal'}
                    </span>

                    <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 bg-primary/10 text-primary rounded border border-primary/10">
                      {task.task_type === 'callback' ? 'Geri Arama' : task.task_type === 'meeting' ? 'Toplantı' : 'Görev'}
                    </span>
                  </div>

                  <p className="text-[10px] text-muted-foreground">
                    İlgili Kayıt: <span className="font-semibold text-foreground">{associatedName}</span>
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                    {task.due_at && (
                      <div className={`flex items-center gap-1 font-semibold ${isOverdue ? 'text-red-500' : ''}`}>
                        <Clock className="h-3.5 w-3.5" />
                        Son Tarih: {new Date(task.due_at).toLocaleDateString('tr-TR')} {new Date(task.due_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    <div className="flex items-center gap-1 capitalize">
                      <User className="h-3.5 w-3.5" />
                      Durum: {task.status === 'pending' ? 'Yapılacak' : task.status === 'ongoing' ? 'Yapılıyor' : 'Tamamlandı'}
                    </div>
                  </div>
                </div>

                {/* Task Operations */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => handleOpenDetail(task)}
                    className="h-8 px-3 border border-border hover:bg-accent rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Detay & Notlar
                  </button>

                  {task.status === 'pending' && (
                    <button
                      onClick={() => handleStartTask(task.id)}
                      className="h-8 px-3 bg-indigo-500 text-white hover:bg-indigo-600 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Başlat
                    </button>
                  )}

                  {task.status !== 'completed' && (
                    <button
                      onClick={() => handleCompleteTask(task.id)}
                      className="h-8 px-3.5 bg-emerald-500 text-white hover:bg-emerald-600 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Tamamla
                    </button>
                  )}
                </div>

              </div>
            )
          })
        )}
      </div>

      {/* TASK DETAIL DIALOG */}
      <Dialog.Root open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-lg z-50 animate-in fade-in zoom-in-95 duration-150 select-none max-h-[85vh] overflow-y-auto">
            <Dialog.Title className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">Görev Detayı & Notları</Dialog.Title>
            
            {selectedTask && (
              <div className="space-y-4 text-xs">
                {/* Details display */}
                <div className="p-3 bg-muted rounded-lg space-y-1">
                  <h4 className="font-bold text-foreground text-sm">{selectedTask.title}</h4>
                  <p className="text-muted-foreground">{selectedTask.description || 'Görev açıklaması belirtilmemiş.'}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 pb-3 border-b border-border">
                  <div>
                    <span className="block text-[9px] font-bold text-muted-foreground uppercase">Son Teslim Tarihi</span>
                    <span className="text-foreground block mt-0.5">
                      {selectedTask.due_at ? new Date(selectedTask.due_at).toLocaleString('tr-TR') : 'Sınırsız'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-muted-foreground uppercase">Görev Durumu</span>
                    <span className="text-foreground font-semibold block mt-0.5 capitalize">{selectedTask.status}</span>
                  </div>
                </div>

                {/* Task Notes/Comments section */}
                <div className="space-y-3">
                  <span className="block text-[9px] font-bold text-muted-foreground uppercase">Görev Notları & Geçmişi</span>
                  
                  {/* Message feed list */}
                  <div className="space-y-2 max-h-40 overflow-y-auto bg-muted/30 p-2.5 rounded-lg border border-border/50 divide-y divide-border/40">
                    {loadingComments ? (
                      <div className="text-center py-4 text-muted-foreground">Yükleniyor...</div>
                    ) : comments.length === 0 ? (
                      <div className="text-center py-4 text-slate-400 italic">Bu göreve henüz not eklenmemiş.</div>
                    ) : (
                      comments.map((c) => (
                        <div key={c.id} className="pt-2 first:pt-0 text-[11px] leading-relaxed">
                          <div className="flex justify-between items-center text-[9px] font-semibold text-slate-500 mb-0.5">
                            <span>{c.profiles?.full_name || 'CRM Yetkilisi'}</span>
                            <span>{new Date(c.created_at).toLocaleString('tr-TR')}</span>
                          </div>
                          <p className="text-foreground">{c.comment}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add note form */}
                  {selectedTask.status !== 'completed' && (
                    <form onSubmit={handleSaveComment} className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Göreve not veya gelişme ekleyin..."
                        className="flex-1 h-9 px-3 bg-background border border-border rounded-lg text-xs focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={savingComment}
                        className="h-9 px-3 bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg text-xs font-semibold cursor-pointer flex items-center justify-center shrink-0 disabled:opacity-50"
                      >
                        {savingComment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Not Ekle'}
                      </button>
                    </form>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Dialog.Close asChild>
                    <button className="px-4 py-2 border border-border hover:bg-accent rounded-lg text-xs font-semibold cursor-pointer">Kapat</button>
                  </Dialog.Close>
                  {selectedTask.status !== 'completed' && (
                    <button
                      onClick={() => handleCompleteTask(selectedTask.id)}
                      className="px-4 py-2 bg-emerald-500 text-white hover:bg-emerald-600 rounded-lg text-xs font-semibold cursor-pointer shadow-sm"
                    >
                      Görevi Tamamla
                    </button>
                  )}
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

    </div>
  )
}

'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  MessageSquare, 
  User, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  Send,
  Loader2,
  ChevronRight
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'

export default function WorkspaceMessagesPage() {
  const supabase = createClient()

  // State
  const [profile, setProfile] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Message details and replies
  const [activeMessage, setActiveMessage] = useState<any>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (prof) {
          setProfile(prof)
          fetchMessages(prof.id)
        }
      }
    }
    init()
  }, [supabase])

  const fetchMessages = async (userId: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('admin_messages')
        .select(`
          *,
          sender:sender_user_id(full_name, role)
        `)
        .or(`recipient_user_id.eq.${userId},target_type.eq.all,target_type.eq.all_call_center`)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setMessages(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenMessage = async (msg: any) => {
    setActiveMessage(msg)
    setReplyText('')
    setDetailOpen(true)

    // Mark as read if not already read
    if (!msg.is_read && msg.recipient_user_id === profile?.id) {
      try {
        const { error } = await supabase
          .from('admin_messages')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('id', msg.id)

        if (!error && profile) {
          fetchMessages(profile.id)
        }
      } catch (err) {
        console.error(err)
      }
    }
  }

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeMessage || !replyText.trim() || !profile) return

    setSendingReply(true)
    try {
      const replyContent = replyText.trim()
      
      // Send message back to the sender of the original message
      const { error } = await supabase.from('admin_messages').insert({
        sender_user_id: profile.id,
        recipient_user_id: activeMessage.sender_user_id, // Reply goes to the manager/sender
        target_type: 'user',
        title: `Re: ${activeMessage.title}`,
        content: replyContent,
        priority: 'normal'
      })

      if (error) {
        alert(error.message)
      } else {
        alert('Cevabınız başarıyla iletildi.')
        setReplyText('')
        setDetailOpen(false)
        setActiveMessage(null)
      }
    } catch (err: any) {
      console.error(err)
    } finally {
      setSendingReply(false)
    }
  }

  // Sort messages: Urgent (acil) at the top, then created_at desc
  const sortedMessages = [...messages].sort((a, b) => {
    const priorityWeight = (p: string) => p === 'urgent' ? 3 : p === 'important' ? 2 : 1
    const weightA = priorityWeight(a.priority)
    const weightB = priorityWeight(b.priority)
    
    if (weightA !== weightB) {
      return weightB - weightA // Higher priority first
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime() // Newer first
  })

  return (
    <div className="space-y-6 select-none pb-8">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground">Yönetici Mesajları</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Yönetim ve takım liderleri tarafından gönderilen bilgilendirmeler.</p>
        </div>
        <button 
          onClick={() => profile && fetchMessages(profile.id)}
          className="h-9 w-9 bg-card border border-border rounded-lg flex items-center justify-center cursor-pointer transition-colors"
          title="Yenile"
        >
          <Loader2 className="h-4 w-4 text-muted-foreground hover:text-foreground animate-spin-none" />
        </button>
      </div>

      {/* Messages Feed list */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs">Mesajlarınız yükleniyor...</p>
          </div>
        ) : sortedMessages.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center text-xs text-muted-foreground">
            Gelen kutunuzda herhangi bir mesaj veya duyuru bulunmuyor.
          </div>
        ) : (
          sortedMessages.map((msg) => {
            const isUrgent = msg.priority === 'urgent'
            const isImportant = msg.priority === 'important'
            const isUnread = !msg.is_read && msg.recipient_user_id === profile?.id
            
            return (
              <div 
                key={msg.id}
                onClick={() => handleOpenMessage(msg)}
                className={`bg-card border rounded-xl p-4 shadow-xs flex items-center justify-between gap-4 cursor-pointer transition-all hover:bg-muted/30 border-l-4 ${
                  isUrgent ? 'border-l-red-500 bg-red-500/[0.01]' :
                  isImportant ? 'border-l-amber-500 bg-amber-500/[0.01]' : 'border-l-transparent'
                }`}
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`h-2 w-2 rounded-full bg-primary shrink-0 transition-opacity ${isUnread ? 'opacity-100' : 'opacity-0'}`} />
                    <h3 className={`text-xs font-bold text-foreground truncate max-w-[200px] sm:max-w-xs ${isUnread ? 'font-extrabold' : ''}`}>{msg.title}</h3>
                    
                    {isUrgent && (
                      <span className="text-[8px] font-extrabold bg-red-500/10 text-red-600 px-1.5 py-0.5 rounded border border-red-500/10">ACİL</span>
                    )}
                    {isImportant && (
                      <span className="text-[8px] font-extrabold bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded border border-amber-500/10">ÖNEMLİ</span>
                    )}
                  </div>
                  
                  <p className="text-[10px] text-muted-foreground line-clamp-1 pr-6">{msg.content}</p>

                  <div className="flex items-center gap-3 text-[9px] text-muted-foreground font-semibold">
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      Gönderen: {msg.sender?.full_name || 'Yönetici'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(msg.created_at).toLocaleString('tr-TR')}
                    </span>
                  </div>
                </div>

                <div className="text-muted-foreground">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* MESSAGE DETAIL & REPLY DIALOG */}
      <Dialog.Root open={detailOpen} onOpenChange={setDetailOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-lg z-50 animate-in fade-in zoom-in-95 duration-150 select-none max-h-[85vh] overflow-y-auto">
            
            {activeMessage && (
              <div className="space-y-4 text-xs">
                {/* Header info */}
                <div className="p-3 bg-muted rounded-lg space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-bold text-muted-foreground uppercase">Gönderen: {activeMessage.sender?.full_name || 'Yönetici'}</span>
                    <span className="text-[8px] text-muted-foreground">{new Date(activeMessage.created_at).toLocaleString('tr-TR')}</span>
                  </div>
                  <h4 className="font-bold text-foreground text-sm mt-1">{activeMessage.title}</h4>
                </div>

                {/* Content */}
                <p className="p-4 bg-muted/30 border border-border rounded-lg text-foreground text-xs leading-relaxed whitespace-pre-wrap">
                  {activeMessage.content}
                </p>

                {/* Reply section */}
                {activeMessage.sender_user_id && (
                  <form onSubmit={handleSendReply} className="space-y-3 pt-3 border-t border-border">
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Kısa Cevap Yaz</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Yöneticiye iletilecek kısa bir cevap yazın..."
                        className="flex-1 h-9 px-3.5 bg-background border border-border rounded-lg text-xs focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={sendingReply}
                        className="h-9 px-3 bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg text-xs font-semibold cursor-pointer flex items-center justify-center gap-1 shrink-0 disabled:opacity-50"
                      >
                        {sendingReply ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Gönder
                      </button>
                    </div>
                  </form>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Dialog.Close asChild>
                    <button className="px-4 py-2 border border-border hover:bg-accent rounded-lg text-xs font-semibold cursor-pointer">Kapat</button>
                  </Dialog.Close>
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

    </div>
  )
}

'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatLeadId } from '@/lib/utils'
import {
  MessageSquare,
  Send,
  Loader2,
  Phone,
  Mail,
  User,
  Building,
  Info,
  Plus,
  AlertTriangle,
  CheckCircle,
  Eye,
  Trash2
} from 'lucide-react'

function renderMessageContent(content: string) {
  if (!content) return null

  if (content.startsWith('[IMAGE]:')) {
    const mediaPart = content.substring(8)
    const pipeIndex = mediaPart.indexOf('|')
    let url = mediaPart
    let caption = ''
    if (pipeIndex !== -1) {
      url = mediaPart.substring(0, pipeIndex)
      caption = mediaPart.substring(pipeIndex + 1)
    }
    return (
      <div className="space-y-1.5 max-w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src={url} 
          alt="WhatsApp Görsel" 
          className="rounded-lg max-w-xs max-h-60 object-cover border border-border/50 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => window.open(url, '_blank')}
        />
        {caption && <p className="font-semibold whitespace-pre-wrap">{caption}</p>}
      </div>
    )
  }

  if (content.startsWith('[AUDIO]:')) {
    const url = content.substring(8)
    return (
      <div className="py-1 min-w-[240px]">
        <audio src={url} controls className="w-full max-w-xs outline-hidden" />
      </div>
    )
  }

  return <span className="whitespace-pre-wrap">{content}</span>
}

export default function MessagesPage() {
  const supabase = createClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auth & Profile
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [profiles, setProfiles] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])

  // Existing thread messaging states
  const [conversations, setConversations] = useState<any[]>([])
  const [matchingLeads, setMatchingLeads] = useState<Record<string, any>>({})
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [loadingConv, setLoadingConv] = useState(true)
  const [loadingMsg, setLoadingMsg] = useState(false)
  const [newMessageText, setNewMessageText] = useState('')

  // Tab channels: 'all' | 'internal' | 'whatsapp' | 'admin_announcements'
  const [activeChannel, setActiveChannel] = useState<'all' | 'internal' | 'whatsapp' | 'admin_announcements'>('all')

  // Admin Broadcast / Message composition states
  const [adminMessagesList, setAdminMessagesList] = useState<any[]>([])
  const [selectedAdminMsg, setSelectedAdminMsg] = useState<any>(null)
  const [loadingAdminMsg, setLoadingAdminMsg] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [savingAdminMsg, setSavingAdminMsg] = useState(false)

  // Compose form fields
  const [composeForm, setComposeForm] = useState({
    targetType: 'all', // all, all_call_center, department, user
    recipientUserId: '',
    targetDepartmentId: '',
    title: '',
    content: '',
    priority: 'normal', // normal, important, urgent
    relatedEntityType: '', // '', lead, task
    relatedEntityId: ''
  })

  // Load auth, lookup profiles, and initial threads list
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUser(user)
      }
      loadConversations()
      loadAdminLookups()
      loadAdminMessages()
    }
    init()
  }, [supabase])

  useEffect(() => {
    const channel = supabase
      .channel('messages_page_conversations_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations'
        },
        () => {
          loadConversations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const loadConversations = async () => {
    setLoadingConv(true)
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          leads(id, first_name, last_name, company_name, phone, phone_normalized, email, lead_number, status_id, avatar_url),
          customers(full_name, type, company_name, phone, email, customer_number)
        `)
        .order('last_message_at', { ascending: false })

      if (!error && data) {
        const excludedSalesPhones = new Set([
          '905335745839',
          '905416003432',
          '905061122350',
          '905452733802',
          '905366507583',
          '905070471333',
          '905379527983',
          '905345743401',
          '905379527977'
        ])

        const filteredData = data.filter((c: any) => {
          const phone = c.leads?.phone_normalized || (c.leads?.phone ? c.leads.phone.replace(/\D/g, '') : '') ||
                        c.customers?.phone?.replace(/\D/g, '') || ''
          return !excludedSalesPhones.has(phone)
        })

        // Fetch matching registered leads by phone for raw chats
        const rawChatPhones = filteredData
          .filter((c: any) => c.leads?.status_id === '22222222-0000-0000-0000-000000000020')
          .map((c: any) => c.leads.phone_normalized || c.leads.phone?.replace(/\D/g, ''))
          .filter(Boolean)

        const matchedLeadsMap: Record<string, any> = {}
        if (rawChatPhones.length > 0) {
          const { data: matches } = await supabase
            .from('leads')
            .select('id, lead_number, legacy_lead_id, first_name, last_name, phone_normalized, status_id')
            .in('phone_normalized', rawChatPhones)
            .neq('status_id', '22222222-0000-0000-0000-000000000020')
            .eq('is_active', true)

          if (matches) {
            matches.forEach((m: any) => {
              if (!matchedLeadsMap[m.phone_normalized] || m.lead_number) {
                matchedLeadsMap[m.phone_normalized] = m
              }
            })
          }
        }
        setMatchingLeads(matchedLeadsMap)
        setConversations(filteredData)
        if (filteredData.length > 0 && !activeConvId) {
          setActiveConvId(filteredData[0].id)
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingConv(false)
    }
  }

  const loadAdminLookups = async () => {
    try {
      const { data: profs } = await supabase.from('profiles').select('id, full_name, role, is_active').eq('is_active', true)
      const { data: depts } = await supabase.from('departments').select('id, name')
      if (profs) setProfiles(profs)
      if (depts) setDepartments(depts)
    } catch (err) {
      console.error(err)
    }
  }

  const loadAdminMessages = async () => {
    setLoadingAdminMsg(true)
    try {
      const { data, error } = await supabase
        .from('admin_messages')
        .select(`
          *,
          sender:sender_user_id(full_name),
          recipient:recipient_user_id(full_name),
          department:target_department_id(name)
        `)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setAdminMessagesList(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingAdminMsg(false)
    }
  }

  // Load messages for chosen conversation thread
  useEffect(() => {
    if (!activeConvId || activeChannel === 'admin_announcements') return

    async function loadMessages() {
      setLoadingMsg(true)
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', activeConvId)
          .order('sent_at', { ascending: true })

        if (!error && data) {
          setMessages(data)
          scrollToBottom()
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingMsg(false)
      }
    }

    loadMessages()

    const active = conversations.find(c => c.id === activeConvId)
    if (active?.leads && !active.leads.avatar_url) {
      fetch('http://localhost:3001/fetch-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: active.leads.phone })
      }).catch(err => console.error('Failed to trigger avatar fetch:', err))
    }

    const channel = supabase
      .channel(`room:${activeConvId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${activeConvId}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new])
        scrollToBottom()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeConvId, activeChannel, conversations, supabase])

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  // Send standard conversation thread message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessageText.trim() || !activeConvId || !currentUser) return

    const messageText = newMessageText.trim()
    setNewMessageText('')

    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: activeConvId,
        sender_type: 'user',
        sender_user_id: currentUser.id,
        direction: 'outgoing',
        channel: conversations.find(c => c.id === activeConvId)?.channel || 'internal',
        content: messageText
      })

      if (error) {
        alert(error.message)
      } else {
        await supabase
          .from('conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', activeConvId)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Send/Publish Admin broadcast message
  const handleSendAdminBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser || !composeForm.title || !composeForm.content) return

    setSavingAdminMsg(true)
    try {
      const payload: any = {
        sender_user_id: currentUser.id,
        target_type: composeForm.targetType,
        title: composeForm.title,
        content: composeForm.content,
        priority: composeForm.priority,
        related_entity_type: composeForm.relatedEntityType || null,
        related_entity_id: composeForm.relatedEntityId || null
      }

      if (composeForm.targetType === 'user') {
        payload.recipient_user_id = composeForm.recipientUserId
      } else if (composeForm.targetType === 'department') {
        payload.target_department_id = composeForm.targetDepartmentId
      }

      const { error } = await supabase.from('admin_messages').insert(payload)

      if (error) {
        alert(error.message)
      } else {
        alert('Yönetici mesajı başarıyla yayınlandı/gönderildi.')
        setComposeOpen(false)
        setComposeForm({
          targetType: 'all',
          recipientUserId: '',
          targetDepartmentId: '',
          title: '',
          content: '',
          priority: 'normal',
          relatedEntityType: '',
          relatedEntityId: ''
        })
        loadAdminMessages()
      }
    } catch (err: any) {
      alert('Mesaj gönderilemedi: ' + err.message)
    } finally {
      setSavingAdminMsg(false)
    }
  }

  // Delete Admin message
  const handleDeleteAdminMessage = async (msgId: string) => {
    if (!confirm('Bu yönetici duyurusunu silmek istediğinize emin misiniz?')) return
    try {
      const { error } = await supabase.from('admin_messages').delete().eq('id', msgId)
      if (error) {
        alert(error.message)
      } else {
        setSelectedAdminMsg(null)
        loadAdminMessages()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const filteredConversations = conversations.filter(c => {
    if (activeChannel === 'all') return true
    return c.channel === activeChannel
  })

  const activeConv = conversations.find(c => c.id === activeConvId)
  
  let clientName = ''
  if (activeConv) {
    if (activeConv.leads) {
      const isRawChat = activeConv.leads.status_id === '22222222-0000-0000-0000-000000000020'
      const matched = isRawChat ? matchingLeads[activeConv.leads.phone_normalized] : null
      const displayLead = matched || activeConv.leads

      if (isRawChat && !matched) {
        clientName = activeConv.leads.phone || '-'
      } else {
        clientName = `${displayLead.first_name || ''} ${displayLead.last_name || ''}`.trim()
        if (!clientName || clientName.includes('Yeni Müşteri') || clientName.includes('Müşterisi') || clientName === 'WhatsApp Müşterisi' || clientName === 'WhatsApp') {
          clientName = displayLead.phone || clientName
        }
      }
    } else {
      clientName = activeConv.customers?.full_name || '-'
    }
  }
  const clientPhone = activeConv
    ? activeConv.leads
      ? activeConv.leads.phone
      : activeConv.customers?.phone || '-'
    : ''
  const clientEmail = activeConv
    ? activeConv.leads
      ? activeConv.leads.email
      : activeConv.customers?.email || '-'
    : ''

  return (
    <div className="h-[calc(100vh-120px)] border border-border bg-card rounded-xl shadow-xs flex overflow-hidden select-none">
      
      {/* 1. Left Side: Channels & Thread/Announcement list */}
      <div className="w-80 border-r border-border flex flex-col justify-between shrink-0">
        
        {/* Top Header Filter Switch */}
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex bg-muted rounded-lg p-0.5 text-[10px] font-bold">
            <button onClick={() => setActiveChannel('all')} className={`flex-1 py-1.5 rounded-md ${activeChannel === 'all' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`}>Tümü</button>
            <button onClick={() => setActiveChannel('internal')} className={`flex-1 py-1.5 rounded-md ${activeChannel === 'internal' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`}>İç Mesaj</button>
            <button onClick={() => setActiveChannel('whatsapp')} className={`flex-1 py-1.5 rounded-md ${activeChannel === 'whatsapp' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`}>WhatsApp</button>
            <button onClick={() => {
              setActiveChannel('admin_announcements')
              setSelectedAdminMsg(null)
            }} className={`flex-1 py-1.5 rounded-md truncate ${activeChannel === 'admin_announcements' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`}>Yönetici</button>
          </div>
        </div>

        {/* List selection */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/60">
          {activeChannel === 'admin_announcements' ? (
            /* Admin messages broadcast lists */
            loadingAdminMsg ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : adminMessagesList.length === 0 ? (
              <p className="text-center py-12 text-xs text-muted-foreground">Gönderilmiş yönetici mesajı bulunmuyor.</p>
            ) : (
              adminMessagesList.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => {
                    setSelectedAdminMsg(msg)
                    setComposeOpen(false)
                  }}
                  className={`w-full text-left p-3.5 flex flex-col gap-1 transition-colors cursor-pointer ${
                    selectedAdminMsg?.id === msg.id ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-muted/40'
                  }`}
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-foreground truncate max-w-[130px]">{msg.title}</span>
                    <span className="text-[9px] text-muted-foreground">
                      {new Date(msg.created_at).toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                    <span className="capitalize font-semibold text-primary">
                      Hedef: {msg.target_type === 'all' ? 'Tümü' : msg.target_type === 'all_call_center' ? 'Temsilciler' : msg.recipient?.full_name || msg.department?.name || 'Grup'}
                    </span>
                    <span className={`text-[8px] font-extrabold uppercase px-1 rounded ${
                      msg.priority === 'urgent' ? 'bg-red-500/10 text-red-600' : 'bg-slate-500/10 text-slate-600'
                    }`}>
                      {msg.priority}
                    </span>
                  </div>
                </button>
              ))
            )
          ) : (
            /* Standard CRM chat conversations list */
            loadingConv ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <p className="text-center py-12 text-xs text-muted-foreground">Kayıtlı mesajlaşma bulunmuyor.</p>
            ) : (
              filteredConversations.map((c) => {
                const isRawChat = c.leads?.status_id === '22222222-0000-0000-0000-000000000020'
                const matched = isRawChat && c.leads ? matchingLeads[c.leads.phone_normalized] : null
                const displayLead = matched || c.leads

                let name = ''
                if (c.leads) {
                  if (isRawChat && !matched) {
                    name = c.leads.phone
                  } else {
                    name = `${displayLead.first_name || ''} ${displayLead.last_name || ''}`.trim()
                    if (!name || name.includes('Yeni Müşteri') || name.includes('Müşterisi') || name === 'WhatsApp Müşterisi' || name === 'WhatsApp') {
                      name = displayLead.phone || name
                    }
                  }
                } else {
                  name = c.customers?.full_name || 'Bilinmeyen'
                }

                const num = (isRawChat && !matched) ? '' : (displayLead?.lead_number || c.customers?.customer_number || '')
                const isSelected = c.id === activeConvId
                const hasLeadNumber = !(isRawChat && !matched) && displayLead?.lead_number
                const formattedId = hasLeadNumber ? formatLeadId(displayLead.lead_number) : ''
                
                return (
                  <button
                    key={c.id}
                    onClick={async () => {
                      setActiveConvId(c.id)
                      if (c.unread_count > 0) {
                        try {
                          await supabase
                            .from('conversations')
                            .update({ unread_count: 0 })
                            .eq('id', c.id)
                          loadConversations()
                        } catch (err) {
                          console.error(err)
                        }
                      }
                    }}
                    className={`w-full text-left p-3.5 flex items-center gap-3 transition-colors cursor-pointer border-l-4 ${
                      isSelected 
                        ? 'bg-primary/5 border-l-primary' 
                        : c.unread_count > 0
                          ? 'bg-blue-50/70 dark:bg-blue-950/20 border-l-blue-500 font-bold'
                          : 'border-l-transparent hover:bg-muted/40'
                    }`}
                  >
                    {/* Avatar */}
                    {c.leads?.avatar_url ? (
                      <img src={c.leads.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="h-9 w-9 bg-primary/10 text-primary rounded-full flex items-center justify-center shrink-0">
                        <User className="h-4.5 w-4.5" />
                      </div>
                    )}

                    {/* Text Details */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        {c.leads ? (
                          isRawChat && !matched ? (
                            <span className="flex items-center gap-1.5 truncate">
                              <span className="font-bold text-foreground truncate max-w-[140px]">{name}</span>
                            </span>
                          ) : hasLeadNumber ? (
                            <span className="flex items-center gap-1.5 truncate">
                              <span className="px-1.5 py-0.5 text-[8px] font-black bg-amber-500/10 text-amber-600 rounded border border-amber-500/20 uppercase tracking-wider shrink-0">{formattedId}</span>
                              <span className="font-bold text-foreground truncate max-w-[140px]">{name}</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 truncate">
                              <span className="font-bold text-foreground truncate max-w-[140px]">{name}</span>
                            </span>
                          )
                        ) : (
                          <span className="font-bold text-foreground truncate max-w-[140px]">{name}</span>
                        )}
                        <span className={`text-[9px] ${c.unread_count > 0 ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-muted-foreground'}`}>
                          {new Date(c.last_message_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                        <span className="font-mono text-muted-foreground/75">{num}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {c.unread_count > 0 && (
                            <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                          )}
                          <span className="capitalize font-semibold text-primary">{c.channel === 'internal' ? 'İç Görüşme' : c.channel}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })
            )
          )}
        </div>

        {/* Compose admin message trigger inside sidebar bottom */}
        {activeChannel === 'admin_announcements' && (
          <div className="p-3 border-t border-border">
            <button
              onClick={() => {
                setComposeOpen(true)
                setSelectedAdminMsg(null)
              }}
              className="w-full h-9 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
            >
              <Plus className="h-4 w-4" />
              Yönetici Mesajı Yayınla
            </button>
          </div>
        )}
      </div>

      {/* 2. Center: Chat detail OR Compose admin message */}
      <div className="flex-1 flex flex-col bg-muted/15 overflow-hidden">
        {activeChannel === 'admin_announcements' ? (
          /* Admin announcements / Messages compose panel or details panel */
          composeOpen ? (
            /* Compose Form Panel */
            <form onSubmit={handleSendAdminBroadcast} className="p-6 space-y-4 max-w-lg mx-auto w-full text-xs">
              <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">Yeni Yönetici Mesajı / Duyuru Yayınla</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Hedef Tipi</label>
                  <select
                    value={composeForm.targetType}
                    onChange={(e) => setComposeForm({ ...composeForm, targetType: e.target.value })}
                    className="w-full h-9 px-3 bg-background border border-border rounded-lg"
                  >
                    <option value="all">Tüm Kullanıcılar (Sistem)</option>
                    <option value="all_call_center">Tüm Call Center Temsilcileri</option>
                    <option value="department">Belirli Departman</option>
                    <option value="user">Özel Kullanıcı (Personel)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Öncelik Derecesi</label>
                  <select
                    value={composeForm.priority}
                    onChange={(e) => setComposeForm({ ...composeForm, priority: e.target.value })}
                    className="w-full h-9 px-3 bg-background border border-border rounded-lg"
                  >
                    <option value="normal">Normal</option>
                    <option value="important">Önemli</option>
                    <option value="urgent">Acil / Kritik</option>
                  </select>
                </div>
              </div>

              {/* Conditional selects */}
              {composeForm.targetType === 'user' && (
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Alıcı Temsilci</label>
                  <select
                    required
                    value={composeForm.recipientUserId}
                    onChange={(e) => setComposeForm({ ...composeForm, recipientUserId: e.target.value })}
                    className="w-full h-9 px-3 bg-background border border-border rounded-lg cursor-pointer"
                  >
                    <option value="" disabled>Temsilci seçin...</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>
                    ))}
                  </select>
                </div>
              )}

              {composeForm.targetType === 'department' && (
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Alıcı Departman</label>
                  <select
                    required
                    value={composeForm.targetDepartmentId}
                    onChange={(e) => setComposeForm({ ...composeForm, targetDepartmentId: e.target.value })}
                    className="w-full h-9 px-3 bg-background border border-border rounded-lg cursor-pointer"
                  >
                    <option value="" disabled>Departman seçin...</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Mesaj Başlığı</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Günlük Arama Hedefleri ve Performans Değerlendirmesi"
                  value={composeForm.title}
                  onChange={(e) => setComposeForm({ ...composeForm, title: e.target.value })}
                  className="w-full h-9 px-3 bg-background border border-border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Mesaj İçeriği</label>
                <textarea
                  required
                  placeholder="Personellere iletilecek genel talimatları veya duyuru metnini buraya yazın..."
                  rows={4}
                  value={composeForm.content}
                  onChange={(e) => setComposeForm({ ...composeForm, content: e.target.value })}
                  className="w-full p-3 bg-background border border-border rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setComposeOpen(false)}
                  className="h-9 px-4.5 border border-border hover:bg-accent rounded-lg font-semibold cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={savingAdminMsg}
                  className="h-9 px-4.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingAdminMsg && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Mesajı Yayınla
                </button>
              </div>
            </form>
          ) : selectedAdminMsg ? (
            /* Admin message Detail view with delivery tracking */
            <div className="p-6 space-y-4 max-w-xl mx-auto w-full text-xs">
              <div className="flex justify-between items-start border-b border-border pb-3">
                <div>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">Gönderilen Yönetici Mesajı Detayı</span>
                  <h3 className="font-extrabold text-foreground text-sm mt-1">{selectedAdminMsg.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteAdminMessage(selectedAdminMsg.id)}
                  className="h-8 w-8 text-destructive hover:bg-destructive/10 border border-transparent rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                  title="Sil"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="p-4 bg-card border border-border rounded-xl shadow-xs leading-relaxed text-foreground whitespace-pre-wrap">
                {selectedAdminMsg.content}
              </div>

              <div className="grid grid-cols-3 gap-3 text-[10px] text-muted-foreground">
                <div>
                  <span className="block font-bold">Yayın Tarihi</span>
                  <span className="text-foreground font-semibold">{new Date(selectedAdminMsg.created_at).toLocaleString('tr-TR')}</span>
                </div>
                <div>
                  <span className="block font-bold">Öncelik</span>
                  <span className={`text-foreground font-semibold uppercase ${selectedAdminMsg.priority === 'urgent' ? 'text-red-500 font-bold' : ''}`}>
                    {selectedAdminMsg.priority}
                  </span>
                </div>
                <div>
                  <span className="block font-bold">Alıcı / Kitle</span>
                  <span className="text-foreground font-semibold">
                    {selectedAdminMsg.target_type === 'all' ? 'Tüm Sistem' : selectedAdminMsg.target_type === 'all_call_center' ? 'Temsilciler' : selectedAdminMsg.recipient?.full_name || selectedAdminMsg.department?.name}
                  </span>
                </div>
              </div>

              {/* Delivery read log tracking */}
              {selectedAdminMsg.target_type === 'user' && (
                <div className="pt-3 border-t border-border/60">
                  <span className="block font-bold text-[9px] text-muted-foreground uppercase mb-1">Okunma Durumu (Delivery Tracking)</span>
                  {selectedAdminMsg.is_read ? (
                    <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                      <CheckCircle className="h-4 w-4" />
                      <span>Okundu: {new Date(selectedAdminMsg.read_at).toLocaleString('tr-TR')}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-slate-400 font-medium">
                      <Eye className="h-4 w-4" />
                      <span>Henüz okunmadı (Beklemede)</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Empty selection placeholder */
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-xs">Detayları görmek için sol listeden gönderilmiş bir yönetici mesajını seçin veya yenisini oluşturun.</p>
            </div>
          )
        ) : (
          /* Normal leads/customers chat messages view */
          activeConvId ? (
            <>
              {/* Header info bar */}
              <div className="h-14 border-b border-border bg-card px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  {(() => {
                    if (!activeConv?.leads) {
                      return <span className="font-bold text-xs text-foreground">{clientName}</span>
                    }

                    const isRawChat = activeConv.leads.status_id === '22222222-0000-0000-0000-000000000020'
                    const matched = isRawChat ? matchingLeads[activeConv.leads.phone_normalized] : null
                    const displayLead = matched || activeConv.leads

                    if (isRawChat && !matched) {
                      return (
                        <>
                          <span className="font-bold text-xs text-foreground">{clientName}</span>
                        </>
                      )
                    } else {
                      const hasLeadNumber = displayLead.lead_number || displayLead.legacy_lead_id
                      const formattedId = formatLeadId(displayLead.legacy_lead_id || displayLead.lead_number)
                      return (
                        <>
                          {hasLeadNumber && (
                            <span className="px-2 py-0.5 text-[9px] font-black bg-amber-500/10 text-amber-600 rounded-md border border-amber-500/20 uppercase tracking-wider">
                              {formattedId}
                            </span>
                          )}
                          <span className="font-bold text-xs text-foreground">{clientName}</span>
                          <Link 
                            href={`/workspace?tab=totalIncoming&id=${displayLead.id}`}
                            className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded border border-border flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            📂 Aday Kartına Git
                          </Link>
                        </>
                      )
                    }
                  })()}
                </div>
                
                {activeConv?.channel !== 'internal' && (
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Yakında (Bağlantı Yok)
                  </span>
                )}
              </div>

              {/* Messages body scrolling */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMsg ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-xs text-muted-foreground py-10">Mesaj geçmişi bulunmuyor. İlk mesajı siz yazın.</div>
                ) : (
                  messages.map((m) => {
                    const isOwn = m.sender_type === 'user' && m.sender_user_id === currentUser?.id
                    return (
                      <div
                        key={m.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] p-3 rounded-xl text-xs leading-relaxed ${
                            isOwn 
                              ? 'bg-primary text-primary-foreground rounded-tr-none shadow-xs' 
                              : 'bg-card border border-border text-foreground rounded-tl-none shadow-xs'
                          }`}
                        >
                          <div className="font-medium">{renderMessageContent(m.content)}</div>
                          <span className={`block text-[9px] text-right mt-1.5 ${isOwn ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}>
                            {new Date(m.sent_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message input footer form */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-border bg-card flex gap-2 shrink-0">
                <input
                  type="text"
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  placeholder="Mesajınızı yazın..."
                  className="flex-1 h-9 px-3.5 bg-background border border-border rounded-lg text-xs focus:outline-none"
                />
                <button
                  type="submit"
                  className="h-9 w-9 bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg flex items-center justify-center cursor-pointer transition-colors shadow-xs"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-xs">Görüşmeleri ve mesajları yüklemek için sol listeden bir başlık seçin.</p>
            </div>
          )
        )}
      </div>

      {/* 3. Right Side: Müşteri / Lead 360° summary side card */}
      {activeConvId && activeConv && activeChannel !== 'admin_announcements' && (
        <div className="w-64 border-l border-border bg-card p-5 overflow-y-auto hidden xl:block select-none">
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-4 border-b border-border pb-1.5">Müşteri Detayı</h3>
          
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-2">
              {activeConv.leads?.avatar_url ? (
                <img src={activeConv.leads.avatar_url} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="h-9 w-9 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
                  <User className="h-4.5 w-4.5" />
                </div>
              )}
              <div>
                <h4 className="font-bold text-foreground truncate max-w-[150px]">{clientName}</h4>
                {(() => {
                  if (!activeConv.leads) {
                    return (
                      <span className="text-[9px] font-semibold text-muted-foreground uppercase font-mono">
                        {activeConv.customers?.customer_number}
                      </span>
                    )
                  }

                  const isRawChat = activeConv.leads.status_id === '22222222-0000-0000-0000-000000000020'
                  const matched = isRawChat ? matchingLeads[activeConv.leads.phone_normalized] : null
                  const displayLead = matched || activeConv.leads

                  if (isRawChat && !matched) {
                    return null // No ID badge
                  }

                  const hasLeadNumber = displayLead.lead_number || displayLead.legacy_lead_id
                  const formattedId = formatLeadId(displayLead.legacy_lead_id || displayLead.lead_number)
                  return hasLeadNumber ? (
                    <span className="text-[9px] font-semibold text-muted-foreground uppercase font-mono">
                      {formattedId}
                    </span>
                  ) : null
                })()}
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-border/60">
              <div>
                <span className="text-[9px] font-bold text-muted-foreground uppercase">Telefon</span>
                <a href={`tel:${clientPhone}`} className="text-primary hover:underline flex items-center gap-1 mt-0.5">
                  <Phone className="h-3.5 w-3.5" />
                  {clientPhone}
                </a>
              </div>
              <div>
                <span className="text-[9px] font-bold text-muted-foreground uppercase">E-Posta</span>
                <p className="font-medium text-foreground mt-0.5 truncate">{clientEmail}</p>
              </div>
              {activeConv.leads && (
                <div>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">Ürün İlgisi</span>
                  <p className="font-semibold text-foreground mt-0.5">{activeConv.leads.requested_product || '-'}</p>
                </div>
              )}
              {(() => {
                if (!activeConv.leads) return null
                const isRawChat = activeConv.leads.status_id === '22222222-0000-0000-0000-000000000020'
                const matched = isRawChat ? matchingLeads[activeConv.leads.phone_normalized] : null
                const displayLead = matched || activeConv.leads

                if (isRawChat && !matched) return null

                return (
                  <div className="pt-2">
                    <Link 
                      href={`/workspace?tab=totalIncoming&id=${displayLead.id}`}
                      className="w-full h-8 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded border border-border flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-[10px] font-bold"
                    >
                      📂 Aday Kartına Git
                    </Link>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

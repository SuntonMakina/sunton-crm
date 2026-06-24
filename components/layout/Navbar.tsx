'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/components/shared/ThemeProvider'
import { Profile, Notification } from '@/types/crm'
import {
  Search,
  Plus,
  Bell,
  Sun,
  Moon,
  LogOut,
  User,
  Settings as SettingsIcon,
  Shield,
  Loader2,
  Menu,
  X,
  FileText,
  Briefcase,
  CheckSquare
} from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Dialog from '@radix-ui/react-dialog'

interface NavbarProps {
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  profile: Profile | null
}

export default function Navbar({ sidebarCollapsed, setSidebarCollapsed, profile }: NavbarProps) {
  const router = useRouter()
  const supabase = createClient()
  const { theme, toggleTheme } = useTheme()

  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationsLoading, setNotificationsLoading] = useState(false)

  // Quick action modal states
  const [isQuickLeadOpen, setIsQuickLeadOpen] = useState(false)
  const [isQuickCustomerOpen, setIsQuickCustomerOpen] = useState(false)
  const [isQuickTaskOpen, setIsQuickTaskOpen] = useState(false)

  // Quick form fields
  const [leadForm, setLeadForm] = useState({ firstName: '', lastName: '', phone: '', company: '', product: '' })
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', email: '', type: 'individual' as 'individual' | 'corporate' })
  const [taskForm, setTaskForm] = useState({ title: '', type: 'general', priority: 'normal', dueAt: '' })
  const [actionLoading, setActionLoading] = useState(false)

  // Fetch Notifications
  useEffect(() => {
    if (!profile) return

    async function loadNotifications() {
      setNotificationsLoading(true)
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', profile!.id)
          .order('created_at', { ascending: false })
          .limit(10)
        
        if (!error && data) {
          setNotifications(data as Notification[])
          setUnreadCount(data.filter(n => !n.is_read).length)
        }
      } catch (err) {
        console.error('Error fetching notifications:', err)
      } finally {
        setNotificationsLoading(false)
      }
    }

    loadNotifications()

    // Realtime notifications listener
    const channel = supabase
      .channel('public:notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`
      }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev.slice(0, 9)])
        setUnreadCount(prev => prev + 1)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile, supabase])

  // Mark all as read
  const handleMarkAllRead = async () => {
    if (!profile) return
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', profile.id)
        .eq('is_read', false)

      if (!error) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
        setUnreadCount(0)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Global search implementation (leads, customers, opportunities)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results: any[] = []
        const query = searchQuery.trim()

        // 1. Search leads
        const { data: leads } = await supabase
          .from('leads')
          .select('id, lead_number, first_name, last_name, company_name, phone')
          .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,company_name.ilike.%${query}%,lead_number.ilike.%${query}%,phone.ilike.%${query}%`)
          .limit(3)
        if (leads) {
          leads.forEach(l => results.push({ id: l.id, type: 'lead', title: `${l.first_name} ${l.last_name}`, subtitle: l.company_name || 'Şahıs', number: l.lead_number, url: `/dashboard/leads?id=${l.id}` }))
        }

        // 2. Search customers
        const { data: customers } = await supabase
          .from('customers')
          .select('id, customer_number, full_name, company_name, phone')
          .or(`full_name.ilike.%${query}%,company_name.ilike.%${query}%,customer_number.ilike.%${query}%,phone.ilike.%${query}%`)
          .limit(3)
        if (customers) {
          customers.forEach(c => results.push({ id: c.id, type: 'customer', title: c.full_name || c.company_name, subtitle: c.company_name || 'Bireysel Müşteri', number: c.customer_number, url: `/dashboard/customers?id=${c.id}` }))
        }

        // 3. Search opportunities
        const { data: opportunities } = await supabase
          .from('opportunities')
          .select('id, opportunity_number, title, amount')
          .or(`title.ilike.%${query}%,opportunity_number.ilike.%${query}%`)
          .limit(3)
        if (opportunities) {
          opportunities.forEach(o => results.push({ id: o.id, type: 'opportunity', title: o.title, subtitle: `${o.amount.toLocaleString('tr-TR')} TRY`, number: o.opportunity_number, url: `/dashboard/pipeline?id=${o.id}` }))
        }

        setSearchResults(results)
      } catch (err) {
        console.error(err)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, supabase])

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Quick Lead Add
  const handleQuickLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!leadForm.firstName || !leadForm.lastName || !leadForm.phone) return
    setActionLoading(true)
    try {
      const { error } = await supabase.from('leads').insert({
        first_name: leadForm.firstName,
        last_name: leadForm.lastName,
        phone: leadForm.phone,
        phone_normalized: leadForm.phone.replace(/\D/g, ''),
        company_name: leadForm.company || null,
        requested_product: leadForm.product || null,
        created_by: profile?.id,
        status_id: 'ls000000-0000-0000-0000-000000000001' // Yeni Lead
      })

      if (!error) {
        setIsQuickLeadOpen(false)
        setLeadForm({ firstName: '', lastName: '', phone: '', company: '', product: '' })
        router.refresh()
      } else {
        alert(error.message)
      }
    } catch (err: any) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  // Quick Customer Add
  const handleQuickCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerForm.name) return
    setActionLoading(true)
    try {
      const { error } = await supabase.from('customers').insert({
        type: customerForm.type,
        full_name: customerForm.name,
        company_name: customerForm.type === 'corporate' ? customerForm.name : null,
        first_name: customerForm.type === 'individual' ? customerForm.name.split(' ')[0] : null,
        last_name: customerForm.type === 'individual' ? customerForm.name.split(' ')[1] || '' : null,
        phone: customerForm.phone || null,
        phone_normalized: customerForm.phone ? customerForm.phone.replace(/\D/g, '') : null,
        email: customerForm.email || null,
        created_by: profile?.id
      })

      if (!error) {
        setIsQuickCustomerOpen(false)
        setCustomerForm({ name: '', phone: '', email: '', type: 'individual' })
        router.refresh()
      } else {
        alert(error.message)
      }
    } catch (err: any) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  // Quick Task Add
  const handleQuickTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskForm.title) return
    setActionLoading(true)
    try {
      const { error } = await supabase.from('tasks').insert({
        title: taskForm.title,
        task_type: taskForm.type,
        priority: taskForm.priority,
        status: 'pending',
        due_at: taskForm.dueAt ? new Date(taskForm.dueAt).toISOString() : null,
        assigned_to: profile?.id,
        created_by: profile?.id
      })

      if (!error) {
        setIsQuickTaskOpen(false)
        setTaskForm({ title: '', type: 'general', priority: 'normal', dueAt: '' })
        router.refresh()
      } else {
        alert(error.message)
      }
    } catch (err: any) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  // Role display translator
  const translateRole = (role: string) => {
    const roles: Record<string, string> = {
      super_admin: 'Süper Yönetici',
      admin: 'Yönetici',
      team_leader: 'Takım Lideri',
      call_center_rep: 'Temsilci (CC)',
      sales_manager: 'Satış Müdürü',
      sales_specialist: 'Satış Uzmanı',
      viewer: 'Görüntüleyici'
    }
    return roles[role] || role
  }

  return (
    <header className="h-16 bg-card border-b border-border px-4 flex items-center justify-between sticky top-0 z-20 select-none">
      
      {/* Search & Collapse Menu trigger */}
      <div className="flex items-center gap-4 flex-1 max-w-lg">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="h-9 w-9 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Global Search Bar */}
        <div className="relative w-full max-w-sm hidden md:block">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Müşteri, lead, telefon veya fırsat ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-8 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 h-4 w-4 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          )}

          {/* Search Results Dropdown */}
          {searchQuery && (
            <div className="absolute top-11 left-0 right-0 bg-card border border-border rounded-lg shadow-xl z-50 p-2 max-h-80 overflow-y-auto space-y-1 animate-in fade-in slide-in-from-top-1 duration-100">
              {isSearching ? (
                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Aranıyor...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  Sonuç bulunamadı.
                </div>
              ) : (
                searchResults.map((res, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      router.push(res.url)
                      setSearchQuery('')
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-accent rounded-md flex items-center justify-between text-sm transition-colors cursor-pointer"
                  >
                    <div>
                      <div className="font-semibold text-foreground">{res.title}</div>
                      <div className="text-xs text-muted-foreground">{res.subtitle}</div>
                    </div>
                    <span className="text-xs font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded border border-border">
                      {res.number}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Control Widgets */}
      <div className="flex items-center gap-3">
        
        {/* Quick Add Menu */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="h-9 px-3 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm shadow-primary/10">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Hızlı Ekle</span>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="bg-card border border-border rounded-lg shadow-lg z-50 p-1 min-w-44 space-y-0.5 animate-in fade-in zoom-in-95 duration-100"
              sideOffset={5}
            >
              <DropdownMenu.Item
                onSelect={() => setIsQuickLeadOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md outline-none cursor-pointer"
              >
                <FileText className="h-4 w-4 text-sky-500" />
                Hızlı Lead Ekle
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => setIsQuickCustomerOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md outline-none cursor-pointer"
              >
                <User className="h-4 w-4 text-emerald-500" />
                Hızlı Müşteri Ekle
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => setIsQuickTaskOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md outline-none cursor-pointer"
              >
                <CheckSquare className="h-4 w-4 text-amber-500" />
                Hızlı Görev Ekle
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="h-9 w-9 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
        >
          {theme === 'light' ? <Moon className="h-4.5 w-4.5" /> : <Sun className="h-4.5 w-4.5" />}
        </button>

        {/* Notifications Hub */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="h-9 w-9 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer relative transition-colors">
              <Bell className="h-4.5 w-4.5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                  {unreadCount}
                </span>
              )}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="bg-card border border-border rounded-lg shadow-xl z-50 w-80 p-0 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
              align="end"
              sideOffset={5}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-accent/40">
                <span className="font-semibold text-xs text-foreground">Bildirimler</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                  >
                    Tümünü Okundu İşaretle
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-border">
                {notificationsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    Yeni bildirim bulunmuyor.
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-3 text-xs leading-relaxed transition-colors ${notif.is_read ? 'bg-card' : 'bg-primary/5 font-medium'}`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-semibold text-foreground">{notif.title}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(notif.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-0.5">{notif.message}</p>
                    </div>
                  ))
                )}
              </div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* Profile Dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="h-9 w-9 rounded-lg hover:bg-accent border border-border flex items-center justify-center cursor-pointer transition-colors relative">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name || ''}
                  className="h-7 w-7 rounded-md object-cover"
                />
              ) : (
                <div className="h-7 w-7 rounded bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                  {profile?.first_name?.charAt(0) || profile?.email.charAt(0).toUpperCase()}
                  {profile?.last_name?.charAt(0) || ''}
                </div>
              )}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="bg-card border border-border rounded-lg shadow-xl z-50 p-1.5 min-w-56 space-y-1 animate-in fade-in zoom-in-95 duration-100"
              align="end"
              sideOffset={5}
            >
              {/* User details display */}
              <div className="px-3.5 py-2.5 border-b border-border mb-1">
                <div className="font-semibold text-xs text-foreground truncate">{profile?.full_name || 'CRM Kullanıcısı'}</div>
                <div className="text-[10px] text-muted-foreground truncate">{profile?.email}</div>
                <span className="inline-block mt-1.5 px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded">
                  {translateRole(profile?.role || 'viewer')}
                </span>
              </div>

              <DropdownMenu.Item
                onSelect={() => router.push('/dashboard/settings')}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md outline-none cursor-pointer transition-colors"
              >
                <User className="h-4 w-4" />
                Profilimi Düzenle
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => router.push('/dashboard/settings')}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md outline-none cursor-pointer transition-colors"
              >
                <SettingsIcon className="h-4 w-4" />
                Sistem Ayarları
              </DropdownMenu.Item>

              <DropdownMenu.Separator className="h-px bg-border my-1" />

              <DropdownMenu.Item
                onSelect={handleLogout}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-md outline-none cursor-pointer transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Çıkış Yap
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Quick Add Dialog Forms */}
      {/* Lead Dialog */}
      <Dialog.Root open={isQuickLeadOpen} onOpenChange={setIsQuickLeadOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-md z-50 animate-in fade-in zoom-in-95 duration-150">
            <Dialog.Title className="text-base font-bold text-foreground mb-4">Hızlı Lead Ekle</Dialog.Title>
            <form onSubmit={handleQuickLeadSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">AD *</label>
                  <input
                    type="text"
                    required
                    value={leadForm.firstName}
                    onChange={(e) => setLeadForm({ ...leadForm, firstName: e.target.value })}
                    className="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">SOYAD *</label>
                  <input
                    type="text"
                    required
                    value={leadForm.lastName}
                    onChange={(e) => setLeadForm({ ...leadForm, lastName: e.target.value })}
                    className="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1">TELEFON *</label>
                <input
                  type="text"
                  required
                  placeholder="0 (5XX) XXX XX XX"
                  value={leadForm.phone}
                  onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                  className="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1">FİRMA ADI</label>
                <input
                  type="text"
                  value={leadForm.company}
                  onChange={(e) => setLeadForm({ ...leadForm, company: e.target.value })}
                  className="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1">TALEP EDİLEN ÜRÜN</label>
                <input
                  type="text"
                  placeholder="Örn: Abkant Pres 100 Ton"
                  value={leadForm.product}
                  onChange={(e) => setLeadForm({ ...leadForm, product: e.target.value })}
                  className="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Dialog.Close asChild>
                  <button type="button" className="px-4 py-2 border border-border hover:bg-accent rounded-lg text-xs font-semibold cursor-pointer">Vazgeç</button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  Kaydet
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Customer Dialog */}
      <Dialog.Root open={isQuickCustomerOpen} onOpenChange={setIsQuickCustomerOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-md z-50 animate-in fade-in zoom-in-95 duration-150">
            <Dialog.Title className="text-base font-bold text-foreground mb-4">Hızlı Müşteri Ekle</Dialog.Title>
            <form onSubmit={handleQuickCustomerSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1">MÜŞTERİ TİPİ</label>
                <div className="flex gap-4">
                  <label className="flex items-center text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      checked={customerForm.type === 'individual'}
                      onChange={() => setCustomerForm({ ...customerForm, type: 'individual' })}
                      className="mr-1.5 h-3.5 w-3.5"
                    />
                    Bireysel
                  </label>
                  <label className="flex items-center text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      checked={customerForm.type === 'corporate'}
                      onChange={() => setCustomerForm({ ...customerForm, type: 'corporate' })}
                      className="mr-1.5 h-3.5 w-3.5"
                    />
                    Kurumsal
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1">MÜŞTERİ ADI / UNVANI *</label>
                <input
                  type="text"
                  required
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  className="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">TELEFON</label>
                  <input
                    type="text"
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                    className="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">E-POSTA</label>
                  <input
                    type="email"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                    className="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Dialog.Close asChild>
                  <button type="button" className="px-4 py-2 border border-border hover:bg-accent rounded-lg text-xs font-semibold cursor-pointer">Vazgeç</button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  Kaydet
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Task Dialog */}
      <Dialog.Root open={isQuickTaskOpen} onOpenChange={setIsQuickTaskOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-md z-50 animate-in fade-in zoom-in-95 duration-150">
            <Dialog.Title className="text-base font-bold text-foreground mb-4">Hızlı Görev Ekle</Dialog.Title>
            <form onSubmit={handleQuickTaskSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1">GÖREV BAŞLIĞI *</label>
                <input
                  type="text"
                  required
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">TÜR</label>
                  <select
                    value={taskForm.type}
                    onChange={(e) => setTaskForm({ ...taskForm, type: e.target.value })}
                    className="w-full h-9 px-2 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="general">Genel Görev</option>
                    <option value="call">Arama</option>
                    <option value="callback">Geri Arama</option>
                    <option value="meeting">Toplantı</option>
                    <option value="offer">Teklif Hazırlama</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">ÖNCELİK</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="w-full h-9 px-2 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="low">Düşük</option>
                    <option value="normal">Normal</option>
                    <option value="high">Yüksek</option>
                    <option value="critical">Kritik</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1">SON TARİH</label>
                <input
                  type="datetime-local"
                  value={taskForm.dueAt}
                  onChange={(e) => setTaskForm({ ...taskForm, dueAt: e.target.value })}
                  className="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Dialog.Close asChild>
                  <button type="button" className="px-4 py-2 border border-border hover:bg-accent rounded-lg text-xs font-semibold cursor-pointer">Vazgeç</button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  Kaydet
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

    </header>
  )
}

'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/components/shared/ThemeProvider'
import { Profile, Notification } from '@/types/crm'
import {
  Bell,
  Sun,
  Moon,
  LogOut,
  User,
  Loader2,
  Menu,
  Shield
} from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

interface WorkspaceNavbarProps {
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  profile: Profile | null
}

export default function WorkspaceNavbar({ sidebarCollapsed, setSidebarCollapsed, profile }: WorkspaceNavbarProps) {
  const router = useRouter()
  const supabase = createClient()
  const { theme, toggleTheme } = useTheme()

  // State
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationsLoading, setNotificationsLoading] = useState(false)

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
      .channel('public:workspace_notifications')
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

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Role translator
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
      
      {/* Collapse Menu trigger */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="h-9 w-9 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors md:flex hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <span className="font-bold text-sm text-foreground">Çalışma Alanı</span>
        </div>
      </div>

      {/* Right Control Widgets */}
      <div className="flex items-center gap-3">
        
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
              {/* User details */}
              <div className="px-3.5 py-2.5 border-b border-border mb-1">
                <div className="font-semibold text-xs text-foreground truncate">{profile?.full_name || 'Temsilci'}</div>
                <div className="text-[10px] text-muted-foreground truncate">{profile?.email}</div>
                <span className="inline-block mt-1.5 px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded">
                  {translateRole(profile?.role || 'viewer')}
                </span>
              </div>

              <DropdownMenu.Item
                onSelect={() => router.push('/workspace/profile')}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md outline-none cursor-pointer transition-colors"
              >
                <User className="h-4 w-4" />
                Profilim
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

    </header>
  )
}

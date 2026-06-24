'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import WorkspaceSidebar from './WorkspaceSidebar'
import WorkspaceNavbar from './WorkspaceNavbar'
import { Profile } from '@/types/crm'
import {
  LayoutGrid,
  UserCheck,
  CheckSquare,
  MessageSquare,
  User,
  MessageCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface WorkspaceLayoutClientProps {
  children: React.ReactNode
  profile: Profile | null
}

export default function WorkspaceLayoutClient({ children, profile }: WorkspaceLayoutClientProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  // Mobile navigation tabs
  const mobileTabs = [
    { name: 'Çalışma', href: '/workspace', icon: LayoutGrid },
    { name: 'Leadlerim', href: '/workspace/leads', icon: UserCheck },
    { name: 'Görevlerim', href: '/workspace/tasks', icon: CheckSquare },
    { name: 'WhatsApp', href: '/workspace/whatsapp', icon: MessageCircle },
    { name: 'Mesajlar', href: '/workspace/messages', icon: MessageSquare },
    { name: 'Profil', href: '/workspace/profile', icon: User },
  ]

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar: hidden on mobile */}
      <div className="hidden md:flex">
        <WorkspaceSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden pb-16 md:pb-0">
        <WorkspaceNavbar sidebarCollapsed={collapsed} setSidebarCollapsed={setCollapsed} profile={profile} />
        
        <main className="flex-1 overflow-y-auto bg-background/50 p-4 md:p-6 transition-all duration-300">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar: visible only on mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around px-2 z-40 select-none shadow-lg">
        {mobileTabs.map((tab) => {
          const isActive = pathname === tab.href || (tab.href !== '/workspace' && pathname.startsWith(tab.href + '/'))
          const Icon = tab.icon

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 py-1 gap-1 text-[10px] font-bold transition-colors",
                isActive
                  ? "text-primary font-extrabold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{tab.name}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  UserCheck,
  Users,
  Phone,
  Layers,
  CheckSquare,
  Calendar,
  MessageSquare,
  BarChart3,
  UserCog,
  Zap,
  Settings,
  Shield,
  ChevronLeft,
  ChevronRight,
  Database
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}

export default function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
  const pathname = usePathname()

  const menuItems = [
    { name: 'İstatistikler', href: '/dashboard/statistics', icon: BarChart3 },
    { name: 'Script Müşteriler', href: '/dashboard/script-leads', icon: Database },
    { name: 'Görevler', href: '/dashboard/tasks', icon: CheckSquare },
    { name: 'Kullanıcılar', href: '/dashboard/users', icon: UserCog },
    { name: 'Ayarlar', href: '/dashboard/settings', icon: Settings },
  ]

  return (
    <aside
      className={cn(
        "bg-card border-r border-border h-screen sticky top-0 flex flex-col justify-between transition-all duration-300 z-30 select-none",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div>
        {/* Brand header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          <Link href="/dashboard/statistics" className="flex items-center gap-2 overflow-hidden">
            {collapsed ? (
              <div className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
                <span className="font-black text-base text-yellow-500">S</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <img src="/sunton-logo.png" alt="Sunton Logo" className="h-6.5 w-auto object-contain" />
                <span className="font-bold bg-primary px-1.5 py-0.5 rounded text-white text-[9px] uppercase tracking-wider">
                  CRM
                </span>
              </div>
            )}
          </Link>
          
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="h-7 w-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Navigation list */}
        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-120px)]">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer group relative",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                )}
              >
                <Icon className={cn("h-4.5 w-4.5 shrink-0", isActive ? "" : "text-muted-foreground/75 group-hover:text-foreground")} />
                {!collapsed && <span className="whitespace-nowrap transition-opacity duration-300">{item.name}</span>}

                {/* Tooltip on hover when collapsed */}
                {collapsed && (
                  <div className="absolute left-14 hidden group-hover:block bg-slate-900 text-white text-xs py-1.5 px-3 rounded shadow-lg whitespace-nowrap z-50 animate-in fade-in zoom-in-95 duration-100 font-medium">
                    {item.name}
                  </div>
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Collapse button inside footer when collapsed */}
      {collapsed && (
        <div className="p-3 border-t border-border flex justify-center">
          <button
            onClick={() => setCollapsed(false)}
            className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </aside>
  )
}

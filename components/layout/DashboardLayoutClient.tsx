'use client'

import React, { useState } from 'react'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import { Profile } from '@/types/crm'

interface LayoutClientProps {
  children: React.ReactNode
  profile: Profile | null
}

export default function DashboardLayoutClient({ children, profile }: LayoutClientProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar sidebarCollapsed={collapsed} setSidebarCollapsed={setCollapsed} profile={profile} />
        <main className="flex-1 overflow-y-auto bg-background/50 p-4 md:p-6 transition-all duration-300">
          {children}
        </main>
      </div>
    </div>
  )
}

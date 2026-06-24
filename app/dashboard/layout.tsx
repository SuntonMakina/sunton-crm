import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardLayoutClient from '@/components/layout/DashboardLayoutClient'
import { Profile } from '@/types/crm'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Verify auth session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch logged in user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Redirect non-admins to the workspace
  if (profile && profile.role !== 'admin' && profile.role !== 'super_admin') {
    redirect('/workspace')
  }

  return (
    <DashboardLayoutClient profile={profile as Profile | null}>
      {children}
    </DashboardLayoutClient>
  )
}

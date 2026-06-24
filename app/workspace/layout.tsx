import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import WorkspaceLayoutClient from '@/components/layout/WorkspaceLayoutClient'
import { Profile } from '@/types/crm'

export default async function WorkspaceLayout({
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

  // If the user is an admin or super_admin, redirect them to the Admin Dashboard
  if (profile && (profile.role === 'admin' || profile.role === 'super_admin')) {
    redirect('/dashboard')
  }

  return (
    <WorkspaceLayoutClient profile={profile as Profile | null}>
      {children}
    </WorkspaceLayoutClient>
  )
}

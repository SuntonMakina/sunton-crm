'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  User, 
  Phone, 
  Mail, 
  Lock, 
  Shield, 
  Loader2,
  CheckCircle,
  Building,
  Target
} from 'lucide-react'

export default function WorkspaceProfilePage() {
  const supabase = createClient()

  // Profile data state
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Edit fields
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: prof, error } = await supabase
            .from('profiles')
            .select(`
              *,
              departments(name)
            `)
            .eq('id', user.id)
            .single()

          if (!error && prof) {
            setProfile(prof)
            setPhone(prof.phone || '')
            setAvatarUrl(prof.avatar_url || '')
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [supabase])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    setSaving(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      // 1. Update profiles table
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({
          phone: phone,
          avatar_url: avatarUrl
        })
        .eq('id', profile.id)

      if (profileErr) throw new Error(profileErr.message)

      // 2. Update Auth metadata avatar_url
      await supabase.auth.updateUser({
        data: { avatar_url: avatarUrl }
      })

      setSuccessMsg('Profil bilgileriniz başarıyla güncellendi.')
    } catch (err: any) {
      setErrorMsg('Güncelleme hatası: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) return

    if (password !== passwordConfirm) {
      setErrorMsg('Şifreler uyuşmuyor.')
      return
    }

    if (password.length < 6) {
      setErrorMsg('Şifre en az 6 karakter olmalıdır.')
      return
    }

    setSaving(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) throw new Error(error.message)

      setSuccessMsg('Şifreniz başarıyla güncellendi.')
      setPassword('')
      setPasswordConfirm('')
    } catch (err: any) {
      setErrorMsg('Şifre güncelleme hatası: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Translators
  const translateRole = (role: string) => {
    const roles: Record<string, string> = {
      super_admin: 'Süper Yönetici',
      admin: 'Yönetici',
      team_leader: 'Takım Lideri',
      call_center_rep: 'Temsilci (Call Center)',
      sales_manager: 'Satış Müdürü',
      sales_specialist: 'Satış Uzmanı',
      viewer: 'Görüntüleyici'
    }
    return roles[role] || role
  }

  return (
    <div className="space-y-6 select-none pb-8 max-w-4xl">
      {/* Header section */}
      <div className="border-b border-border/60 pb-5">
        <h1 className="text-xl font-bold text-foreground">Profil Ayarlarım</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Kişisel bilgilerinizi ve giriş şifrenizi güncelleyin.</p>
      </div>

      {/* Alert boxes */}
      {errorMsg && (
        <div className="p-3 bg-destructive/15 border border-destructive/30 rounded-lg text-xs text-destructive font-semibold">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
          {successMsg}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Column 1: Read-only organization metadata */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-4 h-fit">
            <div className="flex flex-col items-center text-center pb-4 border-b border-border">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={profile?.full_name || ''}
                  className="h-20 w-20 rounded-full object-cover border-2 border-primary/20"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-primary/10 text-primary font-bold text-2xl flex items-center justify-center border-2 border-primary/20">
                  {profile?.first_name?.charAt(0) || profile?.email.charAt(0).toUpperCase()}
                  {profile?.last_name?.charAt(0) || ''}
                </div>
              )}
              <h3 className="font-bold text-sm text-foreground mt-3">{profile?.full_name}</h3>
              <span className="text-[10px] font-bold text-primary mt-1 px-2.5 py-0.5 bg-primary/10 rounded">{translateRole(profile?.role)}</span>
            </div>

            <div className="space-y-3.5 text-xs pt-2">
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <span className="block text-[9px] font-bold text-muted-foreground/60 uppercase">Kilitli E-posta</span>
                  <span className="text-foreground text-[11px] truncate block">{profile?.email}</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Building className="h-4 w-4 shrink-0" />
                <div>
                  <span className="block text-[9px] font-bold text-muted-foreground/60 uppercase">Departman</span>
                  <span className="text-foreground text-[11px] font-semibold block">{profile?.departments?.name || 'Genel Operasyon'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Shield className="h-4 w-4 shrink-0" />
                <div>
                  <span className="block text-[9px] font-bold text-muted-foreground/60 uppercase">Yetki Grubu</span>
                  <span className="text-slate-500 font-medium block">Değiştirilemez (Sistem Kilidi)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Edit profile metadata form */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-xs h-fit md:col-span-2 space-y-4">
            <h3 className="text-xs font-bold text-foreground border-b border-border pb-2 uppercase tracking-wider">Kişisel Bilgiler</h3>
            
            <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Telefon Numarası</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="05XX XXX XX XX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full h-10 pl-10 pr-4 bg-background border border-border rounded-lg text-sm focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Avatar Fotoğraf URL</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="https://..."
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      className="w-full h-10 pl-10 pr-4 bg-background border border-border rounded-lg text-sm focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="h-10 px-4.5 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4.5 w-4.5 animate-spin" />}
                Profil Bilgilerimi Kaydet
              </button>
            </form>

            {/* Password update form */}
            <h3 className="text-xs font-bold text-foreground border-b border-border pb-2 pt-4 uppercase tracking-wider">Giriş Şifresi Değiştir</h3>
            <form onSubmit={handleUpdatePassword} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Yeni Şifre</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                      type="password"
                      required
                      placeholder="••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-10 pl-10 pr-4 bg-background border border-border rounded-lg text-sm focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Şifre Tekrar</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                      type="password"
                      required
                      placeholder="••••••"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      className="w-full h-10 pl-10 pr-4 bg-background border border-border rounded-lg text-sm focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="h-10 px-4.5 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4.5 w-4.5 animate-spin" />}
                Şifremi Güncelle
              </button>
            </form>
          </div>

        </div>
      )}

    </div>
  )
}

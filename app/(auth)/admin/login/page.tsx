'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react'

export default function AdminLoginPage() {
  const router = useRouter()
  const supabase = createClient()

  // Common UI states
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Login form states
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)

  const getFriendlyErrorMessage = (error: any) => {
    if (!error) return 'Giriş yapılamadı. Lütfen tekrar deneyin.'
    
    let message = error.message
    if (typeof message === 'object') {
      try {
        message = JSON.stringify(message)
      } catch {
        message = ''
      }
    }
    
    if (!message || message === '{}' || message === 'null' || message === 'undefined') {
      return 'Giriş yapılamadı. Hatalı e-posta adresi veya şifre.'
    }

    if (message.includes('Invalid login credentials')) {
      return 'Hatalı e-posta adresi veya şifre.'
    }
    if (message.includes('Email not confirmed')) {
      return 'E-posta adresiniz henüz onaylanmamış. Lütfen gelen kutunuzu kontrol edin.'
    }
    if (message.includes('rate limit')) {
      return 'Çok fazla giriş denemesi yapıldı. Lütfen daha sonra tekrar deneyin.'
    }

    return message
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginEmail || !loginPassword) {
      setErrorMessage('Lütfen e-posta ve şifre alanlarını doldurun.')
      return
    }

    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      })

      if (error) {
        setErrorMessage(getFriendlyErrorMessage(error))
      } else if (data.user) {
        // Fetch profile to verify if this user is actually an admin/super_admin
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single()

        if (profileError || !profile) {
          setErrorMessage('Kullanıcı profil bilgileri alınamadı.')
          await supabase.auth.signOut()
        } else if (profile.role !== 'admin' && profile.role !== 'super_admin') {
          // If not admin, sign out and show error
          setErrorMessage('Yetkisiz Giriş: Bu panele sadece yöneticiler giriş yapabilir.')
          await supabase.auth.signOut()
        } else {
          setSuccessMessage('Giriş başarılı. Yönetim Paneline yönlendiriliyorsunuz...')
          setTimeout(() => {
            router.push('/dashboard')
            router.refresh()
          }, 800)
        }
      }
    } catch (err: any) {
      setErrorMessage('Bir sistem hatası oluştu. Lütfen tekrar deneyin.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-radial from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-950 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-8 relative overflow-hidden transition-all duration-300">
        
        {/* Brand header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="mb-4 max-w-[220px] flex items-center justify-center">
            <img src="/sunton-logo.png" alt="Sunton Logo" className="h-11 object-contain" />
          </div>
          <h1 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
            CRM Portal
          </h1>
          <p className="text-[10px] text-muted-foreground mt-1 font-semibold text-primary">
            Yönetici Giriş Portalı
          </p>
        </div>

        {/* Alert box */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-destructive/15 border border-destructive/30 rounded-lg text-xs text-destructive font-semibold">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            {successMessage}
          </div>
        )}

        {/* Admin Login View */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground mb-1 tracking-wider">YÖNETİCİ E-POSTA ADRESİ</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4.5 w-4.5 text-muted-foreground" />
              <input
                type="email"
                required
                placeholder="ornek@sunton.com.tr"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] font-bold text-muted-foreground tracking-wider">ŞİFRE</label>
              <a
                href="/forgot-password"
                className="text-xs text-primary hover:underline font-semibold"
              >
                Şifremi Unuttum
              </a>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4.5 w-4.5 text-muted-foreground" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full h-10 pl-10 pr-10 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center">
            <input
              id="remember_me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary bg-background cursor-pointer"
            />
            <label htmlFor="remember_me" className="ml-2 block text-xs font-medium text-muted-foreground cursor-pointer select-none">
              Beni Hatırla
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/95 flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-md shadow-primary/10 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Giriş Yap (Yönetici)
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Link to User Login */}
        <div className="mt-8 pt-4 border-t border-border text-center">
          <button
            onClick={() => router.push('/login')}
            className="text-xs text-primary hover:underline font-semibold cursor-pointer"
          >
            Personel Giriş Portalı (Çağrı Merkezi / Satış Temsilcisi)
          </button>
        </div>
      </div>
    </main>
  )
}

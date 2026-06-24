'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Lock, Eye, EyeOff, Loader2 } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!password || !passwordConfirm) {
      setErrorMessage('Lütfen tüm alanları doldurun.')
      return
    }

    if (password !== passwordConfirm) {
      setErrorMessage('Şifreler uyuşmuyor.')
      return
    }

    if (password.length < 6) {
      setErrorMessage('Şifre en az 6 karakter olmalıdır.')
      return
    }

    setLoading(true)
    setErrorMessage('')

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) {
        setErrorMessage(error.message)
      } else {
        setSuccess(true)
        setTimeout(() => {
          router.push('/dashboard')
        }, 1500)
      }
    } catch (err: any) {
      setErrorMessage('Şifre güncellenirken hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-radial from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-950 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-8 transition-all">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="mb-4 max-w-[220px] flex items-center justify-center">
            <img src="/sunton-logo.png" alt="Sunton Logo" className="h-11 object-contain" />
          </div>
          <h1 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
            CRM Portal
          </h1>
          <h2 className="text-2xl font-bold tracking-tight text-foreground mt-2">
            Yeni Şifre Belirle
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            Lütfen hesabınız için yeni ve güvenli bir şifre belirleyin.
          </p>
        </div>

        {success && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-sm text-emerald-600 dark:text-emerald-400 font-medium">
            Şifreniz başarıyla güncellendi! Dashboard'a yönlendiriliyorsunuz...
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 bg-destructive/15 border border-destructive/30 rounded-lg text-sm text-destructive font-medium">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">YENİ ŞİFRE</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4.5 w-4.5 text-muted-foreground" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 pl-10 pr-10 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">YENİ ŞİFRE TEKRAR</label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="••••••"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full h-10 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/95 flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-md disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Şifreyi Güncelle'}
          </button>
        </form>
      </div>
    </main>
  )
}

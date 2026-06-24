'use client'

import React, { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mail, ArrowLeft, Loader2 } from 'lucide-react'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setLoading(true)
    setMessage('')
    setErrorMessage('')

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        setErrorMessage(error.message)
      } else {
        setMessage('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Lütfen gelen kutunuzu kontrol edin.')
      }
    } catch (err: any) {
      setErrorMessage('Bir hata oluştu. Lütfen tekrar deneyin.')
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
            Şifremi Unuttum
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            Hesabınıza kayıtlı e-posta adresinizi girin, şifre sıfırlama bağlantısı gönderelim.
          </p>
        </div>

        {message && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-sm text-emerald-600 dark:text-emerald-400 font-medium leading-relaxed">
            {message}
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 bg-destructive/15 border border-destructive/30 rounded-lg text-sm text-destructive font-medium">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">E-POSTA ADRESİ</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4.5 w-4.5 text-muted-foreground" />
              <input
                type="email"
                required
                placeholder="ornek@sunton.com.tr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/95 flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-md disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sıfırlama Bağlantısı Gönder'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a
            href="/login"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-medium transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Giriş Sayfasına Dön
          </a>
        </div>
      </div>
    </main>
  )
}

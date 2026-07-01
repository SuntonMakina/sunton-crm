'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  ArrowLeft, 
  Plus, 
  Phone, 
  User, 
  Mail, 
  Briefcase, 
  MapPin, 
  Loader2, 
  CheckCircle, 
  AlertTriangle 
} from 'lucide-react'

export default function AddLeadPage() {
  const supabase = createClient()
  const router = useRouter()

  // Authenticated user state
  const [profile, setProfile] = useState<any>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  // Dropdown states
  const [provinces, setProvinces] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loadingLookups, setLoadingLookups] = useState(true)

  // Form states
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [secondaryPhone, setSecondaryPhone] = useState('')
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [selectedProvince, setSelectedProvince] = useState('')
  const [district, setDistrict] = useState('')
  const [requestedProduct, setRequestedProduct] = useState('')
  const [sourceId, setSourceId] = useState('11111111-0000-0000-0000-000000000007') // Default: Telefon

  // Status states
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  
  // Duplicate check states
  const [duplicateLead, setDuplicateLead] = useState<any>(null)
  const [bypassDuplicate, setBypassDuplicate] = useState(false)

  // Phone number normalization
  const normalizePhoneNumber = (num: string) => {
    let clean = num.replace(/\D/g, '')
    if (clean.startsWith('90')) clean = clean.substring(2)
    else if (clean.startsWith('090')) clean = clean.substring(3)
    else if (clean.startsWith('0')) clean = clean.substring(1)
    return '90' + clean
  }

  useEffect(() => {
    async function init() {
      // Fetch authenticated user profile
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        if (prof) {
          setProfile(prof)
        }
      }
      setLoadingUser(false)
    }

    async function loadLookups() {
      try {
        const { data: provs } = await supabase
          .from('provinces')
          .select('id, name')
          .eq('is_active', true)
          .order('name')
        
        const { data: prods } = await supabase
          .from('products')
          .select('id, name')
          .eq('is_active', true)
          .order('name')

        if (provs) setProvinces(provs)
        if (prods) setProducts(prods)
      } catch (err) {
        console.error('Lookup load error:', err)
      } finally {
        setLoadingLookups(false)
      }
    }

    init()
    loadLookups()
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!profile) {
      setErrorMsg('Oturum açmış kullanıcı profili bulunamadı.')
      return
    }

    if (!firstName || !lastName || !phone) {
      setErrorMsg('Lütfen ad, soyad ve telefon alanlarını doldurun.')
      return
    }

    const normPhone = normalizePhoneNumber(phone)
    if (normPhone.length < 10) {
      setErrorMsg('Geçerli bir telefon numarası giriniz.')
      return
    }

    setSubmitting(true)

    try {
      // 1. Duplicate check (only if not bypassed)
      if (!bypassDuplicate) {
        const { data: existingLeads, error: checkError } = await supabase
          .from('leads')
          .select('id, first_name, last_name, lead_number')
          .eq('phone_normalized', normPhone)
          .eq('is_active', true)
          .limit(1)

        if (checkError) throw checkError

        if (existingLeads && existingLeads.length > 0) {
          setDuplicateLead(existingLeads[0])
          setSubmitting(false)
          return
        }
      }

      // 2. Insert Lead
      const { data: newLead, error: insertError } = await supabase
        .from('leads')
        .insert({
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
          phone: phone,
          phone_normalized: normPhone,
          secondary_phone: secondaryPhone || null,
          email: email || null,
          company_name: companyName || null,
          province: selectedProvince || null,
          district: district || null,
          source_id: sourceId || null,
          status_id: '22222222-0000-0000-0000-000000000001', // Yeni Lead
          assigned_call_center_user_id: profile.id, // Assign to current user (Ebru)
          created_by: profile.id,
          updated_by: profile.id,
          is_active: true
        })
        .select()
        .single()

      if (insertError) throw insertError

      // 3. Success handling
      setSuccessMsg(`Lead başarıyla eklendi! Lead Numarası: ${newLead.lead_number}`)
      
      // Reset form
      setFirstName('')
      setLastName('')
      setPhone('')
      setSecondaryPhone('')
      setEmail('')
      setCompanyName('')
      setSelectedProvince('')
      setDistrict('')
      setRequestedProduct('')
      setDuplicateLead(null)
      setBypassDuplicate(false)

    } catch (err: any) {
      console.error(err)
      const details = err.details ? ` (Detay: ${err.details})` : ''
      const code = err.code ? ` [Kod: ${err.code}]` : ''
      const hint = err.hint ? ` - İpucu: ${err.hint}` : ''
      setErrorMsg(`${err.message || 'Bir hata oluştu'}${details}${code}${hint}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingUser || loadingLookups) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-semibold">Sayfa yükleniyor...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-5">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/workspace')}
            className="h-9 w-9 bg-card border border-border rounded-lg flex items-center justify-center cursor-pointer transition-colors hover:bg-muted"
            title="Geri Dön"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Manuel Lead Ekle</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Eklenen lead doğrudan sizin arama listenize atanacaktır.
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-3 animate-in fade-in duration-200">
          <CheckCircle className="h-5 w-5 shrink-0 text-emerald-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-3 animate-in fade-in duration-200">
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Duplicate Warning */}
      {duplicateLead && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-400 text-xs font-semibold space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500 animate-bounce" />
            <div>
              <p className="font-bold">Mükerrer Kayıt Uyarısı!</p>
              <p className="text-[11px] opacity-90 mt-0.5">
                Bu telefon numarasıyla aktif bir kayıt zaten var: <strong>{duplicateLead.first_name} {duplicateLead.last_name}</strong> ({duplicateLead.lead_number})
              </p>
            </div>
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => {
                setBypassDuplicate(true)
                setBypassDuplicate(prev => {
                  setTimeout(() => {
                    const submitBtn = document.getElementById('submit-btn')
                    submitBtn?.click()
                  }, 100)
                  return true
                })
              }}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-[10px] cursor-pointer transition-colors shadow-xs"
            >
              Yine de Kaydet
            </button>
            <button
              type="button"
              onClick={() => setDuplicateLead(null)}
              className="px-3.5 py-1.5 bg-card border border-border hover:bg-muted text-foreground rounded-lg font-bold text-[10px] cursor-pointer transition-colors"
            >
              İptal Et
            </button>
          </div>
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Ad */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ad *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Örn: Ahmet"
                className="w-full h-10 pl-9 pr-3 bg-background border border-border rounded-xl text-xs focus:ring-1 focus:ring-primary focus:outline-none font-medium"
              />
            </div>
          </div>

          {/* Soyad */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Soyad *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Örn: Yılmaz"
                className="w-full h-10 pl-9 pr-3 bg-background border border-border rounded-xl text-xs focus:ring-1 focus:ring-primary focus:outline-none font-medium"
              />
            </div>
          </div>

          {/* Telefon */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Telefon *</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Örn: 0555 555 5555"
                className="w-full h-10 pl-9 pr-3 bg-background border border-border rounded-xl text-xs focus:ring-1 focus:ring-primary focus:outline-none font-medium"
              />
            </div>
          </div>

          {/* İkinci Telefon */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Yedek Telefon</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="tel"
                value={secondaryPhone}
                onChange={(e) => setSecondaryPhone(e.target.value)}
                placeholder="Varsa diğer telefon numarası"
                className="w-full h-10 pl-9 pr-3 bg-background border border-border rounded-xl text-xs focus:ring-1 focus:ring-primary focus:outline-none font-medium"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">E-posta</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Örn: ornek@mail.com"
                className="w-full h-10 pl-9 pr-3 bg-background border border-border rounded-xl text-xs focus:ring-1 focus:ring-primary focus:outline-none font-medium"
              />
            </div>
          </div>

          {/* Şirket Adı */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Firma Adı</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Örn: ABC Makine A.Ş."
                className="w-full h-10 pl-9 pr-3 bg-background border border-border rounded-xl text-xs focus:ring-1 focus:ring-primary focus:outline-none font-medium"
              />
            </div>
          </div>

          {/* İl */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">İl</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <select
                value={selectedProvince}
                onChange={(e) => setSelectedProvince(e.target.value)}
                className="w-full h-10 pl-9 pr-3 bg-background border border-border rounded-xl text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer font-medium"
              >
                <option value="">Seçiniz...</option>
                {provinces.map((prov) => (
                  <option key={prov.id} value={prov.name}>{prov.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* İlçe */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">İlçe</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="Örn: Nilüfer"
                className="w-full h-10 pl-9 pr-3 bg-background border border-border rounded-xl text-xs focus:ring-1 focus:ring-primary focus:outline-none font-medium"
              />
            </div>
          </div>

          {/* Talep Edilen Ürün */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Talep Edilen Ürün</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <select
                value={requestedProduct}
                onChange={(e) => setRequestedProduct(e.target.value)}
                className="w-full h-10 pl-9 pr-3 bg-background border border-border rounded-xl text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer font-medium"
              >
                <option value="">Seçiniz...</option>
                {products.map((prod) => (
                  <option key={prod.id} value={prod.name}>{prod.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Lead Kaynağı */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Lead Kaynağı *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <select
                required
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="w-full h-10 pl-9 pr-3 bg-background border border-border rounded-xl text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer font-extrabold text-indigo-600 dark:text-indigo-400"
              >
                <option value="11111111-0000-0000-0000-000000000007">📞 Telefon</option>
                <option value="11111111-0000-0000-0000-000000000008">✉️ Mail</option>
                <option value="11111111-0000-0000-0000-000000000013">🌐 Diğer</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="border-t border-border/50 pt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push('/workspace')}
            className="h-10 px-4 bg-background border border-border hover:bg-muted text-foreground rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            İptal
          </button>
          <button
            id="submit-btn"
            type="submit"
            disabled={submitting}
            className="h-10 px-6 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Kaydediliyor...</span>
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                <span>Lead Kaydet</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

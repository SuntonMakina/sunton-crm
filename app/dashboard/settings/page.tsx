'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Settings,
  Building,
  Sliders,
  PhoneCall,
  GitBranch,
  Bell,
  Link as LinkIcon,
  Shield,
  Loader2,
  CheckCircle,
  HelpCircle,
  AlertCircle
} from 'lucide-react'

export default function SettingsPage() {
  const supabase = createClient()

  // States
  const [activeTab, setActiveTab] = useState<'general' | 'crm' | 'callcenter' | 'integrations'>('general')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Settings values states
  const [settings, setSettings] = useState<any[]>([])
  const [companyName, setCompanyName] = useState('')
  const [timezone, setTimezone] = useState('Europe/Istanbul')
  const [currency, setCurrency] = useState('TRY')

  // Load Settings
  const loadSettingsData = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('app_settings').select('*')
      if (!error && data) {
        setSettings(data)
        const nameVal = data.find(s => s.key === 'company_name')?.value
        const tzVal = data.find(s => s.key === 'timezone')?.value
        const curVal = data.find(s => s.key === 'currency')?.value

        if (nameVal) setCompanyName(nameVal)
        if (tzVal) setTimezone(tzVal)
        if (curVal) setCurrency(curVal)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettingsData()
  }, [])

  // Save General settings
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { error: err1 } = await supabase.from('app_settings').update({ value: companyName }).eq('key', 'company_name')
      const { error: err2 } = await supabase.from('app_settings').update({ value: timezone }).eq('key', 'timezone')
      const { error: err3 } = await supabase.from('app_settings').update({ value: currency }).eq('key', 'currency')

      if (!err1 && !err2 && !err3) {
        alert('Ayarlar başarıyla güncellendi!')
        loadSettingsData()
      } else {
        alert('Güncelleme sırasında hata oluştu.')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Sistem Ayarları</h1>
        <p className="text-xs text-muted-foreground mt-0.5 font-medium">Sunton CRM şirket profili, durum tanımları ve entegrasyon ayarları.</p>
      </div>

      {/* Main Grid: Left Tabs / Right Sheets */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 select-none">
        
        {/* Left Side Tab selectors */}
        <div className="flex flex-col gap-1 border-r border-border pr-4 h-fit shrink-0">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer ${
              activeTab === 'general' ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            <Building className="h-4 w-4" />
            Genel Ayarlar
          </button>
          <button
            onClick={() => setActiveTab('crm')}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer ${
              activeTab === 'crm' ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            <Sliders className="h-4 w-4" />
            CRM Yapılandırması
          </button>
          <button
            onClick={() => setActiveTab('callcenter')}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer ${
              activeTab === 'callcenter' ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            <PhoneCall className="h-4 w-4" />
            Çağrı & Santral
          </button>
          <button
            onClick={() => setActiveTab('integrations')}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer ${
              activeTab === 'integrations' ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            <LinkIcon className="h-4 w-4" />
            Entegrasyonlar
          </button>

          <div className="border-t border-border my-2 pt-2" />

          <Link
            href="/dashboard/settings/legacy-mappings"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold text-left text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          >
            <Sliders className="h-4 w-4 text-muted-foreground" />
            Eski Veri Eşleştirmeleri
          </Link>
        </div>

        {/* Right Side Sheet Content panels */}
        <div className="md:col-span-3 bg-card border border-border p-6 rounded-xl shadow-xs">
          
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {activeTab === 'general' && (
                <form onSubmit={handleSaveGeneral} className="space-y-4 text-xs max-w-md">
                  <h3 className="text-xs font-bold text-foreground mb-4 uppercase tracking-wider">Şirket Profili & Yerel Ayarlar</h3>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">ŞİRKET RESMİ ADI *</label>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground mb-1">SAAT DİLİMİ</label>
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-full h-9 px-2 bg-background border border-border rounded-lg"
                      >
                        <option value="Europe/Istanbul">Europe/Istanbul (GMT+3)</option>
                        <option value="UTC">UTC (GMT+0)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground mb-1">PARA BİRİMİ</label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-full h-9 px-2 bg-background border border-border rounded-lg"
                      >
                        <option value="TRY">TRY - Türk Lirası</option>
                        <option value="USD">USD - Dolar</option>
                        <option value="EUR">EUR - Euro</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-border pt-4 mt-2">
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Tarih Formatı</span>
                      <p className="font-semibold text-foreground mt-0.5">GG.AA.YYYY</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Saat Formatı</span>
                      <p className="font-semibold text-foreground mt-0.5">SS:DD</p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="h-9 px-4.5 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 flex items-center gap-1 cursor-pointer transition-colors shadow-sm disabled:opacity-50"
                  >
                    {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                    Ayarları Kaydet
                  </button>
                </form>
              )}

              {activeTab === 'crm' && (
                <div className="space-y-4 text-xs">
                  <h3 className="text-xs font-bold text-foreground mb-4 uppercase tracking-wider">Durum & Kaynak Değerleri</h3>
                  
                  <div className="p-3 bg-muted/40 rounded-lg border border-border/60">
                    <p className="text-muted-foreground leading-relaxed">
                      Lütfen lead durumlarını, müşteri kaynak listelerini ve satış adımlarını veritabanı şemaları üzerinden güncelleyin. 
                      Lookup tabloları (lead_sources, lead_statuses) CRM genelinde dinamik olarak çalışmaktadır.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'callcenter' && (
                <div className="space-y-4 text-xs">
                  <h3 className="text-xs font-bold text-foreground mb-4 uppercase tracking-wider font-sans">Santral & Çağrı Yönetimi</h3>
                  
                  <div className="p-3 bg-muted/40 rounded-lg border border-border/60 space-y-2">
                    <div className="flex items-center gap-2 text-primary font-bold">
                      <PhoneCall className="h-4 w-4" />
                      Telefon Santrali: Entegrasyon Yok
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      Gerçek telefon santrali / SIP trunk bağlantısı kurulmamıştır. Temsilciler arama kayıtlarını ve görüşme sonuçlarını manuel olarak sisteme işlemektedir. Telefon numaralarına tıklandığında cihazın varsayılan dialer protokolü (`tel:`) çalıştırılır.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'integrations' && (
                <div className="space-y-5 text-xs">
                  <h3 className="text-xs font-bold text-foreground mb-2 uppercase tracking-wider">Harici Servis Bağlantıları</h3>
                  
                  {/* WhatsApp Card */}
                  <div className="p-4 border border-border bg-card rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-foreground">WhatsApp API Entegrasyonu</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Müşteri adaylarına anlık WhatsApp mesajı gönderimi ve gelen cevapların takibi.</p>
                    </div>
                    <span className="px-2.5 py-1 bg-muted text-muted-foreground rounded text-[10px] font-bold border border-border">
                      Bağlı Değil / Yakında
                    </span>
                  </div>

                  {/* Email Card */}
                  <div className="p-4 border border-border bg-card rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-foreground">Kurumsal E-Posta Entegrasyonu (SMTP / IMAP)</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">CRM üzerinden e-posta alıp gönderme ve e-posta geçmişlerini kurşunlara bağlama.</p>
                    </div>
                    <span className="px-2.5 py-1 bg-muted text-muted-foreground rounded text-[10px] font-bold border border-border">
                      Bağlı Değil
                    </span>
                  </div>

                  {/* Telephony SIP Card */}
                  <div className="p-4 border border-border bg-card rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-foreground">Bulut Santral Entegrasyonu (Asterisk / VoIP)</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Otomatik çağrı dağıtımı, arama kuyruğu yönetimi ve ses kayıtlarının dinlenmesi.</p>
                    </div>
                    <span className="px-2.5 py-1 bg-muted text-muted-foreground rounded text-[10px] font-bold border border-border">
                      Yapılandırma Yok
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

        </div>

      </div>

    </div>
  )
}

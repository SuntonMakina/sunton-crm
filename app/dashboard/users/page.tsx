'use client'

import React, { useState, useEffect } from 'react'
import { createClient as createSupabaseRaw } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Profile, Department } from '@/types/crm'
import {
  UserCog,
  Search,
  Plus,
  Shield,
  Loader2,
  Trash2,
  Lock,
  Edit,
  Sliders,
  X,
  Target
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'

export default function UsersPage() {
  const supabase = createClient()

  // States
  const [users, setUsers] = useState<any[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [myProfile, setMyProfile] = useState<Profile | null>(null)

  // Modals state
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isTargetOpen, setIsTargetOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit user state
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [editForm, setEditForm] = useState({
    role: 'call_center_rep' as any,
    department_id: '',
    status: 'active' as any,
    is_active: true
  })

  // Edit target state
  const [targetingUser, setTargetingUser] = useState<any>(null)
  const [targetForm, setTargetForm] = useState({
    target_leads: 0,
    target_calls: 0,
    target_sales: 0,
    target_revenue: 0
  })

  // Add user state
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'call_center_rep' as any,
    department_id: ''
  })

  // Add new user submit handler
  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addForm.firstName || !addForm.lastName || !addForm.email || !addForm.password) {
      alert('Lütfen ad, soyad, e-posta ve şifre alanlarını doldurun.')
      return
    }

    setSaving(true)
    try {
      // Create a raw supabase client without session persistence to prevent signing out the current admin
      const rawClient = createSupabaseRaw(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        }
      )

      const fullName = `${addForm.firstName} ${addForm.lastName}`

      // Register the new user in Auth
      const { data, error } = await rawClient.auth.signUp({
        email: addForm.email,
        password: addForm.password,
        options: {
          data: {
            first_name: addForm.firstName,
            last_name: addForm.lastName,
            full_name: fullName,
            role: addForm.role
          }
        }
      })

      if (error) {
        alert(error.message)
      } else if (data.user) {
        // If department is selected, update the newly created profile using the main admin client
        if (addForm.department_id) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ department_id: addForm.department_id })
            .eq('id', data.user.id)
          
          if (updateError) {
            console.error('Error setting department:', updateError.message)
          }
        }

        alert('Kullanıcı hesabı başarıyla oluşturuldu.')
        setIsAddOpen(false)
        setAddForm({
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          role: 'call_center_rep',
          department_id: ''
        })
        initData()
      }
    } catch (err: any) {
      alert('Kullanıcı oluşturulurken hata: ' + err.message)
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // Load current user, departments & all profiles
  const initData = async () => {
    setLoading(true)
    try {
      // Current User
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (prof) setMyProfile(prof as Profile)
      }

      const { data: depts } = await supabase.from('departments').select('*').eq('is_active', true)
      if (depts) setDepartments(depts)

      // Fetch all user profiles with department details and target values
      const { data: profilesList, error } = await supabase
        .from('profiles')
        .select(`
          *,
          departments(name),
          user_targets(target_leads, target_calls, target_sales, target_revenue)
        `)
      
      if (!error && profilesList) {
        setUsers(profilesList)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    initData()
  }, [])

  // Check if current user has permissions (super_admin or admin)
  const isAuthorized = myProfile?.role === 'super_admin' || myProfile?.role === 'admin'

  // Edit user details form submit
  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          role: editForm.role,
          department_id: editForm.department_id || null,
          status: editForm.status,
          is_active: editForm.is_active
        })
        .eq('id', editingUser.id)

      if (!error) {
        setIsEditOpen(false)
        setEditingUser(null)
        initData()
      } else {
        alert(error.message)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // Update representative targets submit
  const handleTargetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetingUser) return

    setSaving(true)
    try {
      const today = new Date()
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]

      // Check if target already exists
      const { data: existing } = await supabase
        .from('user_targets')
        .select('id')
        .eq('user_id', targetingUser.id)
        .eq('period_start', startOfMonth)
        .limit(1)

      let resError
      if (existing && existing.length > 0) {
        // Update
        const { error } = await supabase
          .from('user_targets')
          .update({
            target_leads: targetForm.target_leads,
            target_calls: targetForm.target_calls,
            target_sales: targetForm.target_sales,
            target_revenue: targetForm.target_revenue
          })
          .eq('id', existing[0].id)
        resError = error
      } else {
        // Insert new
        const { error } = await supabase
          .from('user_targets')
          .insert({
            user_id: targetingUser.id,
            period_type: 'monthly',
            period_start: startOfMonth,
            period_end: endOfMonth,
            target_leads: targetForm.target_leads,
            target_calls: targetForm.target_calls,
            target_sales: targetForm.target_sales,
            target_revenue: targetForm.target_revenue
          })
        resError = error
      }

      if (!resError) {
        setIsTargetOpen(false)
        setTargetingUser(null)
        initData()
      } else {
        alert(resError.message)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // Open Edit User Modal
  const openEditModal = (user: any) => {
    setEditingUser(user)
    setEditForm({
      role: user.role,
      department_id: user.department_id || '',
      status: user.status,
      is_active: user.is_active
    })
    setIsEditOpen(true)
  }

  // Open Target Modal
  const openTargetModal = (user: any) => {
    setTargetingUser(user)
    const activeTarget = user.user_targets?.[0] || {}
    setTargetForm({
      target_leads: activeTarget.target_leads || 0,
      target_calls: activeTarget.target_calls || 0,
      target_sales: activeTarget.target_sales || 0,
      target_revenue: activeTarget.target_revenue || 0
    })
    setIsTargetOpen(true)
  }

  // Role display translator
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

  // Search filtering
  const filteredUsers = users.filter(u => {
    const term = searchQuery.trim().toLowerCase()
    if (!term) return true
    return (
      u.full_name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.role?.toLowerCase().includes(term)
    )
  })

  // Block unauthorized viewer screen
  if (!loading && !isAuthorized) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center text-sm space-y-4 max-w-md mx-auto mt-12 shadow-md select-none">
        <div className="h-12 w-12 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center mx-auto">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="font-extrabold text-foreground text-base">Erişim Yetkisi Yok</h2>
        <p className="text-muted-foreground leading-relaxed">
          Kullanıcı yönetimi ve rol atamaları alanını görüntülemek için <strong>Yönetici (admin)</strong> veya <strong>Süper Yönetici</strong> yetkinizin bulunması gerekmektedir.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      
      {/* Title & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Kullanıcılar</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Sistem kullanıcı yetkileri, rol tanımları ve aylık hedefleri yönetimi.</p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="h-9 px-3.5 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" />
          Yeni Kullanıcı Ekle
        </button>
      </div>

      {/* Filters Search */}
      <div className="bg-card border border-border p-3.5 rounded-xl shadow-xs">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Kullanıcı ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-8.5 pr-3 bg-background border border-border rounded-lg text-xs focus:outline-none"
          />
        </div>
      </div>

      {/* Profiles list table */}
      {loading ? (
        <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground mt-3 font-medium">Kullanıcı listesi yükleniyor...</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[10px] font-bold uppercase text-muted-foreground select-none">
                  <th className="py-3 px-4">Kullanıcı Adı</th>
                  <th className="py-3 px-4">E-Posta</th>
                  <th className="py-3 px-4">Rol</th>
                  <th className="py-3 px-4">Departman</th>
                  <th className="py-3 px-4">Durum</th>
                  <th className="py-3 px-4 text-center">Hedefler (Aylık)</th>
                  <th className="py-3 px-4 text-center">Yönetim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs text-foreground">
                {filteredUsers.map((user) => {
                  const target = user.user_targets?.[0] || {}
                  const targetDisplay = target.target_leads 
                    ? `Lead: ${target.target_leads} | Çağrı: ${target.target_calls}`
                    : 'Belirlenmemiş'

                  return (
                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-foreground">{user.full_name || 'İsimsiz'}</td>
                      <td className="py-3.5 px-4 text-muted-foreground">{user.email}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded">
                          {translateRole(user.role)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground">{user.departments?.name || '-'}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          user.is_active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
                        }`}>
                          {user.is_active ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center text-muted-foreground font-semibold">
                        {targetDisplay}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openTargetModal(user)}
                            className="p-1.5 hover:bg-accent text-primary hover:text-primary-foreground rounded-lg cursor-pointer transition-colors"
                            title="Performans Hedefi Belirle"
                          >
                            <Target className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground rounded-lg cursor-pointer transition-colors"
                            title="Kullanıcıyı Düzenle"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dialog: Edit User Modal */}
      {isEditOpen && editingUser && (
        <Dialog.Root open={isEditOpen} onOpenChange={setIsEditOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-md z-50 animate-in fade-in zoom-in-95 duration-150">
              <Dialog.Title className="text-base font-bold text-foreground mb-4">Kullanıcıyı Düzenle</Dialog.Title>
              <form onSubmit={handleEditUserSubmit} className="space-y-4 text-xs">
                
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">ROLLER</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                    className="w-full h-9 px-2 bg-background border border-border rounded-lg"
                  >
                    <option value="call_center_rep">Çağrı Merkezi Temsilcisi (call_center_rep)</option>
                    <option value="sales_specialist">Satış Uzmanı (sales_specialist)</option>
                    <option value="team_leader">Takım Lideri (team_leader)</option>
                    <option value="sales_manager">Satış Müdürü (sales_manager)</option>
                    <option value="admin">Yönetici (admin)</option>
                    <option value="viewer">Salt Okunur Görüntüleyici (viewer)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">DEPARTMAN</label>
                  <select
                    value={editForm.department_id}
                    onChange={(e) => setEditForm({ ...editForm, department_id: e.target.value })}
                    className="w-full h-9 px-2 bg-background border border-border rounded-lg"
                  >
                    <option value="">Seçiniz</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">DURUM</label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                      className="w-full h-9 px-2 bg-background border border-border rounded-lg"
                    >
                      <option value="active">Aktif</option>
                      <option value="inactive">Çevrimdışı / Pasif</option>
                      <option value="away">Dışarıda / İzinli</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">SİSTEM ERİŞİMİ</label>
                    <select
                      value={editForm.is_active ? 'true' : 'false'}
                      onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === 'true' })}
                      className="w-full h-9 px-2 bg-background border border-border rounded-lg"
                    >
                      <option value="true">Etkin (Giriş Yapabilir)</option>
                      <option value="false">Engelli (Giriş Yapamaz)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Dialog.Close asChild>
                    <button type="button" className="px-4 py-2 border border-border hover:bg-accent rounded-lg text-xs font-semibold cursor-pointer">Vazgeç</button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                    Güncelle
                  </button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {/* Dialog: Edit User Performance Targets Modal */}
      {isTargetOpen && targetingUser && (
        <Dialog.Root open={isTargetOpen} onOpenChange={setIsTargetOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-md z-50 animate-in fade-in zoom-in-95 duration-150">
              <Dialog.Title className="text-base font-bold text-foreground mb-2 flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Aylık Performans Hedefleri
              </Dialog.Title>
              <p className="text-xs text-muted-foreground mb-4"><strong>{targetingUser.full_name}</strong> için geçerli takvim ayı hedeflerini güncelleyin.</p>
              <form onSubmit={handleTargetSubmit} className="space-y-4 text-xs">
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">HEDEF LEAD ADETİ</label>
                    <input
                      type="number"
                      min={0}
                      value={targetForm.target_leads || ''}
                      onChange={(e) => setTargetForm({ ...targetForm, target_leads: parseInt(e.target.value) || 0 })}
                      className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">HEDEF ÇAĞRI SAYISI</label>
                    <input
                      type="number"
                      min={0}
                      value={targetForm.target_calls || ''}
                      onChange={(e) => setTargetForm({ ...targetForm, target_calls: parseInt(e.target.value) || 0 })}
                      className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">HEDEF SATIŞ ADETİ</label>
                    <input
                      type="number"
                      min={0}
                      value={targetForm.target_sales || ''}
                      onChange={(e) => setTargetForm({ ...targetForm, target_sales: parseInt(e.target.value) || 0 })}
                      className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">HEDEF CİRO (TRY)</label>
                    <input
                      type="number"
                      min={0}
                      value={targetForm.target_revenue || ''}
                      onChange={(e) => setTargetForm({ ...targetForm, target_revenue: parseFloat(e.target.value) || 0 })}
                      className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Dialog.Close asChild>
                    <button type="button" className="px-4 py-2 border border-border hover:bg-accent rounded-lg text-xs font-semibold cursor-pointer">Vazgeç</button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                    Hedefleri Kaydet
                  </button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {/* Dialog: Add User Modal */}
      {isAddOpen && (
        <Dialog.Root open={isAddOpen} onOpenChange={setIsAddOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-md z-50 animate-in fade-in zoom-in-95 duration-150">
              <Dialog.Title className="text-base font-bold text-foreground mb-4">Yeni Kullanıcı Ekle</Dialog.Title>
              <form onSubmit={handleAddUserSubmit} className="space-y-4 text-xs">
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">AD *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ahmet"
                      value={addForm.firstName}
                      onChange={(e) => setAddForm({ ...addForm, firstName: e.target.value })}
                      className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">SOYAD *</label>
                    <input
                      type="text"
                      required
                      placeholder="Yılmaz"
                      value={addForm.lastName}
                      onChange={(e) => setAddForm({ ...addForm, lastName: e.target.value })}
                      className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">E-POSTA ADRESİ *</label>
                  <input
                    type="email"
                    required
                    placeholder="temsilci@sunton.com.tr"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">ŞİFRE *</label>
                  <input
                    type="password"
                    required
                    placeholder="•••••• (En az 6 karakter)"
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">ROL</label>
                    <select
                      value={addForm.role}
                      onChange={(e) => setAddForm({ ...addForm, role: e.target.value as any })}
                      className="w-full h-9 px-2 bg-background border border-border rounded-lg"
                    >
                      <option value="call_center_rep">Çağrı Merkezi Temsilcisi</option>
                      <option value="sales_specialist">Satış Uzmanı</option>
                      <option value="team_leader">Takım Lideri</option>
                      <option value="sales_manager">Satış Müdürü</option>
                      <option value="admin">Yönetici</option>
                      <option value="viewer">Salt Okunur Görüntüleyici</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">DEPARTMAN</label>
                    <select
                      value={addForm.department_id}
                      onChange={(e) => setAddForm({ ...addForm, department_id: e.target.value })}
                      className="w-full h-9 px-2 bg-background border border-border rounded-lg"
                    >
                      <option value="">Seçiniz</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Dialog.Close asChild>
                    <button type="button" className="px-4 py-2 border border-border hover:bg-accent rounded-lg text-xs font-semibold cursor-pointer">Vazgeç</button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                    Oluştur
                  </button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

    </div>
  )
}
const AlertCircle = (props: any) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
)

'use client'

import React, { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { createClient } from '@/lib/supabase/client'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  Phone,
  Video,
  MapPin,
  ClipboardList,
  Clock,
  X
} from 'lucide-react'

// Date helpers for monthly calendar
const TURKISH_MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]

export default function CalendarPage() {
  const supabase = createClient()

  // States
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedDayEvents, setSelectedDayEvents] = useState<any[]>([])
  const [activeDayStr, setActiveDayStr] = useState<string | null>(null)

  // Event creation form
  const [eventForm, setEventForm] = useState({
    title: '', description: '', type: 'meeting', date: '', time: '10:00', location: ''
  })

  // Load calendar events (selects tasks and call log callbacks)
  const loadEvents = async () => {
    setLoading(true)
    try {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()

      // start and end date for active month
      const startOfMonth = new Date(year, month, 1).toISOString()
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

      const calendarEvents: any[] = []

      // 1. Fetch tasks
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, due_at, status, task_type, description')
        .eq('is_active', true)
        .gte('due_at', startOfMonth)
        .lte('due_at', endOfMonth)
      
      if (tasks) {
        tasks.forEach(t => {
          calendarEvents.push({
            id: t.id,
            title: t.title,
            description: t.description,
            start_at: t.due_at,
            type: t.task_type === 'callback' ? 'callback' : t.task_type === 'meeting' ? 'meeting' : 'task',
            status: t.status
          })
        })
      }

      // 2. Fetch calls with followups
      const { data: calls } = await supabase
        .from('calls')
        .select('id, started_at, notes, follow_up_at, phone_number')
        .eq('follow_up_required', true)
        .gte('follow_up_at', startOfMonth)
        .lte('follow_up_at', endOfMonth)

      if (calls) {
        calls.forEach(c => {
          calendarEvents.push({
            id: c.id,
            title: `${c.phone_number} - Geri Arama Takibi`,
            description: c.notes,
            start_at: c.follow_up_at,
            type: 'call',
            status: 'pending'
          })
        })
      }

      setEvents(calendarEvents)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEvents()
  }, [currentDate])

  // Get list of days in active month
  const getDaysInMonth = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    
    // First day of month weekday index (convert 0-Sunday to 0-Monday grid index)
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7
    const totalDays = new Date(year, month + 1, 0).getDate()
    
    const dayArray: (Date | null)[] = []
    
    // Fill empty offset boxes before start of month
    for (let i = 0; i < firstDayIndex; i++) {
      dayArray.push(null)
    }
    
    // Fill month days
    for (let d = 1; d <= totalDays; d++) {
      dayArray.push(new Date(year, month, d))
    }
    
    return dayArray
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    setSelectedDayEvents([])
    setActiveDayStr(null)
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    setSelectedDayEvents([])
    setActiveDayStr(null)
  }

  const handleDaySelect = (day: Date) => {
    const dateStr = day.toISOString().split('T')[0]
    setActiveDayStr(dateStr)
    const dayEvts = events.filter(e => e.start_at && e.start_at.startsWith(dateStr))
    setSelectedDayEvents(dayEvts)
  }

  // Create new task event from calendar
  const handleCreateCalendarEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventForm.title || !eventForm.date) {
      alert('Lütfen başlık ve tarih alanlarını doldurun.')
      return
    }

    setSaving(true)
    try {
      const taskDue = new Date(`${eventForm.date}T${eventForm.time}:00`).toISOString()

      const { error } = await supabase.from('tasks').insert({
        title: eventForm.title,
        description: eventForm.description || null,
        task_type: eventForm.type === 'meeting' ? 'meeting' : eventForm.type === 'call' ? 'call' : 'general',
        status: 'pending',
        due_at: taskDue
      })

      if (!error) {
        setIsAddOpen(false)
        setEventForm({ title: '', description: '', type: 'meeting', date: '', time: '10:00', location: '' })
        loadEvents()
        setSelectedDayEvents([])
        setActiveDayStr(null)
      } else {
        alert(error.message)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const days = getDaysInMonth()

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Takvim</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Toplantı planlamaları, geri arama takvimleri ve görev ajandası.</p>
        </div>

        <button
          onClick={() => {
            const todayStr = new Date().toISOString().split('T')[0]
            setEventForm(f => ({ ...f, date: todayStr }))
            setIsAddOpen(true)
          }}
          className="h-9 px-3.5 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
        >
          <Plus className="h-4.5 w-4.5" />
          Etkinlik Oluştur
        </button>
      </div>

      {/* Main Grid & Details layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Monthly day grid calendar */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-xs lg:col-span-2 select-none">
          {/* Header selectors */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-extrabold text-sm text-foreground">
              {TURKISH_MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                className="h-8 w-8 rounded border border-border hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 h-8 rounded border border-border hover:bg-accent text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                Bugün
              </button>
              <button
                onClick={handleNextMonth}
                className="h-8 w-8 rounded border border-border hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Month grid table */}
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1 text-center">
              {/* Day header names */}
              {WEEKDAYS.map(day => (
                <div key={day} className="py-2 text-[10px] font-bold text-muted-foreground uppercase">{day}</div>
              ))}

              {/* Day values grid */}
              {days.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} className="aspect-square bg-muted/10 rounded-lg border border-transparent" />
                
                const dateStr = day.toISOString().split('T')[0]
                const dayEvts = events.filter(e => e.start_at && e.start_at.startsWith(dateStr))
                const isToday = new Date().toISOString().split('T')[0] === dateStr
                const isSelected = activeDayStr === dateStr

                return (
                  <button
                    key={dateStr}
                    onClick={() => handleDaySelect(day)}
                    className={`aspect-square p-1.5 rounded-lg border flex flex-col justify-between items-center transition-all cursor-pointer ${
                      isToday ? 'border-primary/50 bg-primary/5' : 'border-border/60 hover:bg-accent/40'
                    } ${
                      isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
                    }`}
                  >
                    <span className={`text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full ${
                      isToday ? 'bg-primary text-white' : 'text-foreground'
                    }`}>
                      {day.getDate()}
                    </span>
                    {dayEvts.length > 0 && (
                      <div className="flex gap-1">
                        {dayEvts.slice(0, 3).map((evt, eIdx) => (
                          <span
                            key={eIdx}
                            className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                              evt.type === 'meeting' ? 'bg-indigo-500' :
                              evt.type === 'call' || evt.type === 'callback' ? 'bg-blue-500' : 'bg-amber-500'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Selected day Agenda sidebar details */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col min-h-[300px]">
          <h3 className="text-xs font-bold text-foreground mb-4 uppercase tracking-wider flex items-center gap-1.5 select-none">
            <CalendarIcon className="h-4.5 w-4.5 text-primary" />
            Günlük Plan & Randevular
          </h3>
          
          {activeDayStr ? (
            <div className="flex-1 flex flex-col justify-between">
              <div className="space-y-3.5">
                <span className="text-[10px] font-extrabold bg-muted text-muted-foreground px-2 py-1 rounded inline-block">
                  {new Date(activeDayStr).toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                
                {selectedDayEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-8 text-center leading-relaxed">
                    Seçilen gün için herhangi bir ajanda kaydı veya toplantı planı bulunmuyor.
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
                    {selectedDayEvents.map((evt) => (
                      <div key={evt.id} className="p-3 border border-border rounded-lg bg-muted/20 flex flex-col gap-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground line-clamp-1">{evt.title}</span>
                          <span className="text-[10px] font-mono font-medium">
                            {new Date(evt.start_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {evt.description && <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2 mt-0.5">{evt.description}</p>}
                        
                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-border/50 text-[9px] text-muted-foreground">
                          <span className="flex items-center gap-0.5 font-bold uppercase text-primary">
                            {evt.type === 'meeting' ? <Video className="h-3 w-3" /> : evt.type === 'call' || evt.type === 'callback' ? <Phone className="h-3 w-3" /> : <ClipboardList className="h-3 w-3" />}
                            {evt.type === 'meeting' ? 'Toplantı' : evt.type === 'call' || evt.type === 'callback' ? 'Görüşme' : 'Görev'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center text-xs text-muted-foreground leading-relaxed">
              Planlarını ve randevularını görmek için soldaki takvimden bir gün seçin.
            </div>
          )}
        </div>

      </div>

      {/* Dialog: Create Event Modal */}
      {isAddOpen && (
        <Dialog.Root open={isAddOpen} onOpenChange={setIsAddOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="bg-black/40 backdrop-blur-xs fixed inset-0 z-50" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-md z-50 animate-in fade-in zoom-in-95 duration-150">
              <Dialog.Title className="text-base font-bold text-foreground mb-4">Yeni Takvim Etkinliği / Görevi</Dialog.Title>
              <form onSubmit={handleCreateCalendarEvent} className="space-y-4 text-xs">
                
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">BAŞLIK *</label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: Özkan Lazer Sunum Toplantısı"
                    value={eventForm.title}
                    onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                    className="w-full h-9 px-3 bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">AÇIKLAMA</label>
                  <textarea
                    rows={2}
                    value={eventForm.description}
                    onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg p-2 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">TÜR</label>
                    <select
                      value={eventForm.type}
                      onChange={(e) => setEventForm({ ...eventForm, type: e.target.value })}
                      className="w-full h-9 px-2 bg-background border border-border rounded-lg"
                    >
                      <option value="meeting">Toplantı (Meeting)</option>
                      <option value="call">Arama (Call)</option>
                      <option value="general">Genel Görev (Task)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">SAAT</label>
                    <input
                      type="time"
                      value={eventForm.time}
                      onChange={(e) => setEventForm({ ...eventForm, time: e.target.value })}
                      className="w-full h-9 px-3 bg-background border border-border rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1">TARİH *</label>
                  <input
                    type="date"
                    required
                    value={eventForm.date}
                    onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                    className="w-full h-9 px-3 bg-background border border-border rounded-lg"
                  />
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

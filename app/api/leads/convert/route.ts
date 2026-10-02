import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // 1. Verify User Session
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 401 })
    }

    // 2. Fetch User Profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', user.id)
      .single()

    const userName = profile?.full_name || 'Temsilci'

    const body = await request.json()
    const { leadId, firstName, lastName, companyName, product, note, addToQueue } = body

    if (!leadId) {
      return NextResponse.json({ error: 'leadId parametresi zorunludur.' }, { status: 400 })
    }

    const cleanFirstName = (firstName || '').trim() || 'WhatsApp'
    const cleanLastName = (lastName || '').trim() || 'Müşterisi'
    const cleanCompanyName = (companyName || '').trim() || null
    const cleanProduct = (product || '').trim() || null
    const cleanNote = (note || '').trim() || null

    // 3. Find target lead
    const { data: currentLead, error: fetchErr } = await supabase
      .from('leads')
      .select('id, lead_number, status_id, extra_notes')
      .eq('id', leadId)
      .single()

    if (fetchErr || !currentLead) {
      return NextResponse.json({ error: 'Aday kaydı bulunamadı.' }, { status: 404 })
    }

    const currYear = new Date().getFullYear()

    // 4. Calculate safe next lead number
    let finalLeadNumber = currentLead.lead_number

    if (!finalLeadNumber) {
      // Find true max numeric suffix
      const { data: maxLeads } = await supabase
        .from('leads')
        .select('lead_number')
        .not('lead_number', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200)

      let maxSeq = 3533
      if (maxLeads && maxLeads.length > 0) {
        for (const l of maxLeads) {
          if (l.lead_number) {
            const m = l.lead_number.match(/(\d+)$/)
            if (m) {
              const num = parseInt(m[1], 10)
              if (num > maxSeq) maxSeq = num
            }
          }
        }
      }

      let candidateSeq = maxSeq + 1
      let candidateNum = `LD-${currYear}-${String(candidateSeq).padStart(6, '0')}`

      // Collision check with retry
      for (let i = 0; i < 50; i++) {
        const { data: exists } = await supabase
          .from('leads')
          .select('id')
          .eq('lead_number', candidateNum)
          .maybeSingle()

        if (!exists) {
          finalLeadNumber = candidateNum
          break
        }
        candidateSeq++
        candidateNum = `LD-${currYear}-${String(candidateSeq).padStart(6, '0')}`
      }

      if (!finalLeadNumber) {
        const randomSalt = Math.floor(1000 + Math.random() * 9000)
        finalLeadNumber = `LD-${currYear}-${String(Date.now()).slice(-4)}${randomSalt.toString().slice(-2)}`
      }
    }

    // Prepare extra notes
    let finalNotes = currentLead.extra_notes || ''
    if (cleanNote) {
      const timeStr = new Date().toLocaleString('tr-TR')
      finalNotes = `[${timeStr}] - ${cleanNote}\n` + finalNotes
    }

    // 5. Update lead in Supabase
    let updateResult: any = null
    let lastUpdateErr: any = null

    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt > 0) {
        const candidateSeq = 3215 + attempt + Math.floor(Math.random() * 100)
        finalLeadNumber = `LD-${currYear}-${String(candidateSeq).padStart(6, '0')}`
      }

      const now = new Date()
      const payload: any = {
        first_name: cleanFirstName,
        last_name: cleanLastName,
        company_name: cleanCompanyName,
        lead_number: finalLeadNumber,
        status_id: '22222222-0000-0000-0000-000000000001', // Yeni Lead
        assigned_call_center_user_id: user.id,
        whatsapp_step: 'viewed',
        created_at: new Date().toISOString(),
        created_by: user.id,
        updated_by: user.id
      }

      if (cleanProduct) {
        payload.requested_product = cleanProduct
      }
      if (finalNotes) {
        payload.extra_notes = finalNotes
      }
      if (addToQueue) {
        payload.callback_status = 'pending'
        payload.next_contact_at = now.toISOString()
      } else {
        payload.callback_status = 'none'
        payload.next_contact_at = null
      }

      const { data: updatedLead, error: updateErr } = await supabase
        .from('leads')
        .update(payload)
        .eq('id', leadId)
        .select()
        .single()

      if (!updateErr && updatedLead) {
        updateResult = updatedLead
        break
      }

      lastUpdateErr = updateErr
    }

    if (!updateResult) {
      console.error('Lead conversion failed after retries:', lastUpdateErr)
      return NextResponse.json({ 
        error: `Aday kartı güncellenemedi: ${lastUpdateErr?.message || 'Bilinmeyen veritabanı hatası'}` 
      }, { status: 500 })
    }

    // 6. Log activity
    await supabase.from('activities').insert({
      entity_type: 'lead',
      entity_id: leadId,
      activity_type: 'status_changed',
      title: 'WhatsApp Sohbeti Adaya Dönüştürüldü',
      description: `${userName} bu sohbeti yeni aday (${cleanFirstName} ${cleanLastName}) olarak kaydetti.`,
      user_id: user.id
    })

    return NextResponse.json({ 
      success: true, 
      lead: updateResult,
      lead_number: finalLeadNumber
    })

  } catch (err: any) {
    console.error('Lead conversion exception:', err)
    return NextResponse.json({ error: `Sunucu hatası: ${err.message}` }, { status: 500 })
  }
}

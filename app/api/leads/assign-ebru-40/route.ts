import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import fs from 'fs'
import path from 'path'
import { generateNextLeadNumber, calculateNextWorkingTime } from '@/lib/utils'

export async function GET() {
  try {
    const supabase = await createClient()
    const ebruId = 'b2b2b2b2-bbbb-cccc-dddd-eeeeeeeeeeee'

    const jsonPath = path.join(process.cwd(), 'scratch', 'ebru_40_leads.json')
    if (!fs.existsSync(jsonPath)) {
      return NextResponse.json({ error: 'ebru_40_leads.json bulunamadı.' }, { status: 404 })
    }

    const leadsData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    const insertedLeads = []

    // Base start time: today 10:30
    let currentTime = new Date()
    currentTime.setHours(10, 30, 0, 0)

    for (let i = 0; i < leadsData.length; i++) {
      const item = leadsData[i]
      
      // Check if lead with this phone or name already assigned to Ebru
      const { data: existing } = await supabase
        .from('leads')
        .select('id, lead_number')
        .eq('phone_normalized', item.phone_normalized)
        .eq('is_active', true)
        .maybeSingle()

      if (existing) {
        insertedLeads.push({ status: 'already_exists', id: existing.id, company: item.company_name, lead_number: existing.lead_number })
        continue
      }

      // Generate next lead number
      const leadNumber = await generateNextLeadNumber(supabase)
      
      // Calculate scheduled call slot (7 mins apart, avoid lunch 12:30-13:30)
      let targetTime = new Date(currentTime.getTime() + i * 7 * 60 * 1000)
      targetTime = calculateNextWorkingTime(targetTime, 0)

      const payload = {
        first_name: item.company_name,
        last_name: '-',
        company_name: item.company_name,
        phone: item.phone,
        phone_normalized: item.phone_normalized,
        province: item.province || 'İzmir',
        district: item.district || '',
        requested_product: item.sector || 'CNC / Lazer Sac İşleme',
        extra_notes: `Sektör/Faaliyet: ${item.sector || '-'}\nAdres: ${item.address || '-'}\nWeb: ${item.website || '-'}\n(Önümüzdeki Hafta Veri Havuzundan Ebru'ya Atandı)`,
        lead_number: leadNumber,
        status_id: '22222222-0000-0000-0000-000000000001', // Yeni Lead
        source_id: '11111111-0000-0000-0000-000000000015', // Harita / Outbound Arama
        assigned_call_center_user_id: ebruId,
        assigned_at: new Date().toISOString(),
        next_contact_at: targetTime.toISOString(),
        whatsapp_step: 'pending',
        callback_status: 'none',
        created_at: new Date().toISOString(),
        created_by: ebruId,
        updated_by: ebruId,
        is_active: true
      }

      const { data: newLead, error: insertErr } = await supabase
        .from('leads')
        .insert(payload)
        .select()
        .single()

      if (insertErr) {
        console.error(`Error inserting lead ${item.company_name}:`, insertErr)
        insertedLeads.push({ status: 'error', error: insertErr.message, company: item.company_name })
      } else {
        insertedLeads.push({ status: 'inserted', id: newLead.id, company: item.company_name, lead_number: newLead.lead_number })
      }
    }

    return NextResponse.json({
      success: true,
      total: leadsData.length,
      results: insertedLeads
    })
  } catch (err: any) {
    console.error('API Error in assign-ebru-40:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

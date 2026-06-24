import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function POST(request: Request) {
  const supabase = await createClient()

  // 1. Verify Authentication & Admin Status
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Bu işlemi yapmaya yetkiniz bulunmuyor.' }, { status: 403 })
  }

  const jsonPath = path.join(process.cwd(), 'scratch', 'legacy_leads_clean.json')
  if (!fs.existsSync(jsonPath)) {
    return NextResponse.json({ error: 'Temizlenmiş eski veri JSON dosyası bulunamadı.' }, { status: 404 })
  }

  // 2. Load JSON Data
  let rawData: any[] = []
  try {
    const fileContent = fs.readFileSync(jsonPath, 'utf-8')
    rawData = JSON.parse(fileContent)
  } catch (err: any) {
    return NextResponse.json({ error: `JSON dosyası okunamadı: ${err.message}` }, { status: 500 })
  }

  // 3. Initialize Import Batch
  const { data: batch, error: batchErr } = await supabase
    .from('legacy_import_batches')
    .insert({
      source_file: '2026 - Mayıs Haziran Verileri.xlsx',
      total_rows: rawData.length,
      status: 'running',
      created_by: user.id
    })
    .select()
    .single()

  if (batchErr || !batch) {
    return NextResponse.json({ error: `Aktarım kaydı oluşturulamadı: ${batchErr?.message}` }, { status: 500 })
  }

  try {
    // 4. Load Lookups for Mapping
    const [
      { data: statuses },
      { data: sources },
      { data: channels },
      { data: provinces },
      { data: mappings }
    ] = await Promise.all([
      supabase.from('lead_statuses').select('id, name'),
      supabase.from('lead_sources').select('id, name'),
      supabase.from('communication_channels').select('id, name'),
      supabase.from('provinces').select('id, name'),
      supabase.from('legacy_sales_rep_mappings').select('legacy_name, mapped_user_id')
    ])

    const statusMap = new Map(statuses?.map(s => [s.name.toLowerCase(), s.id]))
    const sourceMap = new Map(sources?.map(s => [s.name.toLowerCase(), s.id]))
    const channelMap = new Map(channels?.map(c => [c.name.toLowerCase(), c.id]))
    const provinceMap = new Map(provinces?.map(p => [p.name.toLowerCase(), p.id]))
    const repMap = new Map(mappings?.map(m => [m.legacy_name.toLowerCase(), m.mapped_user_id]))

    // May-June lookup defaults
    const defaultStatusId = statusMap.get('yeni lead') || statuses?.[0]?.id
    const defaultSourceId = sourceMap.get('diğer') || sources?.[0]?.id
    const defaultChannelId = channelMap.get('diğer') || channels?.[0]?.id
    const defaultProvinceId = provinceMap.get('belirtilmemiş') || provinces?.[0]?.id

    let inserted = 0
    let updated = 0
    let skipped = 0
    let errors = 0

    const BATCH_SIZE = 50

    function buildLegacyUniqueKey(lead: {
      legacy_source_file?: string | null;
      legacy_excel_row?: number | null;
      phone_normalized?: string | null;
      first_contact_date?: string | null;
      first_contact_time?: string | null;
    }) {
      return [
        lead.legacy_source_file ?? "",
        String(lead.legacy_excel_row ?? ""),
        lead.phone_normalized ?? "",
        lead.first_contact_date ?? "",
        lead.first_contact_time ?? "",
      ].join("|");
    }

    // Check existing legacy leads to distinguish insert/update
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('legacy_source_file, legacy_excel_row, phone_normalized, first_contact_date, first_contact_time')
      .eq('legacy_source_file', '2026 - Mayıs Haziran Verileri.xlsx')
    
    const existingKeys = new Set(existingLeads?.map(l => buildLegacyUniqueKey(l)) || [])

    // Process in batches
    for (let i = 0; i < rawData.length; i += BATCH_SIZE) {
      const chunk = rawData.slice(i, i + BATCH_SIZE)
      const payloads: any[] = []
      const errorRecords: any[] = []

      for (const item of chunk) {
        try {
          // Resolve Name Splitting
          let firstName = 'Belirtilmemiş'
          let lastName = ''
          const nameVal = item.full_name || ''
          
          if (nameVal && nameVal !== 'Belirtilmemiş' && nameVal !== '-') {
            // Split by space, slash, or dash
            const cleanedName = nameVal.replace('/', ' ').replace('-', ' ').trim()
            const parts = cleanedName.split(/\s+/)
            if (parts.length > 1) {
              lastName = parts[parts.length - 1]
              firstName = parts.slice(0, parts.length - 1).join(' ')
            } else {
              firstName = parts[0]
            }
          }

          // Resolve Priority
          let priority = 'normal'
          const prioText = (item.priority || '').toLowerCase()
          if (prioText.includes('yüksek') || prioText.includes('high')) {
            priority = 'high'
          } else if (prioText.includes('düşük') || prioText.includes('low')) {
            priority = 'low'
          }

          // Resolve Lookups
          const statusId = statusMap.get(item.lead_status_text.toLowerCase()) || defaultStatusId
          const sourceId = sourceMap.get(item.lead_source.toLowerCase()) || defaultSourceId
          const channelId = channelMap.get(item.communication_channel.toLowerCase()) || defaultChannelId
          const provinceId = provinceMap.get(item.province.toLowerCase()) || defaultProvinceId
          
          // Satış Temsilcisi mapping check
          const repText = item.sales_representative_text || '-'
          const mappedUserId = repMap.get(repText.toLowerCase()) || null

          payloads.push({
            legacy_lead_id: item.legacy_lead_id,
            legacy_source_file: item.legacy_source_file,
            legacy_excel_row: item.legacy_excel_row,
            legacy_raw_data: item.legacy_raw_data,
            legacy_import_batch_id: batch.id,
            legacy_imported_at: new Date().toISOString(),
            legacy_import_status: 'active',
            first_contact_date: item.first_contact_date,
            first_contact_time: item.first_contact_time,
            first_contact_at: item.first_contact_at,
            sales_status_requested_at: item.sales_status_requested_at,
            full_name: nameVal,
            first_name: firstName,
            last_name: lastName,
            email: item.email || null,
            phone: item.phone,
            phone_normalized: item.phone_normalized,
            province: item.province,
            requested_product: item.requested_product,
            first_message_note: item.first_message_note,
            priority: priority,
            sales_representative_text: repText,
            conversation_completed: item.conversation_completed,
            conversation_date: item.conversation_date,
            conversation_time: item.conversation_time,
            conversation_summary: item.conversation_summary,
            response_positive: item.response_positive,
            next_action: item.next_action,
            sales_active: item.sales_active,
            quote_status: item.quote_status,
            quote_date: item.quote_date,
            estimated_potential_amount: item.estimated_potential_amount,
            converted_to_sale: item.converted_to_sale,
            sale_status: item.sale_status,
            sale_date: item.sale_date,
            sale_amount: item.sale_amount,
            next_follow_up_date: item.next_follow_up_date,
            delay_status: item.delay_status,
            legacy_last_update: item.legacy_last_update,
            extra_notes: item.extra_notes,
            data_quality_flags: item.data_quality_flags,
            status_id: statusId,
            source_id: sourceId,
            communication_channel_id: channelId,
            province_id: provinceId,
            assigned_sales_user_id: mappedUserId
          })

          const leadKey = buildLegacyUniqueKey({
            legacy_source_file: item.legacy_source_file,
            legacy_excel_row: item.legacy_excel_row,
            phone_normalized: item.phone_normalized,
            first_contact_date: item.first_contact_date,
            first_contact_time: item.first_contact_time
          })

          // Calculate counters
          if (existingKeys.has(leadKey)) {
            updated++
          } else {
            inserted++
          }
        } catch (itemErr: any) {
          errors++
          errorRecords.push({
            batch_id: batch.id,
            legacy_excel_row: item.legacy_excel_row,
            legacy_lead_id: item.legacy_lead_id,
            raw_data: item,
            error_message: itemErr.message
          })
        }
      }

      // Upsert Leads chunk
      if (payloads.length > 0) {
        const { error: upsertErr } = await supabase
          .from('leads')
          .upsert(payloads, { 
            onConflict: 'legacy_source_file,legacy_excel_row',
            ignoreDuplicates: false
          })

        if (upsertErr) {
          // If the whole batch fails, log all as errors
          errors += payloads.length
          const getPayloadKey = (p: any) => buildLegacyUniqueKey({
            legacy_source_file: p.legacy_source_file,
            legacy_excel_row: p.legacy_excel_row,
            phone_normalized: p.phone_normalized,
            first_contact_date: p.first_contact_date,
            first_contact_time: p.first_contact_time
          })
          inserted -= payloads.filter(p => !existingKeys.has(getPayloadKey(p))).length
          updated -= payloads.filter(p => existingKeys.has(getPayloadKey(p))).length
          
          const errorPayloads = payloads.map(p => ({
            batch_id: batch.id,
            legacy_excel_row: p.legacy_excel_row,
            legacy_lead_id: p.legacy_lead_id,
            raw_data: p.legacy_raw_data,
            error_message: `Upsert hatası: ${upsertErr.message}`
          }))

          await supabase.from('legacy_import_errors').insert(errorPayloads)
        }
      }

      // Insert Errors chunk
      if (errorRecords.length > 0) {
        await supabase.from('legacy_import_errors').insert(errorRecords)
      }
    }

    // 5. Update Batch Status to Completed
    await supabase
      .from('legacy_import_batches')
      .update({
        completed_at: new Date().toISOString(),
        inserted_rows: inserted,
        updated_rows: updated,
        skipped_rows: skipped,
        error_rows: errors,
        status: 'completed',
        notes: `Aktarım başarıyla tamamlandı. ${inserted} yeni kayıt eklendi, ${updated} kayıt güncellendi.`
      })
      .eq('id', batch.id)

    return NextResponse.json({
      success: true,
      batchId: batch.id,
      inserted,
      updated,
      skipped,
      errors
    })

  } catch (err: any) {
    // Fail Batch on critical error
    await supabase
      .from('legacy_import_batches')
      .update({
        completed_at: new Date().toISOString(),
        status: 'failed',
        notes: `Hata oluştu: ${err.message}`
      })
      .eq('id', batch.id)

    return NextResponse.json({ error: `Aktarım başarısız oldu: ${err.message}` }, { status: 500 })
  }
}

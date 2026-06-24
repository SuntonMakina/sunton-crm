import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import ws from 'ws'

// 1. Load Supabase Environment Variables
const envContent = fs.readFileSync('.env.local', 'utf-8')
const env = {}
envContent.split('\n').forEach(line => {
  const parts = line.split('=')
  if (parts.length >= 2) {
    const key = parts[0].trim()
    const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '')
    env[key] = value
  }
})

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws }
})

// Normalization Helpers
function normalizeDate(dateStr) {
  if (!dateStr || dateStr.trim() === '' || dateStr.trim() === '-') return null;
  const cleanStr = dateStr.trim();
  // Check DD.MM.YYYY
  const ddmmyyyyMatch = cleanStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddmmyyyyMatch) {
    const day = ddmmyyyyMatch[1].padStart(2, '0');
    const month = ddmmyyyyMatch[2].padStart(2, '0');
    const year = ddmmyyyyMatch[3];
    return `${year}-${month}-${day}`;
  }
  // Check YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
    return cleanStr;
  }
  return null;
}

function normalizeTime(timeStr) {
  if (!timeStr || timeStr.trim() === '' || timeStr.trim() === '-') return null;
  const cleanStr = timeStr.trim();
  const hhmmMatch = cleanStr.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmmMatch) {
    const hours = hhmmMatch[1].padStart(2, '0');
    const minutes = hhmmMatch[2];
    return `${hours}:${minutes}:00`;
  }
  if (/^\d{2}:\d{2}:\d{2}$/.test(cleanStr)) {
    return cleanStr;
  }
  return null;
}

function combineDateTimeToIso(dateStr, timeStr) {
  const normDate = normalizeDate(dateStr);
  if (!normDate) return null;
  const normTime = normalizeTime(timeStr) || '00:00:00';
  try {
    const localStr = `${normDate}T${normTime}+03:00`;
    return new Date(localStr).toISOString();
  } catch (e) {
    return null;
  }
}

function normalizePhone(phoneVal) {
  if (!phoneVal) {
    return { phone_normalized: '', flags: ['missing_phone'] };
  }
  const phoneStr = String(phoneVal).trim();
  const digits = phoneStr.replace(/\D/g, '');
  
  const flags = [];
  if (!digits) {
    return { phone_normalized: '', flags: ['missing_phone'] };
  }
  
  let normalized = digits;
  if (digits.length === 10 && digits.startsWith('5')) {
    normalized = '90' + digits;
  } else if (digits.length === 11 && digits.startsWith('05')) {
    normalized = '90' + digits.slice(1);
  } else if (digits.length === 11 && digits.startsWith('5')) {
    normalized = '90' + digits.slice(0, 10);
    flags.push('invalid_phone');
  } else if (digits.length === 12 && digits.startsWith('90')) {
    normalized = digits;
  } else {
    normalized = digits;
    flags.push('invalid_phone');
  }
  
  return { phone_normalized: normalized, flags };
}

function getLeadSequence(leadId) {
  const match = String(leadId ?? '').trim().match(/^L-(\d+)$/i);
  return match ? Number(match[1]) : null;
}

function normalizeTurkish(val) {
  if (!val) return '';
  let res = String(val).toLowerCase();
  const replacements = {
    'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ş': 's', 'ö': 'o', 'ü': 'u'
  };
  res = res.replace(/[çğıışöüı]/g, m => replacements[m] || m);
  res = res.replace(/[.,;:!?()'"\-+=]/g, ' ');
  res = res.replace(/\s+/g, ' ');
  return res.trim();
}

function findProfileMatch(repName, profiles) {
  if (!repName || repName.trim() === '' || repName.trim() === '-') return null;
  const cleanRep = normalizeTurkish(repName);
  
  for (const p of profiles) {
    const fullNameClean = normalizeTurkish(p.full_name);
    const firstNameClean = normalizeTurkish(p.first_name);
    const lastNameClean = normalizeTurkish(p.last_name);

    if (fullNameClean.includes(cleanRep) || cleanRep.includes(fullNameClean) || 
        firstNameClean.includes(cleanRep) || cleanRep.includes(firstNameClean)) {
      return p.id;
    }
  }
  return null;
}

// 2. Core Import Routine
export async function runImport(filePath) {
  console.log(`Starting import process for file: ${filePath}`);
  
  // A. Check batch JSON file
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found at ${filePath}`);
    return;
  }
  
  const rawContent = fs.readFileSync(filePath, 'utf-8');
  const sourceRecords = JSON.parse(rawContent);
  console.log(`Total raw records found in payload: ${sourceRecords.length}`);

  // B. Authenticate as Mert (admin)
  console.log('Authenticating as Mert...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'mert@suntonmakina.com',
    password: 'Sunton123*'
  });
  
  if (authError || !authData?.session) {
    throw new Error('Authentication failed: ' + (authError?.message || 'No session returned'));
  }
  
  console.log('Authenticated successfully.');

  // C. Load Lookup Tables & Active Profiles
  console.log('Loading profiles and lookups...');
  const [
    { data: profiles },
    { data: statuses },
    { data: sources },
    { data: channels },
    { data: provinces }
  ] = await Promise.all([
    supabase.from('profiles').select('id, first_name, last_name, full_name').eq('is_active', true),
    supabase.from('lead_statuses').select('id, name'),
    supabase.from('lead_sources').select('id, name'),
    supabase.from('communication_channels').select('id, name'),
    supabase.from('provinces').select('id, name')
  ]);

  const statusMap = new Map(statuses?.map(s => [normalizeTurkish(s.name), s.id]));
  const sourceMap = new Map(sources?.map(s => [normalizeTurkish(s.name), s.id]));
  const channelMap = new Map(channels?.map(c => [normalizeTurkish(c.name), c.id]));
  const provinceMap = new Map(provinces?.map(p => [normalizeTurkish(p.name), p.id]));

  const defaultStatusId = statusMap.get('yeni lead') || statuses?.[0]?.id;
  const defaultSourceId = sourceMap.get('diger') || sources?.[0]?.id;
  const defaultChannelId = channelMap.get('diger') || channels?.[0]?.id;
  const defaultProvinceId = provinceMap.get('belirtilmemis') || provinces?.[0]?.id;

  // D. Filter new records (numerical ID > 313)
  const newRecords = sourceRecords.filter(record => {
    const sequence = getLeadSequence(record["Lead ID"]);
    return sequence !== null && sequence > 313;
  });
  
  console.log(`Filtered records (Lead ID > 313): ${newRecords.length} (ignored ${sourceRecords.length - newRecords.length} records <= L-0313)`);
  
  if (newRecords.length === 0) {
    console.log('No new records to import.');
    return;
  }

  // E. Create Legacy Import Batch record
  const sourceFileName = newRecords[0]._legacy_source_file || 'Sunton Makina Reklam Lead Takip - Lead Takip (2).csv';
  const { data: importBatch, error: batchErr } = await supabase
    .from('legacy_import_batches')
    .insert({
      source_file: sourceFileName,
      total_rows: newRecords.length,
      status: 'running',
      created_by: authData.user.id
    })
    .select()
    .single();

  if (batchErr || !importBatch) {
    throw new Error('Failed to initialize import batch: ' + batchErr?.message);
  }

  console.log(`Initialized import batch ID: ${importBatch.id}`);

  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let matchedRepsCount = 0;
  let unmatchedRepsCount = 0;
  let tasksCreatedCount = 0;
  let activitiesCreatedCount = 0;
  
  // Set of sales rep names seen
  const matchedRepsSet = new Set();
  const unmatchedRepsSet = new Set();

  const BATCH_SIZE = 25; // Process in batches of 25

  for (let idx = 0; idx < newRecords.length; idx += BATCH_SIZE) {
    const chunk = newRecords.slice(idx, idx + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(idx / BATCH_SIZE) + 1} (${chunk.length} records)...`);

    for (const item of chunk) {
      try {
        const leadIdStr = item["Lead ID"];
        const excelRow = item._legacy_excel_row;
        const sourceFile = item._legacy_source_file || sourceFileName;

        // Normalizations
        const { phone_normalized: normPhone, flags: phoneFlags } = normalizePhone(item["Telefon Numarası"]);
        const firstContactDate = normalizeDate(item["İlk Temas Tarihi"]);
        const firstContactTime = normalizeTime(item["İlk Temas Saati"]);
        const firstContactAt = combineDateTimeToIso(item["İlk Temas Tarihi"], item["İlk Temas Saati"]);
        
        const conversationDate = normalizeDate(item["Görüşme Tarihi"]);
        const conversationTime = normalizeTime(item["Görüşme Saati"]);
        const legacyLastUpdate = normalizeDate(item["Son Güncelleme"]);
        const quoteDate = normalizeDate(item["Teklif Tarihi"]);
        const saleDate = normalizeDate(item["Satış Tarihi"]);
        const nextFollowUpDate = normalizeDate(item["Sonraki Takip Tarihi"]);

        // Split Full Name
        let firstName = 'Belirtilmemiş';
        let lastName = '';
        const nameVal = item["Ad Soyad / Firma"] || '';
        if (nameVal && nameVal !== 'Belirtilmemiş' && nameVal !== '-') {
          const cleanedName = nameVal.replace('/', ' ').replace('-', ' ').trim();
          const parts = cleanedName.split(/\s+/);
          if (parts.length > 1) {
            lastName = parts[parts.length - 1];
            firstName = parts.slice(0, parts.length - 1).join(' ');
          } else {
            firstName = parts[0];
          }
        }

        // Priority
        let priority = 'normal';
        const prioText = normalizeTurkish(item["Öncelik"]);
        if (prioText.includes('yuksek') || prioText.includes('high')) {
          priority = 'high';
        } else if (prioText.includes('dusuk') || prioText.includes('low')) {
          priority = 'low';
        }

        // Status, Source, Channel, Province mappings
        const statusId = statusMap.get(normalizeTurkish(item["Lead Durumu"])) || defaultStatusId;
        const sourceId = sourceMap.get(normalizeTurkish(item["Reklam Kaynağı"])) || defaultSourceId;
        const channelId = channelMap.get(normalizeTurkish(item["İletişim Kanalı"])) || defaultChannelId;
        const provinceId = provinceMap.get(normalizeTurkish(item["Şehir"])) || defaultProvinceId;

        // Sales specialist mapping
        const repText = item["Satış Uzmanı"] || '';
        const assignedSalesUserId = findProfileMatch(repText, profiles);

        if (repText && repText !== '-') {
          if (assignedSalesUserId) {
            matchedRepsSet.add(repText);
          } else {
            unmatchedRepsSet.add(repText);
          }
        }

        // Parse numeric fields
        const parseAmount = (val) => {
          if (val === null || val === undefined || String(val).trim() === '' || String(val).trim() === '-') return null;
          const clean = String(val).replace('TL', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
          const parsed = parseFloat(clean);
          return isNaN(parsed) ? null : parsed;
        };
        const estimatedPotentialAmount = parseAmount(item["Tahmini Potansiyel Tutar (TL)"]);
        const saleAmount = parseAmount(item["Satış Tutarı (TL)"]);

        // Booleans
        const convCompleted = item["Konuşma Yapıldı mı?"]?.toLowerCase() === 'evet' ? true : item["Konuşma Yapıldı mı?"]?.toLowerCase() === 'hayır' ? false : null;
        const responsePositive = item["Dönüş Olumlu mu?"]?.toLowerCase() === 'evet' ? true : item["Dönüş Olumlu mu?"]?.toLowerCase() === 'hayır' ? false : null;
        const salesActive = item["Satış Aktif/Pasif"]?.toLowerCase() === 'aktif' || item["Satış Aktif/Pasif"]?.toLowerCase() === 'evet' ? true : item["Satış Aktif/Pasif"]?.toLowerCase() === 'pasif' || item["Satış Aktif/Pasif"]?.toLowerCase() === 'hayır' ? false : null;
        const convertedToSale = item["Satışa Döndü mü?"]?.toLowerCase() === 'evet' ? true : item["Satışa Döndü mü?"]?.toLowerCase() === 'hayır' ? false : null;

        // Duplicate Check
        let existingLead = null;
        
        // 1. By Source File and Row
        const { data: rowMatch } = await supabase
          .from('leads')
          .select('*')
          .eq('legacy_source_file', sourceFile)
          .eq('legacy_excel_row', excelRow)
          .maybeSingle();

        if (rowMatch) {
          existingLead = rowMatch;
        } else {
          // 2. By ID + Phone + Date
          const { data: detailMatch } = await supabase
            .from('leads')
            .select('*')
            .eq('legacy_lead_id', leadIdStr)
            .eq('phone_normalized', normPhone)
            .eq('first_contact_date', firstContactDate)
            .maybeSingle();
          if (detailMatch) {
            existingLead = detailMatch;
          }
        }

        let leadUuid = null;

        const payload = {
          legacy_lead_id: leadIdStr,
          legacy_source_file: sourceFile,
          legacy_excel_row: excelRow,
          legacy_import_batch_id: importBatch.id,
          legacy_imported_at: new Date().toISOString(),
          first_contact_date: firstContactDate,
          first_contact_time: firstContactTime,
          first_contact_at: firstContactAt,
          sales_status_requested_at: item["satış uzmanına son durum soruldu"] || null,
          full_name: nameVal || 'Belirtilmemiş',
          first_name: firstName,
          last_name: lastName,
          phone: item["Telefon Numarası"] || '',
          phone_normalized: normPhone,
          province: item["Şehir"] || 'Belirtilmemiş',
          communication_channel_id: channelId,
          source_id: sourceId,
          requested_product: item["İstenen Makine / Ürün"] || null,
          first_message_note: item["İlk Mesaj / Arama Notu"] || null,
          message: item["İlk Mesaj / Arama Notu"] || null,
          priority: priority,
          assigned_sales_user_id: assignedSalesUserId,
          conversation_completed: convCompleted,
          conversation_date: conversationDate,
          conversation_time: conversationTime,
          conversation_summary: item["Görüşme Özeti / Sonuç"] || null,
          response_positive: responsePositive,
          next_action: item["Sonraki Aksiyon"] || null,
          sales_active: salesActive,
          quote_status: item["Teklif Gönderildi mi?"] || null,
          quote_date: quoteDate,
          estimated_potential_amount: estimatedPotentialAmount,
          converted_to_sale: convertedToSale,
          sale_status: item["Satış Durumu"] || null,
          sales_representative_text: repText || null,
          sale_date: saleDate,
          sale_amount: saleAmount,
          next_follow_up_date: nextFollowUpDate,
          delay_status: item["Gecikme Durumu"] || null,
          legacy_last_update: legacyLastUpdate,
          extra_notes: item["Ek Notlar"] || null,
          status_id: statusId,
          province_id: provinceId,
          data_quality_flags: phoneFlags,
          legacy_raw_data: item
        };

        if (existingLead) {
          // UPDATE: Protect manually updated CRM fields
          // If the status or assignee has been changed in CRM, protect it.
          const isStatusChanged = existingLead.status_id !== statusId && existingLead.status_id !== defaultStatusId;
          const isAssigneeChanged = existingLead.assigned_sales_user_id !== assignedSalesUserId && existingLead.assigned_sales_user_id !== null;
          
          if (isStatusChanged) {
            delete payload.status_id;
          }
          if (isAssigneeChanged) {
            delete payload.assigned_sales_user_id;
            delete payload.sales_representative_text;
          }
          if (existingLead.quality_manually_overridden || existingLead.lead_quality_manually_overridden) {
            payload.quality_manually_overridden = true;
            payload.lead_quality_manually_overridden = true;
            payload.automatic_quality_category = existingLead.automatic_quality_category;
            payload.final_quality_category = existingLead.final_quality_category;
          }

          const { data: updatedLead, error: updateErr } = await supabase
            .from('leads')
            .update(payload)
            .eq('id', existingLead.id)
            .select()
            .single();

          if (updateErr) throw updateErr;
          
          leadUuid = updatedLead.id;
          updatedCount++;
        } else {
          // INSERT
          const { data: insertedLead, error: insertErr } = await supabase
            .from('leads')
            .insert(payload)
            .select()
            .single();

          if (insertErr) throw insertErr;

          leadUuid = insertedLead.id;
          insertedCount++;
        }

        // F. Generate Follow-up Tasks (Rule 15)
        if (nextFollowUpDate && !convertedToSale) {
          // Check if pending task already exists for this lead
          const { data: existingTask } = await supabase
            .from('tasks')
            .select('id')
            .eq('lead_id', leadUuid)
            .eq('status', 'pending')
            .maybeSingle();

          if (!existingTask) {
            let taskType = 'general';
            const actionText = normalizeTurkish(item["Sonraki Aksiyon"] || '');
            if (actionText.includes('ara') || actionText.includes('geri arama')) {
              taskType = 'callback';
            } else if (actionText.includes('gorusme') || actionText.includes('satis')) {
              taskType = 'meeting';
            } else if (actionText.includes('teklif') || actionText.includes('fiyat')) {
              taskType = 'offer';
            }

            const dueAt = combineDateTimeToIso(item["Sonraki Aksiyon Tarihi"] || item["Sonraki Takip Tarihi"], '09:00');

            const { error: taskErr } = await supabase
              .from('tasks')
              .insert({
                title: `Lead Takibi - ${nameVal || 'Belirtilmemiş'}`,
                description: item["Sonraki Aksiyon"] || item["Ek Notlar"] || 'Lead follow-up task generated from legacy import.',
                task_type: taskType,
                status: 'pending',
                assigned_to: assignedSalesUserId || null,
                lead_id: leadUuid,
                due_at: dueAt
              });

            if (!taskErr) {
              tasksCreatedCount++;
            } else {
              console.error(`Error creating task for lead ${leadIdStr}:`, taskErr.message);
            }
          }
        }

        // G. Generate Historical Activities (Rule 16)
        if (conversationDate || item["Görüşme Özeti / Sonuç"]) {
          const activityCreatedAt = combineDateTimeToIso(item["Görüşme Tarihi"] || item["İlk Temas Tarihi"], item["Görüşme Saati"] || '12:00');
          
          // Check if activity already exists
          const { data: existingActivity } = await supabase
            .from('activities')
            .select('id')
            .eq('entity_id', leadUuid)
            .eq('activity_type', 'call_made')
            .eq('created_at', activityCreatedAt)
            .maybeSingle();

          if (!existingActivity) {
            const { error: actErr } = await supabase
              .from('activities')
              .insert({
                entity_type: 'lead',
                entity_id: leadUuid,
                activity_type: 'call_made',
                title: 'Görüşme Yapıldı',
                description: item["Görüşme Özeti / Sonuç"] || 'Görüşme detayları legacy aktarımdan eklendi.',
                user_id: assignedSalesUserId || null,
                created_at: activityCreatedAt
              });

            if (!actErr) {
              activitiesCreatedCount++;
            } else {
              console.error(`Error creating activity for lead ${leadIdStr}:`, actErr.message);
            }
          }
        }

      } catch (itemErr) {
        errorCount++;
        console.error(`Error processing record:`, itemErr);
        
        // Log to legacy import errors
        await supabase
          .from('legacy_import_errors')
          .insert({
            batch_id: importBatch.id,
            legacy_excel_row: item._legacy_excel_row,
            legacy_lead_id: item["Lead ID"],
            raw_data: item,
            error_message: itemErr.message
          });
      }
    }
  }

  matchedRepsCount = matchedRepsSet.size;
  unmatchedRepsCount = unmatchedRepsSet.size;

  // H. Complete Batch Status
  const summaryNotes = `Batch execution completed. Added: ${insertedCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}. Tasks: ${tasksCreatedCount}, Activities: ${activitiesCreatedCount}.`;
  
  await supabase
    .from('legacy_import_batches')
    .update({
      completed_at: new Date().toISOString(),
      inserted_rows: insertedCount,
      updated_rows: updatedCount,
      skipped_rows: skippedCount,
      error_rows: errorCount,
      status: 'completed',
      notes: summaryNotes
    })
    .eq('id', importBatch.id);

  console.log('-------------------------------------------');
  console.log('IMPORT BATCH REPORT:');
  console.log(`- Total leads to process: ${newRecords.length}`);
  console.log(`- Added (new records): ${insertedCount}`);
  console.log(`- Updated (existing records): ${updatedCount}`);
  console.log(`- Skipped: ${skippedCount}`);
  console.log(`- Failed: ${errorCount}`);
  console.log(`- Assigned sales reps matched: ${matchedRepsCount} (${Array.from(matchedRepsSet).join(', ')})`);
  console.log(`- Assigned sales reps unmatched: ${unmatchedRepsCount} (${Array.from(unmatchedRepsSet).join(', ')})`);
  console.log(`- Tasks created: ${tasksCreatedCount}`);
  console.log(`- Activities created: ${activitiesCreatedCount}`);
  console.log(`- Lead ID Range: L-${String(getLeadSequence(newRecords[0]["Lead ID"])).padStart(4, '0')} → L-${String(getLeadSequence(newRecords[newRecords.length - 1]["Lead ID"])).padStart(4, '0')}`);
  console.log('-------------------------------------------');

  return {
    success: true,
    total: newRecords.length,
    inserted: insertedCount,
    updated: updatedCount,
    skipped: skippedCount,
    errors: errorCount,
    matchedReps: matchedRepsCount,
    unmatchedReps: unmatchedRepsCount,
    tasksCreated: tasksCreatedCount,
    activitiesCreated: activitiesCreatedCount,
    range: `L-${String(getLeadSequence(newRecords[0]["Lead ID"])).padStart(4, '0')} → L-${String(getLeadSequence(newRecords[newRecords.length - 1]["Lead ID"])).padStart(4, '0')}`
  };
}

if (process.argv[1] && process.argv[1].endsWith('import_new_leads.mjs')) {
  runImport(path.join('scratch', 'new_leads_batch.json')).catch(console.error);
}

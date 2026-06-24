const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const ws = require('ws');

// Load environment variables
const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

function cleanPhoneNum(phone) {
  if (!phone) return '';
  const cleaned = String(phone).replace(/\D/g, '');
  return cleaned.length >= 10 ? cleaned.slice(-10) : cleaned;
}

function parseToISO(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  // If it's already ISO format, return it
  if (str.includes('T') || str.endsWith('Z')) {
    try {
      return new Date(str).toISOString();
    } catch (e) {}
  }
  
  // Check if it is Turkish format DD.MM.YYYY HH:MM:SS or DD.MM.YYYY
  const trMatch = str.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (trMatch) {
    const [_, day, month, year, hour = '12', minute = '00', second = '00'] = trMatch;
    try {
      const d = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second)));
      if (!isNaN(d.getTime())) return d.toISOString();
    } catch (e) {}
  }
  
  // Try default JS date parsing
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  } catch (e) {}
  
  return null;
}

async function run() {
  const jsonPath = path.join(__dirname, 'user_call_logs.json');
  
  if (!fs.existsSync(jsonPath)) {
    console.error(`ERROR: JSON file not found at ${jsonPath}. Please make sure you save the full JSON payload to this file path first.`);
    return;
  }
  
  console.log('Reading user call logs from JSON...');
  let logData;
  try {
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    logData = JSON.parse(rawData);
  } catch (err) {
    console.error('Failed to parse user_call_logs.json:', err.message);
    return;
  }
  
  // Login as mert to get auth token and make requests
  console.log('Authenticating with Supabase...');
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'mert@suntonmakina.com',
    password: 'Sunton123*'
  });
  if (authErr) {
    console.error('Authentication failed:', authErr.message);
    return;
  }
  const myUserId = authData.user.id;
  console.log(`Authenticated. User UUID: ${myUserId}`);
  
  // Fetch all active leads
  console.log('Fetching active leads from database...');
  const { data: leads, error: leadsErr } = await supabase
    .from('leads')
    .select('id, phone, phone_normalized, assigned_call_center_user_id, created_at, first_contact_at')
    .eq('is_active', true);
    
  if (leadsErr) {
    console.error('Failed to fetch leads:', leadsErr.message);
    return;
  }
  console.log(`Fetched ${leads.length} active leads.`);
  
  // Map leads by last 10 digits of their phone numbers
  const leadMap = new Map();
  leads.forEach(l => {
    const p1 = cleanPhoneNum(l.phone);
    const p2 = cleanPhoneNum(l.phone_normalized);
    if (p1) leadMap.set(p1, l);
    if (p2) leadMap.set(p2, l);
  });
  
  // Clean up previous OCR call records to reset their timestamps
  console.log('Deleting previous OCR call records from database to reset timestamps...');
  const { error: deleteErr } = await supabase
    .from('calls')
    .delete()
    .like('external_call_id', 'ocr-%');
  if (deleteErr) {
    console.error('Failed to delete old OCR calls:', deleteErr.message);
    return;
  }
  console.log('Previous OCR call records deleted successfully.');

  // Fetch existing calls to check for duplicates using external_call_id
  console.log('Fetching existing call record external IDs...');
  const { data: existingCalls, error: callsErr } = await supabase
    .from('calls')
    .select('external_call_id')
    .not('external_call_id', 'is', null);
    
  if (callsErr) {
    console.error('Failed to fetch existing calls:', callsErr.message);
    return;
  }
  const existingExternalIds = new Set(existingCalls.map(c => c.external_call_id));
  console.log(`Found ${existingExternalIds.size} existing calls with external IDs.`);

  // Resolve the data format dynamically
  let flatCallsList = null;
  if (Array.isArray(logData)) {
    flatCallsList = logData;
  } else if (logData && Array.isArray(logData.call_occurrences)) {
    flatCallsList = logData.call_occurrences;
  } else if (logData && Array.isArray(logData.calls)) {
    flatCallsList = logData.calls;
  }

  let insertedCount = 0;
  let skippedCount = 0;
  
  const unmatchedCallContacts = [];
  const manualReviewCalls = [];
  const callsToInsert = [];

  if (flatCallsList) {
    console.log(`Processing flat array format with ${flatCallsList.length} records...`);
    let idx = 0;
    for (const item of flatCallsList) {
      const normalizedPhone = item.phone || item.normalized_phone;
      if (!normalizedPhone) continue;
      const cleanPhone = cleanPhoneNum(normalizedPhone);
      const callDate = item.call_date || item.date || '';
      const callTime = item.call_time || item.time || '';
      
      const confidence = item.confidence ?? item.match_confidence ?? 1.0;
      const manualReviewRequired = item.manual_review_required ?? false;
      const isLowConfidence = confidence < 0.85 || manualReviewRequired;
      
      const matchedLead = leadMap.get(cleanPhone);
      const extId = `ocr-${item.source_image || 'flat'}-${item.source_panel || idx++}-${cleanPhone}`;
      
      if (existingExternalIds.has(extId)) {
        skippedCount++;
        continue;
      }
      
      let leadId = null;
      let notes = '';
      
      if (isLowConfidence) {
        notes = `[Manuel Kontrol] Düşük güvenilirlikli OCR araması. Tarih: ${callDate} ${callTime}. Güven: ${confidence}`;
        manualReviewCalls.push({
          normalized_phone: normalizedPhone,
          confidence,
          item
        });
      } else if (matchedLead) {
        leadId = matchedLead.id;
        notes = `Manuel Arama Görsel Kaydı (OCR). Tarih: ${callDate} ${callTime}.`;
      } else {
        notes = `[Eşleşmeyen Numara] Telefon numarası sistemdeki hiçbir lead ile eşleşmedi. Tarih: ${callDate} ${callTime}.`;
        unmatchedCallContacts.push({
          normalized_phone: normalizedPhone,
          confidence,
          item
        });
      }
      
      const resolvedLeadId = isLowConfidence ? null : leadId;
      const resolvedUserId = (matchedLead && matchedLead.assigned_call_center_user_id) 
        ? matchedLead.assigned_call_center_user_id 
        : myUserId;
        
      const parsedDate = parseToISO(`${callDate} ${callTime}`) || parseToISO(callDate) || '2026-06-22T14:00:00.000Z';
      
      callsToInsert.push({
        lead_id: resolvedLeadId,
        user_id: resolvedUserId,
        direction: item.direction || 'outgoing',
        phone_number: normalizedPhone,
        started_at: parsedDate,
        created_at: parsedDate,
        updated_at: parsedDate,
        duration_seconds: 60,
        status: item.is_missed ? 'missed' : 'completed',
        notes: notes,
        external_call_id: extId,
        outcome_id: '33333333-0000-0000-0000-000000000001' // Default outcome
      });
    }
  } else {
    // Nested object format (previous format)
    const uniqueRecords = logData.unique_phone_records || [];
    console.log(`Loaded ${uniqueRecords.length} unique phone records from JSON file.`);
    for (const record of uniqueRecords) {
      const normalizedPhone = record.normalized_phone;
      const cleanPhone = cleanPhoneNum(normalizedPhone);
      const confidence = record.highest_confidence ?? 1.0;
      const manualReviewRequired = record.manual_review_required ?? false;
      const sources = record.sources || [];
      
      const isLowConfidence = confidence < 0.85 || manualReviewRequired;
      const matchedLead = leadMap.get(cleanPhone);
      
      for (const source of sources) {
        const extId = `ocr-${source.image}-${source.panel}-${cleanPhone}`;
        
        if (existingExternalIds.has(extId)) {
          skippedCount++;
          continue;
        }
        
        let leadId = null;
        let notes = '';
        
        if (isLowConfidence) {
          notes = `[Manuel Kontrol] Düşük güvenilirlikli OCR araması. Görsel: ${source.image}, Panel: ${source.panel}, Ham OCR: ${source.raw}. Güven: ${confidence}`;
          manualReviewCalls.push({
            normalized_phone: normalizedPhone,
            confidence,
            source
          });
        } else if (matchedLead) {
          leadId = matchedLead.id;
          notes = `Manuel Arama Görsel Kaydı (OCR). Görsel: ${source.image}, Panel: ${source.panel}, Ham OCR: ${source.raw}. Güven: ${confidence}`;
        } else {
          notes = `[Eşleşmeyen Numara] Telefon numarası sistemdeki hiçbir lead ile eşleşmedi. Görsel: ${source.image}, Panel: ${source.panel}, Ham OCR: ${source.raw}. Güven: ${confidence}`;
          unmatchedCallContacts.push({
            normalized_phone: normalizedPhone,
            confidence,
            source
          });
        }
        
        const resolvedLeadId = isLowConfidence ? null : leadId;
        const resolvedUserId = (matchedLead && matchedLead.assigned_call_center_user_id) 
          ? matchedLead.assigned_call_center_user_id 
          : myUserId;
          
        const jsonDateStr = source.called_at || source.timestamp || source.date || 
                            record.called_at || record.timestamp || record.date;
        const parsedJsonDate = parseToISO(jsonDateStr);
                         
        let resolvedDate = parsedJsonDate;
        if (!resolvedDate) {
          resolvedDate = (matchedLead && (matchedLead.first_contact_at || matchedLead.created_at))
            ? (matchedLead.first_contact_at || matchedLead.created_at)
            : '2026-06-22T14:00:00.000Z';
        }
        
        callsToInsert.push({
          lead_id: resolvedLeadId,
          user_id: resolvedUserId,
          direction: 'outgoing',
          phone_number: normalizedPhone,
          started_at: resolvedDate,
          created_at: resolvedDate,
          updated_at: resolvedDate,
          duration_seconds: 60,
          status: 'completed',
          notes: notes,
          external_call_id: extId,
          outcome_id: '33333333-0000-0000-0000-000000000001' // Default outcome
        });
      }
    }
  }
  
  console.log(`Prepared ${callsToInsert.length} call records for insertion.`);
  
  // Insert call records in batches of 100 to prevent payload limit issues
  const batchSize = 100;
  for (let i = 0; i < callsToInsert.length; i += batchSize) {
    const batch = callsToInsert.slice(i, i + batchSize);
    console.log(`Inserting batch ${Math.floor(i / batchSize) + 1}...`);
    const { error: insertErr } = await supabase
      .from('calls')
      .insert(batch);
      
    if (insertErr) {
      console.error(`Failed to insert batch:`, insertErr.message);
      return;
    }
    insertedCount += batch.length;
  }
  
  // Write unmatched contacts and manual review lists to local JSON files
  fs.writeFileSync(
    path.join(__dirname, 'unmatched_call_contacts.json'),
    JSON.stringify(unmatchedCallContacts, null, 2),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(__dirname, 'manual_review_calls.json'),
    JSON.stringify(manualReviewCalls, null, 2),
    'utf-8'
  );
  
  console.log('\n--- EXECUTION SUMMARY ---');
  console.log(`Total calls successfully inserted: ${insertedCount}`);
  console.log(`Total duplicates skipped: ${skippedCount}`);
  console.log(`Unmatched call contacts saved: ${unmatchedCallContacts.length} (saved to unmatched_call_contacts.json)`);
  console.log(`Manual review calls saved: ${manualReviewCalls.length} (saved to manual_review_calls.json)`);
  console.log('Database synchronization completed successfully.');
}

run();

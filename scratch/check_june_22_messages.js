const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
  }
});

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

function getLocalDateStringWithShift(dateStr) {
  if (!dateStr) return null;
  try {
    const trimmed = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.split('T')[0];
    
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const formattedParts = formatter.formatToParts(d);
    const partMap = {};
    formattedParts.forEach(p => { partMap[p.type] = p.value; });
    
    const localDate = `${partMap.year}-${partMap.month}-${partMap.day}`;
    const localHours = parseInt(partMap.hour, 10);
    const localMinutes = parseInt(partMap.minute, 10);
    
    if (localHours > 17 || (localHours === 17 && localMinutes >= 30)) {
      const shiftedDate = new Date(d.getTime() + 24 * 60 * 60 * 1000);
      return shiftedDate.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
    }
    
    return localDate;
  } catch (e) {
    return dateStr.split('T')[0];
  }
}

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'mert@suntonmakina.com',
    password: 'Sunton123*'
  });
  
  const { data: leads, error } = await supabase
    .from('leads')
    .select('*, communication_channels:communication_channel_id(name), lead_sources:source_id(name, code)');
    
  if (error) {
    console.error(error);
    return;
  }
  
  const june22Leads = leads.filter(l => {
    const d = l.first_contact_date || l.first_contact_at || l.created_at;
    return getLocalDateStringWithShift(d) === '2026-06-22';
  });
  
  console.log(`Total leads on June 22: ${june22Leads.length}`);
  june22Leads.forEach(l => {
    console.log({
      id: l.id,
      lead_number: l.lead_number,
      first_name: l.first_name,
      last_name: l.last_name,
      phone: l.phone,
      source: l.lead_sources ? l.lead_sources.name : 'None',
      channel: l.communication_channels ? l.communication_channels.name : 'None',
      status_id: l.status_id,
      isConverted: l.status_id !== '22222222-0000-0000-0000-000000000020',
      created_at: l.created_at,
      legacy: l.legacy_source_file !== null
    });
  });
}

run();

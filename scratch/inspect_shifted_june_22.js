const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = value;
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
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
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
    formattedParts.forEach(p => {
      partMap[p.type] = p.value;
    });
    
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
  try {
    await supabase.auth.signInWithPassword({
      email: 'mert@suntonmakina.com',
      password: 'Sunton123*'
    });

    const { data: convs, error: convErr } = await supabase
      .from('conversations')
      .select('*')
      .eq('channel', 'whatsapp');
    if (convErr) throw convErr;

    const { data: leads, error: leadErr } = await supabase
      .from('leads')
      .select('*')
      .eq('is_active', true);
    if (leadErr) throw leadErr;

    const leadsMap = new Map(leads.map(l => [l.id, l]));

    const periodConvs = convs.filter(c => {
      const ts = c.last_message_at || c.created_at;
      return getLocalDateStringWithShift(ts) === '2026-06-22';
    });

    console.log(`Conversations on June 22: ${periodConvs.length}`);

    let convertedCount = 0;
    let unconvertedCount = 0;

    periodConvs.forEach(c => {
      const lead = c.lead_id ? leadsMap.get(c.lead_id) : null;
      if (lead) {
        const isConverted = lead.status_id !== '22222222-0000-0000-0000-000000000020';
        if (isConverted) {
          convertedCount++;
          console.log(`Converted: Phone ${lead.phone}, ID: ${lead.id}`);
        } else {
          unconvertedCount++;
          console.log(`Unconverted: Phone ${lead.phone}, ID: ${lead.id}`);
        }
      } else {
        unconvertedCount++;
        console.log(`Unconverted (No Lead): Conv ID: ${c.id}`);
      }
    });

    console.log(`\nTotals:`);
    console.log(`Converted (Sisteme Eklenenler): ${convertedCount}`);
    console.log(`Unconverted (Unutulan): ${unconvertedCount}`);
    console.log(`Total: ${convertedCount + unconvertedCount}`);

  } catch (e) {
    console.error(e);
  }
}

run();

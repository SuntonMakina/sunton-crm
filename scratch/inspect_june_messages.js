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
  await supabase.auth.signInWithPassword({
    email: 'mert@suntonmakina.com',
    password: 'Sunton123*'
  });

  const { data: messages, error } = await supabase
    .from('messages')
    .select('*, conversations(lead_id)')
    .order('sent_at', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  console.log('Total messages fetched:', messages.length);
  
  const june15AndLater = messages.filter(m => {
    const localDate = getLocalDateStringWithShift(m.sent_at || m.created_at);
    return localDate && localDate >= '2026-06-15';
  });

  console.log('Messages on/after June 15 count:', june15AndLater.length);
  if (june15AndLater.length > 0) {
    console.log('Sample message:', june15AndLater[0]);
  }
}

run();

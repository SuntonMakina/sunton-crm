const url = 'https://ffjwugzhdjzibaghkdcm.supabase.co/rest/v1/lead_statuses';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmand1Z3poZGp6aWJhZ2hrZGNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTcyMDEsImV4cCI6MjA5NzE3MzIwMX0.fXgoX2kzUgBL7ak668Cqp4ktXCw0OyElE6g0TWxGs7w';

async function run() {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: '22222222-0000-0000-0000-000000000016',
        name: 'Veri Yok',
        color: '#9E9E9E',
        sort_order: 16,
        is_final: false,
        is_won: false,
        is_lost: false,
        is_active: true
      })
    });
    
    if (res.ok) {
      console.log('Status "Veri Yok" upserted successfully!');
    } else {
      console.error('Error upserting status:', res.status, await res.text());
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

run();

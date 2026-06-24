const url = 'https://ffjwugzhdjzibaghkdcm.supabase.co/rest/v1/leads?select=id,legacy_lead_id,conversation_completed,legacy_source_file';
const authUrl = 'https://ffjwugzhdjzibaghkdcm.supabase.co/auth/v1/token?grant_type=password';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmand1Z3poZGp6aWJhZ2hrZGNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTcyMDEsImV4cCI6MjA5NzE3MzIwMX0.fXgoX2kzUgBL7ak668Cqp4ktXCw0OyElE6g0TWxGs7w';

async function run() {
  try {
    const authRes = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'mert@suntonmakina.com',
        password: 'Sunton123*'
      })
    });
    
    const authData = await authRes.json();
    const token = authData.access_token;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (res.ok) {
      const data = await res.json();
      console.log('Total leads fetched:', data.length);
      const sample = data.slice(0, 10);
      console.log('Sample leads:', sample);
      const conversationCounts = {
        true: data.filter(l => l.conversation_completed === true).length,
        false: data.filter(l => l.conversation_completed === false).length,
        null: data.filter(l => l.conversation_completed === null).length
      };
      console.log('conversation_completed values count:', conversationCounts);
    } else {
      console.error('Error:', res.status, await res.text());
    }
  } catch (err) {
    console.error(err);
  }
}

run();

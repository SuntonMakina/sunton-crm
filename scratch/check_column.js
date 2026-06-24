const url = 'https://ffjwugzhdjzibaghkdcm.supabase.co/rest/v1/leads?select=id,lead_quality_status&limit=1';
const authUrl = 'https://ffjwugzhdjzibaghkdcm.supabase.co/auth/v1/token?grant_type=password';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmand1Z3poZGp6aWJhZ2hrZGNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTcyMDEsImV4cCI6MjA5NzE3MzIwMX0.fXgoX2kzUgBL7ak668Cqp4ktXCw0OyElE6g0TWxGs7w';

async function check() {
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
    
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text);
  } catch (err) {
    console.error(err);
  }
}

check();

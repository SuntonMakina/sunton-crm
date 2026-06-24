const url = 'https://ffjwugzhdjzibaghkdcm.supabase.co/auth/v1/token?grant_type=password'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmand1Z3poZGp6aWJhZ2hrZGNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTcyMDEsImV4cCI6MjA5NzE3MzIwMX0.fXgoX2kzUgBL7ak668Cqp4ktXCw0OyElE6g0TWxGs7w'

async function check() {
  console.log('Testing raw fetch to Supabase Auth for ebru@suntonmakina.com ...')
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'ebru@suntonmakina.com',
        password: 'Sunton123*'
      })
    })
    
    const status = res.status
    const json = await res.json()
    console.log('Response Status:', status)
    console.log('Response Body:', JSON.stringify(json, null, 2))
  } catch (err) {
    console.error('Fetch error:', err)
  }
}

check()

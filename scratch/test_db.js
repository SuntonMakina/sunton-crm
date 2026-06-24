const url = 'https://ffjwugzhdjzibaghkdcm.supabase.co/rest/v1/communication_channels?select=*'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmand1Z3poZGp6aWJhZ2hrZGNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTcyMDEsImV4cCI6MjA5NzE3MzIwMX0.fXgoX2kzUgBL7ak668Cqp4ktXCw0OyElE6g0TWxGs7w'

async function check() {
  console.log('Fetching communication_channels table status...')
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    })
    console.log('Status:', res.status)
    const json = await res.json()
    console.log('Response:', JSON.stringify(json, null, 2))
  } catch (err) {
    console.error(err)
  }
}

check()

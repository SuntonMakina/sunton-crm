const loginUrl = 'https://ffjwugzhdjzibaghkdcm.supabase.co/auth/v1/token?grant_type=password'
const errorsUrl = 'https://ffjwugzhdjzibaghkdcm.supabase.co/rest/v1/legacy_import_errors?select=*&order=created_at.desc&limit=5'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmand1Z3poZGp6aWJhZ2hrZGNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTcyMDEsImV4cCI6MjA5NzE3MzIwMX0.fXgoX2kzUgBL7ak668Cqp4ktXCw0OyElE6g0TWxGs7w'

async function check() {
  console.log('Logging in as Mert...')
  try {
    const loginRes = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'mert@suntonmakina.com',
        password: 'Sunton123*'
      })
    })

    const loginJson = await loginRes.json()
    const token = loginJson.access_token
    if (!token) {
      console.error('Failed to log in:', loginJson)
      return
    }

    console.log('Login successful. Fetching legacy import errors...')
    const res = await fetch(errorsUrl, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${token}`
      }
    })
    console.log('Status:', res.status)
    const json = await res.json()
    console.log('Errors:', JSON.stringify(json, null, 2))
  } catch (err) {
    console.error(err)
  }
}

check()

const authUrl = 'https://ffjwugzhdjzibaghkdcm.supabase.co/auth/v1/token?grant_type=password';
const profilesUrl = 'https://ffjwugzhdjzibaghkdcm.supabase.co/rest/v1/profiles?select=*';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmand1Z3poZGp6aWJhZ2hrZGNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTcyMDEsImV4cCI6MjA5NzE3MzIwMX0.fXgoX2kzUgBL7ak668Cqp4ktXCw0OyElE6g0TWxGs7w';

async function check() {
  try {
    console.log('Logging in as mert@suntonmakina.com...');
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
    if (authRes.status !== 200) {
      console.error('Login failed:', authData);
      return;
    }
    
    const token = authData.access_token;
    console.log('Login successful! Token acquired.');
    console.log('User UUID:', authData.user.id);
    
    console.log('Querying profiles...');
    const res = await fetch(profilesUrl, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Profiles HTTP Status:', res.status);
    const profiles = await res.json();
    console.log('Profiles returned:', JSON.stringify(profiles, null, 2));
    
  } catch (err) {
    console.error('Error during execution:', err);
  }
}

check();

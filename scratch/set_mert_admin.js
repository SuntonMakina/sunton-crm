const authUrl = 'https://ffjwugzhdjzibaghkdcm.supabase.co/auth/v1/token?grant_type=password';
const profileUpdateUrl = 'https://ffjwugzhdjzibaghkdcm.supabase.co/rest/v1/profiles?id=eq.a1a1a1a1-bbbb-cccc-dddd-eeeeeeeeeeee';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmand1Z3poZGp6aWJhZ2hrZGNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTcyMDEsImV4cCI6MjA5NzE3MzIwMX0.fXgoX2kzUgBL7ak668Cqp4ktXCw0OyElE6g0TWxGs7w';

async function updateRole() {
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
    const userId = authData.user.id;
    console.log('Logged in. User UUID:', userId);
    
    console.log('Attempting to update profile role to admin...');
    const updateRes = await fetch(profileUpdateUrl, {
      method: 'PATCH',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        role: 'admin'
      })
    });
    
    console.log('Update HTTP Status:', updateRes.status);
    const result = await updateRes.json();
    console.log('Update Result:', JSON.stringify(result, null, 2));
    
  } catch (err) {
    console.error('Error during execution:', err);
  }
}

updateRole();

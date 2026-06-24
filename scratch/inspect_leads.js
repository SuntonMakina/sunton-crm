const authUrl = 'https://ffjwugzhdjzibaghkdcm.supabase.co/auth/v1/token?grant_type=password';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmand1Z3poZGp6aWJhZ2hrZGNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTcyMDEsImV4cCI6MjA5NzE3MzIwMX0.fXgoX2kzUgBL7ak668Cqp4ktXCw0OyElE6g0TWxGs7w';

async function main() {
  try {
    console.log('Logging in...');
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
    console.log('Login successful!');
    
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    
    console.log('Querying messages...');
    const messagesUrl = `https://ffjwugzhdjzibaghkdcm.supabase.co/rest/v1/messages?select=conversation_id,sender_user_id,channel,created_at,conversation:conversations(lead_id)&sender_user_id=eq.${authData.user.id}&channel=eq.whatsapp&created_at=gte.${todayStart.toISOString()}`;
    const res = await fetch(messagesUrl, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${token}`
      }
    });
    
    const messages = await res.json();
    console.log('Messages query status:', res.status);
    console.log('Messages response:', messages);
  } catch (err) {
    console.error(err);
  }
}

main();

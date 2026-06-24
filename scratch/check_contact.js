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
        email: 'ebru@suntonmakina.com',
        password: 'Sunton123*'
      })
    });
    
    const authData = await authRes.json();
    const token = authData.access_token;
    const userId = authData.user.id;

    const res = await fetch(`https://ffjwugzhdjzibaghkdcm.supabase.co/rest/v1/leads?select=id,legacy_lead_id,last_contact_at,conversation_completed,legacy_source_file&is_active=eq.true&or=(assigned_call_center_user_id.eq.${userId},legacy_source_file.not.is.null)`, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${token}`
      }
    });
    
    const leads = await res.json();
    console.log('Total leads:', leads.length);
    console.log('last_contact_at non-null count:', leads.filter(l => l.last_contact_at !== null).length);
    console.log('conversation_completed non-null count:', leads.filter(l => l.conversation_completed !== null).length);
  } catch (err) {
    console.error(err);
  }
}

run();

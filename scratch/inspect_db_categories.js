const authUrl = 'https://ffjwugzhdjzibaghkdcm.supabase.co/auth/v1/token?grant_type=password';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmand1Z3poZGp6aWJhZ2hrZGNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTcyMDEsImV4cCI6MjA5NzE3MzIwMX0.fXgoX2kzUgBL7ak668Cqp4ktXCw0OyElE6g0TWxGs7w';
const url = 'https://ffjwugzhdjzibaghkdcm.supabase.co/rest/v1/leads?select=*,communication_channels:communication_channel_id(name)'

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
    
    const rawLeads = await res.json()
    
    const june2026Leads = rawLeads.filter(lead => {
      if (lead.is_active !== true) return false
      if (lead.legacy_source_file === null) return false
      const dateStr = lead.first_contact_date ?? lead.first_contact_at ?? lead.legacy_raw_data?.["İlk Temas Tarihi"]
      if (!dateStr) return false
      const leadDate = new Date(dateStr)
      const startDate = new Date('2026-06-01T00:00:00')
      const endDate = new Date('2026-06-30T23:59:59')
      return leadDate >= startDate && leadDate <= endDate
    })
    
    console.log('June 2026 Leads count:', june2026Leads.length)
    
    const conversationCompletedCount = june2026Leads.filter(l => l.conversation_completed === true).length
    const conversationCompletedNullCount = june2026Leads.filter(l => l.conversation_completed === null).length
    const conversationCompletedFalseCount = june2026Leads.filter(l => l.conversation_completed === false).length
    
    console.log('conversation_completed:', {
      true: conversationCompletedCount,
      false: conversationCompletedFalseCount,
      null: conversationCompletedNullCount
    })
    
    // Check how many have notes or conversation summary
    const hasConvSummary = june2026Leads.filter(l => l.conversation_summary && l.conversation_summary !== '-').length
    const hasNotes = june2026Leads.filter(l => l.notes && l.notes !== '-').length
    const hasFirstMsgNote = june2026Leads.filter(l => l.first_message_note && l.first_message_note !== '-').length
    
    console.log('Content checks:', {
      hasConvSummary,
      hasNotes,
      hasFirstMsgNote
    })
    
  } catch (err) {
    console.error(err)
  }
}

check()

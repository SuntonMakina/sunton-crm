const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

const authUrl = `${supabaseUrl}/auth/v1/token?grant_type=password`;

async function loginAndGetToken() {
  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'mert@suntonmakina.com',
      password: 'Sunton123*'
    })
  });
  if (!response.ok) {
    throw new Error(`Auth failed! status: ${response.status}`);
  }
  const data = await response.json();
  return data.access_token;
}

async function callSupabase(endpoint, token, params = '', method = 'GET', body = null) {
  const url = `${supabaseUrl}/rest/v1/${endpoint}?${params}`;
  const options = {
    method: method,
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP error on ${method} ${endpoint}! status: ${response.status} - ${text}`);
  }
  return response.json();
}

async function run() {
  let createdTestLeads = [];
  try {
    const token = await loginAndGetToken();
    console.log('Logged in successfully!');

    // 1. Create a dummy existing lead to simulate Chat 3 mapping
    console.log('Creating dummy existing lead...');
    const testLead = await callSupabase('leads', token, '', 'POST', {
      first_name: 'Ahmet',
      last_name: 'Demir',
      phone: '+905444444444',
      phone_normalized: '905444444444',
      source_id: '474b7a22-c53f-43ba-a8bd-75ce0977a798',
      status_id: '22222222-0000-0000-0000-000000000001', // Yeni Lead
      assigned_call_center_user_id: 'b2b2b2b2-bbbb-cccc-dddd-eeeeeeeeeeee',
      priority: 'normal',
      temperature: 'warm'
    });
    createdTestLeads.push(testLead[0].id);
    console.log(`Created dummy existing lead ID: ${testLead[0].id} (L-Number: ${testLead[0].lead_number})`);

    // 2. Prepare sync payload
    const syncPayload = {
      chats: [
        {
          id: '905060419007', // Resolved LID JID (mapped in gateway)
          name: 'Mert Sunton'
        },
        {
          id: '905333333333', // New customer JID
          name: '' // Empty name (should default to +905333333333 Yeni Müşteri)
        },
        {
          id: '905444444444', // Existing lead JID
          name: 'Ahmet Demir'
        }
      ],
      messages: [
        {
          id: 'MSG1',
          chatId: '905060419007',
          from: '905060419007',
          fromMe: false,
          timestamp: Math.floor(Date.now() / 1000) - 3600,
          content: 'Merhaba Mert Sunton test mesajı.'
        },
        {
          id: 'MSG2',
          chatId: '905333333333',
          from: '905333333333',
          fromMe: false,
          timestamp: Math.floor(Date.now() / 1000) - 1800,
          content: 'Yeni müşteri test mesajı.'
        },
        {
          id: 'MSG3',
          chatId: '905444444444',
          from: '905444444444',
          fromMe: false,
          timestamp: Math.floor(Date.now() / 1000) - 600,
          content: 'Ahmet Demir test mesajı.'
        }
      ]
    };

    // 3. Trigger history sync API endpoint
    console.log('Sending sync payload to Next.js API endpoint...');
    const syncRes = await fetch('http://localhost:3000/api/whatsapp/sync-history', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(syncPayload)
    });

    console.log(`Sync status: ${syncRes.status}`);
    const syncResult = await syncRes.json();
    console.log('Sync Result:', syncResult);

    // 4. Verify Database Records
    console.log('Verifying created/updated leads in DB...');
    const leads = await callSupabase('leads', token, 'select=id,first_name,last_name,phone,phone_normalized,status_id,lead_number,source_id&is_active=eq.true');
    
    const lead1 = leads.find(l => l.phone_normalized === '905060419007');
    const lead2 = leads.find(l => l.phone_normalized === '905333333333');
    const lead3 = leads.find(l => l.phone_normalized === '905444444444');

    if (lead1) {
      console.log(`- Mapped LID Lead: OK! Name is "${lead1.first_name} ${lead1.last_name}"`);
      createdTestLeads.push(lead1.id);
    } else {
      console.error('- Mapped LID Lead: FAILED! Not found.');
    }

    if (lead2) {
      console.log(`- New Customer Lead: OK! Name is "${lead2.first_name} ${lead2.last_name}", Status ID is "${lead2.status_id}"`);
      createdTestLeads.push(lead2.id);
    } else {
      console.error('- New Customer Lead: FAILED! Not found.');
    }

    if (lead3) {
      console.log(`- Existing Lead: OK! Name remains "${lead3.first_name} ${lead3.last_name}" (Expected Ahmet Demir)`);
    } else {
      console.error('- Existing Lead: FAILED! Not found.');
    }

  } catch (err) {
    console.error('Simulation Error:', err);
  } finally {
    // 5. Cleanup simulated data
    if (createdTestLeads.length > 0) {
      console.log('\nCleaning up test leads...');
      const token = await loginAndGetToken();
      for (const id of createdTestLeads) {
        try {
          await callSupabase('activities', token, `entity_type=eq.lead&entity_id=eq.${id}`, 'DELETE');
          await callSupabase('notifications', token, `entity_type=eq.lead&entity_id=eq.${id}`, 'DELETE');
          await callSupabase('tasks', token, `lead_id=eq.${id}`, 'DELETE');
          await callSupabase('calls', token, `lead_id=eq.${id}`, 'DELETE');
          const convs = await callSupabase('conversations', token, `lead_id=eq.${id}`);
          for (const c of convs) {
            await callSupabase('messages', token, `conversation_id=eq.${c.id}`, 'DELETE');
            await callSupabase('conversations', token, `id=eq.${c.id}`, 'DELETE');
          }
          await callSupabase('leads', token, `id=eq.${id}`, 'DELETE');
          console.log(`- Cleaned test lead: ${id}`);
        } catch (e) {
          console.error(`Error cleaning up lead ${id}:`, e.message);
        }
      }
      console.log('Cleanup completed.');
    }
  }
}

run();

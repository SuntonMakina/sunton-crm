const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

async function loginAndGetToken() {
  const authUrl = `${supabaseUrl}/auth/v1/token?grant_type=password`;
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

// We will run a custom SQL query using postgrest RPC if possible, or query pg_proc via postgrest if allowed.
// Postgrest allows reading views, let's see if we can query pg_proc or pg_description.
async function callSupabase(endpoint, token, params = '', method = 'GET', body = null) {
  const url = `${supabaseUrl}/rest/v1/${endpoint}?${params}`;
  const options = {
    method: method,
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function run() {
  try {
    const token = await loginAndGetToken();
    console.log('Logged in successfully!');

    // Let's call supabase to execute a SQL block via raw postgrest if we have a sql RPC or similar.
    // Wait, let's check if there is an rpc function we can use. In CRM we might have 'execute_sql' or similar?
    // Let's check available RPCs by looking at the schema. We can query the OpenAPI spec or postgrest /
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${token}`
      }
    });
    const spec = await response.json();
    console.log('Available paths in PostgREST:');
    const paths = Object.keys(spec.paths);
    console.log(paths.filter(p => p.startsWith('/rpc/')));

  } catch (err) {
    console.error('Error:', err);
  }
}

run();

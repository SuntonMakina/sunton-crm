const { Client } = require('pg');

const regions = [
  'eu-central-1', // Frankfurt
  'eu-west-3',    // Paris
  'eu-west-2',    // London
  'eu-west-1',    // Ireland
  'us-east-1',    // N. Virginia
  'us-east-2',    // Ohio
  'us-west-1',    // N. California
  'us-west-2',    // Oregon
  'ap-southeast-1', // Singapore
  'ap-northeast-1', // Tokyo
  'sa-east-1'     // Sao Paulo
];

const tenant = 'ffjwugzhdjzibaghkdcm';
const password = 'Sunton123*';

async function testRegion(region) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const connectionString = `postgresql://postgres.${tenant}:${password}@${host}:6543/postgres`;
  
  const client = new Client({
    connectionString: connectionString,
    connectionTimeoutMillis: 3000,
  });

  try {
    await client.connect();
    console.log(`SUCCESS: Connected to ${region}`);
    const res = await client.query('SELECT version()');
    console.log(`Version: ${res.rows[0].version}`);
    await client.end();
    return true;
  } catch (err) {
    console.log(`FAILED ${region}: ${err.message}`);
    return false;
  }
}

async function run() {
  for (const r of regions) {
    const ok = await testRegion(r);
    if (ok) {
      break;
    }
  }
}

run();

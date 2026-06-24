const token = "EAAOwEZA2kPS4BRZCQLXgmcuLgdsbDtFcKODV5ZAd4Kztqi39a59VLzQZBkyI01vuZBt69QZBGqTFj1wmFoW7hIEKoaELYZC62ZALiZB377V067IlboSpLTxdxmnI76ihwzvlPAWByvoLl1FZBq8S1xWSKa7ZC6cMfLftWvnsDtejarQLzuC1PmgVBNjQZAlxfr0gKaPxvQZDZD";
const systemUserId = "122108020035357311";

async function checkSystemUser() {
  try {
    const endpoints = [
      `me/assigned_whatsapp_business_accounts`,
      `${systemUserId}/assigned_whatsapp_business_accounts`,
      `${systemUserId}/assigned_pages`,
    ];

    for (const ep of endpoints) {
      console.log(`Querying: ${ep}`);
      const res = await fetch(`https://graph.facebook.com/v25.0/${ep}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      console.log('Response:', JSON.stringify(data, null, 2));
      console.log('---');
    }
  } catch (e) {
    console.error(e);
  }
}

checkSystemUser();

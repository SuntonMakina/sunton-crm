const token = "EAAOwEZA2kPS4BRZCQLXgmcuLgdsbDtFcKODV5ZAd4Kztqi39a59VLzQZBkyI01vuZBt69QZBGqTFj1wmFoW7hIEKoaELYZC62ZALiZB377V067IlboSpLTxdxmnI76ihwzvlPAWByvoLl1FZBq8S1xWSKa7ZC6cMfLftWvnsDtejarQLzuC1PmgVBNjQZAlxfr0gKaPxvQZDZD";

async function findPhoneNumbers() {
  try {
    // We can list WABAs via client/owned_whatsapp_business_accounts or similar if the token has permission
    console.log('Querying debug details...');
    
    // Attempt 1: Query owned WABAs using the client
    const res1 = await fetch(`https://graph.facebook.com/v25.0/me/whatsapp_business_accounts`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data1 = await res1.json();
    console.log('WABAs under me:', JSON.stringify(data1, null, 2));

    // Attempt 2: Query via the APP itself to see what WABAs are linked
    // GET /v25.0/app/whatsapp_business_accounts
    const res2 = await fetch(`https://graph.facebook.com/v25.0/1038014635851054/whatsapp_business_accounts`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data2 = await res2.json();
    console.log('WABAs linked to App:', JSON.stringify(data2, null, 2));
    
    // If we find any WABA IDs in the output, we can query their /phone_numbers endpoint
    if (data2.data && data2.data.length > 0) {
      for (const waba of data2.data) {
        console.log(`Querying phone numbers for WABA ID: ${waba.id} (${waba.name})...`);
        const resPhone = await fetch(`https://graph.facebook.com/v25.0/${waba.id}/phone_numbers`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataPhone = await resPhone.json();
        console.log(`Phone numbers for ${waba.id}:`, JSON.stringify(dataPhone, null, 2));
      }
    }
  } catch (e) {
    console.error(e);
  }
}

findPhoneNumbers();

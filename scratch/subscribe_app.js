const token = "EAAOwEZA2kPS4BRZCQLXgmcuLgdsbDtFcKODV5ZAd4Kztqi39a59VLzQZBkyI01vuZBt69QZBGqTFj1wmFoW7hIEKoaELYZC62ZALiZB377V067IlboSpLTxdxmnI76ihwzvlPAWByvoLl1FZBq8S1xWSKa7ZC6cMfLftWvnsDtejarQLzuC1PmgVBNjQZAlxfr0gKaPxvQZDZD";
const phoneId = "965497219973810";

async function subscribeApp() {
  const url = `https://graph.facebook.com/v25.0/${phoneId}/subscribed_apps`;
  console.log('Sending subscription POST request to:', url);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error during subscription request:', e);
  }
}

subscribeApp();

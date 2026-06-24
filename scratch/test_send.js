const token = "EAAOwEZA2kPS4BRZCQLXgmcuLgdsbDtFcKODV5ZAd4Kztqi39a59VLzQZBkyI01vuZBt69QZBGqTFj1wmFoW7hIEKoaELYZC62ZALiZB377V067IlboSpLTxdxmnI76ihwzvlPAWByvoLl1FZBq8S1xWSKa7ZC6cMfLftWvnsDtejarQLzuC1PmgVBNjQZAlxfr0gKaPxvQZDZD";
const phoneNumberId = "1137205702810513";
const toPhone = "905070471373";

async function testSend() {
  const url = `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`;
  console.log('Sending to url:', url);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toPhone,
      type: "text",
      text: {
        preview_url: false,
        body: "Test from node script"
      }
    })
  });

  const data = await response.json();
  console.log('Response Status:', response.status);
  console.log('Response Data:', JSON.stringify(data, null, 2));
}

testSend();

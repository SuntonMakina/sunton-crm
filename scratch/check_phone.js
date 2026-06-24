const token = "EAAOwEZA2kPS4BRZCQLXgmcuLgdsbDtFcKODV5ZAd4Kztqi39a59VLzQZBkyI01vuZBt69QZBGqTFj1wmFoW7hIEKoaELYZC62ZALiZB377V067IlboSpLTxdxmnI76ihwzvlPAWByvoLl1FZBq8S1xWSKa7ZC6cMfLftWvnsDtejarQLzuC1PmgVBNjQZAlxfr0gKaPxvQZDZD";
const phoneId = "965497219973810";

async function checkPhone() {
  try {
    const url = `https://graph.facebook.com/v25.0/${phoneId}`;
    console.log('Querying phone ID:', url);
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}

checkPhone();

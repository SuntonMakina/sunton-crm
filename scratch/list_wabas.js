const token = "EAAOwEZA2kPS4BR9WC6WhfsKSQwRZCkeOs3LoWzfPF7lXR8GCTKf55IZAZAajppypqDoUp9toGWArVdzXVj8yqcaqNGsSfGVJfZBYb4SUOvM49MPQ3P003IX65AicNZBtQ3Ky7QkfZBQ6c6O3jHBgTvBAsSpZCeZCnHZAek2ek2AKU1kiiPX5eOH8HyM5RvPX3w7AZANzAZDZD";

async function listWabas() {
  // 1. Get WABAs
  const wabasUrl = `https://graph.facebook.com/v25.0/client/whatsapp_business_accounts`; // or /me/
  const meUrl = `https://graph.facebook.com/v25.0/me`;
  
  try {
    console.log('Querying WABAs via /me/whatsapp_business_accounts...');
    const res1 = await fetch(`https://graph.facebook.com/v25.0/me/whatsapp_business_accounts`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data1 = await res1.json();
    console.log('WABAs response:', JSON.stringify(data1, null, 2));

    console.log('Querying /me details...');
    const res2 = await fetch(meUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data2 = await res2.json();
    console.log('/me response:', JSON.stringify(data2, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}

listWabas();

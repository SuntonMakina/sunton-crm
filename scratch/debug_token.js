const token = "EAAOwEZA2kPS4BR6Wz60U9qhufcBH4WeuRO83TzU6YQsOJ2xORshjGNTnA496a2gxJtLw2PSlgvOti2Tcjzc8OCrrZCGvDqnU160NID9qvC56tZCyESxAzCfpJtOZAFNp8ZAPkZCgzLlPIqZBFrUBsCGlWlJhxZCMKAzVZCpMgjB2vhGxcIbT4O4qF1LW3ZBQWJZCW5x39FJpCZBZBx8RfjRR6XFYxaqBBuK78cTV67j3ifngqg5amZACO8OtHV1QGImb0DavB77NpLSMVLBZBBTjr0jsn31UbPm";

async function debugToken() {
  const url = `https://graph.facebook.com/debug_token?input_token=${token}&access_token=${token}`;
  console.log('Querying debug_token...');
  
  const response = await fetch(url);
  const data = await response.json();
  console.log('Response Status:', response.status);
  console.log('Response Data:', JSON.stringify(data, null, 2));
}

debugToken();

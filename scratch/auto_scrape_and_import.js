const fs = require('fs');
const path = require('path');

// Load env variables
const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
  }
});

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

const API_TOKEN = env.APIFY_API_TOKEN || '';
if (!API_TOKEN) {
  console.error('❌ Error: APIFY_API_TOKEN is missing in .env.local');
  process.exit(1);
}

const searchQueries = [
  "fason lazer kesim Ankara",
  "fason lazer kesim İzmir",
  "fason lazer kesim Bursa",
  "lazer kesim büküm Ankara",
  "lazer kesim büküm İzmir",
  "lazer kesim büküm Bursa",
  "fason sac işleme Ankara",
  "fason sac işleme İzmir",
  "fason sac işleme Bursa",
  "abkant büküm Ankara",
  "abkant büküm İzmir",
  "abkant büküm Bursa",
  "sac işleme merkezi Ankara",
  "sac işleme merkezi İzmir",
  "sac işleme merkezi Bursa",
  "fason sac metal Ankara",
  "fason sac metal İzmir",
  "fason sac metal Bursa",
  "fason metal imalatı Ankara",
  "fason metal imalatı İzmir",
  "fason metal imalatı Bursa",
  "lazer kesim sac Ankara",
  "lazer kesim sac İzmir",
  "lazer kesim sac Bursa",
  "fason metal büküm Ankara",
  "fason metal büküm İzmir",
  "fason metal büküm Bursa",
  "sac levha işleme Ankara",
  "sac levha işleme İzmir",
  "sac levha işleme Bursa"
];

const normalizePhone = (phone) => {
  if (!phone) return '';
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('90') && clean.length >= 12) {
    clean = clean.substring(2);
  } else if (clean.startsWith('090') && clean.length >= 13) {
    clean = clean.substring(3);
  } else if (clean.startsWith('0') && clean.length >= 11) {
    clean = clean.substring(1);
  }
  return '90' + clean;
};

// Turkish normalization helper to resolve dotted/dotless I lowercasing issues
const normalizeTurkish = (str) => {
  if (!str) return '';
  return str
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/Ğ/g, 'g')
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/ü/g, 'u')
    .replace(/Ş/g, 's')
    .replace(/ş/g, 's')
    .replace(/Ö/g, 'o')
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'c')
    .replace(/ç/g, 'c')
    .toLowerCase();
};

async function run() {
  console.log('--- APIFY AUTO SCRAPE & IMPORT STARTED ---');
  console.log(`Targeting cities: Ankara, İzmir, Bursa`);
  console.log(`Keywords: fason lazer kesim, lazer kesim büküm, fason sac işleme, abkant büküm, sac metal, vb.`);
  
  let datasetId = process.argv.slice(2).find(arg => !arg.startsWith('-'));
  
  if (datasetId) {
    console.log(`\nUsing existing Dataset ID: ${datasetId}. Skipping new crawl...`);
  } else {
    // 1. Trigger Apify Actor run
    const triggerUrl = `https://api.apify.com/v2/acts/compass~crawler-google-places/runs?token=${API_TOKEN}`;
    const input = {
      searchStringsArray: searchQueries,
      maxCrawledPlacesPerSearch: 15, // Reduced default to fit within free trial limits
      language: "tr",
      proxyConfiguration: {
        useApifyProxy: true
      }
    };

    console.log('\nTriggering Apify Google Maps Scraper actor (compass~crawler-google-places)...');
    const res = await fetch(triggerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Failed to trigger Apify:', res.statusText, text);
      process.exit(1);
    }

    const runData = await res.json();
    const runId = runData.data.id;
    datasetId = runData.data.defaultDatasetId;

    console.log(`🚀 Apify Scraper triggered successfully!`);
    console.log(`Run ID: ${runId}`);
    console.log(`Dataset ID: ${datasetId}`);

    // 2. Poll until success
    const runStatusUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${API_TOKEN}`;
    console.log('\nWaiting for Scraper to compile and finish. Polling every 20 seconds...');
    
    let status = 'RUNNING';
    while (status === 'RUNNING' || status === 'READY') {
      await new Promise(r => setTimeout(r, 20000));
      try {
        const statusRes = await fetch(runStatusUrl);
        if (statusRes.ok) {
          const data = await statusRes.json();
          status = data.data.status;
          console.log(`Current Run Status: ${status}`);
        } else {
          console.log('Error fetching status, retrying...');
        }
      } catch (e) {
        console.log('Polling network error:', e.message);
      }
    }

    if (status !== 'SUCCEEDED') {
      console.error(`\n❌ Apify run did not succeed. Final status: ${status}`);
      process.exit(1);
    }
  }

  console.log('\n🎉 Fetching items from dataset...');

  // 3. Fetch items from Dataset
  const itemsUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&token=${API_TOKEN}`;
  const itemsRes = await fetch(itemsUrl);
  if (!itemsRes.ok) {
    console.error('Failed to fetch dataset items:', itemsRes.statusText);
    process.exit(1);
  }

  const items = await itemsRes.json();
  console.log(`Fetched ${items.length} raw records from dataset.`);

  // 4. Authenticate Supabase
  console.log('\nConnecting to CRM database...');
  await supabase.auth.signInWithPassword({
    email: 'mert@suntonmakina.com',
    password: 'Sunton123*'
  });

  // Preserving all existing potential leads in the pool to save them
  console.log('Preserving all existing potential leads in the pool.');

  // Fetch existing phones to prevent duplication (with limit 10000 to bypass pagination limits)
  const { data: existingLeads } = await supabase.from('leads').select('phone_normalized').limit(10000);
  const { data: existingPotentialLeads } = await supabase.from('potential_leads').select('phone, website').limit(10000);

  const existingPhones = new Set();
  const existingWebsites = new Set();
  if (existingLeads) {
    existingLeads.forEach(l => {
      if (l.phone_normalized) existingPhones.add(normalizePhone(l.phone_normalized));
    });
  }
  if (existingPotentialLeads) {
    existingPotentialLeads.forEach(l => {
      if (l.phone) existingPhones.add(normalizePhone(l.phone));
      if (l.website) {
        const normWeb = l.website.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
        existingWebsites.add(normWeb);
      }
    });
  }

  const potentialLeadsToInsert = [];

  for (const item of items) {
    const rawPhone = item.phone || item.phoneNumber || item.phoneNormalized;
    if (!rawPhone) continue;

    const normalizedPhone = normalizePhone(rawPhone);
    if (existingPhones.has(normalizedPhone)) continue;

    // Check duplicate websites
    const website = item.website || item.url || null;
    if (website) {
      const normWeb = website.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
      if (existingWebsites.has(normWeb)) continue; // Skip duplicate websites
    }

    const companyName = item.title || item.name || 'Belirtilmemiş Firma';
    const province = item.state || item.city || item.postalCode || null;
    const district = item.address || null;

    // Rich description
    let descriptionText = '';
    if (item.categoryName) descriptionText += `Kategori/Sektör: ${item.categoryName}\n`;
    if (item.subTitle) descriptionText += `Alt Başlık: ${item.subTitle}\n`;
    if (item.description) descriptionText += `Açıklama: ${item.description}\n`;
    if (item.about && item.about.length > 0) {
      const aboutStr = Array.isArray(item.about)
        ? item.about.map(a => `${a.title || ''}: ${a.value || ''}`).join(', ')
        : typeof item.about === 'object'
          ? JSON.stringify(item.about)
          : item.about;
      descriptionText += `Detay: ${aboutStr}\n`;
    }
    if (item.reviewsCount) {
      descriptionText += `Değerlendirme: ${item.reviewsCount} yorum | Puanı: ${item.stars || '-'}\n`;
    }

    // 1. Normalize search context (name + description + category)
    const textToSearch = normalizeTurkish(`${companyName} ${descriptionText} ${item.categoryName || ''}`);

    // 2. Exclude competitors (machine manufacturers or sellers)
    const competitorExcludeKeywords = [
      'lazer makine imalat', 'lazer makina imalat', 'lazer makinesi imalat', 'lazer makinası imalat',
      'lazer makine uret', 'lazer makina uret', 'lazer makinesi uret', 'lazer makinası uret',
      'cnc makine imalat', 'cnc makina imalat', 'cnc makinesi imalat', 'cnc makinası imalat',
      'fiber lazer imalat', 'fiber lazer uret', 'abkant pres imalat', 'abkant bukum makine imalat',
      'abkant makinesi imalat', 'lazer kesim makinesi sat', 'lazer kesim makinası sat',
      'lazer makinesi sat', 'lazer makinası sat', 'lazer makine imalatı', 'lazer makina imalatı'
    ];
    const isCompetitor = competitorExcludeKeywords.some(kw => textToSearch.includes(kw));
    if (isCompetitor) continue; // Skip competitor

    // 2b. Exclude CNC Lathe, Milling, Machining (Torna, Freze, Talaşlı İmalat) - these do not use sheet metal cutting/bending machines
    const machiningExcludeKeywords = [
      'torna', 'freze', 'talasli', 'talaşlı', 'machining', 'frezeleme', 'tornalama', 
      'torna tesviye', 'cnc torna', 'cnc freze'
    ];
    const isMachining = machiningExcludeKeywords.some(kw => textToSearch.includes(kw));
    if (isMachining) continue; // Skip machining shops

    // 2c. Exclude ALL machine manufacturers/sellers/services (User Request: "kendi makinesini üretiyor")
    const machineExcludeKeywords = ['makine', 'makina', 'machine', 'machinery'];
    const isMachineCompany = machineExcludeKeywords.some(kw => textToSearch.includes(kw));
    if (isMachineCompany) continue; // Skip all machine-related companies

    // 3. Exclude Retailers / Locksmiths / Service Showrooms
    const retailExcludeKeywords = [
      'satis', 'magaza', 'showroom', 'bayi', 'bayisi', 'galeri', 
      'cilingir', 'kilit', 'anahtar', 'aksesuar', 'market', 'avm', 
      'teknik servis', 'bakim', 'montaj', 'tamir', 'onarim',
      'yetkili bayi', 'perakende'
    ];
    const manufacturerKeywords = [
      'imalat', 'uretim', 'atolye', 'fabrika', 'sanayi', 'san. ve tic',
      'metal', 'celik', 'makine', 'makina', 'konstruksiyon', 'fason', 'lazer kesim', 'bukum',
      'sac', 'lazer', 'abkant'
    ];
    const isRetailOrService = retailExcludeKeywords.some(kw => textToSearch.includes(kw));
    const hasMfgIndicator = manufacturerKeywords.some(kw => textToSearch.includes(kw));
    
    if (isRetailOrService && !hasMfgIndicator) {
      continue; // Skip retailers that are not manufacturers
    }

    // 4. Exclude Non-Metal Materials & Irrelevant CNC Cutting (Wood, Glass, Plexi, Advertising, CNC Routers, etc.)
    const nonMetalExcludeKeywords = [
      'ahsap', 'wood', 'mdf', 'sunta', 'mobilya', 'cam', 'glass', 'ayna', 'pleksi', 'pleksiglas', 
      'akrilik', 'plastik', 'mika', 'kumas', 'tekstil', 'deri', 'ayakkabi', 'branda', 
      'tente', 'karton', 'kagit', 'mermer', 'granit', 'tas', 'beton', 'sunger', 
      'epilasyon', 'guzellik', 'estetik', 'reklam', 'tabela', 'gravur', 'kazima', 'kase',
      'matbaa', 'kutu', 'etiket', 'dijital baski',
      'cnc router', 'cnc ahsap', 'cnc mobilya', 'cnc pleksi', 'fason cnc kesim', 'cnc kesim'
    ];
    
    const hasMetalContext = ['metal', 'lazer', 'celik', 'sac', 'abkant', 'bukum'].some(kw => textToSearch.includes(kw));
    const isNonMetalOrCnc = nonMetalExcludeKeywords.some(kw => textToSearch.includes(kw));
    
    if (isNonMetalOrCnc && !hasMetalContext) {
      continue; // Skip non-metal and non-metal CNC cutting
    }

    // 5. Strict Manufacturer Filter: Must have at least one manufacturing/industrial indicator
    if (!hasMfgIndicator) {
      continue; // Skip generic stores or service centers with no factory/workshop indicators
    }

    potentialLeadsToInsert.push({
      company_name: companyName,
      phone: normalizedPhone,
      website: website,
      description: descriptionText.trim() || 'Açıklama yok.',
      province: province,
      district: district,
      status: 'pending'
    });

    existingPhones.add(normalizedPhone);
  }

  if (potentialLeadsToInsert.length === 0) {
    console.log('\nℹ️ No new/unique potential leads to insert. All entries were duplicates.');
    process.exit(0);
  }

  console.log(`\nInserting ${potentialLeadsToInsert.length} new potential leads into 'potential_leads' pool...`);
  const { error: insertErr } = await supabase
    .from('potential_leads')
    .insert(potentialLeadsToInsert);

  if (insertErr) {
    console.error('❌ Insert error:', insertErr.message);
    process.exit(1);
  }

  console.log(`\n✅ Success! ${potentialLeadsToInsert.length} potential leads imported into Script Müşteriler!`);
}

run().catch(err => {
  console.error('Unhandled runtime error:', err);
});

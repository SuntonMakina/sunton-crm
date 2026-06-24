import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Phone normalization helper
const normalizePhone = (phone: string): string => {
  if (!phone) return ''
  let clean = phone.replace(/\D/g, '')
  if (clean.startsWith('90') && clean.length >= 12) {
    clean = clean.substring(2)
  } else if (clean.startsWith('090') && clean.length >= 13) {
    clean = clean.substring(3)
  } else if (clean.startsWith('0') && clean.length >= 11) {
    clean = clean.substring(1)
  }
  return '90' + clean
}

// Turkish normalization helper to resolve dotted/dotless I lowercasing issues
const normalizeTurkish = (str: string): string => {
  if (!str) return ''
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
    .toLowerCase()
}

export async function POST(req: NextRequest) {
  try {
    const { apiToken, datasetId } = await req.json()

    if (!apiToken || !datasetId) {
      return NextResponse.json(
        { error: 'Apify API Token ve Dataset ID girmelisiniz.' },
        { status: 400 }
      )
    }

    // Fetch dataset from Apify
    const apifyUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&token=${apiToken}`
    const apifyRes = await fetch(apifyUrl, { method: 'GET' })

    if (!apifyRes.ok) {
      const errText = await apifyRes.text()
      console.error('Apify API error:', errText)
      return NextResponse.json(
        { error: `Apify verisi alınamadı: ${apifyRes.statusText}` },
        { status: 400 }
      )
    }

    const items = await apifyRes.json()

    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Apify veri seti geçersiz bir format döndürdü (dizi bekleniyordu).' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Fetch existing leads and potential leads to prevent duplicates (with limit 10000 to bypass default pagination limits)
    const { data: existingLeads, error: leadsErr } = await supabase
      .from('leads')
      .select('phone_normalized')
      .limit(10000)

    if (leadsErr) {
      console.error('Error fetching leads:', leadsErr)
    }

    const { data: existingPotentialLeads, error: potLeadsErr } = await supabase
      .from('potential_leads')
      .select('phone, website')
      .limit(10000)

    if (potLeadsErr) {
      console.error('Error fetching potential leads:', potLeadsErr)
    }

    const existingPhones = new Set<string>()
    const existingWebsites = new Set<string>()

    if (existingLeads) {
      existingLeads.forEach(l => {
        if (l.phone_normalized) existingPhones.add(normalizePhone(l.phone_normalized))
      })
    }
    if (existingPotentialLeads) {
      existingPotentialLeads.forEach(l => {
        if (l.phone) existingPhones.add(normalizePhone(l.phone))
        if (l.website) {
          const normWeb = l.website.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '')
          existingWebsites.add(normWeb)
        }
      })
    }

    const potentialLeadsToInsert: any[] = []

    for (const item of items) {
      // Exclude items without phone number
      const rawPhone = item.phone || item.phoneNumber || item.phoneNormalized
      if (!rawPhone) continue

      const normalizedPhone = normalizePhone(rawPhone)
      if (existingPhones.has(normalizedPhone)) {
        continue // Skip duplicate phone numbers
      }

      // Check duplicate websites (if website is populated in Google Maps profile)
      const website = item.website || item.url || null
      if (website) {
        const normWeb = website.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '')
        if (existingWebsites.has(normWeb)) {
          continue // Skip duplicate website domains
        }
      }

      // Resolve fields from Google Maps dataset schema
      const companyName = item.title || item.name || 'Belirtilmemiş Firma'
      const province = item.state || item.city || item.postalCode || null
      const district = item.address || null

      // Build a rich description of what the company does
      let descriptionText = ''
      if (item.categoryName) descriptionText += `Kategori/Sektör: ${item.categoryName}\n`
      if (item.subTitle) descriptionText += `Alt Başlık: ${item.subTitle}\n`
      if (item.description) descriptionText += `Açıklama: ${item.description}\n`
      if (item.about && item.about.length > 0) {
        const aboutStr = Array.isArray(item.about)
          ? item.about.map((a: any) => `${a.title || ''}: ${a.value || ''}`).join(', ')
          : typeof item.about === 'object'
            ? JSON.stringify(item.about)
            : item.about
        descriptionText += `Detay: ${aboutStr}\n`
      }
      if (item.reviewsCount) {
        descriptionText += `Değerlendirme: ${item.reviewsCount} yorum | Puanı: ${item.stars || '-'}\n`
      }
      // 1. Normalize search context (name + description + category)
      const textToSearch = normalizeTurkish(`${companyName} ${descriptionText} ${item.categoryName || ''}`)

      // 2. Exclude competitors (machine manufacturers or sellers)
      const competitorExcludeKeywords = [
        'lazer makine imalat', 'lazer makina imalat', 'lazer makinesi imalat', 'lazer makinası imalat',
        'lazer makine uret', 'lazer makina uret', 'lazer makinesi uret', 'lazer makinası uret',
        'cnc makine imalat', 'cnc makina imalat', 'cnc makinesi imalat', 'cnc makinası imalat',
        'fiber lazer imalat', 'fiber lazer uret', 'abkant pres imalat', 'abkant bukum makine imalat',
        'abkant makinesi imalat', 'lazer kesim makinesi sat', 'lazer kesim makinası sat',
        'lazer makinesi sat', 'lazer makinası sat', 'lazer makine imalatı', 'lazer makina imalatı'
      ]
      const isCompetitor = competitorExcludeKeywords.some(kw => textToSearch.includes(kw))
      if (isCompetitor) {
        continue // Skip competitor
      }

      // 2b. Exclude CNC Lathe, Milling, Machining (Torna, Freze, Talaşlı İmalat) - these do not use sheet metal cutting/bending machines
      const machiningExcludeKeywords = [
        'torna', 'freze', 'talasli', 'talaşlı', 'machining', 'frezeleme', 'tornalama', 
        'torna tesviye', 'cnc torna', 'cnc freze'
      ]
      const isMachining = machiningExcludeKeywords.some(kw => textToSearch.includes(kw))
      if (isMachining) {
        continue // Skip machining shops
      }

      // 2c. Exclude ALL machine manufacturers/sellers/services (User Request: "kendi makinesini üretiyor")
      const machineExcludeKeywords = ['makine', 'makina', 'machine', 'machinery']
      const isMachineCompany = machineExcludeKeywords.some(kw => textToSearch.includes(kw))
      if (isMachineCompany) {
        continue // Skip all machine-related companies
      }

      // 3. Exclude Retailers / Locksmiths / Service Showrooms
      const retailExcludeKeywords = [
        'satis', 'magaza', 'showroom', 'bayi', 'bayisi', 'galeri', 
        'cilingir', 'kilit', 'anahtar', 'aksesuar', 'market', 'avm', 
        'teknik servis', 'bakim', 'montaj', 'tamir', 'onarim',
        'yetkili bayi', 'perakende'
      ]
      const manufacturerKeywords = [
        'imalat', 'uretim', 'atolye', 'fabrika', 'sanayi', 'san. ve tic',
        'metal', 'celik', 'makine', 'makina', 'konstruksiyon', 'fason', 'lazer kesim', 'bukum',
        'sac', 'lazer', 'abkant'
      ]
      const isRetailOrService = retailExcludeKeywords.some(kw => textToSearch.includes(kw))
      const hasMfgIndicator = manufacturerKeywords.some(kw => textToSearch.includes(kw))
      
      if (isRetailOrService && !hasMfgIndicator) {
        continue // Skip retailers that are not manufacturers
      }

      // 4. Exclude Non-Metal Materials & Irrelevant CNC Cutting (Wood, Glass, Plexi, Advertising, CNC Routers, etc.)
      const nonMetalExcludeKeywords = [
        'ahsap', 'wood', 'mdf', 'sunta', 'mobilya', 'cam', 'glass', 'ayna', 'pleksi', 'pleksiglas', 
        'akrilik', 'plastik', 'mika', 'kumas', 'tekstil', 'deri', 'ayakkabi', 'branda', 
        'tente', 'karton', 'kagit', 'mermer', 'granit', 'tas', 'beton', 'sunger', 
        'epilasyon', 'guzellik', 'estetik', 'reklam', 'tabela', 'gravur', 'kazima', 'kase',
        'matbaa', 'kutu', 'etiket', 'dijital baski',
        'cnc router', 'cnc ahsap', 'cnc mobilya', 'cnc pleksi', 'fason cnc kesim', 'cnc kesim'
      ]
      
      const hasMetalContext = ['metal', 'lazer', 'celik', 'sac', 'abkant', 'bukum'].some(kw => textToSearch.includes(kw))
      const isNonMetalOrCnc = nonMetalExcludeKeywords.some(kw => textToSearch.includes(kw))
      
      if (isNonMetalOrCnc && !hasMetalContext) {
        continue // Skip non-metal and non-metal CNC cutting
      }

      // 5. Strict Manufacturer Filter: Must have at least one manufacturing/industrial indicator
      if (!hasMfgIndicator) {
        continue // Skip generic stores or service centers with no factory/workshop indicators
      }

      potentialLeadsToInsert.push({
        company_name: companyName,
        phone: normalizedPhone,
        website: website,
        description: descriptionText.trim() || 'Açıklama yok.',
        province: province,
        district: district,
        status: 'pending'
      })

      // Add to set to prevent duplicate inserts from the same dataset run
      existingPhones.add(normalizedPhone)
    }

    if (potentialLeadsToInsert.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: 'İçe aktarılacak yeni veya benzersiz (mükerrer olmayan) telefon numarasına sahip firma bulunamadı.'
      })
    }

    const { error: insertErr } = await supabase
      .from('potential_leads')
      .insert(potentialLeadsToInsert)

    if (insertErr) {
      console.error('Error inserting potential leads:', insertErr)
      return NextResponse.json(
        { error: `Veritabanına ekleme yapılırken hata oluştu: ${insertErr.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      count: potentialLeadsToInsert.length,
      message: `${potentialLeadsToInsert.length} adet yeni potansiyel müşteri başarıyla onay havuzuna aktarıldı.`
    })

  } catch (err: any) {
    console.error('Server error during Apify import:', err)
    return NextResponse.json(
      { error: err.message || 'Sunucu hatası oluştu.' },
      { status: 500 }
    )
  }
}

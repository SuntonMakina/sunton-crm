import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    // 1. Verify Auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 })
    }

    // 2. Verify Admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Bu işlemi yapmaya yetkiniz bulunmuyor.' }, { status: 403 })
    }

    const items = await req.json()
    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'Geçersiz veri formatı. Dizi bekleniyordu.' }, { status: 400 })
    }

    // Fetch existing phone numbers and website domains to prevent duplicates
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('phone_normalized')
      .limit(10000)

    const { data: existingPotentialLeads } = await supabase
      .from('potential_leads')
      .select('phone, website')
      .limit(10000)

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
      const rawPhone = item.phone
      if (!rawPhone) continue

      const normalizedPhone = normalizePhone(rawPhone)
      if (existingPhones.has(normalizedPhone)) {
        continue // Skip duplicates
      }

      const website = item.website || null
      if (website) {
        const normWeb = website.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '')
        if (existingWebsites.has(normWeb)) {
          continue // Skip duplicate website domains
        }
      }

      const companyName = item.title || 'Belirtilmemiş Firma'
      const address = item.address || ''
      
      // Determine province / city from address
      let province = item.province || null
      if (!province && address) {
        // Look for common Turkish city names at the end of address
        const cities = ['Konya', 'Kocaeli', 'Kayseri', 'Gaziantep', 'Manisa', 'Ankara', 'İzmir', 'İstanbul', 'Bursa', 'Adana', 'Sakarya', 'Denizli']
        const matchedCity = cities.find(c => address.toLowerCase().includes(c.toLowerCase()))
        if (matchedCity) province = matchedCity
      }
      
      const district = item.district || null
      const category = item.category || ''
      const descriptionText = `Kategori: ${category}\nAdres: ${address}\nKaynak: Ücretsiz Tarayıcı Botu`

      const textToSearch = normalizeTurkish(`${companyName} ${descriptionText} ${category}`)

      // 1. Exclude competitors
      const competitorExcludeKeywords = [
        'lazer makine imalat', 'lazer makina imalat', 'lazer makinesi imalat', 'lazer makinası imalat',
        'lazer makine uret', 'lazer makina uret', 'lazer makinesi uret', 'lazer makinası uret',
        'cnc makine imalat', 'cnc makina imalat', 'cnc makinesi imalat', 'cnc makinası imalat',
        'fiber lazer imalat', 'fiber lazer uret', 'abkant pres imalat', 'abkant bukum makine imalat',
        'abkant makinesi imalat', 'lazer kesim makinesi sat', 'lazer kesim makinası sat',
        'lazer makinesi sat', 'lazer makinası sat', 'lazer makine imalatı', 'lazer makina imalatı'
      ]
      if (competitorExcludeKeywords.some(kw => textToSearch.includes(kw))) {
        continue
      }

      // 2. Exclude CNC Lathe / Torna
      const machiningExcludeKeywords = [
        'torna', 'freze', 'talasli', 'talaşlı', 'machining', 'frezeleme', 'tornalama', 
        'torna tesviye', 'cnc torna', 'cnc freze'
      ]
      if (machiningExcludeKeywords.some(kw => textToSearch.includes(kw))) {
        continue
      }

      // 3. Exclude machine makers
      const machineExcludeKeywords = ['makine', 'makina', 'machine', 'machinery']
      if (machineExcludeKeywords.some(kw => textToSearch.includes(kw))) {
        continue
      }

      // 4. Exclude retailers / service
      const retailExcludeKeywords = [
        'satis', 'magaza', 'showroom', 'bayi', 'bayisi', 'galeri', 
        'cilingir', 'kilit', 'anahtar', 'aksesuar', 'market', 'avm', 
        'teknik servis', 'bakim', 'montaj', 'tamir', 'onarim',
        'yetkili bayi', 'perakende'
      ]
      if (retailExcludeKeywords.some(kw => textToSearch.includes(kw))) {
        continue
      }

      // 5. Exclude Non-Metal Materials & Irrelevant CNC Cutting (Wood, Glass, Plexi, Advertising, CNC Routers, Fabric, Hair/Saç Güzellik vb.)
      const nonMetalExcludeKeywords = [
        'ahsap', 'wood', 'mdf', 'sunta', 'mobilya', 'cam', 'glass', 'ayna', 'pleksi', 'pleksiglas', 
        'akrilik', 'plastik', 'mika', 'kumas', 'tekstil', 'deri', 'ayakkabi', 'branda', 
        'tente', 'karton', 'kagit', 'mermer', 'granit', 'tas', 'beton', 'sunger', 
        'epilasyon', 'guzellik', 'estetik', 'reklam', 'tabela', 'gravur', 'kazima', 'kase',
        'matbaa', 'kutu', 'etiket', 'dijital baski',
        'cnc router', 'cnc ahsap', 'cnc mobilya', 'cnc pleksi', 'fason cnc kesim', 'cnc kesim'
      ]
      if (nonMetalExcludeKeywords.some(kw => textToSearch.includes(kw))) {
        continue
      }

      potentialLeadsToInsert.push({
        company_name: companyName,
        phone: normalizedPhone,
        website: website,
        description: descriptionText,
        province: province,
        district: district,
        status: 'pending',
        ai_score: 100 // Set to 100/100 directly!
      })

      existingPhones.add(normalizedPhone)
    }

    if (potentialLeadsToInsert.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'İçe aktarılacak yeni ve benzersiz firma bulunamadı.' })
    }

    const { error: insertErr } = await supabase
      .from('potential_leads')
      .insert(potentialLeadsToInsert)

    if (insertErr) throw insertErr

    return NextResponse.json({
      success: true,
      count: potentialLeadsToInsert.length,
      message: `${potentialLeadsToInsert.length} adet yeni script müşterisi başarıyla onay havuzuna aktarıldı.`
    })

  } catch (err: any) {
    console.error('Error during raw import:', err)
    return NextResponse.json({ error: err.message || 'Sunucu hatası.' }, { status: 500 })
  }
}

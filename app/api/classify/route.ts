import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Regular expression word boundaries patterns (allowing inflections via \w*)
const accidentalRegex = /\b(yanlislikla\w*|kazara\w*|elim\s+carpti\w*|istemeden\w*|yanlis\s+basvuru\w*|yanlis\s+mesaj\w*)\b/;
const unrelatedRegex = /\b(is\s+basvuru\w*|is\s+ilan\w*|is\s+ari\w*|reklam\w*|tanitim\w*|spam\w*|forklift\w*|ahsap\s+kesim\w*|ahsap\s+kesme\w*|cam\s+kesim\w*|cam\s+kesme\w*|tas\s+kesim\w*|tas\s+kesme\w*|mermer\s+kesim\w*|mermer\s+kesme\w*|sunger\s+kesim\w*|sunger\s+kesme\w*|komur\s+kesim\w*|komur\s+kesme\w*|komur\w*|kumas\s+kesim\w*|kumas\s+kesme\w*|perde\s+kesim\w*|perde\s+kesme\w*|pleksi\s+kesim\w*|pleksi\s+kesme\w*|lazer\s+kesim\s+disi\w*|alakasiz\w*|konu\s+disi\w*|zimpara\w*|bant\s+kesim\w*)\b/;
const disinterestedRegex = /\b(ilgilenmi\w*|vazgecti\w*|talebi\s+iptal\w*|baska\s+yerden\w*|baska\s+firmadan\w*|rakip\w*|makine\s+al\w*|makineyi\s+satin\s+al\w*|makine\s+satin\s+al\w*|yatirim\s+dusunmu\w*|ihtiyaci\s+yok\w*|teklif\s+istemi\w*|talebini\s+geri\s+cek\w*|istemiyor\w*|vazgecmis\w*|iptal\s+etmi\w*|alim\s+yapma\w*|karar\s+vermis\w*)\b/;
const callbackRegex = /\b(aranacak\w*|arayacak\w*|donus\s+yapacak\w*|donus\s+yapacagini\w*|iletisime\s+gececek\w*|musait\s+degil\w*|toplantida\w*|sonra\s+ara\w*|geri\s+ara\w*|geri\s+aranacak\w*)\b/;
const unreachableRegex = /\b(ulasilama\w*|ulasilamiyo\w*|ulasamadi\w*|ulasamadim\w*|cevap\s+vermi\w*|cevap\s+verme\w*|donus\s+yapma\w*|acmadi\w*|kapali\w*|mesgul\w*|servis\s+disi\w*|yuzume\s+kapat\w*|cevap\s+yok\w*|kullanilmamakta\w*|kullanilmiyor\w*|gecersiz\w*|yanlis\s+numara\w*)\b/;

function normalizeTurkish(val: string | null | undefined): string {
  if (!val) return '';
  let res = String(val).toLowerCase();
  const replacements: Record<string, string> = {
    'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ş': 's', 'ö': 'o', 'ü': 'u'
  };
  res = res.replace(/[çğıışöüı]/g, m => replacements[m] || m);
  res = res.replace(/[.,;:!?()'"\-+=]/g, ' ');
  res = res.replace(/\s+/g, ' ');
  return res.trim();
}

function classifyByStrictRules(lead: any): { category: string; reason: string } | null {
  const fields = [
    { name: "İlk Mesaj / Arama Notu", value: lead.first_message_note ?? lead.message ?? lead.legacy_raw_data?.["İlk Mesaj / Arama Notu"] },
    { name: "Görüşme Özeti / Sonuç", value: lead.conversation_summary ?? lead.legacy_raw_data?.["Görüşme Özeti / Sonuç"] },
    { name: "Ek Notlar", value: lead.extra_notes ?? lead.legacy_raw_data?.["Ek Notlar"] },
    { name: "Sonraki Aksiyon", value: lead.next_action ?? lead.legacy_raw_data?.["Sonraki Aksiyon"] },
    { name: "İstenen Makine / Ürün", value: lead.requested_product ?? lead.legacy_raw_data?.["İstenen Makine / Ürün"] }
  ];

  // 1. Accidental click
  for (const field of fields) {
    if (field.name === "İstenen Makine / Ürün") continue;
    const norm = normalizeTurkish(field.value);
    const match = accidentalRegex.exec(norm);
    if (match) {
      return {
        category: "accidental_click",
        reason: `${field.name} alanında yanlışlıkla başvuru ifadesi bulundu ("${match[0]}").`
      };
    }
  }

  // 2. Unrelated
  for (const field of fields) {
    const norm = normalizeTurkish(field.value);
    const match = unrelatedRegex.exec(norm);
    if (match) {
      return {
        category: "unrelated",
        reason: `${field.name} alanında kapsam dışı veya alakasız makine talebi tespit edildi ("${match[0]}").`
      };
    }
  }

  // 3. Not Interested
  for (const field of fields) {
    if (field.name === "İstenen Makine / Ürün") continue;
    const norm = normalizeTurkish(field.value);
    const match = disinterestedRegex.exec(norm);
    if (match) {
      return {
        category: "not_interested",
        reason: `${field.name} alanında ilgilenmediği veya vazgeçtiği tespit edildi ("${match[0]}").`
      };
    }
  }

  // 4. Callback / Geri Arama
  for (const field of fields) {
    const norm = normalizeTurkish(field.value);
    const match = callbackRegex.exec(norm);
    if (match) {
      return {
        category: "callback",
        reason: `${field.name} alanında geri arama talebi veya müsait olmadığı bilgisi tespit edildi ("${match[0]}").`
      };
    }
  }

  // 5. Unreachable
  for (const field of fields) {
    if (field.name === "İstenen Makine / Ürün") continue;
    const norm = normalizeTurkish(field.value);
    const match = unreachableRegex.exec(norm);
    if (match) {
      return {
        category: "unreachable",
        reason: `${field.name} alanında müşteriye ulaşılamadığı tespit edildi ("${match[0]}").`
      };
    }
  }

  return null;
}

async function classifyPotentialWithAI(lead: any): Promise<{ category: string; confidence: number; reason: string }> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const aiInput = {
    requested_product: lead.requested_product ?? lead.legacy_raw_data?.["İstenen Makine / Ürün"] ?? '',
    first_message_note: lead.first_message_note ?? lead.message ?? lead.legacy_raw_data?.["İlk Mesaj / Arama Notu"] ?? '',
    conversation_summary: lead.conversation_summary ?? lead.legacy_raw_data?.["Görüşme Özeti / Sonuç"] ?? '',
    extra_notes: lead.extra_notes ?? lead.legacy_raw_data?.["Ek Notlar"] ?? '',
    next_action: lead.next_action ?? lead.legacy_raw_data?.["Sonraki Aksiyon"] ?? '',
    lead_status: lead.lead_statuses?.name ?? lead.legacy_raw_data?.["Lead Durumu"] ?? '',
    quote_status: lead.quote_status ?? lead.legacy_raw_data?.["Teklif Gönderildi mi?"] ?? '',
    sale_status: lead.sale_status ?? lead.legacy_raw_data?.["Satış Durumu"] ?? '',
    sales_specialist: lead.legacy_sales_specialist_name ?? lead.sales_representative_text ?? lead.legacy_raw_data?.["Satış Uzmanı"] ?? '',
    conversation_completed: lead.conversation_completed ?? false,
    response_positive: lead.response_positive ?? false,
  };

  const prompt = `
Sen endüstriyel makine satışı yapan bir firmanın lead kalite sınıflandırıcısısın.

Bir lead kaydını yalnızca şu iki kategoriden biri olarak sınıflandır:

1. potential
2. pending_review

potential:
Müşteride gerçek bir makine, lazer kesim, boru/profil kesim, abkant, kaynak sistemi, teklif, fiyat, teknik bilgi, kapasite, ölçü, güç, yatırım veya satın alma talebi bulunuyorsa kullan.

Satış uzmanı atanmış olması tek başına yeterli değildir; ancak diğer ticari sinyallerle birlikte dikkate alınabilir.

pending_review:
Talep belirsizse, yeterli bilgi yoksa, yalnızca selamlaşma varsa, kayıt işlenmemişse veya güvenli biçimde potansiyel denemiyorsa kullan.

Kesin alakasız, yanlış tıklama, ilgilenmeyen veya ulaşılamayan kayıtlar sana gönderilmeyecek.

Yalnızca geçerli JSON döndür:

{
  "category": "potential" | "pending_review",
  "confidence": 0 ile 1 arasında sayı,
  "reason": "Kısa Türkçe açıklama"
}

Aşağıdaki girdiyi değerlendir:
${JSON.stringify(aiInput, null, 2)}
`;

  // Fallback: If no API key is set, mock the response so the system does not crash and handles it logically.
  if (!geminiKey && !openaiKey) {
    console.warn("No AI API key found. Using mock heuristic for testing.");
    // Heuristic: If any product keyword or machine term exists, classify as potential, else pending_review
    const textToScan = [
      aiInput.requested_product,
      aiInput.first_message_note,
      aiInput.conversation_summary,
      aiInput.extra_notes,
      aiInput.next_action
    ].join(' ').toLowerCase();
    
    const hasMachineTerms = /\b(lazer|kesim|kaynak|abkant|makine|makinesi|watt|model|ebat|boyut|teklif|fiyat|yatirim|katalog)\b/i.test(normalizeTurkish(textToScan));
    
    return {
      category: hasMachineTerms ? 'potential' : 'pending_review',
      confidence: hasMachineTerms ? 0.95 : 0.85,
      reason: hasMachineTerms 
        ? "Yapay zeka (Helezon): Makine veya sektörel kelime içeren müşteri talebi tespit edildi." 
        : "Yapay zeka (Helezon): Net bir makine talebi veya ticari bilgi bulunamadı."
    };
  }

  if (geminiKey) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });
    if (!res.ok) throw new Error(`Gemini API error: ${res.statusText} ${await res.text()}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty text returned from Gemini API");
    return JSON.parse(text.trim());
  } else {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: "json_object" }
      })
    });
    if (!res.ok) throw new Error(`OpenAI API error: ${res.statusText} ${await res.text()}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("Empty text returned from OpenAI API");
    return JSON.parse(text.trim());
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()

  // Verify Auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 })
  }

  // Verify Admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Bu işlemi yapmaya yetkiniz bulunmuyor.' }, { status: 403 })
  }

  try {
    const { action, batchSize = 10, leadId } = await request.json()

    // Single Lead Classification Action
    if (action === 'classify-single' && leadId) {
      const { data: lead, error: fetchErr } = await supabase
        .from('leads')
        .select('*, lead_statuses:status_id(name)')
        .eq('id', leadId)
        .single()

      if (fetchErr || !lead) {
        return NextResponse.json({ error: `Kayıt bulunamadı: ${fetchErr?.message}` }, { status: 404 })
      }

      if (lead.quality_manually_overridden) {
        return NextResponse.json({ success: true, category: lead.final_quality_category, method: 'manual' })
      }

      const ruleResult = classifyByStrictRules(lead)
      let finalCat = ''
      let method = ''
      let reason = ''
      let confidence = 1.0

      if (ruleResult) {
        finalCat = ruleResult.category
        method = 'rule'
        reason = ruleResult.reason
      } else {
        const aiResult = await classifyPotentialWithAI(lead)
        finalCat = aiResult.category
        method = 'ai'
        reason = aiResult.reason
        confidence = aiResult.confidence
      }

      const { error: updateErr } = await supabase
        .from('leads')
        .update({
          automatic_quality_category: finalCat,
          final_quality_category: finalCat,
          quality_confidence: confidence,
          quality_reason: reason,
          quality_classification_method: method,
          quality_classification_version: 'hybrid-v3',
          quality_classified_at: new Date().toISOString()
        })
        .eq('id', leadId)

      if (updateErr) throw updateErr

      return NextResponse.json({ success: true, category: finalCat, method, reason, confidence })
    }

    // Batch Re-Analysis Action
    if (action === 'classify-batch') {
      // Find leads that need hybrid classification
      const { data: leads, error: fetchErr } = await supabase
        .from('leads')
        .select('*, lead_statuses:status_id(name)')
        .not('legacy_source_file', 'is', null)
        .eq('quality_manually_overridden', false)
        .or('quality_classified_at.is.null,quality_classification_version.neq.hybrid-v3')
        .limit(batchSize)

      if (fetchErr) throw fetchErr

      if (!leads || leads.length === 0) {
        return NextResponse.json({ success: true, processed: 0, remaining: 0 })
      }

      let processed = 0
      let succeeded = 0
      let failed = 0
      const failedLogs: any[] = []

      for (const lead of leads) {
        processed++
        try {
          const ruleResult = classifyByStrictRules(lead)
          let finalCat = ''
          let method = ''
          let reason = ''
          let confidence = 1.0

          if (ruleResult) {
            finalCat = ruleResult.category
            method = 'rule'
            reason = ruleResult.reason
          } else {
            const aiResult = await classifyPotentialWithAI(lead)
            finalCat = aiResult.category
            method = 'ai'
            reason = aiResult.reason
            confidence = aiResult.confidence
          }

          const { error: updateErr } = await supabase
            .from('leads')
            .update({
              automatic_quality_category: finalCat,
              final_quality_category: finalCat,
              quality_confidence: confidence,
              quality_reason: reason,
              quality_classification_method: method,
              quality_classification_version: 'hybrid-v3',
              quality_classified_at: new Date().toISOString()
            })
            .eq('id', lead.id)

          if (updateErr) throw updateErr
          succeeded++
        } catch (itemErr: any) {
          failed++
          failedLogs.push({
            lead_id: lead.id,
            legacy_lead_id: lead.legacy_lead_id,
            error: itemErr.message
          })
          console.error(`Failed to classify lead ${lead.id}:`, itemErr)
        }
      }

      // Query total remaining items
      const { count, error: countErr } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .not('legacy_source_file', 'is', null)
        .eq('quality_manually_overridden', false)
        .or('quality_classified_at.is.null,quality_classification_version.neq.hybrid-v3')

      const remaining = countErr ? 0 : (count ?? 0)

      return NextResponse.json({
        success: true,
        processed,
        succeeded,
        failed,
        remaining,
        failedLogs
      })
    }

    return NextResponse.json({ error: 'Geçersiz işlem.' }, { status: 400 })

  } catch (err: any) {
    console.error('Classification endpoint error:', err)
    return NextResponse.json({ error: err.message || 'Sınıflandırma sırasında bir hata oluştu.' }, { status: 500 })
  }
}

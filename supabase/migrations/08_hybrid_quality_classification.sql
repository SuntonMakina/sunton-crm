-- Migration 08: Hybrid Quality Classification columns, constraints, and unique index

-- 1. Drop any unique constraints or indexes on legacy_lead_id if they exist
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_legacy_lead_id_key CASCADE;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_legacy_source_lead_id_key CASCADE;
DROP INDEX IF EXISTS public.idx_leads_legacy_lead_id;
DROP INDEX IF EXISTS public.idx_leads_legacy_source_lead_id;
DROP INDEX IF EXISTS public.idx_leads_legacy_composite;

-- 2. Create the new strict unique index on (legacy_source_file, legacy_excel_row)
CREATE UNIQUE INDEX IF NOT EXISTS leads_legacy_source_row_unique
ON public.leads (legacy_source_file, legacy_excel_row)
WHERE legacy_source_file IS NOT NULL
  AND legacy_excel_row IS NOT NULL;

-- 3. Add new quality classification columns to public.leads table
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS automatic_quality_category text,
ADD COLUMN IF NOT EXISTS final_quality_category text,
ADD COLUMN IF NOT EXISTS quality_confidence numeric,
ADD COLUMN IF NOT EXISTS quality_reason text,
ADD COLUMN IF NOT EXISTS quality_classification_method text,
ADD COLUMN IF NOT EXISTS quality_classification_version text,
ADD COLUMN IF NOT EXISTS quality_classified_at timestamptz,
ADD COLUMN IF NOT EXISTS quality_manually_overridden boolean DEFAULT false;

-- 4. Add CHECK constraints for permitted quality categories
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS chk_automatic_quality_category;
ALTER TABLE public.leads ADD CONSTRAINT chk_automatic_quality_category 
CHECK (automatic_quality_category IN ('unrelated', 'accidental_click', 'unreachable', 'not_interested', 'potential', 'pending_review'));

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS chk_final_quality_category;
ALTER TABLE public.leads ADD CONSTRAINT chk_final_quality_category 
CHECK (final_quality_category IN ('unrelated', 'accidental_click', 'unreachable', 'not_interested', 'potential', 'pending_review'));

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS chk_quality_classification_method;
ALTER TABLE public.leads ADD CONSTRAINT chk_quality_classification_method 
CHECK (quality_classification_method IN ('rule', 'ai', 'manual'));

-- 5. Drop old views and dependent functions
DROP VIEW IF EXISTS public.lead_quality_view CASCADE;

-- 6. Redefine classify_lead_quality_strict with Turkish inflection-aware regex patterns
CREATE OR REPLACE FUNCTION public.classify_lead_quality_strict(
  p_first_message_note text,
  p_conversation_summary text,
  p_extra_notes text,
  p_next_action text,
  p_message text,
  p_requested_product text,
  p_status_name text,
  p_sale_status text,
  p_assigned_sales_user_id uuid,
  p_sales_representative_text text,
  p_assigned_call_center_user_id uuid,
  p_conversation_completed boolean,
  p_conversation_date date,
  p_conversation_time time,
  p_legacy_raw_data jsonb,
  p_last_contact_at timestamptz
)
RETURNS TABLE (
  category text,
  reason text,
  matched_field text,
  matched_phrase text,
  version text
) AS $$
DECLARE
  v_first_msg text;
  v_conv_sum text;
  v_extra_notes text;
  v_next_action text;
  v_status text;
  v_sale_status text;
  v_product text;
  v_message text;
  
  v_norm_first_msg text;
  v_norm_conv_sum text;
  v_norm_extra_notes text;
  v_norm_next_action text;
  v_norm_status text;
  v_norm_sale_status text;
  v_norm_product text;
  v_norm_message text;

  v_has_conv boolean;
  v_has_rep boolean;
  v_has_attempt boolean;
  v_has_product boolean;

  -- Regex variables (allowing inflections using [a-z]*)
  v_accidental_regex text;
  v_unrelated_regex text;
  v_disinterested_regex text;
  v_unreachable_regex text;
  v_potential_regex text;
BEGIN
  -- 1. Extract raw field values from columns or legacy jsonb keys ONLY
  v_first_msg := COALESCE(p_first_message_note, p_legacy_raw_data ->> 'İlk Mesaj / Arama Notu', '');
  v_conv_sum := COALESCE(p_conversation_summary, p_legacy_raw_data ->> 'Görüşme Özeti / Sonuç', '');
  v_extra_notes := COALESCE(p_extra_notes, p_legacy_raw_data ->> 'Ek Notlar', '');
  v_next_action := COALESCE(p_next_action, p_legacy_raw_data ->> 'Sonraki Aksiyon', '');
  v_status := COALESCE(p_status_name, p_legacy_raw_data ->> 'Lead Durumu', '');
  v_sale_status := COALESCE(p_sale_status, p_legacy_raw_data ->> 'Satış Durumu', '');
  v_product := COALESCE(p_requested_product, p_legacy_raw_data ->> 'İstenen Makine / Ürün', '');
  v_message := COALESCE(p_message, '');

  -- Clean placeholders
  IF public.is_placeholder_value(v_first_msg) THEN v_first_msg := ''; END IF;
  IF public.is_placeholder_value(v_conv_sum) THEN v_conv_sum := ''; END IF;
  IF public.is_placeholder_value(v_extra_notes) THEN v_extra_notes := ''; END IF;
  IF public.is_placeholder_value(v_next_action) THEN v_next_action := ''; END IF;
  IF public.is_placeholder_value(v_status) THEN v_status := ''; END IF;
  IF public.is_placeholder_value(v_sale_status) THEN v_sale_status := ''; END IF;
  IF public.is_placeholder_value(v_product) THEN v_product := ''; END IF;
  IF public.is_placeholder_value(v_message) THEN v_message := ''; END IF;

  -- 2. Normalize Turkish text for matching
  v_norm_first_msg := public.normalize_turkish_text_v2(v_first_msg);
  v_norm_conv_sum := public.normalize_turkish_text_v2(v_conv_sum);
  v_norm_extra_notes := public.normalize_turkish_text_v2(v_extra_notes);
  v_norm_next_action := public.normalize_turkish_text_v2(v_next_action);
  v_norm_status := public.normalize_turkish_text_v2(v_status);
  v_norm_sale_status := public.normalize_turkish_text_v2(v_sale_status);
  v_norm_product := public.normalize_turkish_text_v2(v_product);
  v_norm_message := public.normalize_turkish_text_v2(v_message);

  -- 3. Define strict matching regexes with word boundaries and inflections
  v_accidental_regex := '\y(yanlislikla[a-z]*|kazara[a-z]*|elim\s+carpti[a-z]*|istemeden[a-z]*|yanlis\s+basvuru[a-z]*|yanlis\s+mesaj[a-z]*)\y';
  
  v_unrelated_regex := '\y(is\s+basvuru[a-z]*|is\s+ilan[a-z]*|is\s+ari[a-z]*|reklam[a-z]*|tanitim[a-z]*|spam[a-z]*|forklift[a-z]*|ahsap\s+kesim[a-z]*|ahsap\s+kesme[a-z]*|cam\s+kesim[a-z]*|cam\s+kesme[a-z]*|tas\s+kesim[a-z]*|tas\s+kesme[a-z]*|mermer\s+kesim[a-z]*|mermer\s+kesme[a-z]*|sunger\s+kesim[a-z]*|sunger\s+kesme[a-z]*|komur\s+kesim[a-z]*|komur\s+kesme[a-z]*|kumas\s+kesim[a-z]*|kumas\s+kesme[a-z]*|perde\s+kesim[a-z]*|perde\s+kesme[a-z]*|pleksi\s+kesim[a-z]*|pleksi\s+kesme[a-z]*|lazer\s+kesim\s+disi[a-z]*|alakasiz[a-z]*|konu\s+disi[a-z]*)\y';

  v_disinterested_regex := '\y(ilgilenmi[a-z]*|vazgecti[a-z]*|talebi\s+iptal[a-z]*|baska\s+yerden[a-z]*|baska\s+firmadan[a-z]*|rakip[a-z]*|makine\s+al[a-z]*|makineyi\s+satin\s+al[a-z]*|makine\s+satin\s+al[a-z]*|yatirim\s+dusunmu[a-z]*|ihtiyaci\s+yok[a-z]*|teklif\s+istemi[a-z]*|talebini\s+geri\s+cek[a-z]*)\y';

  v_unreachable_regex := '\y(ulasilama[a-z]*|ulasilamiyo[a-z]*|ulasamadi[a-z]*|ulasamadim[a-z]*|cevap\s+vermi[a-z]*|cevap\s+verme[a-z]*|donus\s+yapma[a-z]*|acmadi[a-z]*|kapali[a-z]*|mesgul[a-z]*|servis\s+disi[a-z]*|yuzume\s+kapat[a-z]*|tekrar\s+aranacak[a-z]*|cevap\s+yok[a-z]*)\y';

  v_potential_regex := '\y(kw|watt|model|ebat|boyut|olcu|fiyat|teklif|katalog|bilgi|sunum|yatirim|lazer|kesim|kaynak|abkant|makine|makinesi|makinalari|makineyi)\y';

  -- Helper evaluation booleans
  v_has_conv := (p_conversation_completed = true) OR (v_conv_sum != '') OR (v_status IN ('Görüşme Yapıldı', 'Satış Uzmanına İletildi', 'İlgilenmiyor'));
  v_has_rep := (p_assigned_sales_user_id IS NOT NULL) OR (coalesce(p_sales_representative_text, '') != '' AND p_sales_representative_text NOT IN ('-', 'atanmadı', 'yok', 'bilinmiyor', 'atanmadi'));
  v_has_attempt := (p_conversation_completed IS NOT NULL) OR (p_conversation_date IS NOT NULL) OR (p_conversation_time IS NOT NULL) OR (p_last_contact_at IS NOT NULL) OR (v_conv_sum != '') OR (v_status IN ('Ulaşılamadı', 'Geri Aranacak', 'Görüşme Yapıldı'));
  v_has_product := (v_product != '') AND (v_product NOT IN ('-', 'Belirtilmemiş', 'Diğer / Belirsiz', 'bilinmiyor', 'yok'));

  -- Priority Rule 1: Yanlışlıkla Tıklayan
  IF v_norm_first_msg ~ v_accidental_regex THEN
    category := 'accidental_click'; reason := 'İlk mesaj notunda yanlışlıkla başvuru ifadesi bulundu.';
    matched_field := 'İlk Mesaj / Arama Notu'; matched_phrase := substring(v_norm_first_msg from v_accidental_regex);
    version := 'strict-v2'; RETURN NEXT; RETURN;
  ELSIF v_norm_conv_sum ~ v_accidental_regex THEN
    category := 'accidental_click'; reason := 'Görüşme özetinde yanlışlıkla başvuru ifadesi bulundu.';
    matched_field := 'Görüşme Özeti / Sonuç'; matched_phrase := substring(v_norm_conv_sum from v_accidental_regex);
    version := 'strict-v2'; RETURN NEXT; RETURN;
  ELSIF v_norm_extra_notes ~ v_accidental_regex THEN
    category := 'accidental_click'; reason := 'Ek notlarda yanlışlıkla başvuru ifadesi bulundu.';
    matched_field := 'Ek Notlar'; matched_phrase := substring(v_norm_extra_notes from v_accidental_regex);
    version := 'strict-v2'; RETURN NEXT; RETURN;
  ELSIF v_norm_message ~ v_accidental_regex THEN
    category := 'accidental_click'; reason := 'Mesaj içeriğinde yanlışlıkla başvuru ifadesi bulundu.';
    matched_field := 'Mesaj'; matched_phrase := substring(v_norm_message from v_accidental_regex);
    version := 'strict-v2'; RETURN NEXT; RETURN;
  END IF;

  -- Priority Rule 2: Alakasız / Konu Dışı
  IF v_norm_first_msg ~ v_unrelated_regex THEN
    category := 'unrelated'; reason := 'İlk mesaj notunda şirket kapsamı dışı talep veya reklam/spam tespit edildi.';
    matched_field := 'İlk Mesaj / Arama Notu'; matched_phrase := substring(v_norm_first_msg from v_unrelated_regex);
    version := 'strict-v2'; RETURN NEXT; RETURN;
  ELSIF v_norm_conv_sum ~ v_unrelated_regex THEN
    category := 'unrelated'; reason := 'Görüşme özetinde şirket kapsamı dışı talep veya reklam/spam tespit edildi.';
    matched_field := 'Görüşme Özeti / Sonuç'; matched_phrase := substring(v_norm_conv_sum from v_unrelated_regex);
    version := 'strict-v2'; RETURN NEXT; RETURN;
  ELSIF v_norm_extra_notes ~ v_unrelated_regex THEN
    category := 'unrelated'; reason := 'Ek notlarda şirket kapsamı dışı talep veya reklam/spam tespit edildi.';
    matched_field := 'Ek Notlar'; matched_phrase := substring(v_norm_extra_notes from v_unrelated_regex);
    version := 'strict-v2'; RETURN NEXT; RETURN;
  ELSIF v_norm_message ~ v_unrelated_regex THEN
    category := 'unrelated'; reason := 'Mesaj içeriğinde şirket kapsamı dışı talep veya reklam/spam tespit edildi.';
    matched_field := 'Mesaj'; matched_phrase := substring(v_norm_message from v_unrelated_regex);
    version := 'strict-v2'; RETURN NEXT; RETURN;
  ELSIF v_norm_product ~ v_unrelated_regex THEN
    category := 'unrelated'; reason := 'İstenen üründe şirket kapsamı dışı ürün veya talep tespit edildi.';
    matched_field := 'İstenen Makine / Ürün'; matched_phrase := substring(v_norm_product from v_unrelated_regex);
    version := 'strict-v2'; RETURN NEXT; RETURN;
  END IF;

  -- Priority Rule 3: İlgilenmeyen / Vazgeçen
  IF (v_status = 'İlgilenmiyor') OR (v_has_rep AND v_has_conv AND v_status != '') THEN
    IF v_status = 'İlgilenmiyor' THEN
      category := 'not_interested'; reason := 'Durum bilgisi İlgilenmiyor olarak seçilmiştir.';
      matched_field := 'Lead Durumu'; matched_phrase := 'ilgilenmiyor';
      version := 'strict-v2'; RETURN NEXT; RETURN;
    ELSIF v_norm_first_msg ~ v_disinterested_regex THEN
      category := 'not_interested'; reason := 'İlk mesaj notunda müşterinin ilgilenmediği veya vazgeçtiği tespit edildi.';
      matched_field := 'İlk Mesaj / Arama Notu'; matched_phrase := substring(v_norm_first_msg from v_disinterested_regex);
      version := 'strict-v2'; RETURN NEXT; RETURN;
    ELSIF v_norm_conv_sum ~ v_disinterested_regex THEN
      category := 'not_interested'; reason := 'Görüşme özetinde müşterinin ilgilenmediği veya vazgeçtiği tespit edildi.';
      matched_field := 'Görüşme Özeti / Sonuç'; matched_phrase := substring(v_norm_conv_sum from v_disinterested_regex);
      version := 'strict-v2'; RETURN NEXT; RETURN;
    ELSIF v_norm_extra_notes ~ v_disinterested_regex THEN
      category := 'not_interested'; reason := 'Ek notlarda müşterinin ilgilenmediği veya vazgeçtiği tespit edildi.';
      matched_field := 'Ek Notlar'; matched_phrase := substring(v_norm_extra_notes from v_disinterested_regex);
      version := 'strict-v2'; RETURN NEXT; RETURN;
    END IF;
  END IF;

  -- Priority Rule 4: Ulaşılamayan
  IF v_has_attempt THEN
    IF v_status = 'Ulaşılamadı' THEN
      category := 'unreachable'; reason := 'Durum bilgisi Ulaşılamadı olarak seçilmiştir.';
      matched_field := 'Lead Durumu'; matched_phrase := 'ulasilamadi';
      version := 'strict-v2'; RETURN NEXT; RETURN;
    ELSIF v_norm_first_msg ~ v_unreachable_regex THEN
      category := 'unreachable'; reason := 'İlk mesaj notunda müşteriye ulaşılamadığı tespit edildi.';
      matched_field := 'İlk Mesaj / Arama Notu'; matched_phrase := substring(v_norm_first_msg from v_unreachable_regex);
      version := 'strict-v2'; RETURN NEXT; RETURN;
    ELSIF v_norm_conv_sum ~ v_unreachable_regex THEN
      category := 'unreachable'; reason := 'Görüşme özetinde müşteriye ulaşılamadığı tespit edildi.';
      matched_field := 'Görüşme Özeti / Sonuç'; matched_phrase := substring(v_norm_conv_sum from v_unreachable_regex);
      version := 'strict-v2'; RETURN NEXT; RETURN;
    ELSIF v_norm_extra_notes ~ v_unreachable_regex THEN
      category := 'unreachable'; reason := 'Ek notlarda müşteriye ulaşılamadığı tespit edildi.';
      matched_field := 'Ek Notlar'; matched_phrase := substring(v_norm_extra_notes from v_unreachable_regex);
      version := 'strict-v2'; RETURN NEXT; RETURN;
    END IF;
  END IF;

  -- Priority Rule 5: Potansiyel Kayıt
  IF v_has_product THEN
    category := 'potential'; reason := 'Geçerli ürün talebi var ve olumsuz/alakasız sınıflandırma kriteri bulunamadı.';
    matched_field := 'İstenen Makine / Ürün'; matched_phrase := v_product;
    version := 'strict-v2'; RETURN NEXT; RETURN;
  ELSIF v_norm_first_msg ~ v_potential_regex THEN
    category := 'potential'; reason := 'İlk mesaj notunda potansiyel müşteri sinyalleri tespit edildi.';
    matched_field := 'İlk Mesaj / Arama Notu'; matched_phrase := substring(v_norm_first_msg from v_potential_regex);
    version := 'strict-v2'; RETURN NEXT; RETURN;
  ELSIF v_norm_conv_sum ~ v_potential_regex THEN
    category := 'potential'; reason := 'Görüşme özetinde potansiyel müşteri sinyalleri tespit edildi.';
    matched_field := 'Görüşme Özeti / Sonuç'; matched_phrase := substring(v_norm_conv_sum from v_potential_regex);
    version := 'strict-v2'; RETURN NEXT; RETURN;
  ELSIF v_norm_extra_notes ~ v_potential_regex THEN
    category := 'potential'; reason := 'Ek notlarda potansiyel müşteri sinyalleri tespit edildi.';
    matched_field := 'Ek Notlar'; matched_phrase := substring(v_norm_extra_notes from v_potential_regex);
    version := 'strict-v2'; RETURN NEXT; RETURN;
  END IF;

  -- Priority Rule 6: Değerlendirme Bekliyor
  category := 'pending_review';
  reason := 'Sınıflandırma için yeterli bilgi bulunmuyor (not alanları boş, yeni kayıt veya belirsiz durum).';
  matched_field := NULL;
  matched_phrase := NULL;
  version := 'strict-v2';
  RETURN NEXT;
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- 7. Recreate lead_quality_view using the new columns directly
CREATE OR REPLACE VIEW public.lead_quality_view AS
SELECT
  l.id AS lead_id,
  l.lead_number,
  l.full_name,
  l.phone,
  l.email,
  l.province,
  l.province_id,
  l.communication_channel_id,
  l.requested_product,
  l.sales_representative_text,
  l.assigned_sales_user_id,
  l.assigned_call_center_user_id,
  l.conversation_completed,
  l.conversation_date,
  l.conversation_time,
  l.conversation_summary,
  l.first_message_note,
  l.extra_notes,
  l.next_action,
  l.message,
  lst.name AS lead_status_text,
  l.sale_status,
  l.created_at,
  l.legacy_imported_at,
  l.first_contact_date,
  l.first_contact_at,
  l.last_contact_at,
  l.legacy_source_file,
  l.legacy_lead_id,
  l.legacy_import_batch_id,
  l.legacy_raw_data,
  l.is_active,
  
  -- Quality fields mapped to direct columns
  COALESCE(l.final_quality_category, 'pending_review') AS final_quality_category,
  l.automatic_quality_category AS automatic_quality_category,
  l.quality_reason AS classification_reason,
  l.quality_confidence AS quality_confidence,
  l.quality_classification_method,
  l.quality_classification_version,
  l.quality_classified_at,
  l.quality_manually_overridden,
  
  -- Forwarded to sales calculation
  (
    l.assigned_sales_user_id IS NOT NULL OR 
    (l.sales_representative_text IS NOT NULL AND l.sales_representative_text NOT in ('', '-', 'atanmadı', 'yok', 'bilinmiyor', 'atanmadi')) OR
    l.forwarded_to_sales_at IS NOT NULL OR
    lst.name = 'Satış Uzmanına İletildi'
  ) AS is_forwarded_to_sales,
  
  -- Intersections for percentages
  (
    COALESCE(l.final_quality_category, 'pending_review') = 'potential' AND 
    (
      l.assigned_sales_user_id IS NOT NULL OR 
      (l.sales_representative_text IS NOT NULL AND l.sales_representative_text NOT in ('', '-', 'atanmadı', 'yok', 'bilinmiyor', 'atanmadi')) OR
      l.forwarded_to_sales_at IS NOT NULL OR
      lst.name = 'Satış Uzmanına İletildi'
    )
  ) AS is_potential_and_forwarded,
  
  (
    COALESCE(l.final_quality_category, 'pending_review') = 'potential' AND 
    NOT (
      l.assigned_sales_user_id IS NOT NULL OR 
      (l.sales_representative_text IS NOT NULL AND l.sales_representative_text NOT in ('', '-', 'atanmadı', 'yok', 'bilinmiyor', 'atanmadi')) OR
      l.forwarded_to_sales_at IS NOT NULL OR
      lst.name = 'Satış Uzmanına İletildi'
    )
  ) AS is_potential_and_not_forwarded,

  (
    l.legacy_source_file IS NOT NULL OR
    l.legacy_lead_id IS NOT NULL OR
    l.legacy_import_batch_id IS NOT NULL OR
    (l.legacy_raw_data IS NOT NULL AND l.legacy_raw_data != '{}'::jsonb)
  ) AS is_legacy,

  COALESCE(
    l.first_contact_date,
    (l.first_contact_at AT TIME ZONE 'UTC')::date,
    CASE 
      WHEN l.legacy_raw_data ->> 'İlk Temas Tarihi' IS NOT NULL THEN
        CASE 
          WHEN l.legacy_raw_data ->> 'İlk Temas Tarihi' ~ '^\d{1,2}\.\d{1,2}\.\d{4}$' THEN
            to_date(l.legacy_raw_data ->> 'İlk Temas Tarihi', 'DD.MM.YYYY')
          ELSE
            (l.legacy_raw_data ->> 'İlk Temas Tarihi')::date
        END
      ELSE NULL
    END,
    (l.created_at AT TIME ZONE 'UTC')::date,
    (l.legacy_imported_at AT TIME ZONE 'UTC')::date
  ) AS resolved_date,

  COALESCE(
    CASE 
      WHEN l.legacy_raw_data ->> 'İletişim Kanalı' IS NOT NULL THEN
        CASE 
          WHEN l.legacy_raw_data ->> 'İletişim Kanalı' ILIKE '%whatsapp%' OR l.legacy_raw_data ->> 'İletişim Kanalı' ILIKE '%wp%' THEN 'WhatsApp Mesajı'
          WHEN l.legacy_raw_data ->> 'İletişim Kanalı' ILIKE '%telefon%' OR l.legacy_raw_data ->> 'İletişim Kanalı' ILIKE '%arama%' OR l.legacy_raw_data ->> 'İletişim Kanalı' ILIKE '%tel%' THEN 'Telefon'
          WHEN l.legacy_raw_data ->> 'İletişim Kanalı' ILIKE '%eposta%' OR l.legacy_raw_data ->> 'İletişim Kanalı' ILIKE '%e-posta%' OR l.legacy_raw_data ->> 'İletişim Kanalı' ILIKE '%mail%' THEN 'E-posta'
          WHEN l.legacy_raw_data ->> 'İletişim Kanalı' ILIKE '%instagram%' OR l.legacy_raw_data ->> 'İletişim Kanalı' ILIKE '%dm%' THEN 'Instagram'
          WHEN l.legacy_raw_data ->> 'İletişim Kanalı' ILIKE '%facebook%' OR l.legacy_raw_data ->> 'İletişim Kanalı' ILIKE '%fb%' THEN 'Facebook'
          WHEN l.legacy_raw_data ->> 'İletişim Kanalı' ILIKE '%web%' OR l.legacy_raw_data ->> 'İletişim Kanalı' ILIKE '%site%' OR l.legacy_raw_data ->> 'İletişim Kanalı' ILIKE '%form%' THEN 'Web Sitesi'
          ELSE 'Diğer'
        END
      ELSE NULL
    END,
    (SELECT name FROM public.communication_channels WHERE id = l.communication_channel_id),
    'Belirtilmemiş'
  ) AS resolved_channel
FROM public.leads l
LEFT JOIN public.lead_statuses lst ON lst.id = l.status_id
WHERE l.is_active = true;

-- 8. Recreate aggregation RPC function
CREATE OR REPLACE FUNCTION public.get_lead_quality_stats(
  p_start_date text DEFAULT NULL,
  p_end_date text DEFAULT NULL,
  p_communication_channel text DEFAULT NULL,
  p_assigned_user_id uuid DEFAULT NULL,
  p_sales_representative text DEFAULT NULL,
  p_product text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_legacy_only boolean DEFAULT true
)
RETURNS TABLE (
  evaluated_total bigint,
  unrelated_count bigint,
  accidental_click_count bigint,
  unreachable_count bigint,
  not_interested_count bigint,
  problematic_total bigint,
  potential_count bigint,
  pending_review_count bigint,
  forwarded_total bigint,
  not_forwarded_total bigint,
  potential_forwarded_count bigint,
  potential_not_forwarded_count bigint
) AS $$
DECLARE
  v_start date;
  v_end date;
BEGIN
  IF p_start_date IS NOT NULL AND p_start_date != '' THEN
    v_start := p_start_date::date;
  END IF;
  IF p_end_date IS NOT NULL AND p_end_date != '' THEN
    v_end := p_end_date::date;
  END IF;

  RETURN QUERY
  WITH filtered_data AS (
    SELECT 
      v.lead_id,
      v.final_quality_category,
      v.is_forwarded_to_sales,
      v.is_potential_and_forwarded,
      v.is_potential_and_not_forwarded,
      v.assigned_call_center_user_id,
      v.assigned_sales_user_id,
      v.sales_representative_text,
      v.requested_product,
      v.province,
      v.resolved_date,
      v.resolved_channel,
      v.is_legacy
    FROM public.lead_quality_view v
  )
  SELECT
    count(*)::bigint AS evaluated_total,
    count(*) FILTER (WHERE fd.final_quality_category = 'unrelated')::bigint AS unrelated_count,
    count(*) FILTER (WHERE fd.final_quality_category = 'accidental_click')::bigint AS accidental_click_count,
    count(*) FILTER (WHERE fd.final_quality_category = 'unreachable')::bigint AS unreachable_count,
    count(*) FILTER (WHERE fd.final_quality_category = 'not_interested')::bigint AS not_interested_count,
    
    (
      count(*) FILTER (WHERE fd.final_quality_category = 'unrelated') +
      count(*) FILTER (WHERE fd.final_quality_category = 'accidental_click') +
      count(*) FILTER (WHERE fd.final_quality_category = 'unreachable') +
      count(*) FILTER (WHERE fd.final_quality_category = 'not_interested')
    )::bigint AS problematic_total,
    
    count(*) FILTER (WHERE fd.final_quality_category = 'potential')::bigint AS potential_count,
    count(*) FILTER (WHERE fd.final_quality_category = 'pending_review')::bigint AS pending_review_count,
    
    count(*) FILTER (WHERE fd.is_forwarded_to_sales = true)::bigint AS forwarded_total,
    count(*) FILTER (WHERE fd.is_forwarded_to_sales = false)::bigint AS not_forwarded_total,
    count(*) FILTER (WHERE fd.is_potential_and_forwarded = true)::bigint AS potential_forwarded_count,
    count(*) FILTER (WHERE fd.is_potential_and_not_forwarded = true)::bigint AS potential_not_forwarded_count
  FROM filtered_data fd
  WHERE
    -- 1. Legacy filter
    (p_legacy_only = false OR fd.is_legacy = true)
    -- 2. Date filters
    AND (v_start IS NULL OR fd.resolved_date >= v_start)
    AND (v_end IS NULL OR fd.resolved_date <= v_end)
    -- 3. Channel filter
    AND (p_communication_channel IS NULL OR p_communication_channel = 'all_channels' OR fd.resolved_channel = p_communication_channel)
    -- 4. CC Rep filter
    AND (p_assigned_user_id IS NULL OR fd.assigned_call_center_user_id = p_assigned_user_id)
    -- 5. Sales specialist filter
    AND (
      p_sales_representative IS NULL OR 
      fd.sales_representative_text = p_sales_representative OR 
      fd.assigned_sales_user_id = (SELECT id FROM public.profiles WHERE full_name = p_sales_representative LIMIT 1)
    )
    -- 6. Product filter
    AND (p_product IS NULL OR fd.requested_product = p_product)
    -- 7. City filter
    AND (p_city IS NULL OR fd.province = p_city);
END;
$$ LANGUAGE plpgsql;

-- 9. Drop old database trigger on public.leads
DROP TRIGGER IF EXISTS trg_leads_classifier ON public.leads;

-- 10. Create the new trigger function mapping to the new columns
CREATE OR REPLACE FUNCTION public.trg_leads_lead_quality_classifier_hybrid()
RETURNS TRIGGER AS $$
DECLARE
  v_status_name text := '';
  v_cat text;
  v_reason text;
  v_field text;
  v_phrase text;
  v_ver text;
BEGIN
  -- 1. Sync manual override flags
  IF NEW.quality_manually_overridden = true OR NEW.lead_quality_manually_overridden = true THEN
    NEW.quality_manually_overridden := true;
    NEW.lead_quality_manually_overridden := true;
    NEW.quality_classification_method := 'manual';
    
    IF NEW.final_quality_category IS NULL AND NEW.lead_quality_category IS NOT NULL THEN
      NEW.final_quality_category := NEW.lead_quality_category;
    ELSIF NEW.lead_quality_category IS NULL AND NEW.final_quality_category IS NOT NULL THEN
      NEW.lead_quality_category := NEW.final_quality_category;
    END IF;
    
    RETURN NEW;
  END IF;

  -- 2. On update, only run classifier if classification inputs actually changed
  IF TG_OP = 'UPDATE' THEN
    IF OLD.first_message_note IS NOT DISTINCT FROM NEW.first_message_note AND
       OLD.conversation_summary IS NOT DISTINCT FROM NEW.conversation_summary AND
       OLD.extra_notes IS NOT DISTINCT FROM NEW.extra_notes AND
       OLD.next_action IS NOT DISTINCT FROM NEW.next_action AND
       OLD.message IS NOT DISTINCT FROM NEW.message AND
       OLD.requested_product IS NOT DISTINCT FROM NEW.requested_product AND
       OLD.status_id IS NOT DISTINCT FROM NEW.status_id AND
       OLD.sale_status IS NOT DISTINCT FROM NEW.sale_status AND
       OLD.assigned_sales_user_id IS NOT DISTINCT FROM NEW.assigned_sales_user_id AND
       OLD.sales_representative_text IS NOT DISTINCT FROM NEW.sales_representative_text AND
       OLD.assigned_call_center_user_id IS NOT DISTINCT FROM NEW.assigned_call_center_user_id AND
       OLD.conversation_completed IS NOT DISTINCT FROM NEW.conversation_completed AND
       OLD.conversation_date IS NOT DISTINCT FROM NEW.conversation_date AND
       OLD.conversation_time IS NOT DISTINCT FROM NEW.conversation_time AND
       OLD.legacy_raw_data IS NOT DISTINCT FROM NEW.legacy_raw_data AND
       OLD.last_contact_at IS NOT DISTINCT FROM NEW.last_contact_at
    THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Retrieve status name
  IF NEW.status_id IS NOT NULL THEN
    SELECT name INTO v_status_name FROM public.lead_statuses WHERE id = NEW.status_id;
  END IF;

  -- Call strict classifier
  SELECT category, reason, matched_field, matched_phrase, version 
  INTO v_cat, v_reason, v_field, v_phrase, v_ver 
  FROM public.classify_lead_quality_strict(
    NEW.first_message_note,
    NEW.conversation_summary,
    NEW.extra_notes,
    NEW.next_action,
    NEW.message,
    NEW.requested_product,
    v_status_name,
    NEW.sale_status,
    NEW.assigned_sales_user_id,
    NEW.sales_representative_text,
    NEW.assigned_call_center_user_id,
    NEW.conversation_completed,
    NEW.conversation_date,
    NEW.conversation_time,
    NEW.legacy_raw_data,
    NEW.last_contact_at
  );

  IF v_cat IN ('unrelated', 'accidental_click', 'unreachable', 'not_interested', 'potential') THEN
    NEW.automatic_quality_category := v_cat;
    NEW.final_quality_category := v_cat;
    NEW.quality_confidence := 1.0;
    NEW.quality_reason := v_reason;
    NEW.quality_classification_method := 'rule';
    NEW.quality_classification_version := 'hybrid-v2';
    NEW.quality_classified_at := now();
  ELSE
    -- Defaults to pending review (ai method) so batch endpoint can analyze it
    NEW.automatic_quality_category := 'pending_review';
    NEW.final_quality_category := 'pending_review';
    NEW.quality_confidence := 0.5;
    NEW.quality_reason := 'Otomatik sınıflandırma bekliyor (Yapay Zeka analizi gerekli).';
    NEW.quality_classification_method := 'ai';
    NEW.quality_classification_version := 'hybrid-v2';
    NEW.quality_classified_at := now();
  END IF;

  -- Sync with old columns
  NEW.lead_quality_category := NEW.final_quality_category;
  NEW.lead_quality_reason := NEW.quality_reason;
  NEW.lead_quality_confidence := NEW.quality_confidence;
  NEW.lead_quality_classified_at := NEW.quality_classified_at;
  NEW.lead_quality_classification_version := NEW.quality_classification_version;
  NEW.lead_quality_manually_overridden := NEW.quality_manually_overridden;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Bind the new hybrid trigger
DROP TRIGGER IF EXISTS trg_leads_classifier_hybrid ON public.leads;
CREATE TRIGGER trg_leads_classifier_hybrid
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.trg_leads_lead_quality_classifier_hybrid();

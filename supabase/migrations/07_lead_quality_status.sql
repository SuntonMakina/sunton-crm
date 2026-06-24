-- Migration 07: Add strict lead quality classification, database views, triggers, and RPC query function

-- 1. Create audit logs table
CREATE TABLE IF NOT EXISTS public.lead_quality_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
    old_category text,
    new_category text,
    changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    changed_at timestamptz DEFAULT now(),
    reason text
);

-- Enable RLS for the audit logs table
ALTER TABLE public.lead_quality_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Quality Audit Logs" ON public.lead_quality_audit_logs;
CREATE POLICY "Public Read Quality Audit Logs" ON public.lead_quality_audit_logs 
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins Manage Quality Audit Logs" ON public.lead_quality_audit_logs;
CREATE POLICY "Admins Manage Quality Audit Logs" ON public.lead_quality_audit_logs 
    FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'admin'));

-- 2. Add columns to public.leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS lead_quality_category text 
CONSTRAINT chk_lead_quality_category CHECK (lead_quality_category IN ('unrelated', 'accidental_click', 'unreachable', 'not_interested', 'potential', 'pending_review')),
ADD COLUMN IF NOT EXISTS lead_quality_reason text,
ADD COLUMN IF NOT EXISTS lead_quality_confidence numeric(5,2) DEFAULT 1.00,
ADD COLUMN IF NOT EXISTS lead_quality_classified_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS lead_quality_classification_version text DEFAULT 'strict-v2',
ADD COLUMN IF NOT EXISTS lead_quality_manually_overridden boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS lead_quality_overridden_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS lead_quality_overridden_at timestamptz;

-- 3. Turkish text normalization function v2
CREATE OR REPLACE FUNCTION public.normalize_turkish_text_v2(val text)
RETURNS text AS $$
DECLARE
  res text;
BEGIN
  IF val IS NULL THEN
    RETURN '';
  END IF;
  res := LOWER(val);
  -- Turkish character transliteration
  res := translate(res, 'çğışöüıÇĞİŞÖÜ', 'cgisouicgisou');
  -- Remove basic punctuation to avoid breaking keywords, split apostrophes
  res := regexp_replace(res, '[.,;:!?()''"\-+=]', ' ', 'g');
  -- Replace multiple spaces with a single space
  res := regexp_replace(res, '\s+', ' ', 'g');
  RETURN trim(res);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Turkish placeholder check helper
CREATE OR REPLACE FUNCTION public.is_placeholder_value(val text)
RETURNS boolean AS $$
DECLARE
  norm text;
BEGIN
  IF val IS NULL THEN
    RETURN true;
  END IF;
  norm := trim(lower(val));
  -- Normalize turkish chars to compare
  norm := translate(norm, 'çğışöüıÇĞİŞÖÜ', 'cgisouicgisou');
  RETURN norm IN ('', '-', '—', 'belirtilmis', 'belirtilmese', 'belirtilmemis', 'bilinmiyor', 'yok', 'girilmedi', 'secilmedi', 'null', 'undefined', 'n/a', 'na');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Classification logic function strict-v2
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

  -- Regex variables
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

  -- 3. Define strict matching regexes with word boundaries
  v_accidental_regex := '\y(yanlislikla tikladim|yanlislikla tikladi|elim carpti|kazara tikladim|kazara tiklamis|yanlis basvuru yaptim|istemeden form doldurdum|yanlislikla mesaj attim|yanlislikla gonderildi|yanlislikla gonderilmistir)\y';
  
  v_unrelated_regex := '\y(is basvurusu|is ilani|is ariyorum|is arayan|reklam ve tanitim|spam mesaj|yanlis firma|yanlis sirket|ahsap kesim|ahsap kesme|cam kesim|cam kesme|tas kesim|tas kesme|mermer kesim|mermer kesme|sunger kesim|sunger kesme|komur kesim|komur kesme|kumas kesim|kumas kesme|pleksi kesim|pleksi kesme|forklift|lazer kesim disi|alakasiz talep|konu disi|spam|reklam)\y';

  v_disinterested_regex := '\y(ilgilenmiyor|vazgecti|talebi iptal|baska yerden aldi|baska firmadan aldi|rakip firmadan aldi|rakipten aldi|makineyi satin aldi|makine almis|makine satin almis|makine aldi|yatirim dusunmuyor|artik ihtiyaci yok|teklif istemiyor|talebini geri cekti)\y';

  v_unreachable_regex := '\y(ulasilamadi|telefonu acmadi|cevap vermedi|telefon kapali|servis disi|mesgul|mesajlara cevap vermedi|arandi ulasilamadi|tekrar aranacak|geri donus yapmadi|cevap vermiyor|ulasilamiyor|ulasamadim|acmadi|kapali|donus yapmadi)\y';

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

-- 5. Create before insert/update trigger function for classification
CREATE OR REPLACE FUNCTION public.trg_leads_lead_quality_classifier()
RETURNS TRIGGER AS $$
DECLARE
  v_status_name text := '';
  v_cat text;
  v_reason text;
  v_field text;
  v_phrase text;
  v_ver text;
BEGIN
  -- Only execute if manually overridden is false
  IF NEW.lead_quality_manually_overridden = false THEN
    -- Retrieve status name
    IF NEW.status_id IS NOT NULL THEN
      SELECT name INTO v_status_name FROM public.lead_statuses WHERE id = NEW.status_id;
    END IF;

    -- Call classifier
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

    NEW.lead_quality_category := v_cat;
    NEW.lead_quality_reason := v_reason;
    NEW.lead_quality_classified_at := now();
    NEW.lead_quality_classification_version := v_ver;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind classification trigger
DROP TRIGGER IF EXISTS trg_leads_classifier ON public.leads;
CREATE TRIGGER trg_leads_classifier
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.trg_leads_lead_quality_classifier();

-- 6. Create after update trigger function for audit logging
CREATE OR REPLACE FUNCTION public.trg_leads_quality_audit_logger()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    IF OLD.lead_quality_category IS DISTINCT FROM NEW.lead_quality_category AND NEW.lead_quality_manually_overridden = true THEN
      INSERT INTO public.lead_quality_audit_logs (
        lead_id,
        old_category,
        new_category,
        changed_by,
        reason
      ) VALUES (
        NEW.id,
        OLD.lead_quality_category,
        NEW.lead_quality_category,
        NEW.lead_quality_overridden_by,
        NEW.lead_quality_reason
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind audit logging trigger
DROP TRIGGER IF EXISTS trg_leads_quality_audit_logger ON public.leads;
CREATE TRIGGER trg_leads_quality_audit_logger
  AFTER UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.trg_leads_quality_audit_logger();

-- 7. Create lead level classification view
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
  l.lead_quality_manually_overridden,
  l.lead_quality_overridden_by,
  l.lead_quality_overridden_at,
  
  -- Category resolution: respect manual category choice, else use database trigger category
  COALESCE(
    CASE WHEN l.lead_quality_manually_overridden = true THEN l.lead_quality_category ELSE NULL END,
    l.lead_quality_category,
    'pending_review'
  ) AS final_quality_category,
  
  l.lead_quality_category AS automatic_quality_category,
  
  COALESCE(
    CASE WHEN l.lead_quality_manually_overridden = true THEN l.lead_quality_reason ELSE NULL END,
    l.lead_quality_reason
  ) AS classification_reason,
  
  -- Query matched details for debugging
  auto.matched_field,
  auto.matched_phrase,
  
  -- Forwarded to sales calculation
  (
    l.assigned_sales_user_id IS NOT NULL OR 
    (l.sales_representative_text IS NOT NULL AND l.sales_representative_text NOT in ('', '-', 'atanmadı', 'yok', 'bilinmiyor', 'atanmadi')) OR
    l.forwarded_to_sales_at IS NOT NULL OR
    lst.name = 'Satış Uzmanına İletildi'
  ) AS is_forwarded_to_sales,
  
  -- Intersections for percentages
  (
    COALESCE(
      CASE WHEN l.lead_quality_manually_overridden = true THEN l.lead_quality_category ELSE NULL END,
      l.lead_quality_category,
      'pending_review'
    ) = 'potential' AND 
    (
      l.assigned_sales_user_id IS NOT NULL OR 
      (l.sales_representative_text IS NOT NULL AND l.sales_representative_text NOT in ('', '-', 'atanmadı', 'yok', 'bilinmiyor', 'atanmadi')) OR
      l.forwarded_to_sales_at IS NOT NULL OR
      lst.name = 'Satış Uzmanına İletildi'
    )
  ) AS is_potential_and_forwarded,
  
  (
    COALESCE(
      CASE WHEN l.lead_quality_manually_overridden = true THEN l.lead_quality_category ELSE NULL END,
      l.lead_quality_category,
      'pending_review'
    ) = 'potential' AND 
    NOT (
      l.assigned_sales_user_id IS NOT NULL OR 
      (l.sales_representative_text IS NOT NULL AND l.sales_representative_text NOT in ('', '-', 'atanmadı', 'yok', 'bilinmiyor', 'atanmadi')) OR
      l.forwarded_to_sales_at IS NOT NULL OR
      lst.name = 'Satış Uzmanına İletildi'
    )
  ) AS is_potential_and_not_forwarded,

  -- resolved fields inside view
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
LEFT JOIN LATERAL public.classify_lead_quality_strict(
  l.first_message_note,
  l.conversation_summary,
  l.extra_notes,
  l.next_action,
  l.message,
  l.requested_product,
  lst.name,
  l.sale_status,
  l.assigned_sales_user_id,
  l.sales_representative_text,
  l.assigned_call_center_user_id,
  l.conversation_completed,
  l.conversation_date,
  l.conversation_time,
  l.legacy_raw_data,
  l.last_contact_at
) auto ON true
WHERE l.is_active = true;

-- 8. Create aggregation RPC function
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

-- 9. Backfill all active automatic leads to force strict-v2 classification
UPDATE public.leads 
SET lead_quality_category = NULL, 
    lead_quality_reason = NULL,
    lead_quality_classified_at = NULL,
    lead_quality_classification_version = 'strict-v2'
WHERE is_active = true AND lead_quality_manually_overridden = false;

-- Migration 30: Fix check constraints and triggers on public.leads for 'hsg_customer' category

-- 1. Alter check constraints on public.leads for quality categories to include 'hsg_customer'
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS chk_automatic_quality_category;
ALTER TABLE public.leads ADD CONSTRAINT chk_automatic_quality_category 
CHECK (automatic_quality_category IN ('unrelated', 'accidental_click', 'unreachable', 'not_interested', 'potential', 'pending_review', 'callback', 'hsg_customer'));

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS chk_final_quality_category;
ALTER TABLE public.leads ADD CONSTRAINT chk_final_quality_category 
CHECK (final_quality_category IN ('unrelated', 'accidental_click', 'unreachable', 'not_interested', 'potential', 'pending_review', 'callback', 'hsg_customer'));

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS chk_lead_quality_category;
ALTER TABLE public.leads ADD CONSTRAINT chk_lead_quality_category 
CHECK (lead_quality_category IN ('unrelated', 'accidental_click', 'unreachable', 'not_interested', 'potential', 'pending_review', 'callback', 'hsg_customer'));

-- 2. Update trigger function to handle 'hsg_customer'
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
    
    -- If manually overridden to 'callback', make sure status matches
    IF NEW.final_quality_category = 'callback' AND COALESCE(NEW.callback_status, 'none') = 'none' THEN
      NEW.callback_status := 'pending';
      NEW.callback_date := COALESCE(NEW.callback_date, CURRENT_DATE);
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
       OLD.last_contact_at IS NOT DISTINCT FROM NEW.last_contact_at AND
       OLD.callback_status IS NOT DISTINCT FROM NEW.callback_status AND
       OLD.callback_date IS NOT DISTINCT FROM NEW.callback_date AND
       OLD.callback_time IS NOT DISTINCT FROM NEW.callback_time
    THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Retrieve status name
  IF NEW.status_id IS NOT NULL THEN
    SELECT name INTO v_status_name FROM public.lead_statuses WHERE id = NEW.status_id;
  END IF;

  -- If status is HSG Müşterisi
  IF v_status_name = 'HSG Müşterisi' OR NEW.status_id = '22222222-0000-0000-0000-000000000030' THEN
    NEW.automatic_quality_category := 'hsg_customer';
    NEW.final_quality_category := 'hsg_customer';
    NEW.quality_confidence := 1.0;
    NEW.quality_reason := 'HSG Müşterisi statüsü seçildi.';
    NEW.quality_classification_method := 'rule';
    NEW.quality_classification_version := 'hybrid-v3';
    NEW.quality_classified_at := now();
    NEW.lead_quality_category := 'hsg_customer';
    NEW.lead_quality_reason := NEW.quality_reason;
    NEW.lead_quality_confidence := 1.0;
    NEW.lead_quality_classified_at := now();
    NEW.lead_quality_classification_version := 'hybrid-v3';
    RETURN NEW;
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

  IF v_cat IN ('unrelated', 'accidental_click', 'unreachable', 'not_interested', 'potential', 'callback', 'hsg_customer') THEN
    NEW.automatic_quality_category := v_cat;
    NEW.final_quality_category := v_cat;
    NEW.quality_confidence := 1.0;
    NEW.quality_reason := v_reason;
    NEW.quality_classification_method := 'rule';
    NEW.quality_classification_version := 'hybrid-v3';
    NEW.quality_classified_at := now();
  ELSE
    -- Defaults to pending review (ai method) so batch endpoint can analyze it
    NEW.automatic_quality_category := 'pending_review';
    NEW.final_quality_category := 'pending_review';
    NEW.quality_confidence := 0.5;
    NEW.quality_reason := 'Otomatik sınıflandırma bekliyor (Yapay Zeka analizi gerekli).';
    NEW.quality_classification_method := 'ai';
    NEW.quality_classification_version := 'hybrid-v3';
    NEW.quality_classified_at := now();
  END IF;

  -- Sync with old columns
  NEW.lead_quality_category := NEW.final_quality_category;
  NEW.lead_quality_reason := NEW.quality_reason;
  NEW.lead_quality_confidence := NEW.quality_confidence;
  NEW.lead_quality_classified_at := NEW.quality_classified_at;
  NEW.lead_quality_classification_version := NEW.quality_classification_version;
  NEW.lead_quality_manually_overridden := NEW.quality_manually_overridden;

  -- Callback status logic
  IF NEW.final_quality_category = 'callback' THEN
    IF COALESCE(NEW.callback_status, 'none') = 'none' THEN
      NEW.callback_status := 'pending';
    END IF;
    IF NEW.callback_date IS NULL THEN
      NEW.callback_date := CURRENT_DATE;
    END IF;
  END IF;

  -- Completion rule
  IF NEW.callback_status = 'pending' AND (
    v_status_name IN ('Görüşme Yapıldı', 'Satış Uzmanına İletildi', 'İlgilenmiyor', 'HSG Müşterisi') OR
    NEW.final_quality_category IN ('potential', 'not_interested', 'unrelated', 'accidental_click', 'hsg_customer')
  ) THEN
    NEW.callback_status := 'completed';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Update the lead with phone 5458742804 if it exists
UPDATE public.leads
SET 
    status_id = '22222222-0000-0000-0000-000000000030',
    lead_quality_category = 'hsg_customer',
    final_quality_category = 'hsg_customer',
    automatic_quality_category = 'hsg_customer',
    callback_status = 'none',
    next_contact_at = NULL
WHERE phone LIKE '%545%874%28%04%' OR phone_normalized LIKE '%5458742804%';

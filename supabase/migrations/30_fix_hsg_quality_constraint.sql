-- Migration 30: Complete Fix for HSG Müşterisi Status, Quality Constraints, Document Sequences & Triggers

-- 1. Ensure 'HSG Müşterisi' exists in lead_statuses table
INSERT INTO public.lead_statuses (id, name, color, sort_order, is_final, is_won, is_lost, is_active)
VALUES (
    '22222222-0000-0000-0000-000000000030',
    'HSG Müşterisi',
    '#8B5CF6',
    16,
    true,
    false,
    false,
    true
)
ON CONFLICT (id) DO UPDATE SET 
    name = 'HSG Müşterisi',
    color = '#8B5CF6',
    is_final = true,
    is_active = true;

-- 2. Alter check constraints on public.leads for quality categories to include 'hsg_customer'
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS chk_automatic_quality_category;
ALTER TABLE public.leads ADD CONSTRAINT chk_automatic_quality_category 
CHECK (automatic_quality_category IN ('unrelated', 'accidental_click', 'unreachable', 'not_interested', 'potential', 'pending_review', 'callback', 'hsg_customer'));

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS chk_final_quality_category;
ALTER TABLE public.leads ADD CONSTRAINT chk_final_quality_category 
CHECK (final_quality_category IN ('unrelated', 'accidental_click', 'unreachable', 'not_interested', 'potential', 'pending_review', 'callback', 'hsg_customer'));

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS chk_lead_quality_category;
ALTER TABLE public.leads ADD CONSTRAINT chk_lead_quality_category 
CHECK (lead_quality_category IN ('unrelated', 'accidental_click', 'unreachable', 'not_interested', 'potential', 'pending_review', 'callback', 'hsg_customer'));

-- 3. Synchronize all sequences to prevent unique constraint collisions (e.g. leads_lead_number_key)
DO $$
DECLARE
    max_num bigint := 0;
BEGIN
    -- Sync lead_number_seq
    SELECT COALESCE(MAX(CASE WHEN lead_number ~ '^LD-[0-9]{4}-[0-9]+$' THEN substring(lead_number from 'LD-[0-9]{4}-([0-9]+)')::bigint ELSE 0 END), 0) INTO max_num FROM public.leads;
    IF max_num > 0 THEN
        PERFORM setval('public.lead_number_seq', max_num + 1, false);
    END IF;

    -- Sync customer_number_seq
    SELECT COALESCE(MAX(CASE WHEN customer_number ~ '^MS-[0-9]{4}-[0-9]+$' THEN substring(customer_number from 'MS-[0-9]{4}-([0-9]+)')::bigint ELSE 0 END), 0) INTO max_num FROM public.customers;
    IF max_num > 0 THEN
        PERFORM setval('public.customer_number_seq', max_num + 1, false);
    END IF;

    -- Sync opportunity_number_seq
    SELECT COALESCE(MAX(CASE WHEN opportunity_number ~ '^FR-[0-9]{4}-[0-9]+$' THEN substring(opportunity_number from 'FR-[0-9]{4}-([0-9]+)')::bigint ELSE 0 END), 0) INTO max_num FROM public.opportunities;
    IF max_num > 0 THEN
        PERFORM setval('public.opportunity_number_seq', max_num + 1, false);
    END IF;

    -- Sync task_number_seq
    SELECT COALESCE(MAX(CASE WHEN task_number ~ '^TS-[0-9]{4}-[0-9]+$' THEN substring(task_number from 'TS-[0-9]{4}-([0-9]+)')::bigint ELSE 0 END), 0) INTO max_num FROM public.tasks;
    IF max_num > 0 THEN
        PERFORM setval('public.task_number_seq', max_num + 1, false);
    END IF;
END $$;

-- 4. Update generate_document_number() to guarantee uniqueness even in edge cases
CREATE OR REPLACE FUNCTION generate_document_number()
RETURNS TRIGGER AS $$
DECLARE
    curr_year text := to_char(now(), 'YYYY');
    seq_val bigint;
    candidate text;
BEGIN
    IF TG_TABLE_NAME = 'leads' THEN
        -- If status is raw WhatsApp chat, do not generate lead_number. Keep it NULL.
        IF NEW.status_id = '22222222-0000-0000-0000-000000000020' THEN
            NEW.lead_number := NULL;
        ELSE
            -- Generate lead number only if it doesn't already have one
            IF NEW.lead_number IS NULL THEN
                LOOP
                    seq_val := nextval('public.lead_number_seq');
                    candidate := 'LD-' || curr_year || '-' || lpad(seq_val::text, 6, '0');
                    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.leads WHERE lead_number = candidate);
                END LOOP;
                NEW.lead_number := candidate;
            END IF;
        END IF;
    ELSIF TG_TABLE_NAME = 'customers' THEN
        IF NEW.customer_number IS NULL THEN
            LOOP
                seq_val := nextval('public.customer_number_seq');
                candidate := 'MS-' || curr_year || '-' || lpad(seq_val::text, 6, '0');
                EXIT WHEN NOT EXISTS (SELECT 1 FROM public.customers WHERE customer_number = candidate);
            END LOOP;
            NEW.customer_number := candidate;
        END IF;
    ELSIF TG_TABLE_NAME = 'opportunities' THEN
        IF NEW.opportunity_number IS NULL THEN
            LOOP
                seq_val := nextval('public.opportunity_number_seq');
                candidate := 'FR-' || curr_year || '-' || lpad(seq_val::text, 6, '0');
                EXIT WHEN NOT EXISTS (SELECT 1 FROM public.opportunities WHERE opportunity_number = candidate);
            END LOOP;
            NEW.opportunity_number := candidate;
        END IF;
    ELSIF TG_TABLE_NAME = 'tasks' THEN
        IF NEW.task_number IS NULL THEN
            LOOP
                seq_val := nextval('public.task_number_seq');
                candidate := 'TS-' || curr_year || '-' || lpad(seq_val::text, 6, '0');
                EXIT WHEN NOT EXISTS (SELECT 1 FROM public.tasks WHERE task_number = candidate);
            END LOOP;
            NEW.task_number := candidate;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Update trigger function to handle 'hsg_customer'
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

-- 6. Update the lead with phone 5458742804 if it exists
UPDATE public.leads
SET 
    status_id = '22222222-0000-0000-0000-000000000030',
    lead_quality_category = 'hsg_customer',
    final_quality_category = 'hsg_customer',
    automatic_quality_category = 'hsg_customer',
    callback_status = 'none',
    next_contact_at = NULL
WHERE phone LIKE '%545%874%28%04%' OR phone_normalized LIKE '%5458742804%';

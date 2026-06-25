-- Migration 24: Fix handle_webhook_incoming_message Typo (conversaations -> conversations)

DROP FUNCTION IF EXISTS public.handle_webhook_incoming_message(text, text, text, text);
DROP FUNCTION IF EXISTS public.handle_webhook_incoming_message(text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.handle_webhook_incoming_message(text, text, text, text, boolean, text);

CREATE OR REPLACE FUNCTION public.handle_webhook_incoming_message(
    p_from_phone text,
    p_content text,
    p_profile_name text DEFAULT 'WhatsApp Müşterisi',
    p_timestamp text DEFAULT NULL,
    p_from_me boolean DEFAULT false,
    p_external_message_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clean_phone text;
    v_lead_id uuid;
    v_lead_whatsapp_step text;
    v_first_name text;
    v_last_name text;
    v_parts text[];
    v_conv_id uuid;
    v_conv_unread_count integer;
    v_created_at timestamptz;
    v_source_id uuid := '11111111-0000-0000-0000-000000000005'; -- WHATSAPP
    v_status_id uuid := '22222222-0000-0000-0000-000000000020'; -- WhatsApp Sohbeti
    v_ebru_id uuid := 'b2b2b2b2-bbbb-cccc-dddd-eeeeeeeeeeee';
BEGIN
    -- 0. Deduplicate if external message ID is already registered
    IF p_external_message_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.messages WHERE external_message_id = p_external_message_id
    ) THEN
        RETURN jsonb_build_object('success', true, 'duplicate', true);
    END IF;

    -- 1. Clean phone number
    v_clean_phone := regexp_replace(p_from_phone, '[^0-9]', '', 'g');

    -- 2. Find lead
    SELECT id, whatsapp_step INTO v_lead_id, v_lead_whatsapp_step
    FROM public.leads
    WHERE phone_normalized = v_clean_phone
    LIMIT 1;

    -- Name parsing
    IF p_profile_name IS NULL OR trim(p_profile_name) = '' OR p_profile_name = 'WhatsApp Müşterisi' OR p_profile_name = 'WhatsApp' THEN
        v_first_name := '+' || v_clean_phone;
        v_last_name := 'Yeni Müşteri';
    ELSE
        v_parts := string_to_array(p_profile_name, ' ');
        v_first_name := v_parts[1];
        v_last_name := array_to_string(v_parts[2:cardinality(v_parts)], ' ');
        
        IF v_first_name IS NULL OR v_first_name = '' THEN
            v_first_name := 'WhatsApp';
        END IF;
        IF v_last_name IS NULL OR v_last_name = '' THEN
            v_last_name := 'Müşterisi';
        END IF;
    END IF;

    -- 3. Create lead if doesn't exist
    IF v_lead_id IS NULL THEN
        INSERT INTO public.leads (
            first_name,
            last_name,
            phone,
            phone_normalized,
            source_id,
            status_id,
            assigned_call_center_user_id,
            whatsapp_step
        ) VALUES (
            v_first_name,
            v_last_name,
            '+' || v_clean_phone,
            v_clean_phone,
            v_source_id,
            v_status_id,
            v_ebru_id,
            'viewed'
        )
        RETURNING id INTO v_lead_id;
    END IF;

    -- 4. Find or create conversation
    SELECT id, unread_count INTO v_conv_id, v_conv_unread_count
    FROM public.conversations
    WHERE lead_id = v_lead_id AND channel = 'whatsapp'
    LIMIT 1;

    -- 5. Time
    IF p_timestamp IS NOT NULL AND p_timestamp ~ '^\d+$' THEN
        DECLARE
            v_ts_num bigint := p_timestamp::bigint;
        BEGIN
            IF v_ts_num > 9999999999 THEN
                v_created_at := to_timestamp(v_ts_num::double precision / 1000.0);
            ELSE
                v_created_at := to_timestamp(v_ts_num::double precision);
            END IF;
        END;
    ELSE
        v_created_at := now();
    END IF;

    IF v_conv_id IS NULL THEN
        INSERT INTO public.conversations (
            lead_id,
            channel,
            status,
            unread_count,
            assigned_user_id,
            last_message_at
        ) VALUES (
            v_lead_id,
            'whatsapp',
            'open',
            CASE WHEN p_from_me THEN 0 ELSE 1 END,
            v_ebru_id,
            v_created_at
        )
        RETURNING id INTO v_conv_id;
    ELSE
        UPDATE public.conversations
        SET unread_count = CASE WHEN p_from_me THEN 0 ELSE coalesce(v_conv_unread_count, 0) + 1 END,
            last_message_at = v_created_at,
            status = 'open'
        WHERE id = v_conv_id;
    END IF;

    -- 6. Insert message
    INSERT INTO public.messages (
        conversation_id,
        sender_type,
        sender_user_id,
        direction,
        channel,
        content,
        external_message_id,
        delivery_status,
        sent_at,
        created_at
    ) VALUES (
        v_conv_id,
        CASE WHEN p_from_me THEN 'user'::text ELSE 'client'::text END,
        CASE WHEN p_from_me THEN v_ebru_id ELSE NULL END,
        CASE WHEN p_from_me THEN 'outgoing'::text ELSE 'incoming'::text END,
        'whatsapp',
        p_content,
        p_external_message_id,
        'read',
        v_created_at,
        v_created_at
    );

    -- Update lead's last contact timestamp and last message content preview
    UPDATE public.leads
    SET last_contact_at = coalesce(greatest(last_contact_at, v_created_at), v_created_at),
        last_message_content = p_content
    WHERE id = v_lead_id;

    RETURN jsonb_build_object(
        'success', true,
        'lead_id', v_lead_id,
        'conversation_id', v_conv_id
    );
END;
$$;

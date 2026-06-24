-- Migration 13: WhatsApp Incoming Webhook RPC Update
-- Updates handle_webhook_incoming_message to use 'WhatsApp Sohbeti' status and 'client' sender type.

CREATE OR REPLACE FUNCTION public.handle_webhook_incoming_message(
    p_from_phone text,
    p_content text,
    p_profile_name text DEFAULT 'WhatsApp Müşterisi',
    p_timestamp text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- RLS kurallarını aşarak veritabanı sahibi yetkisiyle yazar.
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
    -- 1. Telefon numarasını sadece sayılardan oluşacak şekilde temizle
    v_clean_phone := regexp_replace(p_from_phone, '[^0-9]', '', 'g');

    -- 2. Adayı (Lead) telefon numarasına göre bul
    SELECT id, whatsapp_step INTO v_lead_id, v_lead_whatsapp_step
    FROM public.leads
    WHERE phone_normalized = v_clean_phone
    LIMIT 1;

    -- Let's check if the name is generic/empty
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

    -- 3. Aday bulunamadıysa yeni aday oluştur
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
    ELSE
        -- Lead already exists, check if name is generic and we have a better name now
        DECLARE
            v_curr_first text;
            v_curr_last text;
        BEGIN
            SELECT first_name, last_name INTO v_curr_first, v_curr_last
            FROM public.leads
            WHERE id = v_lead_id;
            
            IF (v_curr_first IS NULL OR v_curr_first = '' OR v_curr_first = 'WhatsApp' OR v_curr_first = 'Müşterisi' OR v_curr_first LIKE '+%') 
               AND p_profile_name IS NOT NULL AND p_profile_name <> '' AND p_profile_name <> 'WhatsApp Müşterisi' AND p_profile_name <> 'WhatsApp' THEN
                
                UPDATE public.leads
                SET first_name = v_first_name,
                    last_name = v_last_name
                WHERE id = v_lead_id;
            END IF;
        END;
    END IF;

    -- 4. Konuşmayı (Conversation) bul veya oluştur
    SELECT id, unread_count INTO v_conv_id, v_conv_unread_count
    FROM public.conversations
    WHERE lead_id = v_lead_id AND channel = 'whatsapp'
    LIMIT 1;

    IF v_conv_id IS NULL THEN
        INSERT INTO public.conversations (
            lead_id,
            channel,
            status,
            unread_count,
            assigned_user_id
        ) VALUES (
            v_lead_id,
            'whatsapp',
            'open',
            1,
            v_ebru_id
        )
        RETURNING id INTO v_conv_id;
    ELSE
        UPDATE public.conversations
        SET unread_count = coalesce(v_conv_unread_count, 0) + 1,
            last_message_at = now(),
            status = 'open'
        WHERE id = v_conv_id;
    END IF;

    -- 5. Mesaj zaman damgasını belirle
    IF p_timestamp IS NOT NULL AND p_timestamp ~ '^\d+$' THEN
        v_created_at := to_timestamp(p_timestamp::double precision);
    ELSE
        v_created_at := now();
    END IF;

    -- 6. Mesajı (Message) veritabanına kaydet (client olarak kaydeder)
    INSERT INTO public.messages (
        conversation_id,
        sender_type,
        direction,
        channel,
        content,
        delivery_status,
        created_at
    ) VALUES (
        v_conv_id,
        'client',
        'incoming',
        'whatsapp',
        p_content,
        'read',
        v_created_at
    );

    -- Update lead's last contact timestamp and last message content preview
    UPDATE public.leads
    SET last_contact_at = coalesce(greatest(last_contact_at, v_created_at), v_created_at),
        last_message_content = p_content
    WHERE id = v_lead_id;

    -- 7. Adayın whatsapp adımını 'viewed' olarak güncelle
    IF v_lead_whatsapp_step = 'new' THEN
        UPDATE public.leads
        SET whatsapp_step = 'viewed'
        WHERE id = v_lead_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'lead_id', v_lead_id,
        'conversation_id', v_conv_id
    );
END;
$$;

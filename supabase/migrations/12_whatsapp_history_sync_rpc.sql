-- Migration 12: WhatsApp History Sync RPC (SECURITY DEFINER)
-- Allows anonymous webhook sync-history endpoint to safely insert/update leads and messages.

CREATE OR REPLACE FUNCTION public.handle_whatsapp_history_sync(
    p_chats jsonb,
    p_messages jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Bypasses RLS using database owner privileges
AS $$
DECLARE
    v_chat jsonb;
    v_msg jsonb;
    v_from_phone text;
    v_name text;
    v_first_name text;
    v_last_name text;
    v_lead_id uuid;
    v_conv_id uuid;
    v_messages_synced integer := 0;
    v_leads_synced integer := 0;
    v_convs_synced integer := 0;
    v_ebru_id uuid := 'b2b2b2b2-bbbb-cccc-dddd-eeeeeeeeeeee';
    v_source_id uuid := '11111111-0000-0000-0000-000000000005'; -- WHATSAPP
    v_status_id uuid := '22222222-0000-0000-0000-000000000020'; -- WhatsApp Sohbeti
    v_created_at timestamptz;
    v_msg_content text;
    v_msg_id text;
    v_msg_from_me boolean;
    v_msg_timestamp bigint;
BEGIN
    -- Loop through chats
    FOR v_chat IN SELECT * FROM jsonb_array_elements(p_chats) LOOP
        v_from_phone := v_chat->>'id';
        v_name := coalesce(v_chat->>'name', 'WhatsApp Müşterisi');

        -- Skip invalid / support JIDs (like '0' or Support channels)
        IF length(v_from_phone) < 8 THEN
            CONTINUE;
        END IF;

        -- 1. Find or create lead
        SELECT id INTO v_lead_id
        FROM public.leads
        WHERE phone_normalized = v_from_phone
        LIMIT 1;

        -- Let's check if the name is generic/empty
        IF v_name IS NULL OR trim(v_name) = '' OR v_name = 'WhatsApp Müşterisi' OR v_name = 'WhatsApp' THEN
            v_first_name := '+' || v_from_phone;
            v_last_name := 'Yeni Müşteri';
        ELSE
            v_first_name := split_part(v_name, ' ', 1);
            v_last_name := substr(v_name, length(v_first_name) + 2);
            IF v_last_name IS NULL OR v_last_name = '' THEN
                v_last_name := 'Müşterisi';
            END IF;
        END IF;

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
                '+' || v_from_phone,
                v_from_phone,
                v_source_id,
                v_status_id,
                v_ebru_id,
                'viewed'
            )
            RETURNING id INTO v_lead_id;

            v_leads_synced := v_leads_synced + 1;
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
                   AND v_name IS NOT NULL AND v_name <> '' AND v_name <> 'WhatsApp Müşterisi' AND v_name <> 'WhatsApp' THEN
                    
                    UPDATE public.leads
                    SET first_name = v_first_name,
                        last_name = v_last_name
                    WHERE id = v_lead_id;
                END IF;
            END;
        END IF;

        -- 2. Find or create conversation
        SELECT id INTO v_conv_id
        FROM public.conversations
        WHERE lead_id = v_lead_id AND channel = 'whatsapp'
        LIMIT 1;

        IF v_conv_id IS NULL THEN
            INSERT INTO public.conversations (
                lead_id,
                channel,
                assigned_user_id,
                status,
                unread_count
            ) VALUES (
                v_lead_id,
                'whatsapp',
                v_ebru_id,
                'open',
                0
            )
            RETURNING id INTO v_conv_id;

            v_convs_synced := v_convs_synced + 1;
        END IF;

        -- 3. Loop through messages for this chat
        FOR v_msg IN SELECT * FROM jsonb_array_elements(p_messages) LOOP
            IF v_msg->>'chatId' = v_from_phone THEN
                v_msg_id := v_msg->>'id';
                v_msg_content := v_msg->>'content';
                v_msg_from_me := (v_msg->>'fromMe')::boolean;
                v_msg_timestamp := (v_msg->>'timestamp')::bigint;

                -- Check if message already exists
                IF NOT EXISTS (SELECT 1 FROM public.messages WHERE external_message_id = v_msg_id) THEN
                    IF v_msg_timestamp IS NOT NULL THEN
                        v_created_at := to_timestamp(v_msg_timestamp);
                    ELSE
                        v_created_at := now();
                    END IF;

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
                        CASE WHEN v_msg_from_me THEN 'user'::text ELSE 'client'::text END,
                        CASE WHEN v_msg_from_me THEN v_ebru_id ELSE NULL END,
                        CASE WHEN v_msg_from_me THEN 'outgoing'::text ELSE 'incoming'::text END,
                        'whatsapp',
                        v_msg_content,
                        v_msg_id,
                        'read',
                        v_created_at,
                        v_created_at
                    );

                    v_messages_synced := v_messages_synced + 1;

                    -- Update lead's last contact timestamp and last message content preview
                    UPDATE public.leads
                    SET last_contact_at = coalesce(greatest(last_contact_at, v_created_at), v_created_at),
                        last_message_content = v_msg_content
                    WHERE id = v_lead_id;
                END IF;
            END IF;
        END LOOP;

    END LOOP;

    RETURN jsonb_build_object(
        'leads_synced', v_leads_synced,
        'conversations_synced', v_convs_synced,
        'messages_synced', v_messages_synced
    );
END;
$$;

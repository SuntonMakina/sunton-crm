-- Migration 15: WhatsApp LID Resolution RPC (SECURITY DEFINER)
-- Allows the gateway webhook to merge/correct a lead registered under a LID JID into its real phone number.

CREATE OR REPLACE FUNCTION public.resolve_whatsapp_lid_lead(
    p_lid text,
    p_real_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Bypasses RLS to safely merge leads
AS $$
DECLARE
    v_lid_lead_id uuid;
    v_real_lead_id uuid;
    v_lid_conv_id uuid;
    v_real_conv_id uuid;
    v_real_first_name text;
    v_real_last_name text;
BEGIN
    -- 1. Find if there is a lead with the LID phone number
    SELECT id INTO v_lid_lead_id
    FROM public.leads
    WHERE phone_normalized = p_lid
    LIMIT 1;

    -- If no lead exists for this LID, nothing to resolve or merge
    IF v_lid_lead_id IS NULL THEN
        RETURN jsonb_build_object('success', true, 'action', 'none');
    END IF;

    -- 2. Find if a lead already exists for the real phone number
    SELECT id, first_name, last_name INTO v_real_lead_id, v_real_first_name, v_real_last_name
    FROM public.leads
    WHERE phone_normalized = p_real_phone
    LIMIT 1;

    IF v_real_lead_id IS NULL THEN
        -- Case A: Real lead does not exist. Update LID lead to the real phone number.
        UPDATE public.leads
        SET phone = '+' || p_real_phone,
            phone_normalized = p_real_phone
        WHERE id = v_lid_lead_id;

        RETURN jsonb_build_object('success', true, 'action', 'updated_phone', 'lead_id', v_lid_lead_id);
    ELSE
        -- Case B: Both leads exist. Merge LID lead's conversations, calls, tasks, activities into real lead.
        -- 1. Find conversations
        SELECT id INTO v_lid_conv_id
        FROM public.conversations
        WHERE lead_id = v_lid_lead_id AND channel = 'whatsapp'
        LIMIT 1;

        SELECT id INTO v_real_conv_id
        FROM public.conversations
        WHERE lead_id = v_real_lead_id AND channel = 'whatsapp'
        LIMIT 1;

        -- 2. Merge WhatsApp conversations
        IF v_lid_conv_id IS NOT NULL THEN
            IF v_real_conv_id IS NULL THEN
                -- Reassign existing conversation to the real lead
                UPDATE public.conversations
                SET lead_id = v_real_lead_id
                WHERE id = v_lid_conv_id;
            ELSE
                -- Merge messages into real conversation, delete LID conversation
                UPDATE public.messages
                SET conversation_id = v_real_conv_id
                WHERE conversation_id = v_lid_conv_id;

                DELETE FROM public.conversations WHERE id = v_lid_conv_id;
            END IF;
        END IF;

        -- 3. Merge calls, tasks, activities, notifications
        UPDATE public.calls SET lead_id = v_real_lead_id WHERE lead_id = v_lid_lead_id;
        UPDATE public.tasks SET lead_id = v_real_lead_id WHERE lead_id = v_lid_lead_id;
        UPDATE public.activities SET entity_id = v_real_lead_id WHERE entity_type = 'lead' AND entity_id = v_lid_lead_id;
        UPDATE public.notifications SET entity_id = v_real_lead_id WHERE entity_type = 'lead' AND entity_id = v_lid_lead_id;

        -- 4. Update real lead contact metadata
        DECLARE
            v_lid_last_contact timestamptz;
            v_lid_last_msg text;
        BEGIN
            SELECT last_contact_at, last_message_content INTO v_lid_last_contact, v_lid_last_msg
            FROM public.leads
            WHERE id = v_lid_lead_id;

            UPDATE public.leads
            SET last_contact_at = coalesce(greatest(last_contact_at, v_lid_last_contact), v_lid_last_contact),
                last_message_content = coalesce(v_lid_last_msg, last_message_content)
            WHERE id = v_real_lead_id;
        END;

        -- 5. Delete the redundant LID lead
        DELETE FROM public.leads WHERE id = v_lid_lead_id;

        RETURN jsonb_build_object('success', true, 'action', 'merged_leads', 'real_lead_id', v_real_lead_id);
    END IF;
END;
$$;

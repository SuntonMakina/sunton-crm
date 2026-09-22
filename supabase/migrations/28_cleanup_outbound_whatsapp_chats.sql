-- Migration 28: Cleanup outbound synced test leads and conversations from WhatsApp center
CREATE OR REPLACE FUNCTION public.cleanup_outbound_whatsapp_chats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_del_messages integer := 0;
    v_del_conversations integer := 0;
    v_del_leads integer := 0;
    v_target_conv_ids uuid[];
    v_target_lead_ids uuid[];
BEGIN
    -- 1. Find all conversations created by the outbound lead sync
    SELECT array_agg(DISTINCT conversation_id) INTO v_target_conv_ids
    FROM public.messages
    WHERE external_message_id LIKE 'ebru_outbound_lead_%' OR external_message_id LIKE 'outbound_init_%';

    -- 2. Find associated lead IDs
    IF v_target_conv_ids IS NOT NULL AND cardinality(v_target_conv_ids) > 0 THEN
        SELECT array_agg(DISTINCT lead_id) INTO v_target_lead_ids
        FROM public.conversations
        WHERE id = ANY(v_target_conv_ids);

        -- Delete messages
        WITH del_m AS (
            DELETE FROM public.messages
            WHERE conversation_id = ANY(v_target_conv_ids)
            RETURNING id
        )
        SELECT count(*) INTO v_del_messages FROM del_m;

        -- Delete conversations
        WITH del_c AS (
            DELETE FROM public.conversations
            WHERE id = ANY(v_target_conv_ids)
            RETURNING id
        )
        SELECT count(*) INTO v_del_conversations FROM del_c;

        -- Delete unconverted leads associated with this batch
        IF v_target_lead_ids IS NOT NULL AND cardinality(v_target_lead_ids) > 0 THEN
            WITH del_l AS (
                DELETE FROM public.leads
                WHERE id = ANY(v_target_lead_ids)
                  AND status_id = '22222222-0000-0000-0000-000000000020'
                RETURNING id
            )
            SELECT count(*) INTO v_del_leads FROM del_l;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'deleted_messages', v_del_messages,
        'deleted_conversations', v_del_conversations,
        'deleted_leads', v_del_leads
    );
END;
$$;

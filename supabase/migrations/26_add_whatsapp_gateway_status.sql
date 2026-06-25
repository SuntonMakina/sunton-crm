-- Migration 26: Add WhatsApp Gateway Status and Remote Reset RPCs

-- 1. Function to update WhatsApp Gateway status (called by gateway)
CREATE OR REPLACE FUNCTION public.update_whatsapp_gateway_status(
    p_status text,
    p_qr text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current jsonb;
    v_reset_requested boolean := false;
    v_new_value jsonb;
BEGIN
    -- Get current settings to check if reset is requested
    SELECT value INTO v_current FROM public.app_settings WHERE key = 'whatsapp_gateway_status';
    
    IF v_current IS NOT NULL AND (v_current->>'reset_requested')::boolean = true THEN
        v_reset_requested := true;
    END IF;

    -- Build new value
    v_new_value := jsonb_build_object(
        'status', p_status,
        'qr', p_qr,
        'reset_requested', v_reset_requested,
        'updated_at', now()
    );

    INSERT INTO public.app_settings (key, value, category, description)
    VALUES ('whatsapp_gateway_status', v_new_value, 'general', 'Dynamic status and QR code of WhatsApp gateway')
    ON CONFLICT (key)
    DO UPDATE SET value = v_new_value, updated_at = now();

    RETURN jsonb_build_object(
        'success', true,
        'reset_requested', v_reset_requested
    );
END;
$$;

-- 2. Function to set reset requested flag (called by frontend)
CREATE OR REPLACE FUNCTION public.request_whatsapp_gateway_reset()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current jsonb;
    v_status text := 'disconnected';
    v_qr text := null;
BEGIN
    SELECT value INTO v_current FROM public.app_settings WHERE key = 'whatsapp_gateway_status';
    
    IF v_current IS NOT NULL THEN
        v_status := coalesce(v_current->>'status', 'disconnected');
        v_qr := v_current->>'qr';
    END IF;

    INSERT INTO public.app_settings (key, value, category, description)
    VALUES ('whatsapp_gateway_status', jsonb_build_object('status', v_status, 'qr', v_qr, 'reset_requested', true, 'updated_at', now()), 'general', 'Dynamic status and QR code of WhatsApp gateway')
    ON CONFLICT (key)
    DO UPDATE SET value = jsonb_build_object('status', v_status, 'qr', v_qr, 'reset_requested', true, 'updated_at', now()), updated_at = now();

    RETURN true;
END;
$$;

-- 3. Function to clear reset requested flag (called by gateway after starting reset)
CREATE OR REPLACE FUNCTION public.clear_whatsapp_gateway_reset()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current jsonb;
    v_status text := 'disconnected';
    v_qr text := null;
BEGIN
    SELECT value INTO v_current FROM public.app_settings WHERE key = 'whatsapp_gateway_status';
    
    IF v_current IS NOT NULL THEN
        v_status := coalesce(v_current->>'status', 'disconnected');
        v_qr := v_current->>'qr';
    END IF;

    INSERT INTO public.app_settings (key, value, category, description)
    VALUES ('whatsapp_gateway_status', jsonb_build_object('status', v_status, 'qr', v_qr, 'reset_requested', false, 'updated_at', now()), 'general', 'Dynamic status and QR code of WhatsApp gateway')
    ON CONFLICT (key)
    DO UPDATE SET value = jsonb_build_object('status', v_status, 'qr', v_qr, 'reset_requested', false, 'updated_at', now()), updated_at = now();

    RETURN true;
END;
$$;

-- 4. Function to get the current status (called by frontend)
CREATE OR REPLACE FUNCTION public.get_whatsapp_gateway_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_value jsonb;
BEGIN
    SELECT value INTO v_value FROM public.app_settings WHERE key = 'whatsapp_gateway_status';
    RETURN coalesce(v_value, jsonb_build_object('status', 'disconnected', 'qr', null, 'reset_requested', false));
END;
$$;

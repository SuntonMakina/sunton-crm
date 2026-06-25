-- Migration 26: Add WhatsApp Gateway Status and Remote Reset RPCs

-- 1. Function to update WhatsApp Gateway status (called by gateway)
CREATE OR REPLACE FUNCTION public.update_whatsapp_gateway_status(
    p_status text,
    p_qr text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
    INSERT INTO public.app_settings (key, value, category, description)
    VALUES (
        'whatsapp_gateway_status',
        jsonb_build_object(
            'status', p_status,
            'qr', p_qr,
            'reset_requested', false,
            'updated_at', now()
        ),
        'general',
        'Dynamic status and QR code of WhatsApp gateway'
    )
    ON CONFLICT (key)
    DO UPDATE SET 
        value = jsonb_build_object(
            'status', EXCLUDED.value->>'status',
            'qr', EXCLUDED.value->>'qr',
            'reset_requested', coalesce((app_settings.value->>'reset_requested')::boolean, false),
            'updated_at', now()
        ),
        updated_at = now()
    RETURNING jsonb_build_object(
        'success', true,
        'reset_requested', coalesce((value->>'reset_requested')::boolean, false)
    )
$$;

-- 2. Function to set reset requested flag (called by frontend)
CREATE OR REPLACE FUNCTION public.request_whatsapp_gateway_reset()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
    INSERT INTO public.app_settings (key, value, category, description)
    VALUES (
        'whatsapp_gateway_status',
        jsonb_build_object(
            'status', 'disconnected',
            'qr', null,
            'reset_requested', true,
            'updated_at', now()
        ),
        'general',
        'Dynamic status and QR code of WhatsApp gateway'
    )
    ON CONFLICT (key)
    DO UPDATE SET 
        value = jsonb_build_object(
            'status', coalesce(app_settings.value->>'status', 'disconnected'),
            'qr', app_settings.value->>'qr',
            'reset_requested', true,
            'updated_at', now()
        ), 
        updated_at = now()
    RETURNING true
$$;

-- 3. Function to clear reset requested flag (called by gateway after starting reset)
CREATE OR REPLACE FUNCTION public.clear_whatsapp_gateway_reset()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
    INSERT INTO public.app_settings (key, value, category, description)
    VALUES (
        'whatsapp_gateway_status',
        jsonb_build_object(
            'status', 'disconnected',
            'qr', null,
            'reset_requested', false,
            'updated_at', now()
        ),
        'general',
        'Dynamic status and QR code of WhatsApp gateway'
    )
    ON CONFLICT (key)
    DO UPDATE SET 
        value = jsonb_build_object(
            'status', coalesce(app_settings.value->>'status', 'disconnected'),
            'qr', app_settings.value->>'qr',
            'reset_requested', false,
            'updated_at', now()
        ), 
        updated_at = now()
    RETURNING true
$$;

-- 4. Function to get the current status (called by frontend)
CREATE OR REPLACE FUNCTION public.get_whatsapp_gateway_status()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT coalesce(
        (SELECT value FROM public.app_settings WHERE key = 'whatsapp_gateway_status'),
        jsonb_build_object('status', 'disconnected', 'qr', null, 'reset_requested', false)
    )
$$;


-- 1. Function to register the current WhatsApp Gateway URL
CREATE OR REPLACE FUNCTION public.register_whatsapp_gateway(p_url text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
    INSERT INTO public.app_settings (key, value, category, description)
    VALUES ('whatsapp_gateway_url', jsonb_build_object('url', p_url), 'general', 'Active WhatsApp Gateway URL (Dynamic registration)')
    ON CONFLICT (key)
    DO UPDATE SET value = jsonb_build_object('url', p_url), updated_at = now()
    RETURNING true
$$;

-- 2. Function to retrieve the active WhatsApp Gateway URL (bypassing RLS safely for anon webhooks)
CREATE OR REPLACE FUNCTION public.get_whatsapp_gateway_url()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT coalesce(
        (SELECT value->>'url' FROM public.app_settings WHERE key = 'whatsapp_gateway_url'),
        'http://localhost:3001'
    )
$$;


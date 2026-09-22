-- Migration 29: Add HSG Müşterisi Status and Exclude from Analytics

-- 1. Insert HSG Müşterisi into lead_statuses
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

-- 2. Update existing lead with phone 5458742804 if present
UPDATE public.leads
SET 
    status_id = '22222222-0000-0000-0000-000000000030',
    lead_quality_category = 'hsg_customer',
    callback_status = 'none',
    next_contact_at = NULL,
    extra_notes = COALESCE(extra_notes, '') || E'\n[Sistem] - HSG Müşterisi olarak güncellendi.'
WHERE phone LIKE '%545%874%28%04%' OR phone_normalized LIKE '%5458742804%';

-- Migration 11: Fix lead_quality_category check constraint to support 'callback' status
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS chk_lead_quality_category;
ALTER TABLE public.leads ADD CONSTRAINT chk_lead_quality_category 
CHECK (lead_quality_category IN ('unrelated', 'accidental_click', 'unreachable', 'not_interested', 'potential', 'pending_review', 'callback'));

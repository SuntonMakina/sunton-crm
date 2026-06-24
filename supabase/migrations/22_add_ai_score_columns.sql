-- Add AI analysis columns to potential_leads table
ALTER TABLE public.potential_leads 
ADD COLUMN IF NOT EXISTS ai_score integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_notes text;

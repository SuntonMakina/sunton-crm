-- Migration 10: WhatsApp Tracking and Logging

-- Add whatsapp_step column to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS whatsapp_step text DEFAULT 'new';

-- Add check constraint for whatsapp_step
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS chk_whatsapp_step;
ALTER TABLE public.leads ADD CONSTRAINT chk_whatsapp_step CHECK (whatsapp_step IN ('new', 'viewed', 'messaged', 'called_1', 'called_2', 'no_answer', 'proposal', 'completed'));

-- Update activities table check constraint to include whatsapp_step_changed
ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_activity_type_check;
ALTER TABLE public.activities ADD CONSTRAINT activities_activity_type_check CHECK (activity_type IN (
  'lead_created', 
  'lead_assigned', 
  'status_changed', 
  'call_made', 
  'note_added', 
  'task_created', 
  'task_completed', 
  'forwarded_to_sales', 
  'opportunity_created', 
  'pipeline_changed', 
  'converted_to_customer', 
  'message_sent',
  'whatsapp_step_changed'
));

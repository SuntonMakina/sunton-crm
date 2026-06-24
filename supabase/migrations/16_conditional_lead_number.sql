-- Migration 16: Conditional Lead Number Generation
-- Updates generate_document_number trigger function to skip lead number generation for raw WhatsApp chats (status '22222222-0000-0000-0000-000000000020').
-- Creates a BEFORE UPDATE trigger to generate lead number when a lead is converted.

CREATE OR REPLACE FUNCTION generate_document_number()
RETURNS TRIGGER AS $$
DECLARE
    curr_year text := to_char(now(), 'YYYY');
    seq_val bigint;
BEGIN
    IF TG_TABLE_NAME = 'leads' THEN
        -- If status is raw WhatsApp chat, do not generate lead_number. Keep it NULL.
        IF NEW.status_id = '22222222-0000-0000-0000-000000000020' THEN
            NEW.lead_number := NULL;
        ELSE
            -- Generate lead number only if it doesn't already have one
            IF NEW.lead_number IS NULL THEN
                seq_val := nextval('public.lead_number_seq');
                NEW.lead_number := 'LD-' || curr_year || '-' || lpad(seq_val::text, 6, '0');
            END IF;
        END IF;
    ELSIF TG_TABLE_NAME = 'customers' THEN
        IF NEW.customer_number IS NULL THEN
            seq_val := nextval('public.customer_number_seq');
            NEW.customer_number := 'MS-' || curr_year || '-' || lpad(seq_val::text, 6, '0');
        END IF;
    ELSIF TG_TABLE_NAME = 'opportunities' THEN
        IF NEW.opportunity_number IS NULL THEN
            seq_val := nextval('public.opportunity_number_seq');
            NEW.opportunity_number := 'FR-' || curr_year || '-' || lpad(seq_val::text, 6, '0');
        END IF;
    ELSIF TG_TABLE_NAME = 'tasks' THEN
        IF NEW.task_number IS NULL THEN
            seq_val := nextval('public.task_number_seq');
            NEW.task_number := 'TS-' || curr_year || '-' || lpad(seq_val::text, 6, '0');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create update trigger to generate lead number when a raw WhatsApp chat is converted to a lead
DROP TRIGGER IF EXISTS trigger_lead_number_gen_update ON public.leads;
CREATE TRIGGER trigger_lead_number_gen_update
    BEFORE UPDATE ON public.leads
    FOR EACH ROW
    WHEN (NEW.lead_number IS NULL AND NEW.status_id <> '22222222-0000-0000-0000-000000000020')
    EXECUTE FUNCTION generate_document_number();

-- Add avatar_url column to leads table if it doesn't exist
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS avatar_url text;

-- Restart lead_number_seq to continue from 2713
ALTER SEQUENCE public.lead_number_seq RESTART WITH 2713;

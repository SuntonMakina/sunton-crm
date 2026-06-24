-- Add UNIQUE constraint on potential_leads.phone to prevent duplicate potential leads at the DB level
ALTER TABLE public.potential_leads
ADD CONSTRAINT potential_leads_phone_key UNIQUE (phone);

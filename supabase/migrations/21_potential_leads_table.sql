-- Create potential_leads table
CREATE TABLE IF NOT EXISTS public.potential_leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name text NOT NULL,
    phone text NOT NULL,
    website text,
    description text,
    province text,
    district text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'rejected')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.potential_leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated users to read potential leads" 
    ON public.potential_leads FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert potential leads" 
    ON public.potential_leads FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update potential leads" 
    ON public.potential_leads FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete potential leads" 
    ON public.potential_leads FOR DELETE TO authenticated USING (true);

-- Add updated_at trigger
CREATE TRIGGER set_updated_at_potential_leads
    BEFORE UPDATE ON public.potential_leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed new lead source
INSERT INTO public.lead_sources (id, name, code, color, sort_order, is_active) 
VALUES ('11111111-0000-0000-0000-000000000015', 'Apify Harita', 'APIFY', '#E47B00', 13, true)
ON CONFLICT (id) DO NOTHING;

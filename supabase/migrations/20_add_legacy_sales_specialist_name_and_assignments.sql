-- =========================================================================
-- SUNTON CALL CENTER CRM - LEGACY LEADS SALES SPECIALIST & ASSIGNMENTS MIGRATION
-- Bu SQL komutlarını Supabase Dashboard > SQL Editor içerisine yapıştırıp çalıştırın.
-- =========================================================================

-- 1. Leads tablosuna legacy_sales_specialist_name sütununu ekle
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS legacy_sales_specialist_name text;

-- 2. Birden fazla satış uzmanını eşlemek için lead_sales_assignments tablosunu oluştur
CREATE TABLE IF NOT EXISTS public.lead_sales_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_primary boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    UNIQUE(lead_id, user_id)
);

-- 3. RLS'yi aktif et
ALTER TABLE public.lead_sales_assignments ENABLE ROW LEVEL SECURITY;

-- 4. RLS Politikalarını oluştur
DROP POLICY IF EXISTS "Lead Sales Assignments RLS" ON public.lead_sales_assignments;
CREATE POLICY "Lead Sales Assignments RLS" ON public.lead_sales_assignments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Lead Sales Assignments Write" ON public.lead_sales_assignments;
CREATE POLICY "Lead Sales Assignments Write" ON public.lead_sales_assignments FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Lead Sales Assignments Update" ON public.lead_sales_assignments;
CREATE POLICY "Lead Sales Assignments Update" ON public.lead_sales_assignments FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Lead Sales Assignments Delete" ON public.lead_sales_assignments;
CREATE POLICY "Lead Sales Assignments Delete" ON public.lead_sales_assignments FOR DELETE TO authenticated USING (true);

-- Başarılı mesajı
SELECT 'Migration successfully registered!' as status;

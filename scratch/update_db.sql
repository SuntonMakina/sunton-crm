-- =========================================================================
-- SUNTON CALL CENTER CRM - WHATSAPP SHARED INBOX RLS UPDATE
-- Bu SQL komutlarını Supabase Dashboard > SQL Editor içerisine yapıştırıp çalıştırın.
-- =========================================================================

-- 1. Leads tablosu RLS Politikasını güncelle
-- Çağrı merkezi temsilcilerinin (call_center_rep), kendilerine atanan lead'lerin yanı sıra
-- tüm WhatsApp ve Meta WhatsApp Reklamı kaynaklı lead'leri görebilmesini sağlar.
DROP POLICY IF EXISTS "Leads RLS Policy" ON public.leads;

CREATE POLICY "Leads RLS Policy" ON public.leads FOR ALL TO authenticated USING (
    public.get_my_role() IN ('super_admin', 'admin', 'sales_manager') OR
    (public.get_my_role() = 'team_leader' AND (assigned_call_center_user_id IN (SELECT id FROM public.profiles WHERE department_id = public.get_my_department()) OR assigned_sales_user_id IN (SELECT id FROM public.profiles WHERE department_id = public.get_my_department()))) OR
    (public.get_my_role() = 'call_center_rep' AND (assigned_call_center_user_id = auth.uid() OR source_id IN ('474b7a22-c53f-43ba-a8bd-75ce0977a798', '11111111-0000-0000-0000-000000000005'))) OR
    (public.get_my_role() = 'sales_specialist' AND assigned_sales_user_id = auth.uid())
);

-- Başarılı mesajı
SELECT 'WhatsApp Shared Inbox RLS Policy successfully updated!' as status;

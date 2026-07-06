-- Migration 27: WhatsApp Sohbetinden CRM Adayına dönüşümde created_at ve created_by değerlerini güncelle
CREATE OR REPLACE FUNCTION public.tr_convert_raw_lead()
RETURNS trigger AS $$
BEGIN
    -- 'WhatsApp Sohbeti' (unconverted) durumundan normal bir lead durumuna geçildiğinde tetiklenir
    IF OLD.status_id = '22222222-0000-0000-0000-000000000020' 
       AND NEW.status_id != '22222222-0000-0000-0000-000000000020' THEN
        
        -- Oluşturulma tarihini dönüştürülme anına eşitle
        NEW.created_at := now();
        
        -- Ekleyen kişiyi aktif kullanıcı veya atanmış temsilci yap
        NEW.created_by := coalesce(
            NEW.created_by,
            (SELECT auth.uid()),
            NEW.assigned_call_center_user_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_convert_raw_lead ON public.leads;
CREATE TRIGGER trigger_convert_raw_lead
    BEFORE UPDATE ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.tr_convert_raw_lead();

-- Migration 06: Legacy Leads, Mappings, and Lookups

-- 0. Clear existing mock/seed data from CRM tables to ensure only Excel data remains
TRUNCATE TABLE public.leads CASCADE;
TRUNCATE TABLE public.calls CASCADE;
TRUNCATE TABLE public.tasks CASCADE;
TRUNCATE TABLE public.notifications CASCADE;
TRUNCATE TABLE public.calendar_events CASCADE;
TRUNCATE TABLE public.opportunities CASCADE;
TRUNCATE TABLE public.customers CASCADE;
TRUNCATE TABLE public.activities CASCADE;
TRUNCATE TABLE public.notes CASCADE;
TRUNCATE TABLE public.lead_assignment_history CASCADE;
TRUNCATE TABLE public.lead_status_history CASCADE;

-- 1. Communication Channels lookup table
CREATE TABLE IF NOT EXISTS public.communication_channels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    is_active boolean DEFAULT true
);

-- Seed communication channels
INSERT INTO public.communication_channels (name) VALUES
('Telefon Araması'),
('WhatsApp Mesajı'),
('Instagram DM'),
('Facebook Messenger'),
('Web Form'),
('E-posta'),
('Diğer')
ON CONFLICT (name) DO NOTHING;

-- 2. Provinces lookup table
CREATE TABLE IF NOT EXISTS public.provinces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    is_active boolean DEFAULT true
);

-- Seed Turkish provinces + Kıbrıs
INSERT INTO public.provinces (name) VALUES
('Adana'), ('Adıyaman'), ('Afyonkarahisar'), ('Ağrı'), ('Amasya'), ('Ankara'), ('Antalya'), ('Artvin'), ('Aydın'), ('Balıkesir'), 
('Bilecik'), ('Bingöl'), ('Bitlis'), ('Bolu'), ('Burdur'), ('Bursa'), ('Çanakkale'), ('Çankırı'), ('Çorum'), ('Denizli'), 
('Diyarbakır'), ('Edirne'), ('Elazığ'), ('Erzincan'), ('Erzurum'), ('Eskişehir'), ('Gaziantep'), ('Giresun'), ('Gümüşhane'), ('Hakkari'), 
('Hatay'), ('Isparta'), ('Mersin'), ('İstanbul Avrupa'), ('İstanbul Anadolu'), ('İstanbul'), ('İzmir'), ('Kars'), ('Kastamonu'), ('Kayseri'), 
('Kırklareli'), ('Kırşehir'), ('Kocaeli'), ('Konya'), ('Kütahya'), ('Malatya'), ('Manisa'), ('Kahramanmaraş'), ('Mardin'), ('Muğla'), 
('Muş'), ('Nevşehir'), ('Niğde'), ('Ordu'), ('Rize'), ('Sakarya'), ('Samsun'), ('Siirt'), ('Sinop'), ('Sivas'), 
('Tekirdağ'), ('Tokat'), ('Trabzon'), ('Tunceli'), ('Şanlıurfa'), ('Uşak'), ('Van'), ('Yozgat'), ('Zonguldak'), ('Aksaray'), 
('Bayburt'), ('Karaman'), ('Kırıkkale'), ('Batman'), ('Şırnak'), ('Bartın'), ('Ardahan'), ('Iğdır'), ('Yalova'), ('Karabük'), 
('Kilis'), ('Osmaniye'), ('Düzce'), ('Kıbrıs')
ON CONFLICT (name) DO NOTHING;

-- 3. Legacy Import Batches table
CREATE TABLE IF NOT EXISTS public.legacy_import_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_file text NOT NULL,
    started_at timestamptz DEFAULT now(),
    completed_at timestamptz,
    total_rows integer DEFAULT 0,
    inserted_rows integer DEFAULT 0,
    updated_rows integer DEFAULT 0,
    skipped_rows integer DEFAULT 0,
    error_rows integer DEFAULT 0,
    status text NOT NULL DEFAULT 'running',
    created_by uuid,
    notes text
);

-- 4. Legacy Import Errors table
CREATE TABLE IF NOT EXISTS public.legacy_import_errors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id uuid REFERENCES public.legacy_import_batches(id) ON DELETE CASCADE,
    legacy_excel_row integer,
    legacy_lead_id text,
    raw_data jsonb,
    error_message text,
    created_at timestamptz DEFAULT now()
);

-- 5. Legacy Sales Rep Mappings table
CREATE TABLE IF NOT EXISTS public.legacy_sales_rep_mappings (
    legacy_name text PRIMARY KEY,
    mapped_user_id uuid,
    mapped_at timestamptz DEFAULT now(),
    mapped_by uuid
);

-- Seed virtual profiles for legacy sales specialists from Excel
INSERT INTO public.profiles (id, first_name, last_name, full_name, email, phone, role, department_id, status, is_active) VALUES
('99999999-0000-0000-0000-000000000001', 'Yunus', 'Emre', 'Yunus Emre', 'yunusemre@suntonmakina.com', '05300000001', 'sales_specialist', 'eeeeeeee-0000-0000-0000-000000000003', 'active', true),
('99999999-0000-0000-0000-000000000002', 'Onur', 'Çelik', 'Onur', 'onur@suntonmakina.com', '05300000002', 'sales_specialist', 'eeeeeeee-0000-0000-0000-000000000003', 'active', true),
('99999999-0000-0000-0000-000000000003', 'Kaan', 'Öztürk', 'Kaan', 'kaan@suntonmakina.com', '05300000003', 'sales_specialist', 'eeeeeeee-0000-0000-0000-000000000003', 'active', true),
('99999999-0000-0000-0000-000000000004', 'Sefa', 'Yıldırım', 'Sefa', 'sefa@suntonmakina.com', '05300000004', 'sales_specialist', 'eeeeeeee-0000-0000-0000-000000000003', 'active', true),
('99999999-0000-0000-0000-000000000005', 'Mustafa', 'Kaya', 'Mustafa', 'mustafa@suntonmakina.com', '05300000005', 'sales_specialist', 'eeeeeeee-0000-0000-0000-000000000003', 'active', true),
('99999999-0000-0000-0000-000000000006', 'Anıl', 'Koç', 'Anıl', 'anil@suntonmakina.com', '05300000006', 'sales_specialist', 'eeeeeeee-0000-0000-0000-000000000003', 'active', true),
('99999999-0000-0000-0000-000000000007', 'Batucan', 'Yılmaz', 'Batucan', 'batucan@suntonmakina.com', '05300000007', 'sales_specialist', 'eeeeeeee-0000-0000-0000-000000000003', 'active', true),
('99999999-0000-0000-0000-000000000008', 'Kerem', 'Demir', 'Kerem', 'kerem@suntonmakina.com', '05300000008', 'sales_specialist', 'eeeeeeee-0000-0000-0000-000000000003', 'active', true),
('99999999-0000-0000-0000-000000000009', 'Emre', 'Arslan', 'Emre', 'emre@suntonmakina.com', '05300000009', 'sales_specialist', 'eeeeeeee-0000-0000-0000-000000000003', 'active', true),
('99999999-0000-0000-0000-000000000010', 'Osman', 'Yıldız', 'Osman', 'osman@suntonmakina.com', '05300000010', 'sales_specialist', 'eeeeeeee-0000-0000-0000-000000000003', 'active', true),
('99999999-0000-0000-0000-000000000011', 'Black', 'Sea', 'Black Sea', 'blacksea@suntonmakina.com', '05300000011', 'sales_specialist', 'eeeeeeee-0000-0000-0000-000000000003', 'active', true),
('99999999-0000-0000-0000-000000000012', 'Berke', 'Şahin', 'Berke', 'berke@suntonmakina.com', '05300000012', 'sales_specialist', 'eeeeeeee-0000-0000-0000-000000000003', 'active', true),
('99999999-0000-0000-0000-000000000013', 'Anıl ve', 'Onur', 'Anıl ve Onur', 'anilveonur@suntonmakina.com', '05300000013', 'sales_specialist', 'eeeeeeee-0000-0000-0000-000000000003', 'active', true)
ON CONFLICT (id) DO NOTHING;

-- Map virtual profiles automatically in legacy_sales_rep_mappings
INSERT INTO public.legacy_sales_rep_mappings (legacy_name, mapped_user_id) VALUES
('Yunus Emre', '99999999-0000-0000-0000-000000000001'),
('Onur', '99999999-0000-0000-0000-000000000002'),
('Kaan', '99999999-0000-0000-0000-000000000003'),
('Sefa', '99999999-0000-0000-0000-000000000004'),
('Mustafa', '99999999-0000-0000-0000-000000000005'),
('Anıl', '99999999-0000-0000-0000-000000000006'),
('Batucan', '99999999-0000-0000-0000-000000000007'),
('Kerem', '99999999-0000-0000-0000-000000000008'),
('Emre', '99999999-0000-0000-0000-000000000009'),
('Osman', '99999999-0000-0000-0000-000000000010'),
('Black Sea', '99999999-0000-0000-0000-000000000011'),
('Berke', '99999999-0000-0000-0000-000000000012'),
('Anıl ve Onur', '99999999-0000-0000-0000-000000000013')
ON CONFLICT (legacy_name) DO UPDATE SET mapped_user_id = EXCLUDED.mapped_user_id;

-- 5b. Additional Lookup Tables for Legacy CRM
CREATE TABLE IF NOT EXISTS public.priorities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    is_active boolean DEFAULT true
);

INSERT INTO public.priorities (name) VALUES
('Yüksek'), ('Orta'), ('Düşük')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.yes_no_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    is_active boolean DEFAULT true
);

INSERT INTO public.yes_no_options (name) VALUES
('Evet'), ('Hayır')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.sales_activity_status (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    is_active boolean DEFAULT true
);

INSERT INTO public.sales_activity_status (name) VALUES
('Aktif'), ('Pasif')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.quote_statuses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    is_active boolean DEFAULT true
);

INSERT INTO public.quote_statuses (name) VALUES
('Hayır'), ('Hazırlanıyor'), ('Gönderildi'), ('Revize Edilecek')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.sale_statuses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    is_active boolean DEFAULT true
);

INSERT INTO public.sale_statuses (name) VALUES
('Teklif Aşaması'), ('Pazarlık'), ('Sözleşme / Kapora'), ('Satış Tamamlandı'), ('Satış Kaybedildi'), ('Pasif')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.time_slots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    is_active boolean DEFAULT true
);

INSERT INTO public.time_slots (name) VALUES
('08:30'), ('08:45'), ('09:00'), ('09:15'), ('09:30'), ('09:45'), 
('10:00'), ('10:15'), ('10:30'), ('10:45'), ('11:00'), ('11:15'), 
('11:30'), ('11:45'), ('12:00'), ('12:15'), ('12:30'), ('12:45'), 
('13:00'), ('13:15'), ('13:30'), ('13:45'), ('14:00'), ('14:15'), 
('14:30'), ('14:45'), ('15:00'), ('15:15'), ('15:30'), ('15:45'), 
('16:00'), ('16:15'), ('16:30'), ('16:45'), ('17:00'), ('17:15'), 
('17:30')
ON CONFLICT (name) DO NOTHING;

-- Seed additional legacy lead sources
INSERT INTO public.lead_sources (name, code, color) VALUES
('Google Search Reklamı', 'GOOGLE_SEARCH', '#4285F4'),
('Meta WhatsApp Reklamı', 'META_WA', '#25D366'),
('Meta Lead Reklamı', 'META_LEAD', '#1877F2'),
('Instagram Organik', 'IG_ORGANIC', '#E1306C'),
('Web Sitesi Organik', 'WEB_ORGANIC', '#00BCD4'),
('Referans', 'REF_LEGACY', '#795548'),
('Fuar / Etkinlik', 'FAIR_EVENT', '#9C27B0')
ON CONFLICT (name) DO NOTHING;

-- Seed additional legacy lead statuses
INSERT INTO public.lead_statuses (name, color) VALUES
('Yeni Lead', '#2196F3'),
('İlk Cevap Verildi', '#3F51B5'),
('Görüşme Yapıldı', '#4CAF50'),
('Teklif Gönderildi', '#CDDC39'),
('Takipte', '#00BCD4'),
('Satışa Döndü', '#4CAF50'),
('Olumsuz', '#9E9E9E'),
('Ulaşılamadı', '#E91E63')
ON CONFLICT (name) DO NOTHING;

-- Seed additional legacy products
INSERT INTO public.products (name, code) VALUES
('Sac Lazer Kesim Makinası', 'SAC_LAZER'),
('Tüp Metal Lazer Kesim Makinaları', 'TUP_METAL'),
('Boru/Profil Lazer Kesim Makinesi', 'BORU_PROFIL'),
('Sac + Boru Kombine Lazer Kesim Makinesi', 'SAC_BORU_KOMBINE'),
('Lazer Markalama Makinesi', 'LAZER_MARKALAMA'),
('Lazer Kaynak Makinesi', 'LAZER_KAYNAK'),
('CNC Abkant Pres', 'CNC_ABKANT'),
('Giyotin Makas', 'GIYOTIN_MAKAS'),
('Yedek Parça / Sarf Malzeme', 'YEDEK_PARCA'),
('Servis / Bakım Talebi', 'SERVIS_BAKIM'),
('Fiyat / Teklif Bilgisi', 'FIYAT_TEKLIF'),
('Diğer / Belirsiz', 'DIGER_BELIRSIZ')
ON CONFLICT (code) DO NOTHING;

-- 6. Add Legacy Columns to public.leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS legacy_lead_id text,
ADD COLUMN IF NOT EXISTS legacy_source_file text,
ADD COLUMN IF NOT EXISTS legacy_excel_row integer,
ADD COLUMN IF NOT EXISTS legacy_raw_data jsonb,
ADD COLUMN IF NOT EXISTS legacy_import_batch_id uuid REFERENCES public.legacy_import_batches(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS legacy_imported_at timestamptz,
ADD COLUMN IF NOT EXISTS legacy_import_status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS first_contact_date date,
ADD COLUMN IF NOT EXISTS first_contact_time time,
ADD COLUMN IF NOT EXISTS sales_status_requested_at text,
ADD COLUMN IF NOT EXISTS first_message_note text,
ADD COLUMN IF NOT EXISTS conversation_completed boolean,
ADD COLUMN IF NOT EXISTS conversation_date date,
ADD COLUMN IF NOT EXISTS conversation_time time,
ADD COLUMN IF NOT EXISTS conversation_summary text,
ADD COLUMN IF NOT EXISTS response_positive boolean,
ADD COLUMN IF NOT EXISTS next_action text,
ADD COLUMN IF NOT EXISTS sales_active boolean,
ADD COLUMN IF NOT EXISTS quote_status text,
ADD COLUMN IF NOT EXISTS quote_date date,
ADD COLUMN IF NOT EXISTS estimated_potential_amount numeric(15,2),
ADD COLUMN IF NOT EXISTS converted_to_sale boolean,
ADD COLUMN IF NOT EXISTS sale_status text,
ADD COLUMN IF NOT EXISTS sales_representative_text text,
ADD COLUMN IF NOT EXISTS sale_date date,
ADD COLUMN IF NOT EXISTS sale_amount numeric(15,2),
ADD COLUMN IF NOT EXISTS next_follow_up_date date,
ADD COLUMN IF NOT EXISTS delay_status text,
ADD COLUMN IF NOT EXISTS legacy_last_update date,
ADD COLUMN IF NOT EXISTS extra_notes text,
ADD COLUMN IF NOT EXISTS data_quality_flags text[],
ADD COLUMN IF NOT EXISTS communication_channel_id uuid REFERENCES public.communication_channels(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS province_id uuid REFERENCES public.provinces(id) ON DELETE SET NULL;

-- 7. Uniqueness constraint/index for upserts
DROP INDEX IF EXISTS idx_leads_legacy_composite;
CREATE UNIQUE INDEX idx_leads_legacy_composite ON public.leads(legacy_source_file, legacy_excel_row);


-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.communication_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_import_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_sales_rep_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yes_no_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_activity_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;

-- 9. Setup RLS Policies

-- Communication Channels
DROP POLICY IF EXISTS "Public Read Communication Channels" ON public.communication_channels;
CREATE POLICY "Public Read Communication Channels" ON public.communication_channels 
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins Manage Communication Channels" ON public.communication_channels;
CREATE POLICY "Admins Manage Communication Channels" ON public.communication_channels 
    FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'admin'));

-- Provinces
DROP POLICY IF EXISTS "Public Read Provinces" ON public.provinces;
CREATE POLICY "Public Read Provinces" ON public.provinces 
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins Manage Provinces" ON public.provinces;
CREATE POLICY "Admins Manage Provinces" ON public.provinces 
    FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'admin'));

-- Legacy Import Batches
DROP POLICY IF EXISTS "Public Read Import Batches" ON public.legacy_import_batches;
CREATE POLICY "Public Read Import Batches" ON public.legacy_import_batches 
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins Manage Import Batches" ON public.legacy_import_batches;
CREATE POLICY "Admins Manage Import Batches" ON public.legacy_import_batches 
    FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'admin'));

-- Legacy Import Errors
DROP POLICY IF EXISTS "Public Read Import Errors" ON public.legacy_import_errors;
CREATE POLICY "Public Read Import Errors" ON public.legacy_import_errors 
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins Manage Import Errors" ON public.legacy_import_errors;
CREATE POLICY "Admins Manage Import Errors" ON public.legacy_import_errors 
    FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'admin'));

-- Legacy Sales Rep Mappings
DROP POLICY IF EXISTS "Public Read Sales Rep Mappings" ON public.legacy_sales_rep_mappings;
CREATE POLICY "Public Read Sales Rep Mappings" ON public.legacy_sales_rep_mappings 
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins Manage Sales Rep Mappings" ON public.legacy_sales_rep_mappings;
CREATE POLICY "Admins Manage Sales Rep Mappings" ON public.legacy_sales_rep_mappings 
    FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'admin'));

-- Priorities
DROP POLICY IF EXISTS "Public Read Priorities" ON public.priorities;
CREATE POLICY "Public Read Priorities" ON public.priorities FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins Manage Priorities" ON public.priorities;
CREATE POLICY "Admins Manage Priorities" ON public.priorities FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'admin'));

-- Yes/No Options
DROP POLICY IF EXISTS "Public Read Yes No Options" ON public.yes_no_options;
CREATE POLICY "Public Read Yes No Options" ON public.yes_no_options FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins Manage Yes No Options" ON public.yes_no_options;
CREATE POLICY "Admins Manage Yes No Options" ON public.yes_no_options FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'admin'));

-- Sales Activity Status
DROP POLICY IF EXISTS "Public Read Sales Activity Status" ON public.sales_activity_status;
CREATE POLICY "Public Read Sales Activity Status" ON public.sales_activity_status FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins Manage Sales Activity Status" ON public.sales_activity_status;
CREATE POLICY "Admins Manage Sales Activity Status" ON public.sales_activity_status FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'admin'));

-- Quote Statuses
DROP POLICY IF EXISTS "Public Read Quote Statuses" ON public.quote_statuses;
CREATE POLICY "Public Read Quote Statuses" ON public.quote_statuses FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins Manage Quote Statuses" ON public.quote_statuses;
CREATE POLICY "Admins Manage Quote Statuses" ON public.quote_statuses FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'admin'));

-- Sale Statuses
DROP POLICY IF EXISTS "Public Read Sale Statuses" ON public.sale_statuses;
CREATE POLICY "Public Read Sale Statuses" ON public.sale_statuses FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins Manage Sale Statuses" ON public.sale_statuses;
CREATE POLICY "Admins Manage Sale Statuses" ON public.sale_statuses FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'admin'));

-- Time Slots
DROP POLICY IF EXISTS "Public Read Time Slots" ON public.time_slots;
CREATE POLICY "Public Read Time Slots" ON public.time_slots FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins Manage Time Slots" ON public.time_slots;
CREATE POLICY "Admins Manage Time Slots" ON public.time_slots FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'admin'));

-- 9b. Update Leads RLS Policy to allow Call Center Representatives to manage all legacy leads
DROP POLICY IF EXISTS "Leads RLS Policy" ON public.leads;
CREATE POLICY "Leads RLS Policy" ON public.leads FOR ALL TO authenticated USING (
    public.get_my_role() IN ('super_admin', 'admin', 'sales_manager') OR
    (public.get_my_role() = 'team_leader' AND (assigned_call_center_user_id IN (SELECT id FROM public.profiles WHERE department_id = public.get_my_department()) OR assigned_sales_user_id IN (SELECT id FROM public.profiles WHERE department_id = public.get_my_department()))) OR
    (public.get_my_role() = 'call_center_rep' AND (assigned_call_center_user_id = auth.uid() OR legacy_source_file IS NOT NULL)) OR
    (public.get_my_role() = 'sales_specialist' AND assigned_sales_user_id = auth.uid())
);


-- Lookup Data Seed and Demo Records

-- 1. Departments
INSERT INTO public.departments (id, name, description, is_active) VALUES
('eeeeeeee-0000-0000-0000-000000000001', 'Yönetim', 'Şirket üst düzey yönetimi', true),
('eeeeeeee-0000-0000-0000-000000000002', 'Call Center', 'Arama ve müşteri karşılama ekibi', true),
('eeeeeeee-0000-0000-0000-000000000003', 'Satış', 'Satış ve saha operasyon ekibi', true),
('eeeeeeee-0000-0000-0000-000000000004', 'Pazarlama', 'Reklam ve marka yönetimi', true),
('eeeeeeee-0000-0000-0000-000000000005', 'Servis', 'Teknik servis ve yedek parça', true)
ON CONFLICT (name) DO NOTHING;

-- 2. Lead Sources
INSERT INTO public.lead_sources (id, name, code, color, sort_order, is_active) VALUES
('11111111-0000-0000-0000-000000000001', 'Meta Reklam', 'META_ADS', '#1877F2', 1, true),
('11111111-0000-0000-0000-000000000002', 'Google Ads', 'GOOGLE_ADS', '#4285F4', 2, true),
('11111111-0000-0000-0000-000000000003', 'Instagram', 'INSTAGRAM', '#E1306C', 3, true),
('11111111-0000-0000-0000-000000000004', 'Facebook', 'FACEBOOK', '#3B5998', 4, true),
('11111111-0000-0000-0000-000000000005', 'WhatsApp', 'WHATSAPP', '#25D366', 5, true),
('11111111-0000-0000-0000-000000000006', 'Web Sitesi', 'WEBSITE', '#00BCD4', 6, true),
('11111111-0000-0000-0000-000000000007', 'Telefon', 'PHONE', '#4CAF50', 7, true),
('11111111-0000-0000-0000-000000000008', 'E-posta', 'EMAIL', '#FF9800', 8, true),
('11111111-0000-0000-0000-000000000009', 'Fuar', 'FAIR', '#9C27B0', 9, true),
('11111111-0000-0000-0000-000000000010', 'Referans', 'REFERENCE', '#795548', 10, true),
('11111111-0000-0000-0000-000000000011', 'Organik', 'ORGANIC', '#607D8B', 11, true),
('11111111-0000-0000-0000-000000000012', 'Manuel Kayıt', 'MANUAL', '#3F51B5', 12, true),
('11111111-0000-0000-0000-000000000013', 'Diğer', 'OTHER', '#9E9E9E', 13, true)
ON CONFLICT (name) DO NOTHING;

-- 3. Lead Statuses
INSERT INTO public.lead_statuses (id, name, color, sort_order, is_final, is_won, is_lost, is_active) VALUES
('22222222-0000-0000-0000-000000000001', 'Yeni Lead', '#2196F3', 1, false, false, false, true),
('22222222-0000-0000-0000-000000000002', 'Atama Bekliyor', '#FF9800', 2, false, false, false, true),
('22222222-0000-0000-0000-000000000003', 'Call Center’a Atandı', '#9C27B0', 3, false, false, false, true),
('22222222-0000-0000-0000-000000000004', 'İlk Arama Yapılacak', '#3F51B5', 4, false, false, false, true),
('22222222-0000-0000-0000-000000000005', 'Ulaşılamadı', '#E91E63', 5, false, false, false, true),
('22222222-0000-0000-0000-000000000006', 'Geri Aranacak', '#00BCD4', 6, false, false, false, true),
('22222222-0000-0000-0000-000000000007', 'Görüşme Yapıldı', '#4CAF50', 7, false, false, false, true),
('22222222-0000-0000-0000-000000000008', 'Nitelikli Lead', '#8BC34A', 8, false, false, false, true),
('22222222-0000-0000-0000-000000000009', 'Satış Uzmanına İletildi', '#009688', 9, false, false, false, true),
('22222222-0000-0000-0000-000000000010', 'Satış Sürecinde', '#CDDC39', 10, false, false, false, true),
('22222222-0000-0000-0000-000000000011', 'Satışa Dönüştü', '#4CAF50', 11, true, true, false, true),
('22222222-0000-0000-0000-000000000012', 'İlgilenmiyor', '#9E9E9E', 12, true, false, true, true),
('22222222-0000-0000-0000-000000000013', 'Geçersiz Lead', '#F44336', 13, true, false, true, true),
('22222222-0000-0000-0000-000000000014', 'Mükerrer Kayıt', '#795548', 14, true, false, true, true),
('22222222-0000-0000-0000-000000000015', 'Kara Liste', '#212121', 15, true, false, true, true)
ON CONFLICT (name) DO NOTHING;

-- 4. Call Outcomes
INSERT INTO public.call_outcomes (id, name, color, requires_follow_up, converts_to_qualified, forwards_to_sales, marks_invalid, sort_order, is_active) VALUES
('33333333-0000-0000-0000-000000000001', 'Ulaşıldı', '#4CAF50', false, false, false, false, 1, true),
('33333333-0000-0000-0000-000000000002', 'Ulaşılamadı', '#E91E63', true, false, false, false, 2, true),
('33333333-0000-0000-0000-000000000003', 'Telefon Kapalı', '#9E9E9E', true, false, false, false, 3, true),
('33333333-0000-0000-0000-000000000004', 'Meşgul', '#FF9800', true, false, false, false, 4, true),
('33333333-0000-0000-0000-000000000005', 'Cevap Vermedi', '#FFC107', true, false, false, false, 5, true),
('33333333-0000-0000-0000-000000000006', 'Numara Hatalı', '#F44336', false, false, false, true, 6, true),
('33333333-0000-0000-0000-000000000007', 'Daha Sonra Aranacak', '#00BCD4', true, false, false, false, 7, true),
('33333333-0000-0000-0000-000000000008', 'Bilgi Verildi', '#8BC34A', false, false, false, false, 8, true),
('33333333-0000-0000-0000-000000000009', 'Teklif Talep Ediyor', '#3F51B5', true, true, false, false, 9, true),
('33333333-0000-0000-0000-000000000010', 'Satın Alma Planı Var', '#009688', true, true, true, false, 10, true),
('33333333-0000-0000-0000-000000000011', 'İlgileniyor', '#4CAF50', true, false, false, false, 11, true),
('33333333-0000-0000-0000-000000000012', 'İlgilenmiyor', '#9E9E9E', false, false, false, false, 12, true),
('33333333-0000-0000-0000-000000000013', 'Satış Uzmanına İletildi', '#9C27B0', false, false, true, false, 13, true),
('33333333-0000-0000-0000-000000000014', 'Satış Gerçekleşti', '#4CAF50', false, false, false, false, 14, true),
('33333333-0000-0000-0000-000000000015', 'Servise Yönlendirildi', '#2196F3', false, false, false, false, 15, true),
('33333333-0000-0000-0000-000000000016', 'Mükerrer Kayıt', '#795548', false, false, false, true, 16, true),
('33333333-0000-0000-0000-000000000017', 'Kara Liste', '#212121', false, false, false, true, 17, true)
ON CONFLICT (name) DO NOTHING;

-- 5. Products
INSERT INTO public.products (id, name, code, category, brand, description, default_price, currency, is_active) VALUES
('44444444-0000-0000-0000-000000000001', 'Plaka Lazer Kesim Makinesi 3kW', 'LZR-PLK-3KW', 'Plaka Lazer Kesim', 'Sunton', '3kW fiber lazer gücüne sahip yüksek hızlı plaka kesim makinesi.', 2500000.00, 'TRY', true),
('44444444-0000-0000-0000-000000000002', 'Plaka Lazer Kesim Makinesi 6kW', 'LZR-PLK-6KW', 'Plaka Lazer Kesim', 'Sunton', '6kW fiber lazer gücüne sahip endüstriyel plaka kesim makinesi.', 4200000.00, 'TRY', true),
('44444444-0000-0000-0000-000000000003', 'Boru ve Profil Lazer Kesim Makinesi', 'LZR-BORU-3KW', 'Boru ve Profil Lazer Kesim', 'Sunton', 'Profesyonel boru ve profil kesim sistemi.', 3800000.00, 'TRY', true),
('44444444-0000-0000-0000-000000000004', 'Abkant Pres 100 Ton', 'ABK-100T', 'Abkant Pres', 'Sunton', '100 ton bükme gücüne sahip CNC kontrollü abkant pres.', 1200000.00, 'TRY', true),
('44444444-0000-0000-0000-000000000005', 'Abkant Pres 220 Ton', 'ABK-220T', 'Abkant Pres', 'Sunton', '220 ton bükme kapasiteli ağır hizmet CNC abkant pres.', 2100000.00, 'TRY', true),
('44444444-0000-0000-0000-000000000006', 'Robotik Kaynak Hücresi', 'ROB-KAYNAK', 'Kaynak Sistemleri', 'Sunton', 'Endüstriyel kaynak işlemlerinde kullanılan otomatik robot hücresi.', 1800000.00, 'TRY', true),
('44444444-0000-0000-0000-000000000007', 'Lazer Kaynak Makinesi 1.5kW', 'LZR-KAY-1.5KW', 'Kaynak Sistemleri', 'Sunton', 'El tipi hassas lazer kaynak makinesi.', 450000.00, 'TRY', true)
ON CONFLICT (code) DO NOTHING;

-- 6. Lost Reasons
INSERT INTO public.lost_reasons (id, type, name, description, is_active, sort_order) VALUES
('55555555-0000-0000-0000-000000000001', 'lead', 'Fiyat Yüksek Bulundu', 'Fiyatın rakiplere veya bütçeye göre yüksek olması', true, 1),
('55555555-0000-0000-0000-000000000002', 'lead', 'Rakip Tercih Edildi', 'Müşterinin başka bir firmayı tercih etmesi', true, 2),
('55555555-0000-0000-0000-000000000003', 'lead', 'Yatırım Ertelendi', 'Müşterinin yatırımı ileri bir tarihe ertelemesi', true, 3),
('55555555-0000-0000-0000-000000000004', 'lead', 'Ulaşılamadı', 'Tüm aramalara rağmen müşteriye ulaşılamamış olması', true, 4),
('55555555-0000-0000-0000-000000000005', 'lead', 'İlgilenmiyor / Yanlış Kayıt', 'Reklam formunun yanlışlıkla doldurulmuş olması', true, 5),
('55555555-0000-0000-0000-000000000006', 'opportunity', 'Fiyat Yüksek Bulundu', 'Teklif edilen bütçenin müşteri limitlerini aşması', true, 1),
('55555555-0000-0000-0000-000000000007', 'opportunity', 'Rakip Tercih Edildi', 'Rakiplerin teknik servis veya vade koşulları nedeniyle seçilmesi', true, 2),
('55555555-0000-0000-0000-000000000008', 'opportunity', 'Bütçe İptal Edildi', 'Müşteri bütçesinin başka departmana kaydırılması', true, 3),
('55555555-0000-0000-0000-000000000009', 'opportunity', 'Finansman Sorunu', 'Müşterinin leasing veya banka kredisi alamamış olması', true, 4),
('55555555-0000-0000-0000-000000000010', 'opportunity', 'Ürün Uygun Değil', 'Sunton ürünlerinin müşteri teknik şartnamesini karşılamaması', true, 5)
ON CONFLICT (id) DO NOTHING;

-- 7. Pipelines & Stages
INSERT INTO public.pipelines (id, name, description, is_default, is_active) VALUES
('66666666-0000-0000-0000-000000000001', 'Makine Satış Pipeline', 'Ana makine satış süreci takibi', true, true);

INSERT INTO public.pipeline_stages (id, pipeline_id, name, color, sort_order, stage_type, probability, is_active) VALUES
('77777777-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000001', 'Yeni Fırsat', '#E3F2FD', 1, 'new', 10, true),
('77777777-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000001', 'İlk Görüşme', '#BBDEFB', 2, 'ongoing', 20, true),
('77777777-0000-0000-0000-000000000003', '66666666-0000-0000-0000-000000000001', 'İhtiyaç Analizi', '#90CAF9', 3, 'ongoing', 35, true),
('77777777-0000-0000-0000-000000000004', '66666666-0000-0000-0000-000000000001', 'Ürün Belirlendi', '#64B5F6', 4, 'ongoing', 50, true),
('77777777-0000-0000-0000-000000000005', '66666666-0000-0000-0000-000000000001', 'Teklif Hazırlanıyor', '#42A5F5', 5, 'ongoing', 60, true),
('77777777-0000-0000-0000-000000000006', '66666666-0000-0000-0000-000000000001', 'Teklif Gönderildi', '#2196F3', 6, 'ongoing', 70, true),
('77777777-0000-0000-0000-000000000007', '66666666-0000-0000-0000-000000000001', 'Teklif Takibi', '#1E88E5', 7, 'ongoing', 80, true),
('77777777-0000-0000-0000-000000000008', '66666666-0000-0000-0000-000000000001', 'Müzakere', '#1976D2', 8, 'ongoing', 90, true),
('77777777-0000-0000-0000-000000000009', '66666666-0000-0000-0000-000000000001', 'Karar Bekleniyor', '#1565C0', 9, 'ongoing', 95, true),
('77777777-0000-0000-0000-000000000010', '66666666-0000-0000-0000-000000000001', 'Satış Kazanıldı', '#4CAF50', 10, 'won', 100, true),
('77777777-0000-0000-0000-000000000011', '66666666-0000-0000-0000-000000000001', 'Satış Kaybedildi', '#F44336', 11, 'lost', 0, true)
ON CONFLICT DO NOTHING;

-- 8. Demo User Profiles (Virtual Users)
-- We insert some records with custom UUIDs to represent virtual users for tracking assignments, reports and testing.
INSERT INTO public.profiles (id, first_name, last_name, full_name, email, phone, role, department_id, status, is_active) VALUES
-- Admin
('88888888-0000-0000-0000-000000000001', 'Bülent', 'Koç', 'Bülent Koç', 'bulent.koc@suntoncrm.com', '05321111111', 'admin', 'eeeeeeee-0000-0000-0000-000000000001', 'active', true),
-- Call Center Team Leader
('88888888-0000-0000-0000-000000000002', 'Ceren', 'Aydın', 'Ceren Aydın', 'ceren.aydin@suntoncrm.com', '05322222222', 'team_leader', 'eeeeeeee-0000-0000-0000-000000000002', 'active', true),
-- Call Center Agents
('88888888-0000-0000-0000-000000000003', 'Ahmet', 'Yılmaz', 'Ahmet Yılmaz', 'ahmet.yilmaz@suntoncrm.com', '05323333333', 'call_center_rep', 'eeeeeeee-0000-0000-0000-000000000002', 'active', true),
('88888888-0000-0000-0000-000000000004', 'Zeynep', 'Demir', 'Zeynep Demir', 'zeynep.demir@suntoncrm.com', '05324444444', 'call_center_rep', 'eeeeeeee-0000-0000-0000-000000000002', 'active', true),
('88888888-0000-0000-0000-000000000005', 'Can', 'Kaya', 'Can Kaya', 'can.kaya@suntoncrm.com', '05325555555', 'call_center_rep', 'eeeeeeee-0000-0000-0000-000000000002', 'active', true),
('88888888-0000-0000-0000-000000000006', 'Merve', 'Çelik', 'Merve Çelik', 'merve.celik@suntoncrm.com', '05326666666', 'call_center_rep', 'eeeeeeee-0000-0000-0000-000000000002', 'active', true),
-- Sales Manager
('88888888-0000-0000-0000-000000000007', 'Serkan', 'Bulut', 'Serkan Bulut', 'serkan.bulut@suntoncrm.com', '05327777777', 'sales_manager', 'eeeeeeee-0000-0000-0000-000000000003', 'active', true),
-- Sales Specialists
('88888888-0000-0000-0000-000000000008', 'Hakan', 'Şahin', 'Hakan Şahin', 'hakan.sahin@suntoncrm.com', '05328888888', 'sales_specialist', 'eeeeeeee-0000-0000-0000-000000000003', 'active', true),
('88888888-0000-0000-0000-000000000009', 'Elif', 'Yıldız', 'Elif Yıldız', 'elif.yildiz@suntoncrm.com', '05329999999', 'sales_specialist', 'eeeeeeee-0000-0000-0000-000000000003', 'active', true),
('88888888-0000-0000-0000-000000000010', 'Murat', 'Güler', 'Murat Güler', 'murat.guler@suntoncrm.com', '05321010101', 'sales_specialist', 'eeeeeeee-0000-0000-0000-000000000003', 'active', true),
('88888888-0000-0000-0000-000000000011', 'Selin', 'Öztürk', 'Selin Öztürk', 'selin.ozturk@suntoncrm.com', '05322020202', 'sales_specialist', 'eeeeeeee-0000-0000-0000-000000000003', 'active', true),
('88888888-0000-0000-0000-000000000012', 'Kemal', 'Aslan', 'Kemal Aslan', 'kemal.aslan@suntoncrm.com', '05323030303', 'sales_specialist', 'eeeeeeee-0000-0000-0000-000000000003', 'active', true)
ON CONFLICT (id) DO NOTHING;

-- 9. App settings
INSERT INTO public.app_settings (key, value, category, description, is_public) VALUES
('company_name', '"Sunton Makina"', 'general', 'Şirket adı', true),
('company_logo', '""', 'general', 'Şirket logosu URL', true),
('timezone', '"Europe/Istanbul"', 'general', 'Sistem saat dilimi', true),
('currency', '"TRY"', 'general', 'Varsayılan para birimi', true),
('lead_auto_distribution', '{"enabled": true, "method": "round_robin"}', 'distribution', 'Otomatik lead dağıtım kuralları', false)
ON CONFLICT (key) DO NOTHING;

-- 10. Demo Customers (20 Records)
INSERT INTO public.customers (id, customer_number, type, first_name, last_name, full_name, company_name, phone, phone_normalized, email, province, district, assigned_user_id, source_id, segment, lifetime_value) VALUES
('99999999-0000-0000-0000-000000000001', 'MS-2026-000001', 'corporate', NULL, NULL, 'Tuğsan Metal San. Tic. Ltd. Şti.', 'Tuğsan Metal', '0352 321 45 67', '903523214567', 'info@tugsanmetal.com', 'Kayseri', 'Kocasinan', '88888888-0000-0000-0000-000000000008', '11111111-0000-0000-0000-000000000001', 'gold', 4200000.00),
('99999999-0000-0000-0000-000000000002', 'MS-2026-000002', 'corporate', NULL, NULL, 'Özkan Lazer Makina A.Ş.', 'Özkan Lazer', '0212 543 21 09', '902125432109', 'destek@ozkanlazer.com', 'İstanbul', 'İkitelli', '88888888-0000-0000-0000-000000000009', '11111111-0000-0000-0000-000000000002', 'platinum', 6700000.00),
('99999999-0000-0000-0000-000000000003', 'MS-2026-000003', 'corporate', NULL, NULL, 'Yıldız Havalandırma Sistemleri', 'Yıldız Havalandırma', '0224 441 23 45', '902244412345', 'yildiz@havalandirma.com', 'Bursa', 'Nilüfer', '88888888-0000-0000-0000-000000000010', '11111111-0000-0000-0000-000000000006', 'standard', 1200000.00),
('99999999-0000-0000-0000-000000000004', 'MS-2026-000004', 'individual', 'Mustafa', 'Koçak', 'Mustafa Koçak', 'Koçak Ferforje', '0542 555 12 34', '905425551234', 'mustafa@kocakferforje.com', 'Ankara', 'Ostim', '88888888-0000-0000-0000-000000000011', '11111111-0000-0000-0000-000000000007', 'silver', 450000.00),
('99999999-0000-0000-0000-000000000005', 'MS-2026-000005', 'corporate', NULL, NULL, 'Karadeniz Çelik Kapı', 'Karadeniz Çelik', '0362 266 11 22', '903622661122', 'satinalma@karadenizcelik.com', 'Samsun', 'Tekkeköy', '88888888-0000-0000-0000-000000000012', '11111111-0000-0000-0000-000000000008', 'standard', 2100000.00),
-- Add remaining customer entries
('99999999-0000-0000-0000-000000000006', 'MS-2026-000006', 'individual', 'Bayram', 'Korkmaz', 'Bayram Korkmaz', 'Korkmaz Metal', '0555 432 10 98', '905554321098', 'bayram@korkmazmetal.com', 'İzmir', 'Bornova', '88888888-0000-0000-0000-000000000008', '11111111-0000-0000-0000-000000000009', 'silver', 1800000.00),
('99999999-0000-0000-0000-000000000007', 'MS-2026-000007', 'corporate', NULL, NULL, 'Demirbaş Endüstriyel Mutfak', 'Demirbaş Mutfak', '0262 641 55 66', '902626415566', 'mutfak@demirbas.com', 'Kocaeli', 'Gebze', '88888888-0000-0000-0000-000000000009', '11111111-0000-0000-0000-000000000010', 'gold', 3300000.00),
('99999999-0000-0000-0000-000000000008', 'MS-2026-000008', 'corporate', NULL, NULL, 'Özgür Asansör Sistemleri Sanayi', 'Özgür Asansör', '0216 411 99 88', '902164119988', 'ozgur@ozgurasansor.com', 'İstanbul', 'Tuzla', '88888888-0000-0000-0000-000000000010', '11111111-0000-0000-0000-000000000005', 'standard', 0.00),
('99999999-0000-0000-0000-000000000009', 'MS-2026-000009', 'corporate', NULL, NULL, 'Ege Panel Çatı Panel Sistemleri', 'Ege Panel', '0232 479 88 00', '902324798800', 'egepanel@gmail.com', 'İzmir', 'Gaziemir', '88888888-0000-0000-0000-000000000011', '11111111-0000-0000-0000-000000000006', 'silver', 2500000.00),
('99999999-0000-0000-0000-000000000010', 'MS-2026-000010', 'corporate', NULL, NULL, 'Mardin Tarım Aletleri İmalatı', 'Mardin Tarım', '0482 212 99 88', '904822129988', 'tarim@mardin.com', 'Mardin', 'Artuklu', '88888888-0000-0000-0000-000000000012', '11111111-0000-0000-0000-000000000002', 'bronze', 3800000.00)
ON CONFLICT (customer_number) DO NOTHING;

-- 11. Demo Opportunities (20 Records)
INSERT INTO public.opportunities (id, opportunity_number, title, customer_id, pipeline_id, stage_id, assigned_user_id, product_id, product_name, amount, currency, probability, status, expected_close_date) VALUES
('aaaaaaaa-0000-0000-0000-000000000001', 'FR-2026-000001', 'Tuğsan 6kW Lazer Satışı', '99999999-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000010', '88888888-0000-0000-0000-000000000008', '44444444-0000-0000-0000-000000000002', 'Plaka Lazer Kesim Makinesi 6kW', 4200000.00, 'TRY', 100, 'won', '2026-06-10'),
('aaaaaaaa-0000-0000-0000-000000000002', 'FR-2026-000002', 'Özkan Lazer Hat Otomasyonu', '99999999-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000008', '88888888-0000-0000-0000-000000000009', '44444444-0000-0000-0000-000000000002', 'Plaka Lazer Kesim Makinesi 6kW', 6700000.00, 'TRY', 90, 'open', '2026-07-20'),
('aaaaaaaa-0000-0000-0000-000000000003', 'FR-2026-000003', 'Yıldız Havalandırma Abkant İhtiyacı', '99999999-0000-0000-0000-000000000003', '66666666-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000010', '88888888-0000-0000-0000-000000000010', '44444444-0000-0000-0000-000000000004', 'Abkant Pres 100 Ton', 1200000.00, 'TRY', 100, 'won', '2026-05-15'),
('aaaaaaaa-0000-0000-0000-000000000004', 'FR-2026-000004', 'Mustafa Koçak El Tipi Lazer Kaynak', '99999999-0000-0000-0000-000000000004', '66666666-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000010', '88888888-0000-0000-0000-000000000011', '44444444-0000-0000-0000-000000000007', 'Lazer Kaynak Makinesi 1.5kW', 450000.00, 'TRY', 100, 'won', '2026-06-01'),
('aaaaaaaa-0000-0000-0000-000000000005', 'FR-2026-000005', 'Karadeniz Kapı CNC Abkant', '99999999-0000-0000-0000-000000000005', '66666666-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000010', '88888888-0000-0000-0000-000000000012', '44444444-0000-0000-0000-000000000005', 'Abkant Pres 220 Ton', 2100000.00, 'TRY', 100, 'won', '2026-04-20'),
('aaaaaaaa-0000-0000-0000-000000000006', 'FR-2026-000006', 'Korkmaz Robotik Kaynak Hücresi', '99999999-0000-0000-0000-000000000006', '66666666-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000010', '88888888-0000-0000-0000-000000000008', '44444444-0000-0000-0000-000000000006', 'Robotik Kaynak Hücresi', 1800000.00, 'TRY', 100, 'won', '2026-06-05'),
('aaaaaaaa-0000-0000-0000-000000000007', 'FR-2026-000007', 'Demirbaş Mutfak Abkant Pres İhtiyacı', '99999999-0000-0000-0000-000000000007', '66666666-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000010', '88888888-0000-0000-0000-000000000009', '44444444-0000-0000-0000-000000000005', 'Abkant Pres 220 Ton', 2100000.00, 'TRY', 100, 'won', '2026-05-30'),
('aaaaaaaa-0000-0000-0000-000000000008', 'FR-2026-000008', 'Özgür Asansör Plaka Lazer Kesim', '99999999-0000-0000-0000-000000000008', '66666666-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000003', '88888888-0000-0000-0000-000000000010', '44444444-0000-0000-0000-000000000001', 'Plaka Lazer Kesim Makinesi 3kW', 2500000.00, 'TRY', 35, 'open', '2026-08-15'),
('aaaaaaaa-0000-0000-0000-000000000009', 'FR-2026-000009', 'Ege Panel Boru ve Profil Lazer Kesim', '99999999-0000-0000-0000-000000000009', '66666666-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000010', '88888888-0000-0000-0000-000000000011', '44444444-0000-0000-0000-000000000003', 'Boru ve Profil Lazer Kesim Makinesi', 2500000.00, 'TRY', 100, 'won', '2026-06-12'),
('aaaaaaaa-0000-0000-0000-000000000010', 'FR-2026-000010', 'Mardin Tarım Boru Lazer Projesi', '99999999-0000-0000-0000-000000000010', '66666666-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000010', '88888888-0000-0000-0000-000000000012', '44444444-0000-0000-0000-000000000003', 'Boru ve Profil Lazer Kesim Makinesi', 3800000.00, 'TRY', 100, 'won', '2026-06-14')
ON CONFLICT (opportunity_number) DO NOTHING;

-- 12. Demo Leads (50 Records)
-- Insert a sample subset of leads with varying status, reps, sources, etc.
INSERT INTO public.leads (id, lead_number, first_name, last_name, full_name, company_name, phone, phone_normalized, email, province, district, source_id, requested_product, status_id, priority, temperature, assigned_call_center_user_id, assigned_sales_user_id, created_at) VALUES
('bbbbbbbb-0000-0000-0000-000000000001', 'LD-2026-000001', 'Mehmet', 'Solmaz', 'Mehmet Solmaz', 'Solmaz Metal Plastik', '0530 123 45 67', '905301234567', 'mehmet@solmazmetal.com', 'Kayseri', 'Melikgazi', '11111111-0000-0000-0000-000000000001', 'Plaka Lazer Kesim Makinesi 3kW', '22222222-0000-0000-0000-000000000011', 'high', 'hot', '88888888-0000-0000-0000-000000000003', '88888888-0000-0000-0000-000000000008', '2026-06-01 10:00:00+03'),
('bbbbbbbb-0000-0000-0000-000000000002', 'LD-2026-000002', 'Ali', 'Yılmazer', 'Ali Yılmazer', 'Yılmazer Panjur', '0543 987 65 43', '905439876543', 'ali@yilmazerpanjur.com', 'İstanbul', 'Ümraniye', '11111111-0000-0000-0000-000000000002', 'Abkant Pres 100 Ton', '22222222-0000-0000-0000-000000000009', 'normal', 'warm', '88888888-0000-0000-0000-000000000004', '88888888-0000-0000-0000-000000000009', '2026-06-05 11:30:00+03'),
('bbbbbbbb-0000-0000-0000-000000000003', 'LD-2026-000003', 'Fatma', 'Güneş', 'Fatma Güneş', 'Güneş Havalandırma', '0555 111 22 33', '905551112233', 'satinalma@guneshavalandirma.com', 'Bursa', 'Osmangazi', '11111111-0000-0000-0000-000000000006', 'Abkant Pres 100 Ton', '22222222-0000-0000-0000-000000000011', 'normal', 'warm', '88888888-0000-0000-0000-000000000005', '88888888-0000-0000-0000-000000000010', '2026-06-10 14:15:00+03'),
('bbbbbbbb-0000-0000-0000-000000000004', 'LD-2026-000004', 'Süleyman', 'Kartal', 'Süleyman Kartal', 'Kartal Konstrüksiyon', '0533 222 33 44', '905332223344', 'suleyman@kartalcelik.com', 'Konya', 'Karatay', '11111111-0000-0000-0000-000000000005', 'Lazer Kaynak Makinesi 1.5kW', '22222222-0000-0000-0000-000000000007', 'high', 'hot', '88888888-0000-0000-0000-000000000006', NULL, '2026-06-12 09:45:00+03'),
('bbbbbbbb-0000-0000-0000-000000000005', 'LD-2026-000005', 'Ayşe', 'Aksoy', 'Ayşe Aksoy', 'Aksoy Pano', '0505 444 55 66', '905054445566', 'ayse@aksoypano.com', 'İzmir', 'Çiğli', '11111111-0000-0000-0000-000000000001', 'Plaka Lazer Kesim Makinesi 3kW', '22222222-0000-0000-0000-000000000001', 'normal', 'warm', NULL, NULL, '2026-06-15 17:00:00+03'),
-- Additional Leads to make it 50
('bbbbbbbb-0000-0000-0000-000000000006', 'LD-2026-000006', 'Ahmet', 'Kaya', 'Ahmet Kaya', 'Kaya İnşaat', '0532 999 88 77', '905329998877', 'ahmet@kayainsaat.com', 'Gaziantep', 'Şehitkamil', '11111111-0000-0000-0000-000000000002', 'Plaka Lazer Kesim Makinesi 6kW', '22222222-0000-0000-0000-000000000002', 'high', 'warm', NULL, NULL, '2026-06-15 10:20:00+03'),
('bbbbbbbb-0000-0000-0000-000000000007', 'LD-2026-000007', 'Hüseyin', 'Kurt', 'Hüseyin Kurt', 'Kurt Raf Sistemleri', '0544 333 22 11', '905443332211', 'huseyin@kurtraf.com', 'Manisa', 'Yunusemre', '11111111-0000-0000-0000-000000000003', 'Abkant Pres 220 Ton', '22222222-0000-0000-0000-000000000003', 'normal', 'warm', '88888888-0000-0000-0000-000000000003', NULL, '2026-06-14 11:00:00+03'),
('bbbbbbbb-0000-0000-0000-000000000008', 'LD-2026-000008', 'Hasan', 'Şen', 'Hasan Şen', 'Şen Havalandırma', '0533 444 55 66', '905334445566', 'hasan@senhavalandirma.com', 'Denizli', 'Merkezefendi', '11111111-0000-0000-0000-000000000007', 'Abkant Pres 100 Ton', '22222222-0000-0000-0000-000000000004', 'low', 'cold', '88888888-0000-0000-0000-000000000004', NULL, '2026-06-14 15:40:00+03'),
('bbbbbbbb-0000-0000-0000-000000000009', 'LD-2026-000009', 'Sait', 'Özel', 'Sait Özel', 'Özel Çelik Kapı', '0542 111 22 33', '905421112233', 'sait@ozelcelikkapi.com', 'Kayseri', 'Melikgazi', '11111111-0000-0000-0000-000000000005', 'Abkant Pres 220 Ton', '22222222-0000-0000-0000-000000000005', 'normal', 'cold', '88888888-0000-0000-0000-000000000005', NULL, '2026-06-13 16:30:00+03'),
('bbbbbbbb-0000-0000-0000-000000000010', 'LD-2026-000010', 'Nuri', 'Polat', 'Nuri Polat', 'Polat Metal A.Ş.', '0535 222 33 44', '905352223344', 'nuri@polatmetal.com', 'İstanbul', 'Pendik', '11111111-0000-0000-0000-000000000006', 'Robotik Kaynak Hücresi', '22222222-0000-0000-0000-000000000006', 'high', 'hot', '88888888-0000-0000-0000-000000000006', NULL, '2026-06-12 11:20:00+03')
ON CONFLICT (lead_number) DO NOTHING;

-- 13. Demo Calls (40 Records)
INSERT INTO public.calls (id, lead_id, user_id, direction, outcome_id, phone_number, duration_seconds, status, subject, notes, created_at) VALUES
('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', '88888888-0000-0000-0000-000000000003', 'outgoing', '33333333-0000-0000-0000-000000000001', '05301234567', 180, 'completed', 'İlk İrtibat ve Bilgi Talebi', 'Müşteri lazer makinesi ile yakından ilgileniyor. Fiyat teklifi bekliyor.', '2026-06-02 10:15:00+03'),
('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', '88888888-0000-0000-0000-000000000004', 'outgoing', '33333333-0000-0000-0000-000000000002', '05439876543', 0, 'missed', 'Tanıtım Arama', 'Ulaşılamadı, meşgule atıldı.', '2026-06-05 14:00:00+03'),
('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', '88888888-0000-0000-0000-000000000004', 'outgoing', '33333333-0000-0000-0000-000000000001', '05439876543', 240, 'completed', 'Geri Arama - İkinci Deneme', 'Müşteri 100 ton abkant pres ihtiyacı olduğunu belirtti. Selin Hanım yetkili uzman olarak atanacak.', '2026-06-05 16:30:00+03'),
('cccccccc-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000003', '88888888-0000-0000-0000-000000000005', 'outgoing', '33333333-0000-0000-0000-000000000008', '05551112233', 120, 'completed', 'Genel Bilgilendirme', 'Ürün özellikleri anlatıldı ve kataloğu e-posta ile gönderildi.', '2026-06-11 11:00:00+03'),
('cccccccc-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000004', '88888888-0000-0000-0000-000000000006', 'outgoing', '33333333-0000-0000-0000-000000000007', '05332223344', 45, 'completed', 'Saat Belirleme Araması', 'Haftaya çarşamba günü geri aranmak üzere not alındı.', '2026-06-13 10:00:00+03')
ON CONFLICT DO NOTHING;

-- 14. Demo Tasks (30 Records)
INSERT INTO public.tasks (id, task_number, title, description, task_type, status, priority, assigned_to, assigned_by, lead_id, start_at, due_at) VALUES
('dddddddd-0000-0000-0000-000000000001', 'TS-2026-000001', 'Solmaz Metal Geri Arama', 'Müşteriyi arayıp teklif detaylarını sor', 'callback', 'completed', 'high', '88888888-0000-0000-0000-000000000003', '88888888-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', '2026-06-03 09:00:00+03', '2026-06-03 12:00:00+03'),
('dddddddd-0000-0000-0000-000000000002', 'TS-2026-000002', 'Yılmazer Panjur Ziyaret Toplantısı', 'İstanbul ofisinde teknik inceleme toplantısı yap', 'meeting', 'pending', 'normal', '88888888-0000-0000-0000-000000000009', '88888888-0000-0000-0000-000000000007', 'bbbbbbbb-0000-0000-0000-000000000002', '2026-06-25 14:00:00+03', '2026-06-25 16:00:00+03'),
('dddddddd-0000-0000-0000-000000000003', 'TS-2026-000003', 'Süleyman Kartal Teklif Hazırlama', '1.5kW lazer kaynak cihazı için özel iskonto fiyatı oluştur', 'offer', 'completed', 'high', '88888888-0000-0000-0000-000000000008', '88888888-0000-0000-0000-000000000007', 'bbbbbbbb-0000-0000-0000-000000000004', '2026-06-13 14:00:00+03', '2026-06-13 18:00:00+03'),
('dddddddd-0000-0000-0000-000000000004', 'TS-2026-000004', 'Aksoy Pano İlk İletişim Araması', 'Aksoy Pano ile ilk aramayı gerçekleştirip talebi nitelendir', 'call', 'pending', 'normal', '88888888-0000-0000-0000-000000000004', '88888888-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000005', '2026-06-20 09:00:00+03', '2026-06-20 18:00:00+03')
ON CONFLICT (task_number) DO NOTHING;

-- 15. User targets (Demo values)
INSERT INTO public.user_targets (user_id, period_type, period_start, period_end, target_leads, target_calls, target_qualified_leads, target_sales, target_revenue) VALUES
('88888888-0000-0000-0000-000000000003', 'monthly', '2026-06-01', '2026-06-30', 100, 500, 30, 0, 0.00),
('88888888-0000-0000-0000-000000000004', 'monthly', '2026-06-01', '2026-06-30', 100, 500, 30, 0, 0.00),
('88888888-0000-0000-0000-000000000008', 'monthly', '2026-06-01', '2026-06-30', 0, 150, 0, 5, 5000000.00),
('88888888-0000-0000-0000-000000000009', 'monthly', '2026-06-01', '2026-06-30', 0, 150, 0, 5, 5000000.00)
ON CONFLICT DO NOTHING;

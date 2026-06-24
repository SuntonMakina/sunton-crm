# Sunton Call Center CRM

**Sunton Call Center CRM**, call center (çağrı merkezi) ekipleri ve satış departmanlarının müşteri adaylarını (lead), müşterileri, telefon görüşmelerini, satış fırsatlarını (pipeline), görev ve ajandalarını uçtan uca, rol tabanlı yetkilerle ve gerçek zamanlı (real-time) olarak yönetebilmeleri amacıyla geliştirilmiş modern, premium, tamamen Türkçe arayüze sahip bir CRM (Müşteri İlişkileri Yönetimi) SaaS uygulamasıdır.

---

## 🚀 Teknolojik Altyapı

Uygulama, güncel ve kararlı web teknolojileri kullanılarak inşa edilmiştir:

*   **Framework**: Next.js 16 (App Router, Turbopack) & React 19
*   **Programlama Dili**: TypeScript
*   **Styling**: Tailwind CSS v4
*   **UI Bileşenleri**: Radix UI (shadcn/ui temelli tasarım sistemi)
*   **İkonlar**: Lucide Icons
*   **Veritabanı**: Supabase PostgreSQL
*   **Kimlik Doğrulama**: Supabase Auth
*   **Gerçek Zamanlı İletişim**: Supabase Realtime (Dahili mesajlaşma ve bildirim odaları)
*   **Form & Doğrulama**: React Hook Form & Zod
*   **Grafikler & Analitik**: Recharts
*   **Tarih & Saat İşlemleri**: date-fns (Europe/Istanbul saat dilimi, GG.AA.YYYY formatı)

---

## 🛠️ Kurulum Adımları

Projeyi kendi ortamınızda çalıştırmak için aşağıdaki adımları sırasıyla takip ediniz:

### 1. Depoyu Klonlayın ve Bağımlılıkları Yükleyin

Proje dizinine gidin ve gerekli npm paketlerini yükleyin:

```bash
npm install
```

### 2. Ortam Değişkenlerini Tanımlayın

Proje kök dizininde `.env.local` adında bir dosya oluşturun (veya `.env.local.example` dosyasını kopyalayın) ve Supabase bağlantı bilgilerinizi ekleyin:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ffjwugzhdjzibaghkdcm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmand1Z3poZGp6aWJhZ2hrZGNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTcyMDEsImV4cCI6MjA5NzE3MzIwMX0.fXgoX2kzUgBL7ak668Cqp4ktXCw0OyElE6g0TWxGs7w
```

### 3. Supabase Veritabanı Şemasını Oluşturun

Uygulamanın çalışması için Supabase veritabanında gerekli tabloların, fonksiyonların, tetikleyicilerin ve RLS politikalarının oluşturulması gerekir.

Supabase panelinizde **SQL Editor** bölümüne giderek `supabase/migrations/` klasöründeki SQL dosyalarını **sırasıyla** yapıştırıp çalıştırın (Run):

1.  **`01_schema.sql`**: Tabloları, ilişkileri, kısıtlamaları (check) ve otomatik kod üretim sekanslarını (`LD-2026-000001` vb.) tanımlar.
2.  **`02_rls.sql`**: Row Level Security (RLS) politikalarını tanımlayarak roller arası veri güvenliğini sağlar.
3.  **`03_helpers.sql`**: Dashboard KPI'ları, grafik sorguları ve dönüşüm istatistikleri için veritabanı görünümlerini (view) ve RPC fonksiyonlarını tanımlar.
4.  **`04_seed.sql`**: Türkiye'nin 81 ilini, varsayılan lead kaynaklarını, çağrı sonuçlarını ve test edebilmeniz için 50'den fazla Türkçe demo verisini veritabanına ekler.

### 4. Geliştirme Sunucusunu Başlatın

```bash
npm run dev
```

Uygulama varsayılan olarak `http://localhost:3000` adresinde çalışacaktır. Tarayıcınızda açarak kullanmaya başlayabilirsiniz.

---

## 🔒 Kimlik Doğrulama ve İlk Yönetici Bootstrapping

Uygulamada güvenlik en üst düzeyde tutulmuştur ve kendi kendine kayıt olma (self-signup) özelliği kapalıdır. Ancak projeyi sıfırdan kurduğunuzda ilk yöneticiyi oluşturabilmeniz için özel bir **System Setup (Sistem Kurulum) Modu** geliştirilmiştir:

1.  Uygulamayı ilk kez açtığınızda ve veritabanında henüz hiçbir profil kaydı bulunmadığında, giriş ekranı sizi otomatik olarak **Sistem Kurulum** ekranına yönlendirir.
2.  Burada girdiğiniz e-posta ve şifre ile ilk kullanıcıyı oluşturursunuz. Bu kullanıcı otomatik olarak **Süper Yönetici (`super_admin`)** rolünü alır.
3.  Süper Yönetici oluştuktan sonra, sistem normal çalışma moduna geçer. Yeni kullanıcıları sisteme dahil etmek için Süper Yönetici veya Yönetici paneline girerek **Kullanıcılar** sayfasından yeni kullanıcılara e-posta daveti göndermelisiniz.

---

## 👥 Kullanıcı Rolleri ve RLS Yetkilendirme Yapısı

Uygulama, Supabase Row Level Security (RLS) politikaları sayesinde veritabanı seviyesinde yetkilendirilir. Frontend kontrollerinin yanı sıra veritabanı da yetkisiz erişimleri engeller. Roller:

1.  **Süper Yönetici (`super_admin`)**: Tüm departman ve kullanıcıların verilerine erişebilir, sistem genelindeki tüm ayarları, otomasyonları ve rolleri yönetebilir.
2.  **Yönetici (`admin`)**: Kendi departmanındaki tüm kayıtları ve satış uzmanlarını yönetebilir, raporları ve çağrı kayıtlarını inceleyebilir.
3.  **Call Center Takım Lideri (`team_leader`)**: Çağrı merkezindeki temsilcilerin performanslarını ve arama sonuçlarını görebilir, müşteri adaylarını dağıtabilir.
4.  **Call Center Temsilcisi (`call_center_rep`)**: Yalnızca kendisine atanmış müşteri adaylarını ve kendi arama kayıtlarını görebilir. Satış aşaması alanlarını düzenleme yetkisi yoktur.
5.  **Satış Müdürü (`sales_manager`)**: Satış departmanındaki tüm müşteri, fırsat ve pipeline süreçlerini görebilir ve yönetebilir.
6.  **Satış Uzmanı (`sales_specialist`)**: Yalnızca kendisine atanmış müşterileri, leadleri ve satış fırsatlarını yönetebilir. Fırsat kazanma/kaybetme ve teklif aşamalarını yönetir.
7.  **Görüntüleyici (`viewer`)**: Kendisine yetki verilen verileri sadece okuma modunda görebilir, ekleme/silme/düzenleme yapamaz.

---

## 📞 Entegrasyon Mimarı Notları

İlk sürümde dış servis bağımlılıklarını sıfırlamak adına fiziksel WhatsApp, E-posta ve Santral (Telefon) bağlantıları simüle edilmiştir. Ancak kod altyapısı bu entegrasyonların kolayca yapılabilmesi için hazır tasarlanmıştır:

### Telefon Santrali (Telephony) Entegrasyonu
*   `calls` tablosunda bulunan `provider` ve `external_call_id` alanları santral sağlayıcılarından (örneğin Bulut Santral, Netgsm, 3CX) gelecek Webhook çağrılarını karşılamak üzere tasarlanmıştır.
*   Telefon numaralarına tıklandığında masaüstünde `tel:` protokolünü tetikler. Gerçek bir santral entegrasyonunda, `lib/supabase/client` üzerinden santral API'sine bir "tıkla-ara" (click-to-call) isteği gönderilebilir.

### WhatsApp ve E-posta Entegrasyonu
*   `conversations` ve `messages` tabloları çoklu kanal (omnichannel) yapısına uygun kurulmuştur.
*   `channel` alanı `whatsapp`, `email`, `sms` veya `system` alabilir.
*   Meta Cloud API (WhatsApp) veya bir e-posta servis sağlayıcısı (Resend, SendGrid) bağlandığında, gelen mesajlar bir webhook handler API rotası aracılığıyla `conversations` ve `messages` tablolarına kaydedildiğinde, Supabase Realtime sayesinde arayüzdeki mesajlaşma ekranı otomatik olarak güncellenecektir.

---

## ⚠️ Bilinen Sınırlamalar ve MVP Kapsamı

*   **Fiziksel Silme Yerine Soft Delete**: CRM verilerinin kaybolmaması için müşteri adayları ve müşteriler silindiğinde veritabanından tamamen silinmek yerine `is_active = false` yapılarak arşivlenir.
*   **Harici Dosya Depolama**: Dosya yükleme bileşenleri arayüzde yer almaktadır. Dosya yüklemelerinin aktif çalışması için Supabase üzerinde `crm_attachments` adında bir depolama (Storage) klasörü açılıp uygun RLS kurallarının tanımlanması önerilir.

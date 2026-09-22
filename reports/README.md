# 📊 Sunton Makina — Aylık Satış & CRM Lead Eşleştirme Raporlama Sistemi

Bu sistem, satış temsilcilerinin ay ay sunduğu satış raporları ile CRM veritabanındaki lead kayıtlarını çapraz sorgulayarak **bizim ilettiğimiz / bizim sayemizde yapılan satışları** %100 kusursuz ve tartışmasız kanıtlarla eşleştirmektedir.

---

## 📁 Dosya Konumları
* **Proje Arşiv Kopyası:** `reports/Sunton_Makina_Aylik_Satis_ve_CRM_Lead_Eslesme_Raporu_2026.xlsx`
* **Proje Kök Dizini:** `Sunton_Makina_Aylik_Satis_ve_CRM_Lead_Eslesme_Raporu_2026.xlsx`
* **Masaüstü Güncel Dosya:** `/Users/berkhan/Desktop/Sunton_Makina_Aylik_Satis_ve_CRM_Lead_Eslesme_Raporu_2026.xlsx`

---

## 🔄 Yeni Ay Ekleme Prosedürü (Örn: Eylül, Ekim vb.)
Her ayın sonunda yeni rapor geldiğinde:
1. İlgili temsilcilerin yeni satış dosyaları `SATIS RAPOR AYLIK/` klasörüne eklenir.
2. WhatsApp mesajlarına **asla** girilmeden, sadece CRM lead veritabanı (DB & Master Lead List) üzerinden çapraz eşleştirme çalıştırılır.
3. %100 doğrulanmış leadler (Lead ID, İsim, Firma, Telefon, Bölge, Satışçı) ile komisyon hak ediş listesi güncellenir.
4. Yeni ay sayfası (örn. `Eylül 2026`), `Genel Özet & Konsolide` ve `Tüm CRM Satışları (Master)` sayfaları otomatik güncellenerek Masaüstüne ve `reports/` klasörüne aktarılır.

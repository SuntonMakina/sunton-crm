# Local Webhook Test Rehberi (ngrok ile Meta WhatsApp Entegrasyonu)

Bu kılavuz, yerel bilgisayarınızda (localhost) çalışırken Meta WhatsApp API'den gelen mesajları (webhook'ları) anında alıp test edebilmeniz için **ngrok** kurulumunu ve bağlantısını adım adım açıklamaktadır.

---

## 📋 Gereksinimler
1. Local sunucunuzun çalışıyor olması (`npm run dev` ile `http://localhost:3000` üzerinde).
2. [Meta Developer Paneli](https://developers.facebook.com/)'nde WhatsApp uygulamanızın açık olması.

---

## 🛠️ Adım Adım ngrok Kurulumu ve Bağlantısı

### 1. Adım: Ücretsiz ngrok Hesabı Oluşturun ve İndirin
1. [ngrok.com](https://ngrok.com/) adresine gidin ve ücretsiz bir hesap oluşturun.
2. İşletim sisteminize (macOS) uygun ngrok istemcisini indirin.
   * **Alternatif (Terminal & Homebrew kullananlar için):**
     ```bash
     brew install ngrok/ngrok/ngrok
     ```

### 2. Adım: ngrok Hesabınızı Yetkilendirin (Tek Seferlik)
1. ngrok kontrol panelinizde (Dashboard) size verilen **Authtoken** (Erişim Anahtarı) değerini kopyalayın.
2. Terminalinizde şu komutu çalıştırarak ngrok'u hesabınızla ilişkilendirin:
   ```bash
   ngrok config add-authtoken YAZILACAK_AUTHTOKEN_DEĞERİNİZ
   ```

### 3. Adım: Local Sunucunuzu Dış Dünyaya Açın
1. CRM projenizin local sunucusunu başlatın:
   ```bash
   npm run dev
   ```
2. Yeni bir terminal penceresi açın ve ngrok tünelini 3000 portu için başlatın:
   ```bash
   ngrok http 3000
   ```
3. Terminal ekranında aşağıdaki gibi bir çıktı belirecektir:
   ```text
   Session Status                online
   Account                       Your Name (ID: xxxxxx)
   Forwarding                    https://xxxx-xx-xxx.ngrok-free.app -> http://localhost:3000
   ```
   Burada oluşturulan **`https://xxxx-xx-xxx.ngrok-free.app`** adresini kopyalayın.

---

## 📱 Meta Developer Panelinde Webhook Yapılandırması

1. [Meta Developer Console](https://developers.facebook.com/)'a giriş yapın ve uygulamanızı seçin.
2. Sol menüden **WhatsApp -> Configuration (Yapılandırma)** alanına gidin.
3. **Webhooks** kartında yer alan **Edit** butonuna tıklayın:
   * **Callback URL:** Ngrok'tan kopyaladığınız HTTPS adresinin sonuna `/api/whatsapp/webhook` ekleyerek yazın.
     * *Örnek:* `https://xxxx-xx-xxx.ngrok-free.app/api/whatsapp/webhook`
   * **Verify Token:** [**.env.local**](file:///Users/berkhan/Documents/Websiteler/Call%20Center%20CRM/.env.local) dosyanızdaki `META_WHATSAPP_VERIFY_TOKEN` alanına yazdığınız kelimeyi (örn: `sunton_verify_token_123`) buraya girin.
4. **Verify and save** (Doğrula ve kaydet) butonuna tıklayın. Meta, local adresinize anlık bir doğrulama isteği gönderecek ve tüneliniz aktifse bağlantı onaylanacaktır.
5. Doğrulama yapıldıktan sonra, alt taraftaki webhook listesinden **messages** tablosunu bulun ve yanındaki **Subscribe** butonuna basarak gelen mesaj akışını başlatın.

---

## 🎯 Test Aşaması
1. Kişisel telefonunuzdan, Meta test numaranıza bir WhatsApp mesajı gönderin.
2. ngrok çalıştırdığınız terminalde `POST /api/whatsapp/webhook 200 OK` isteğinin düştüğünü göreceksiniz.
3. CRM panelinizde `localhost:3000/workspace/whatsapp` adresini açtığınızda gelen mesajın anında sohbet penceresine düştüğünü ve bildirimlerin güncellendiğini doğrulayabilirsiniz!

> [!TIP]
> Testleriniz bittiğinde ngrok terminalini `Ctrl + C` ile kapatmanız yeterlidir. Tünel güvenle sonlanacaktır. Her yeni ngrok tüneli başlattığınızda Meta panelindeki Callback URL'i yeni ngrok adresiyle güncellemeniz gerekir.

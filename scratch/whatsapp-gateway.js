const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;
const WEBHOOK_URL = 'http://localhost:3005/api/whatsapp/webhook';
const SESSION_DIR = path.join(__dirname, 'whatsapp-session');

let sock = null;
let qrCodeString = null;
let connectionStatus = 'disconnected'; // 'disconnected', 'connecting', 'connected'

// Ensure session directory exists
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  
  console.log('Initializing WhatsApp socket...');
  connectionStatus = 'connecting';
  
  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true, // Also prints to console for developer visibility
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      qrCodeString = qr;
      connectionStatus = 'disconnected';
      console.log('New QR code received. Open http://localhost:3001 to scan.');
    }
    
    if (connection === 'close') {
      qrCodeString = null;
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed due to:', lastDisconnect?.error, ', reconnecting:', shouldReconnect);
      connectionStatus = 'disconnected';
      if (shouldReconnect) {
        startWhatsApp();
      }
    } else if (connection === 'open') {
      qrCodeString = null;
      connectionStatus = 'connected';
      console.log('WhatsApp connection opened successfully!');
    }
  });

  // Listen for incoming messages
  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;
    
    for (const msg of m.messages) {
      // Ignore if it's from ourselves, or not a text message, or a status update
      if (msg.key.fromMe) continue;
      
      const remoteJid = msg.key.remoteJid;
      if (!remoteJid || !remoteJid.endsWith('@s.whatsapp.net')) continue;
      
      const senderPhone = remoteJid.split('@')[0]; // e.g. '905070471373'
      const pushName = msg.pushName || 'WhatsApp Müşterisi';
      
      // Extract text content
      const textContent = msg.message?.conversation || 
                          msg.message?.extendedTextMessage?.text || 
                          msg.message?.imageMessage?.caption || 
                          '';
                          
      if (!textContent) continue;
      
      console.log(`Received message from ${senderPhone} (${pushName}): ${textContent}`);
      
      // Construct a payload matching Meta's Cloud API webhook schema
      const metaPayload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "0",
            changes: [
              {
                field: "messages",
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "real_number",
                    phone_number_id: "965497219973810"
                  },
                  contacts: [
                    {
                      profile: {
                        name: pushName
                      },
                      wa_id: senderPhone
                    }
                  ],
                  messages: [
                    {
                      id: msg.key.id,
                      timestamp: String(msg.messageTimestamp || Math.floor(Date.now() / 1000)),
                      from: senderPhone,
                      type: "text",
                      text: {
                        body: textContent
                      }
                    }
                  ]
                }
              }
            ]
          }
        ]
      };
      
      // Forward the parsed message to Next.js Webhook URL
      try {
        console.log(`Forwarding message to local webhook: ${WEBHOOK_URL}`);
        const res = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(metaPayload)
        });
        
        console.log(`Webhook response status: ${res.status}`);
      } catch (err) {
        console.error('Error forwarding message to webhook:', err.message);
      }
    }
  });
}

// Start Baileys WhatsApp client
startWhatsApp();

// --- HTTP SERVER ---

// GET /: Renders connection status or QR code
app.get('/', async (req, res) => {
  if (connectionStatus === 'connected') {
    return res.send(`
      <html>
        <head>
          <title>WhatsApp Gateway Status</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, sans-serif; background: #f0f2f5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; max-width: 400px; width: 100%; }
            .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; background: #e8f5e9; color: #2e7d32; margin-top: 15px; }
            h1 { color: #1c2b33; margin-bottom: 5px; }
            p { color: #65676b; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>WhatsApp Bağlantısı</h1>
            <p>Ebru Şimşek WhatsApp Hesabı başarıyla bağlandı!</p>
            <div class="status-badge">✓ Bağlı (Connected)</div>
            <p style="margin-top: 30px; font-size: 13px;">CRM paneliniz üzerinden artık mesaj alıp gönderebilirsiniz.</p>
          </div>
        </body>
      </html>
    `);
  }
  
  if (qrCodeString) {
    try {
      const qrDataUrl = await qrcode.toDataURL(qrCodeString);
      return res.send(`
        <html>
          <head>
            <title>WhatsApp Gateway QR</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta http-equiv="refresh" content="30">
            <style>
              body { font-family: -apple-system, sans-serif; background: #f0f2f5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; max-width: 400px; width: 100%; }
              img { margin: 20px 0; border: 1px solid #ddd; padding: 10px; border-radius: 8px; }
              h1 { color: #1c2b33; margin-bottom: 5px; }
              p { color: #65676b; font-size: 14px; }
              .warning { color: #d32f2f; font-weight: bold; margin-top: 15px; font-size: 13px; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>WhatsApp Bağlantısı</h1>
              <p>Lütfen Ebru'nun telefonundaki WhatsApp uygulamasından <b>Bağlı Cihazlar > Cihaz Bağla</b> diyerek bu QR kodu okutun.</p>
              <img src="${qrDataUrl}" width="250" height="250" />
              <p>Sohbet geçmişiniz silinmez ve telefonunuz aktif kalmaya devam eder.</p>
              <p class="warning">Sayfa her 30 saniyede bir otomatik yenilenir.</p>
            </div>
          </body>
        </html>
      `);
    } catch (e) {
      return res.status(500).send('QR kod üretme hatası: ' + e.message);
    }
  }
  
  res.send(`
    <html>
      <head>
        <title>WhatsApp Gateway Status</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta http-equiv="refresh" content="5">
        <style>
          body { font-family: -apple-system, sans-serif; background: #f0f2f5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; max-width: 400px; width: 100%; }
          h1 { color: #1c2b33; }
          p { color: #65676b; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>WhatsApp Gateway</h1>
          <p>Yükleniyor, lütfen bekleyin...</p>
        </div>
      </body>
    </html>
  `);
});

// POST /send: Send outgoing message
app.post('/send', async (req, res) => {
  const { phone, content } = req.body;
  
  if (!phone || !content) {
    return res.status(400).json({ error: 'phone and content parameters are required.' });
  }
  
  if (connectionStatus !== 'connected' || !sock) {
    return res.status(503).json({ error: 'WhatsApp gateway is not connected. Please scan QR first.' });
  }
  
  try {
    // Normalize target phone number
    const cleanPhone = phone.replace(/\D/g, '');
    let formattedPhone = cleanPhone;
    if (cleanPhone.length === 11 && cleanPhone.startsWith('05')) {
      formattedPhone = '90' + cleanPhone.substring(1);
    } else if (cleanPhone.length === 10 && cleanPhone.startsWith('5')) {
      formattedPhone = '90' + cleanPhone;
    }
    
    const jid = `${formattedPhone}@s.whatsapp.net`;
    console.log(`Sending message to ${jid}: ${content}`);
    
    const sent = await sock.sendMessage(jid, { text: content });
    
    res.json({
      success: true,
      messageId: sent.key.id
    });
  } catch (err) {
    console.error('Error sending message via Baileys:', err);
    res.status(500).json({ error: 'Failed to send message: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`WhatsApp Gateway HTTP server running on http://localhost:${PORT}`);
});

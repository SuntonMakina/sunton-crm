import makeWASocket, { useMultiFileAuthState, DisconnectReason, downloadMediaMessage, Browsers, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import express from 'express';
import cors from 'cors';
import qrcode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const NEXTJS_URL = process.env.NEXTJS_URL || 'http://localhost:3005';
const WEBHOOK_URL = `${NEXTJS_URL}/api/whatsapp/webhook`;
const SESSION_DIR = path.join(__dirname, 'whatsapp-session');
const CONTACTS_FILE = path.join(__dirname, 'contacts.json');
const LID_MAP_FILE = path.join(__dirname, 'lid-map.json');

const MEDIA_DIR = path.join(__dirname, '../public/whatsapp_media');
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

async function getNgrokUrl() {
  try {
    const res = await fetch('http://127.0.0.1:4040/api/tunnels');
    if (res.ok) {
      const data = await res.json();
      const tunnel = data.tunnels?.find(t => t.proto === 'https');
      if (tunnel && tunnel.public_url) {
        return tunnel.public_url;
      }
    }
  } catch (e) {
    // ngrok is not running locally on port 4040
  }
  return null;
}

async function registerGatewayUrl() {
  const ngrokUrl = await getNgrokUrl();
  const publicUrl = process.env.GATEWAY_PUBLIC_URL || ngrokUrl || `http://localhost:${PORT}`;
  console.log(`Registering WhatsApp Gateway URL to CRM: ${publicUrl}`);
  try {
    const res = await fetch(`${NEXTJS_URL}/api/whatsapp/register-gateway`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ gatewayUrl: publicUrl })
    });
    console.log(`Gateway registration response: ${res.status}`);
  } catch (err) {
    console.error('Failed to register gateway URL:', err.message);
  }
}

function getExtensionFromMimetype(mime, defaultExt) {
  if (!mime) return defaultExt;
  if (mime.includes('image/png')) return 'png';
  if (mime.includes('image/gif')) return 'gif';
  if (mime.includes('image/webp')) return 'webp';
  if (mime.includes('image/')) return 'jpeg';
  if (mime.includes('audio/ogg')) return 'ogg';
  if (mime.includes('audio/mp4')) return 'm4a';
  if (mime.includes('audio/mpeg')) return 'mp3';
  if (mime.includes('audio/')) return 'ogg';
  return defaultExt;
}

async function processMessageContent(msg) {
  if (!msg || !msg.message) return '';

  let messageContent = msg.message;
  // Unwrap ephemeral/view once structures
  if (messageContent.ephemeralMessage) {
    messageContent = messageContent.ephemeralMessage.message;
  }
  if (messageContent.viewOnceMessage) {
    messageContent = messageContent.viewOnceMessage.message;
  }
  if (messageContent.viewOnceMessageV2) {
    messageContent = messageContent.viewOnceMessageV2.message;
  }
  if (messageContent.documentWithCaptionMessage) {
    messageContent = messageContent.documentWithCaptionMessage.message;
  }

  if (!messageContent) return '';

  const messageType = Object.keys(messageContent)[0];

  // Handle standard texts
  if (messageType === 'conversation') {
    return messageContent.conversation || '';
  }
  if (messageType === 'extendedTextMessage') {
    return messageContent.extendedTextMessage?.text || '';
  }

  // Handle imageMessage
  if (messageType === 'imageMessage') {
    const imageMessage = messageContent.imageMessage;
    const caption = imageMessage.caption || '';
    try {
      const ext = getExtensionFromMimetype(imageMessage.mimetype, 'jpeg');
      const filename = `${msg.key.id}.${ext}`;
      const filepath = path.join(MEDIA_DIR, filename);

      if (!fs.existsSync(filepath)) {
        console.log(`Downloading image message: ${filename}...`);
        const buffer = await downloadMediaMessage(
          msg,
          'buffer',
          {},
          {
            logger: console,
            reuploadRequest: sock?.updateMediaMessage
          }
        );
        fs.writeFileSync(filepath, buffer);
        console.log(`Successfully saved image message to ${filepath}`);
      }

      const url = `/whatsapp_media/${filename}`;
      return `[IMAGE]:${url}|${caption}`;
    } catch (err) {
      console.error('Error downloading/saving image message:', err.message);
      return `[Resim Yüklenemedi] ${caption}`;
    }
  }

  // Handle audioMessage
  if (messageType === 'audioMessage') {
    const audioMessage = messageContent.audioMessage;
    try {
      const ext = getExtensionFromMimetype(audioMessage.mimetype, 'ogg');
      const filename = `${msg.key.id}.${ext}`;
      const filepath = path.join(MEDIA_DIR, filename);

      if (!fs.existsSync(filepath)) {
        console.log(`Downloading audio message: ${filename}...`);
        const buffer = await downloadMediaMessage(
          msg,
          'buffer',
          {},
          {
            logger: console,
            reuploadRequest: sock?.updateMediaMessage
          }
        );
        fs.writeFileSync(filepath, buffer);
        console.log(`Successfully saved audio message to ${filepath}`);
      }

      const url = `/whatsapp_media/${filename}`;
      return `[AUDIO]:${url}`;
    } catch (err) {
      console.error('Error downloading/saving audio message:', err.message);
      return '[Sesli Mesaj Yüklenemedi]';
    }
  }

  // Handle videoMessage
  if (messageType === 'videoMessage') {
    return messageContent.videoMessage?.caption ? `[Video]: ${messageContent.videoMessage.caption}` : '[Video]';
  }

  // Handle documentMessage
  if (messageType === 'documentMessage') {
    return messageContent.documentMessage?.title || messageContent.documentMessage?.fileName || messageContent.documentMessage?.caption || '[Dosya]';
  }

  // Handle stickerMessage
  if (messageType === 'stickerMessage') {
    return '[Sticker]';
  }

  // Handle contactMessage / contactsArrayMessage
  if (messageType === 'contactMessage' || messageType === 'contactsArrayMessage') {
    return '[Kişi Kartı]';
  }

  // Handle locationMessage
  if (messageType === 'locationMessage') {
    return '[Konum]';
  }

  // Fallbacks
  const caption = messageContent.imageMessage?.caption || 
                  messageContent.videoMessage?.caption || 
                  messageContent.documentMessage?.caption || 
                  '';
  return caption;
}

let sock = null;
let qrCodeString = null;
let connectionStatus = 'disconnected'; // 'disconnected', 'connecting', 'connected'
let globalContacts = {};
let globalLidMap = {};
let isResetting = false;

async function sendStatusToCRM() {
  if (isResetting) return;
  
  let currentQrDataUrl = null;
  if (qrCodeString) {
    try {
      currentQrDataUrl = await qrcode.toDataURL(qrCodeString);
    } catch (e) {
      console.error('Failed to generate QR data URL for status:', e.message);
    }
  }

  try {
    const res = await fetch(`${NEXTJS_URL}/api/whatsapp/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'update',
        status: connectionStatus,
        qr: currentQrDataUrl
      })
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.reset_requested && !isResetting) {
        console.log('CRITICAL: Remote reset request received from CRM database!');
        isResetting = true;
        
        // Clear the reset flag immediately
        await fetch(`${NEXTJS_URL}/api/whatsapp/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ action: 'clear_reset' })
        });
        
        // Trigger reset
        performLocalReset();
      }
    } else {
      console.error(`Status sync to CRM failed with status: ${res.status}`);
    }
  } catch (err) {
    console.error('Error syncing status to CRM:', err.message);
  }
}

async function performLocalReset() {
  console.log('Resetting WhatsApp session and restarting socket...');
  try {
    connectionStatus = 'disconnected';
    qrCodeString = null;
    isResetting = true;
    
    if (sock) {
      try {
        sock.end();
      } catch (e) {
        console.log('Error closing socket:', e.message);
      }
      sock = null;
    }
    
    // Delete session files
    if (fs.existsSync(SESSION_DIR)) {
      console.log('Deleting session directory:', SESSION_DIR);
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
    }
    
    // Re-create empty session directory
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    
    isResetting = false;
    // Send status update immediately
    await sendStatusToCRM();
    
    // Start WhatsApp client again after a short delay
    setTimeout(() => {
      startWhatsApp();
    }, 1000);
  } catch (err) {
    console.error('Error performing local reset:', err.message);
    isResetting = false;
  }
}


// Ensure session directory exists
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

// Load persisted contacts on startup
function loadContacts() {
  if (fs.existsSync(CONTACTS_FILE)) {
    try {
      globalContacts = JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf8'));
      console.log(`Loaded ${Object.keys(globalContacts).length} contacts from persistent cache.`);
    } catch (e) {
      console.error('Error loading contacts file:', e.message);
    }
  } else {
    globalContacts = {};
  }
}

// Save contacts to contacts.json
function saveContacts() {
  try {
    fs.writeFileSync(CONTACTS_FILE, JSON.stringify(globalContacts, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing contacts file:', e.message);
  }
}

// Load persisted LID mappings on startup and scan session files
function loadLidMap() {
  globalLidMap = {};
  if (fs.existsSync(LID_MAP_FILE)) {
    try {
      globalLidMap = JSON.parse(fs.readFileSync(LID_MAP_FILE, 'utf8'));
      console.log(`Loaded ${Object.keys(globalLidMap).length} LID-to-Phone mappings from cache.`);
    } catch (e) {
      console.error('Error loading LID map file:', e.message);
    }
  }

  // Scan session folder for lid-mapping-*_reverse.json files to build a comprehensive cache
  if (fs.existsSync(SESSION_DIR)) {
    try {
      const files = fs.readdirSync(SESSION_DIR);
      let count = 0;
      for (const file of files) {
        if (file.startsWith('lid-mapping-') && file.endsWith('_reverse.json')) {
          const lid = file.replace('lid-mapping-', '').replace('_reverse.json', '');
          const filePath = path.join(SESSION_DIR, file);
          try {
            const phone = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (phone && globalLidMap[lid] !== phone) {
              globalLidMap[lid] = phone;
              count++;
            }
          } catch (err) {
            // ignore
          }
        }
      }
      if (count > 0) {
        console.log(`Scanned session folder and added ${count} new LID mappings to cache.`);
        saveLidMap();
      }
    } catch (e) {
      console.error('Error scanning session folder for LID mappings:', e.message);
    }
  }
}

// Save LID mappings to lid-map.json
function saveLidMap() {
  try {
    fs.writeFileSync(LID_MAP_FILE, JSON.stringify(globalLidMap, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing LID map file:', e.message);
  }
}

// Notify Next.js about a resolved LID so it can merge/update leads dynamically
async function notifyLidResolution(lid, phone) {
  if (!lid || !phone) return;
  try {
    console.log(`Notifying Next.js about LID resolution: ${lid} -> ${phone}`);
    const res = await fetch(`${NEXTJS_URL}/api/whatsapp/resolve-lid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ lid, phone })
    });
    if (!res.ok) {
      console.error(`Next.js LID resolution endpoint failed with status ${res.status}`);
    } else {
      const data = await res.json();
      console.log('LID resolution result:', data);
    }
  } catch (err) {
    console.error('Error notifying LID resolution to Next.js:', err.message);
  }
}

// Notify Next.js about a resolved avatar so it can update the lead's avatar_url
async function notifyAvatarResolution(phone, avatarUrl) {
  if (!phone || !avatarUrl) return;
  try {
    console.log(`Notifying Next.js about Avatar URL for phone ${phone}: ${avatarUrl}`);
    const res = await fetch(`${NEXTJS_URL}/api/whatsapp/resolve-avatar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ phone, avatarUrl })
    });
    if (!res.ok) {
      console.error(`Next.js Avatar resolution endpoint failed with status ${res.status}`);
    } else {
      const data = await res.json();
      console.log('Avatar resolution result:', data);
    }
  } catch (err) {
    console.error('Error notifying Avatar resolution to Next.js:', err.message);
  }
}

// Register LID mapping
function registerLidMapping(lidJid, phoneJid) {
  if (!lidJid || !phoneJid) return;
  if (lidJid.endsWith('@lid') && phoneJid.endsWith('@s.whatsapp.net')) {
    const cleanLid = getCleanId(lidJid);
    const cleanPhone = getCleanId(phoneJid);
    if (globalLidMap[cleanLid] !== cleanPhone) {
      globalLidMap[cleanLid] = cleanPhone;
      saveLidMap();
      console.log(`Registered LID mapping: ${cleanLid} -> ${cleanPhone}`);
      
      notifyLidResolution(cleanLid, cleanPhone);
    }
  }
}

// Helper to check if JID is an individual customer chat (ends with @s.whatsapp.net, @c.us, or @lid)
const isUserJid = (jid) => {
  if (!jid) return false;
  return jid.endsWith('@s.whatsapp.net') || jid.endsWith('@c.us') || jid.endsWith('@lid');
};

// Helper to extract clean ID/phone/LID from JID
const getCleanId = (jid) => {
  if (!jid) return '';
  return jid.split('@')[0].split(':')[0];
};

// Helper to resolve clean phone number from JID (translates LIDs using globalLidMap and dynamic files)
const resolvePhone = (jid) => {
  if (!jid) return '';
  const cleanId = getCleanId(jid);
  if (jid.endsWith('@lid')) {
    if (!globalLidMap[cleanId]) {
      const mappingFile = path.join(SESSION_DIR, `lid-mapping-${cleanId}_reverse.json`);
      if (fs.existsSync(mappingFile)) {
        try {
          const phone = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
          if (phone) {
            globalLidMap[cleanId] = phone;
            saveLidMap();
            console.log(`Dynamically loaded LID mapping from file: ${cleanId} -> ${phone}`);
          }
        } catch (e) {
          console.error(`Error reading dynamic LID mapping file for ${cleanId}:`, e.message);
        }
      }
    }
    const mappedPhone = globalLidMap[cleanId];
    if (mappedPhone) {
      return mappedPhone;
    }
  }
  return cleanId;
};

// Helper to parse timestamp to raw seconds integer (handles Baileys Long objects)
function getTimestamp(ts) {
  if (ts === null || ts === undefined) {
    return Math.floor(Date.now() / 1000);
  }
  if (typeof ts === 'object') {
    if (typeof ts.low === 'number') {
      return ts.low;
    }
    if (typeof ts.toNumber === 'function') {
      return ts.toNumber();
    }
  }
  if (typeof ts === 'number') {
    return ts;
  }
  const parsed = parseInt(ts, 10);
  return isNaN(parsed) ? Math.floor(Date.now() / 1000) : parsed;
}

// Update local cache with newly discovered names
function updateContacts(contactsList) {
  if (!contactsList || !Array.isArray(contactsList)) return;
  let updated = false;
  for (const contact of contactsList) {
    if (contact.id) {
      const cleanJid = getCleanId(contact.id);
      const contactName = contact.name || contact.notify || contact.verifiedName || '';
      if (contactName && globalContacts[cleanJid] !== contactName) {
        globalContacts[cleanJid] = contactName;
        updated = true;
      }
      
      // Map contact LIDs dynamically if present
      if (contact.lid && contact.id.endsWith('@s.whatsapp.net')) {
        registerLidMapping(contact.lid, contact.id);
      }
    }
  }
  if (updated) {
    saveContacts();
  }
}

// Migrate cache files from old location inside session folder if they exist
const oldContactsFile = path.join(SESSION_DIR, 'contacts.json');
const oldLidMapFile = path.join(SESSION_DIR, 'lid-map.json');
if (fs.existsSync(oldContactsFile) && !fs.existsSync(CONTACTS_FILE)) {
  try {
    fs.copyFileSync(oldContactsFile, CONTACTS_FILE);
    console.log('Migrated contacts.json from session directory to scratch directory.');
  } catch (e) {
    console.error('Migration of contacts.json failed:', e.message);
  }
}
if (fs.existsSync(oldLidMapFile) && !fs.existsSync(LID_MAP_FILE)) {
  try {
    fs.copyFileSync(oldLidMapFile, LID_MAP_FILE);
    console.log('Migrated lid-map.json from session directory to scratch directory.');
  } catch (e) {
    console.error('Migration of lid-map.json failed:', e.message);
  }
}

loadContacts();
loadLidMap();

// Run database alignment on startup to fix any historical LID leads
async function alignLidLeadsDatabase() {
  console.log('Starting background alignment of LID mappings in database...');
  const keys = Object.keys(globalLidMap);
  for (const lid of keys) {
    const phone = globalLidMap[lid];
    if (lid && phone) {
      // Small delay between calls to not overwhelm the Next.js server on startup
      await new Promise(resolve => setTimeout(resolve, 50));
      notifyLidResolution(lid, phone);
    }
  }
  console.log(`Finished database LID mappings alignment query for ${keys.length} items.`);
}

// Trigger alignment a few seconds after gateway startup
setTimeout(() => {
  alignLidLeadsDatabase();
}, 5000);

async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  
  let version = [2, 3000, 1015901307]; // Fallback version
  try {
    const latest = await fetchLatestBaileysVersion();
    version = latest.version;
    console.log(`Using latest Baileys version: ${version.join('.')}, isLatest: ${latest.isLatest}`);
  } catch (e) {
    console.log(`Failed to fetch latest Baileys version, using fallback: ${version.join('.')}. Error: ${e.message}`);
  }
  
  console.log('Initializing WhatsApp socket (ESM)...');
  connectionStatus = 'connecting';
  
  sock = makeWASocket({
    auth: state,
    version,
    printQRInTerminal: true, // Also prints to console for developer visibility
    syncFullHistory: true,
    browser: Browsers.macOS('Desktop'),
    shouldSyncHistoryMessage: () => true
  });

  const currentSock = sock;

  sock.ev.on('creds.update', () => {
    if (currentSock !== sock) return;
    saveCreds();
  });

  sock.ev.on('connection.update', (update) => {
    if (currentSock !== sock) return;
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      qrCodeString = qr;
      connectionStatus = 'disconnected';
      console.log('New QR code received. Open http://localhost:3001 to scan.');
      sendStatusToCRM();
    }
    
    if (connection === 'close') {
      qrCodeString = null;
      const isLoggedOut = lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut;
      const shouldReconnect = !isLoggedOut;
      console.log('Connection closed due to:', lastDisconnect?.error, ', reconnecting:', shouldReconnect);
      connectionStatus = 'disconnected';
      sendStatusToCRM();
      
      if (shouldReconnect) {
        // Wait 10 seconds for conflicts (statusCode 440) or 3 seconds for other disconnects to let things settle
        const delay = lastDisconnect?.error?.output?.statusCode === 440 ? 10000 : 3000;
        console.log(`Reconnecting in ${delay}ms...`);
        setTimeout(() => {
          startWhatsApp();
        }, delay);
      } else {
        console.log('Session logged out or device removed. Clearing credentials cache after a short delay to force new QR...');
        setTimeout(() => {
          try {
            fs.rmSync(path.join(__dirname, 'whatsapp-session'), { recursive: true, force: true });
            console.log('Successfully cleared credentials directory.');
          } catch (e) {
            console.error('Failed to clear whatsapp-session directory:', e.message);
          }
          startWhatsApp();
        }, 5000);
      }
    } else if (connection === 'open') {
      qrCodeString = null;
      connectionStatus = 'connected';
      console.log('WhatsApp connection opened successfully!');
      // Load contacts again to make sure everything matches
      loadContacts();
      loadLidMap();
      registerGatewayUrl();
      sendStatusToCRM();
    }
  });

  // Track contacts from various socket events
  sock.ev.on('contacts.set', ({ contacts }) => {
    if (currentSock !== sock) return;
    console.log(`Received contacts.set: ${contacts?.length} contacts.`);
    updateContacts(contacts);
  });

  sock.ev.on('contacts.upsert', (contacts) => {
    if (currentSock !== sock) return;
    console.log(`Received contacts.upsert: ${contacts?.length} contacts.`);
    updateContacts(contacts);
  });

  sock.ev.on('contacts.update', (updates) => {
    if (currentSock !== sock) return;
    console.log(`Received contacts.update: ${updates?.length} updates.`);
    updateContacts(updates);
  });

  sock.ev.on('messaging-history.set', async ({ chats, messages, contacts, isLatest }) => {
    if (currentSock !== sock) return;
    console.log(`Received history sync from Baileys: ${chats?.length} chats, ${messages?.length} messages, ${contacts?.length} contacts.`);
    
    // First, scan messages to populate LID mappings
    if (messages && Array.isArray(messages)) {
      for (const m of messages) {
        if (m.key && m.key.remoteJid && m.key.remoteJid.endsWith('@lid') && m.key.remoteJidAlt) {
          registerLidMapping(m.key.remoteJid, m.key.remoteJidAlt);
        }
      }
    }

    if (contacts) {
      updateContacts(contacts);
    }

    if (!chats || !messages) return;

    const userChats = chats.filter(c => isUserJid(c.id));
    const userMessages = messages.filter(m => m.key && isUserJid(m.key.remoteJid));

    // Gather name information mapping for chats
    const chatDetailsMap = new Map(); // cleanPhone -> { id: cleanPhone, name: string, metaTimestamp: number }

    for (const c of userChats) {
      const cleanPhone = resolvePhone(c.id);
      if (cleanPhone && cleanPhone !== '0') {
        const nameFromContact = globalContacts[cleanPhone] || globalContacts[getCleanId(c.id)] || '';
        const metaTs = c.conversationTimestamp ? getTimestamp(c.conversationTimestamp) : 0;
        chatDetailsMap.set(cleanPhone, {
          id: cleanPhone,
          name: c.name || c.verifiedBizName || nameFromContact || '',
          metaTimestamp: metaTs
        });
      }
    }

    for (const m of userMessages) {
      const cleanPhone = resolvePhone(m.key.remoteJid);
      if (cleanPhone && cleanPhone !== '0' && !chatDetailsMap.has(cleanPhone)) {
        const contactName = globalContacts[cleanPhone] || '';
        chatDetailsMap.set(cleanPhone, {
          id: cleanPhone,
          name: contactName,
          metaTimestamp: 0
        });
        console.log(`Synthesizing virtual chat for message JID: ${cleanPhone} (Name: ${contactName || 'None'})`);
      }
    }

    // Find the last message timestamp for each unique chat ID (ignoring messages before January 1, 2026)
    const CUTOFF_TIMESTAMP = Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 1000);
    
    // Group messages belonging to each chat JID (only messages >= CUTOFF_TIMESTAMP)
    const chatMessagesMap = new Map();
    for (const m of userMessages) {
      const cleanPhone = resolvePhone(m.key.remoteJid);
      if (cleanPhone && cleanPhone !== '0') {
        const ts = getTimestamp(m.messageTimestamp);
        if (ts >= CUTOFF_TIMESTAMP) {
          if (!chatMessagesMap.has(cleanPhone)) {
            chatMessagesMap.set(cleanPhone, []);
          }
          chatMessagesMap.get(cleanPhone).push(m);
        }
      }
    }

    // Now, determine the latest activity timestamp for each chat candidate (either from message timestamps or metadata)
    const chatLastTimestamp = {};
    const activeChatIds = [];
    for (const [cleanPhone, detail] of chatDetailsMap.entries()) {
      let maxTs = detail.metaTimestamp || 0;
      
      const msgs = chatMessagesMap.get(cleanPhone) || [];
      for (const m of msgs) {
        maxTs = Math.max(maxTs, getTimestamp(m.messageTimestamp));
      }
      
      // Only sync if the latest activity was on or after May 1, 2026 (or whichever is >= CUTOFF_TIMESTAMP)
      if (maxTs >= CUTOFF_TIMESTAMP) {
        chatLastTimestamp[cleanPhone] = maxTs;
        activeChatIds.push(cleanPhone);
      }
    }

    // Sort active chats by their last message timestamp (descending)
    const sortedChatIds = activeChatIds.sort((a, b) => {
      const tsA = chatLastTimestamp[a] || 0;
      const tsB = chatLastTimestamp[b] || 0;
      return tsB - tsA;
    });

    // Select the top 100 most recent active chats
    const topChatsCount = 100;
    const top100ChatIds = new Set(sortedChatIds.slice(0, topChatsCount));
    console.log(`History sync: Top ${topChatsCount} most recent active chats resolved (since Jan 1st 2026):`, Array.from(top100ChatIds));

    // Build payload chats (only the top active chats)
    const payloadChats = [];
    for (const cleanPhone of top100ChatIds) {
      const chatDetails = chatDetailsMap.get(cleanPhone);
      const lastMsgAt = chatLastTimestamp[cleanPhone] || 0;
      if (chatDetails) {
        payloadChats.push({
          id: cleanPhone,
          name: chatDetails.name,
          lastMessageAt: lastMsgAt
        });
      } else {
        // Fallback JID name if not in chat details map
        const contactName = globalContacts[cleanPhone] || '';
        payloadChats.push({
          id: cleanPhone,
          name: contactName,
          lastMessageAt: lastMsgAt
        });
      }
    }

    // For each of the active chats, take only the last 100 messages (sorted chronologically)
    const finalFilteredMessages = [];
    for (const cleanPhone of top100ChatIds) {
      const msgs = chatMessagesMap.get(cleanPhone) || [];
      // Sort descending (newest first) to slice the last 100 messages
      msgs.sort((a, b) => getTimestamp(b.messageTimestamp) - getTimestamp(a.messageTimestamp));
      const recent100 = msgs.slice(0, 100);
      // Sort ascending (chronological) for correct rendering sequence
      recent100.sort((a, b) => getTimestamp(a.messageTimestamp) - getTimestamp(b.messageTimestamp));
      finalFilteredMessages.push(...recent100);
    }

    const payload = {
      chats: payloadChats,
      messages: (await Promise.all(finalFilteredMessages.map(async (m) => {
        const textContent = await processMessageContent(m);
        const cleanPhone = resolvePhone(m.key.remoteJid);
        return {
          id: m.key.id,
          chatId: cleanPhone,
          from: m.key.fromMe ? 'me' : cleanPhone,
          fromMe: m.key.fromMe,
          timestamp: getTimestamp(m.messageTimestamp),
          content: textContent
        };
      }))).filter(m => m.content && m.chatId)
    };

    // Fetch profile pictures in background asynchronously for the top 30 chats to avoid rate-limiting
    const profilePicChats = payloadChats.slice(0, 30);
    for (const chat of profilePicChats) {
      (async () => {
        try {
          const jid = `${chat.id}@s.whatsapp.net`;
          const url = await sock.profilePictureUrl(jid, 'image');
          console.log(`History sync: Fetched profile picture URL for ${jid}: ${url}`);
          if (url) {
            await notifyAvatarResolution(chat.id, url);
          }
        } catch (e) {
          console.log(`History sync: Failed to fetch profile picture for ${chat.id}:`, e.message);
        }
      })();
    }

    try {
      console.log('Forwarding history sync to Next.js webhook...');
      const res = await fetch(`${NEXTJS_URL}/api/whatsapp/sync-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      console.log(`History sync response status: ${res.status}`);
    } catch (err) {
      console.error('Error forwarding history sync to webhook:', err.message);
    }
  });

  // Listen for incoming messages
  sock.ev.on('messages.upsert', async (m) => {
    if (currentSock !== sock) return;
    console.log('DEBUG messages.upsert event received:', JSON.stringify(m, null, 2));

    if (m.type !== 'notify' && m.type !== 'append') return;
    
    for (const msg of m.messages) {
      let remoteJid = msg.key.remoteJid;
      if (!remoteJid || !isUserJid(remoteJid)) {
        console.log(`Skipping message with non-user JID: ${remoteJid}`);
        continue;
      }
      
      if (remoteJid.endsWith('@lid')) {
        if (msg.key.remoteJidAlt) {
          registerLidMapping(remoteJid, msg.key.remoteJidAlt);
        }
        const resolved = resolvePhone(remoteJid);
        if (resolved && resolved !== remoteJid.split('@')[0]) {
          remoteJid = `${resolved}@s.whatsapp.net`;
        }
      }
      
      const senderPhone = resolvePhone(remoteJid);
      
      // Fetch profile picture in background asynchronously
      (async () => {
        try {
          const url = await sock.profilePictureUrl(remoteJid, 'image');
          console.log(`Fetched profile picture URL for ${remoteJid}: ${url}`);
          if (url) {
            await notifyAvatarResolution(senderPhone, url);
          }
        } catch (e) {
          console.log(`Failed to fetch profile picture for ${remoteJid}:`, e.message);
        }
      })();

      const pushName = msg.pushName || '';
      
      // Update global contacts with push name if it's a real name and not already recorded (only for incoming messages)
      if (!msg.key.fromMe && pushName && pushName !== 'WhatsApp Müşterisi' && globalContacts[senderPhone] !== pushName) {
        globalContacts[senderPhone] = pushName;
        saveContacts();
      }

      const savedName = globalContacts[senderPhone];
      const finalPushName = msg.key.fromMe ? (savedName || 'WhatsApp Müşterisi') : (pushName || savedName || 'WhatsApp Müşterisi');
      
      const textContent = await processMessageContent(msg);
      if (!textContent) continue;
      
      console.log(`Received message from ${senderPhone} (${finalPushName}): ${textContent}`);
      
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
                        name: finalPushName
                      },
                      wa_id: senderPhone
                    }
                  ],
                  messages: [
                    {
                      id: msg.key.id,
                      timestamp: String(getTimestamp(msg.messageTimestamp)),
                      from: senderPhone,
                      fromMe: !!msg.key.fromMe,
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
            .reset-btn { background: #e53935; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: 20px; transition: background 0.2s; }
            .reset-btn:hover { background: #c62828; }
            .reset-desc { font-size: 11px; color: #999; margin-top: 8px; line-height: 1.4; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>WhatsApp Bağlantısı</h1>
            <p>Ebru Şimşek WhatsApp Hesabı başarıyla bağlandı!</p>
            <div class="status-badge">✓ Bağlı (Connected)</div>
            <p style="margin-top: 30px; font-size: 13px;">CRM paneliniz üzerinden artık mesaj alıp gönderebilirsiniz.</p>
            
            <hr style="margin: 25px 0; border: 0; border-top: 1px solid #eee;" />
            
            <button onclick="resetSession()" class="reset-btn">Bağlantıyı Sıfırla ve Yeniden Senkronize Et</button>
            <p class="reset-desc">Eski sohbetleri ve geçmiş mesajları sıfırdan CRM'e eksiksiz çekmek için bağlantıyı sıfırlayıp yeni QR kodu okutabilirsiniz.</p>
          </div>
          
          <script>
            async function resetSession() {
              if (confirm('WhatsApp bağlantısını sıfırlamak ve tüm geçmişi yeniden senkronize etmek için yeni QR kodu üretmek istiyor musunuz?')) {
                try {
                  const res = await fetch('/reset', { method: 'POST' });
                  const data = await res.json();
                  alert(data.message || 'Sıfırlama başlatıldı.');
                  setTimeout(() => window.location.reload(), 2000);
                } catch(e) {
                  alert('Hata: ' + e.message);
                }
              }
            }
          </script>
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

// POST /fetch-avatar: Fetch avatar for a phone number on demand
app.post('/fetch-avatar', async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'phone is required.' });
  }
  if (connectionStatus !== 'connected' || !sock) {
    return res.status(503).json({ error: 'WhatsApp gateway is not connected. Please scan QR first.' });
  }
  try {
    const cleanPhone = phone.replace(/\D/g, '');
    let formattedPhone = cleanPhone;
    if (cleanPhone.length === 11 && cleanPhone.startsWith('05')) {
      formattedPhone = '90' + cleanPhone.substring(1);
    } else if (cleanPhone.length === 10 && cleanPhone.startsWith('5')) {
      formattedPhone = '90' + cleanPhone;
    }
    const jid = `${formattedPhone}@s.whatsapp.net`;
    console.log(`On-demand: Fetching profile picture URL for ${jid}...`);
    const url = await sock.profilePictureUrl(jid, 'image');
    console.log(`On-demand: Profile picture URL result for ${jid}: ${url}`);
    if (url) {
      await notifyAvatarResolution(formattedPhone, url);
    }
    res.json({ success: true, url });
  } catch (err) {
    console.error(`On-demand: Error fetching profile picture for ${phone}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/reset', async (req, res) => {
  performLocalReset();
  res.json({ success: true, message: 'Session reset started.' });
});

app.listen(PORT, () => {
  console.log(`WhatsApp Gateway HTTP server running on http://localhost:${PORT}`);
  registerGatewayUrl();
  sendStatusToCRM();
  // Sync status to CRM periodically every 10 seconds
  setInterval(sendStatusToCRM, 10000);
});

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SESSION_DIR = path.join(__dirname, 'whatsapp-session');
const MEDIA_DIR = path.join(__dirname, '../public/whatsapp_media');

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
  console.log("Entering processMessageContent...");
  if (!msg) { console.log("msg is null"); return ''; }
  if (!msg.message) { console.log("msg.message is null"); return ''; }

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

  if (!messageContent) { console.log("messageContent unwrapped is null"); return ''; }

  const messageType = Object.keys(messageContent)[0];
  console.log("messageType detected:", messageType);

  // Handle standard texts
  if (messageType === 'conversation') {
    return messageContent.conversation || '';
  }
  if (messageType === 'extendedTextMessage') {
    return messageContent.extendedTextMessage?.text || '';
  }

  // Fallbacks
  const caption = messageContent.imageMessage?.caption || 
                  messageContent.videoMessage?.caption || 
                  messageContent.documentMessage?.caption || 
                  '';
  return caption;
}

const globalContacts = {
  "905335745839": "Sunton Makina"
};
const globalLidMap = {
  "205454542118984": "905335745839"
};

const isUserJid = (jid) => {
  if (!jid) return false;
  return jid.endsWith('@s.whatsapp.net') || jid.endsWith('@c.us') || jid.endsWith('@lid');
};

const getCleanId = (jid) => {
  if (!jid) return '';
  return jid.split('@')[0].split(':')[0];
};

const resolvePhone = (jid) => {
  if (!jid) return '';
  const cleanId = getCleanId(jid);
  if (jid.endsWith('@lid')) {
    const mappedPhone = globalLidMap[cleanId];
    if (mappedPhone) {
      return mappedPhone;
    }
  }
  return cleanId;
};

function registerLidMapping(lidJid, phoneJid) {
  if (!lidJid || !phoneJid) return;
  if (lidJid.endsWith('@lid') && phoneJid.endsWith('@s.whatsapp.net')) {
    const cleanLid = getCleanId(lidJid);
    const cleanPhone = getCleanId(phoneJid);
    if (globalLidMap[cleanLid] !== cleanPhone) {
      globalLidMap[cleanLid] = cleanPhone;
      console.log(`Registered LID mapping: ${cleanLid} -> ${cleanPhone}`);
    }
  }
}

// Simulated payload from logs for cevap test 4
const payload = {
  "messages": [
    {
      "key": {
        "remoteJid": "205454542118984@lid",
        "remoteJidAlt": "905335745839@s.whatsapp.net",
        "fromMe": true,
        "id": "3EB01CA3701CC739DE9088",
        "participant": "",
        "addressingMode": "lid"
      },
      "messageTimestamp": 1781874739,
      "pushName": "Satış Destek Uzmanı Ebru Şimşek",
      "broadcast": false,
      "status": 2,
      "message": {
        "extendedTextMessage": {
          "text": "cevap test 4",
          "contextInfo": {
            "ephemeralSettingTimestamp": "1778154733",
            "disappearingMode": {
              "initiator": "CHANGED_IN_CHAT",
              "trigger": "CHAT_SETTING",
              "initiatedByMe": false
            }
          },
          "inviteLinkGroupTypeV2": "DEFAULT"
        }
      }
    }
  ],
  "type": "notify"
};

async function test() {
  console.log("1. Starting test...");
  if (payload.type !== 'notify') {
    console.log("Not a notify event, skipping.");
    return;
  }
  
  console.log("2. Notify event confirmed.");
  for (const msg of payload.messages) {
    console.log("3. Processing message item...");
    let remoteJid = msg.key.remoteJid;
    console.log("4. remoteJid =", remoteJid);
    
    if (!remoteJid || !isUserJid(remoteJid)) {
      console.log(`Skipping message with non-user JID: ${remoteJid}`);
      continue;
    }
    console.log("5. remoteJid is user JID.");
    
    if (remoteJid.endsWith('@lid')) {
      console.log("6. remoteJid ends with @lid.");
      if (msg.key.remoteJidAlt) {
        console.log("7. msg.key.remoteJidAlt is present:", msg.key.remoteJidAlt);
        registerLidMapping(remoteJid, msg.key.remoteJidAlt);
      }
      const resolved = resolvePhone(remoteJid);
      console.log("8. resolved phone =", resolved);
      if (resolved && resolved !== remoteJid.split('@')[0]) {
        remoteJid = `${resolved}@s.whatsapp.net`;
        console.log("9. updated remoteJid =", remoteJid);
      }
    }
    
    const senderPhone = remoteJid.split('@')[0];
    console.log("10. senderPhone =", senderPhone);
    
    const pushName = msg.pushName || '';
    console.log("11. pushName =", pushName);
    
    if (pushName && pushName !== 'WhatsApp Müşterisi' && globalContacts[senderPhone] !== pushName) {
      console.log("12. Updating contacts cache for", senderPhone, "to", pushName);
      globalContacts[senderPhone] = pushName;
    }

    const savedName = globalContacts[senderPhone];
    const finalPushName = pushName || savedName || 'WhatsApp Müşterisi';
    console.log("13. finalPushName =", finalPushName);
    
    const textContent = await processMessageContent(msg);
    console.log("14. textContent parsed =", textContent);
    if (!textContent) {
      console.log("Empty textContent, continuing...");
      continue;
    }
    
    console.log(`15. SUCCESS! Received message from ${senderPhone} (${finalPushName}): ${textContent}`);
  }
}

test();

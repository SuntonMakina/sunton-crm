const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

async function run() {
  const payload = {
    chats: [
      { id: '905340681497', name: 'kutay koçtürk' },
      { id: '905070471373', name: 'Berkhan Sunton İş' },
      { id: '15556503833', name: '' }, // Shows phone number as name since no contact name
      { id: '905454483223', name: 'Selim Arı' },
      { id: '905074127087', name: 'Süleyman' },
      { id: '905340377473', name: 'Muzaffer' },
      { id: '905321201359', name: 'Canan Erkin' },
      { id: '905331271248', name: 'Musa Arslan' }
    ],
    messages: [
      {
        id: 'msg_hist_1',
        chatId: '905340681497',
        from: 'me',
        fromMe: true,
        timestamp: Math.floor(Date.now() / 1000) - 180, // 3 mins ago
        content: 'Tekrardan merhaba, maalesef makinalarımız pleksi kesim yapmamaktadır.'
      },
      {
        id: 'msg_hist_2',
        chatId: '905070471373',
        from: '905070471373',
        fromMe: false,
        timestamp: Math.floor(Date.now() / 1000) - 1800, // 30 mins ago
        content: 'Merhaba, bu Berkhan Test cihazıdır.'
      },
      {
        id: 'msg_hist_3',
        chatId: '15556503833',
        from: '15556503833',
        fromMe: false,
        timestamp: Math.floor(Date.now() / 1000) - 3600 * 3, // 3 hours ago
        content: 'CRM MESAJ'
      },
      {
        id: 'msg_hist_4',
        chatId: '905454483223',
        from: 'me',
        fromMe: true,
        timestamp: Math.floor(Date.now() / 1000) - 3600 * 3.5,
        content: 'Şu mesaja 🙏 ifadesini bıraktınız: "Teşekkür ederim"'
      },
      {
        id: 'msg_hist_5',
        chatId: '905074127087',
        from: 'me',
        fromMe: true,
        timestamp: Math.floor(Date.now() / 1000) - 3600 * 4,
        content: 'verdiğiniz bilgiler için teşekkür ederiz, fiyat teklifi için sizle iletişime geçeceğiz.'
      },
      {
        id: 'msg_hist_6',
        chatId: '905340377473',
        from: 'me',
        fromMe: true,
        timestamp: Math.floor(Date.now() / 1000) - 3600 * 5,
        content: 'Size uygun teklifi hazırlayabilmemiz için aşağıdaki bilgileri doldurur musunuz?'
      },
      {
        id: 'msg_hist_7',
        chatId: '905321201359',
        from: 'me',
        fromMe: true,
        timestamp: Math.floor(Date.now() / 1000) - 3600 * 5.2,
        content: 'Size uygun teklifi hazırlayabilmemiz için aşağıdaki bilgileri doldurur musunuz?'
      },
      {
        id: 'msg_hist_8',
        chatId: '905331271248',
        from: 'me',
        fromMe: true,
        timestamp: Math.floor(Date.now() / 1000) - 3600 * 5.3,
        content: 'Size uygun teklifi hazırlayabilmemiz için aşağıdaki bilgileri doldurur musunuz?'
      }
    ]
  };

  try {
    console.log('Sending mock sync-history payload to Next.js api...');
    const res = await fetch('http://localhost:3000/api/whatsapp/sync-history', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      console.error(`Request failed with status ${res.status}:`, await res.text());
    } else {
      const data = await res.json();
      console.log('Successfully populated history sync:', data);
    }
  } catch (err) {
    console.error('Error populating history:', err.message);
  }
}

run();

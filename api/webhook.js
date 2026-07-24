export default async function handler(req, res) {
  // Allow only POST requests from Telegram
  if (req.method !== 'POST') {
    return res.status(200).send('Telegram Webhook is Active! 🚀');
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).send('TELEGRAM_BOT_TOKEN is missing');

  const msg = req.body?.message;
  if (!msg) return res.status(200).send('No message found');

  const chatId = msg.chat.id;
  const text = msg.text || '';

  // Security Verification (Whitelist)
  const allowedChatIds = new Set();
  if (process.env.PRIMARY_CHAT_ID) allowedChatIds.add(parseInt(process.env.PRIMARY_CHAT_ID, 10));
  if (process.env.ALLOWED_CHAT_IDS) {
    const ids = process.env.ALLOWED_CHAT_IDS.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
    ids.forEach(id => allowedChatIds.add(id));
  }

  // Telegram API Helpers
  const sendMessage = async (chat, message) => {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: message })
    });
  };

  const sendPhoto = async (chat, photoUrl, caption) => {
    await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, photo: photoUrl, caption: caption })
    });
  };

  // Check Authorization
  if (!allowedChatIds.has(chatId) && allowedChatIds.size > 0) {
    await sendMessage(chatId, '❌ عذراً، غير مصرح لك باستخدام هذا البوت.');
    return res.status(200).send('Unauthorized');
  }

  // Command Routing
  if (text.startsWith('/start')) {
     await sendMessage(chatId, 'أهلاً بك! البوت متصل بالخادم السحابي (Vercel) بنجاح 🚀\nاستخدم الأوامر التالية:\n/now - الشارت اللحظي\n/xau - شارت أونصة الدولار\n/btc - شارت البيتكوين\n/egp - شارت الذهب المحلي');
     return res.status(200).send('OK');
  }

  if (text.startsWith('/now') || text === '/xau' || text === '/btc' || text === '/egp') {
    // Send immediate loading message so Telegram knows we got it
    await sendMessage(chatId, '📸 جاري تجهيز الشارت اللحظي... الرجاء الانتظار قليلاً!');
    
    let symbol = 'XAUEGP';
    if (text === '/xau') symbol = 'XAUUSD';
    if (text === '/btc') symbol = 'BTCEGP';

    const targetUrl = `https://chart6532.vercel.app/?symbol=${symbol}`;
    // Microlink API to take screenshot with a 3.5s delay to ensure chart loads
    const microlinkUrl = `https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}&screenshot=true&meta=false&waitForTimeout=3500`;
    
    let imgUrl = null;
    try {
      const response = await fetch(microlinkUrl);
      const data = await response.json();
      if (data?.data?.screenshot?.url) {
         imgUrl = data.data.screenshot.url;
      }
    } catch (e) {
      console.log('Microlink failed, falling back to Thum.io');
    }
    
    if (!imgUrl) {
       // Fallback to Thum.io if Microlink is down or rate limited
       imgUrl = `https://image.thum.io/get/width/800/crop/1200/wait/4/${targetUrl}`;
    }
    
    if (imgUrl) {
      await sendPhoto(chatId, imgUrl, `✅ شارت ${symbol} اللحظي`);
    } else {
      await sendMessage(chatId, '❌ عذراً، حدث خطأ أثناء التقاط الصورة من الخادم المساعد.');
    }
  }

  return res.status(200).send('OK');
}

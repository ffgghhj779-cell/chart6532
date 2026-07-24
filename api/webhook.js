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
      body: JSON.stringify({ chat_id: chat, photo: photoUrl, caption: caption, parse_mode: 'HTML' })
    });
  };

  // Check Authorization
  if (!allowedChatIds.has(chatId) && allowedChatIds.size > 0) {
    await sendMessage(chatId, '❌ عذراً، غير مصرح لك باستخدام هذا البوت.');
    return res.status(200).send('Unauthorized');
  }

  // Command Routing
  if (text.startsWith('/start')) {
     await sendMessage(chatId, 'أهلاً بك! البوت متصل بالخادم السحابي (Vercel) بنجاح 🚀\nاستخدم الأوامر التالية:\n/now - جميع الشارتات اللحظية\n/xau - شارت أونصة الدولار\n/usd - شارت الدولار مقابل الجنيه\n/egp - شارت الذهب المحلي');
     return res.status(200).send('OK');
  }

  if (text.startsWith('/now') || text === '/xau' || text === '/btc' || text === '/egp') {
    await sendMessage(chatId, '📸 جاري تجهيز الشارتات المطلوبة... الرجاء الانتظار ثواني معدودة!');
    
    let symbols = [];
    if (text.startsWith('/now')) symbols = ['XAUEGP', 'XAUUSD', 'USDEGP'];
    else if (text === '/xau') symbols = ['XAUUSD'];
    else if (text === '/usd') symbols = ['USDEGP'];
    else if (text === '/egp') symbols = ['XAUEGP'];

    const promises = symbols.map(async (symbol) => {
       const targetUrl = `https://chart6532.vercel.app/?symbol=${symbol}`;
       const microlinkUrl = `https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}&screenshot=true&meta=false&waitForTimeout=3500`;
       
       let imgUrl = null;
       try {
         const response = await fetch(microlinkUrl);
         const data = await response.json();
         if (data?.data?.screenshot?.url) imgUrl = data.data.screenshot.url;
       } catch (e) {
         console.log('Microlink failed, falling back to Thum.io');
       }
       
       if (!imgUrl) {
          imgUrl = `https://image.thum.io/get/width/800/crop/1200/wait/4/${targetUrl}`;
       }
       
       if (imgUrl) {
         let captionTitle = '';
         if (symbol === 'XAUUSD') captionTitle = '🥇 الذهب العالمي (XAU/USD)';
         else if (symbol === 'XAUEGP') captionTitle = '🇪🇬 الذهب المحلي عيار 21 (EGP)';
         else if (symbol === 'USDEGP') captionTitle = '💵 الدولار مقابل الجنيه (USD/EGP)';
         else captionTitle = `✅ شارت ${symbol} اللحظي`;
         
         const timeString = new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' });
         const finalCaption = `<b>${captionTitle}</b>\n🕒 <i>${timeString}</i>`;

         await sendPhoto(chatId, imgUrl, finalCaption);
       }
    });

    await Promise.all(promises);
  }

  return res.status(200).send('OK');
}

export default async function handler(req, res) {
  // Use PRIMARY_CHAT_ID as a simple secret key to prevent unauthorized execution
  const cronSecret = process.env.PRIMARY_CHAT_ID;
  if (!cronSecret || req.query.key !== cronSecret) {
     return res.status(401).send('Unauthorized to trigger cron job');
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).send('TELEGRAM_BOT_TOKEN is missing');

  // Load allowed IDs
  const allowedChatIds = new Set();
  if (process.env.PRIMARY_CHAT_ID) allowedChatIds.add(parseInt(process.env.PRIMARY_CHAT_ID, 10));
  if (process.env.ALLOWED_CHAT_IDS) {
    const ids = process.env.ALLOWED_CHAT_IDS.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
    ids.forEach(id => allowedChatIds.add(id));
  }
  
  if (allowedChatIds.size === 0) return res.status(200).send('No users configured');

  // Determine which symbols to snapshot
  let symbols = [];
  if (req.query.symbol) {
     symbols = [req.query.symbol];
  } else {
     symbols = ['XAUEGP', 'XAUUSD', 'USDEGP'];
  }

  const sendPhoto = async (chat, photoUrl, caption) => {
    await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, photo: photoUrl, caption: caption, parse_mode: 'HTML' })
    });
  };

  const processSymbol = async (symbol) => {
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

        // Send to all allowed users concurrently
        const promises = Array.from(allowedChatIds).map(chatId => 
           sendPhoto(chatId, imgUrl, finalCaption)
        );
        await Promise.all(promises);
      }
  };

  try {
     const promises = symbols.map(sym => processSymbol(sym));
     await Promise.all(promises);
     return res.status(200).send(`Cron job executed successfully for ${symbols.join(', ')}`);
  } catch(e) {
     return res.status(500).send('Failed to capture screenshots');
  }
}

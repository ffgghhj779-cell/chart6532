const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const puppeteer = require('puppeteer');
const cron = require('node-cron');

// Telegram Bot Token
const token = process.env.TELEGRAM_BOT_TOKEN || '8946049233:AAH6RaR7A5Ahcr6qwwk74kTIZGDqS5XrtFI';
const bot = new TelegramBot(token, { polling: true });

// Vercel app URL base
const APP_URL_BASE = 'https://chart6532.vercel.app/';

// Store chat IDs dynamically from Environment Variables (Admin Whitelist)
let allowedChatIds = new Set();

// Add the Primary Admin ID
if (process.env.PRIMARY_CHAT_ID) {
  allowedChatIds.add(parseInt(process.env.PRIMARY_CHAT_ID, 10));
}

// Add any other allowed IDs (separated by commas)
if (process.env.ALLOWED_CHAT_IDS) {
  const ids = process.env.ALLOWED_CHAT_IDS.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
  ids.forEach(id => allowedChatIds.add(id));
}

// Listen for any message to handle commands and security
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || '';
  
  if (allowedChatIds.has(chatId)) {
    if (text === '/start') {
      bot.sendMessage(chatId, `مرحباً بك! البوت متصل ومؤمن بالكامل. 🚀\nتصلك التحديثات تلقائياً كل ساعة، أو أرسل /now لأخذ سكرينات فورية في أي وقت.`);
    } else if (text === '/now') {
      bot.sendMessage(chatId, 'جاري التقاط السكرينات الآن، يرجى الانتظار دقيقة... ⏳');
      takeAndSendAllScreenshots(chatId);
    } else {
      bot.sendMessage(chatId, `البوت يعمل في الخلفية بنجاح. أرسل /now إذا كنت تريد التحديث فوراً.`);
    }
  } else {
    // SECURITY: Reject unauthorized users!
    bot.sendMessage(chatId, `⛔ عذراً، هذا البوت خاص ومؤمن وغير مصرح لك باستخدامه.\n\nإذا كنت تعرف المالك، أرسل له رقمك التعريفي هذا: \`${chatId}\` ليقوم بإضافتك إلى القائمة البيضاء.`);
    console.log(`Unauthorized access attempt blocked from Chat ID: ${chatId}`);
  }
});

// Function to take screenshot for a specific symbol and send it
async function takeAndSendAllScreenshots(targetChatId = null) {
  if (allowedChatIds.size === 0 && !targetChatId) {
    console.log('No allowed chats registered in Environment Variables. Skipping screenshot.');
    return;
  }

  const targets = targetChatId ? [targetChatId] : Array.from(allowedChatIds);
  const symbolsToCapture = [
    { symbol: 'XAUUSD', name: '🥇 الذهب العالمي (XAU/USD)' },
    { symbol: 'XAUEGP', name: '🇪🇬 الذهب المحلي عيار 21 (EGP)' },
    { symbol: 'USDEGP', name: '💵 الدولار مقابل الجنيه (USD/EGP)' }
  ];

  let browser;
  try {
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath()
    });

    const page = await browser.newPage();
    // Set viewport to tablet/desktop size so the Support/Resistance UI panel is visible
    await page.setViewport({ width: 800, height: 1000, deviceScaleFactor: 2 });
    
    for (const item of symbolsToCapture) {
      console.log(`Navigating to capture ${item.symbol}...`);
      const targetUrl = `${APP_URL_BASE}?symbol=${item.symbol}`;
      
      try {
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Wait an extra 3 seconds to ensure lightweight-charts animation finishes completely
        await new Promise(r => setTimeout(r, 4000));

        console.log(`Taking screenshot for ${item.symbol}...`);
        const screenshotBuffer = await page.screenshot({ type: 'png' });
        
        console.log(`Sending ${item.symbol} to Telegram...`);
        for (const chatId of targets) {
          await bot.sendPhoto(chatId, screenshotBuffer, {
            caption: `<b>${item.name}</b>\n🕒 <i>${new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}</i>`,
            parse_mode: 'HTML'
          });
        }
      } catch (err) {
        console.error(`Failed to capture/send ${item.symbol}:`, err);
        // Silently skip to the next asset without sending annoying error messages
      }
    }

    console.log('All screenshots sent successfully!');
  } catch (error) {
    console.error('Critical Error in browser automation:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Schedule the cron job to run every hour at minute 0 (top of the hour)
cron.schedule('0 * * * *', () => {
  console.log('Running scheduled hourly screenshot job for allowed chats...');
  takeAndSendAllScreenshots();
});

// Set up Express server for UptimeRobot to ping
const app = express();
app.get('/ping', (req, res) => {
  res.status(200).send('Secure Bot is alive and running! 🤖🔒');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}. Ready to receive pings!`);
  console.log('Secure Bot is polling for messages...');
});

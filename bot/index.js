const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const puppeteer = require('puppeteer');
const cron = require('node-cron');

// Telegram Bot Token
const token = process.env.TELEGRAM_BOT_TOKEN || '8946049233:AAH6RaR7A5Ahcr6qwwk74kTIZGDqS5XrtFI';
const bot = new TelegramBot(token, { polling: true });

// Vercel app URL base
const APP_URL_BASE = 'https://chart6532.vercel.app/';

// Store chat IDs dynamically when users text the bot or add it to groups
let activeChatIds = new Set();

// Listen for any message to capture Chat ID (works for private chats AND groups)
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  if (!activeChatIds.has(chatId)) {
    activeChatIds.add(chatId);
    bot.sendMessage(chatId, 'تم تفعيل البوت هنا بنجاح! 🚀 سيقوم البوت بإرسال (الذهب العالمي، الذهب المحلي، والدولار) تلقائياً كل ساعة.');
    console.log(`New chat ID registered: ${chatId}`);
    
    // Trigger an immediate screenshot sequence for the first time
    bot.sendMessage(chatId, 'جاري التقاط أول دفعة من السكرين شوت، يرجى الانتظار دقيقة... ⏳');
    takeAndSendAllScreenshots(chatId);
  }
});

// Function to take screenshot for a specific symbol and send it
async function takeAndSendAllScreenshots(targetChatId = null) {
  if (activeChatIds.size === 0 && !targetChatId) {
    console.log('No active chats registered yet. Skipping screenshot.');
    return;
  }

  const targets = targetChatId ? [targetChatId] : Array.from(activeChatIds);
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
    // Set viewport to mobile size for a clean look
    await page.setViewport({ width: 400, height: 850, deviceScaleFactor: 2 });
    
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
    // Removed the broadcast of the error message to the user!
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Schedule the cron job to run every hour at minute 0 (top of the hour)
cron.schedule('0 * * * *', () => {
  console.log('Running scheduled hourly screenshot job...');
  takeAndSendAllScreenshots();
});

// Set up Express server for UptimeRobot to ping
const app = express();
app.get('/ping', (req, res) => {
  res.status(200).send('Bot is alive and running! 🤖');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}. Ready to receive pings!`);
  console.log('Bot is polling for messages...');
});

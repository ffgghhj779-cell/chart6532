const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const puppeteer = require('puppeteer');
const cron = require('node-cron');

// Telegram Bot Token
const token = process.env.TELEGRAM_BOT_TOKEN || '8946049233:AAH6RaR7A5Ahcr6qwwk74kTIZGDqS5XrtFI';
const bot = new TelegramBot(token, { polling: true });

// Vercel app URL
const APP_URL = 'https://chart6532.vercel.app/';

// Store chat IDs dynamically when users text the bot
let activeChatIds = new Set();

// Listen for any message to capture Chat ID
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  if (!activeChatIds.has(chatId)) {
    activeChatIds.add(chatId);
    bot.sendMessage(chatId, 'تم تسجيلك بنجاح! 🚀 سأقوم بإرسال سكرين شوت للشارت هنا تلقائياً كل 15 دقيقة.');
    console.log(`New chat ID registered: ${chatId}`);
    
    // Trigger an immediate screenshot for the first time
    bot.sendMessage(chatId, 'جاري التقاط أول سكرين شوت الآن، يرجى الانتظار ثواني... ⏳');
    takeAndSendScreenshot(chatId);
  } else {
    bot.sendMessage(chatId, 'البوت يعمل بنجاح في الخلفية! السكرين شوت القادمة ستصلك في موعدها المبرمج. 📈');
  }
});

// Function to take screenshot and send
async function takeAndSendScreenshot(targetChatId = null) {
  if (activeChatIds.size === 0 && !targetChatId) {
    console.log('No active chats registered yet. Skipping screenshot.');
    return;
  }

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
      // Use the executable path if provided by the Docker image environment variable
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath()
    });

    const page = await browser.newPage();
    // Set viewport to mobile size for a clean look
    await page.setViewport({ width: 400, height: 850, deviceScaleFactor: 2 });
    
    console.log(`Navigating to ${APP_URL}...`);
    // Wait until network is idle to ensure data is fetched and chart is rendered
    await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait an extra 3 seconds to ensure lightweight-charts animation finishes completely
    await new Promise(r => setTimeout(r, 3000));

    console.log('Taking screenshot...');
    const screenshotBuffer = await page.screenshot({ type: 'png' });
    
    console.log('Sending to Telegram...');
    
    const targets = targetChatId ? [targetChatId] : Array.from(activeChatIds);
    
    for (const chatId of targets) {
      await bot.sendPhoto(chatId, screenshotBuffer, {
        caption: `📊 تحديث الشارت - ${new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}`
      });
    }

    console.log('Screenshot sent successfully!');
  } catch (error) {
    console.error('Error taking/sending screenshot:', error);
    const targets = targetChatId ? [targetChatId] : Array.from(activeChatIds);
    for (const chatId of targets) {
      bot.sendMessage(chatId, '⚠️ عذراً، حدث خطأ أثناء التقاط الصورة. سيتم المحاولة مرة أخرى لاحقاً.');
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Schedule the cron job to run every 15 minutes
cron.schedule('*/15 * * * *', () => {
  console.log('Running scheduled 15-minute screenshot job...');
  takeAndSendScreenshot();
});

// Set up Express server for UptimeRobot to ping
const app = express();
app.get('/ping', (req, res) => {
  res.status(200).send('Bot is alive and running! 🤖');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}. Ready to receive UptimeRobot pings!`);
  console.log('Bot is polling for messages...');
});

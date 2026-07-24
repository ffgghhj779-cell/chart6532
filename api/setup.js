export default async function handler(req, res) {
  const host = req.headers.host;
  const url = `https://${host}/api/webhook`;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) return res.status(500).send('TELEGRAM_BOT_TOKEN is missing in Environment Variables');
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${url}`);
    const data = await response.json();
    
    res.status(200).json({
       success: true,
       webhook_url: url,
       telegram_response: data
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

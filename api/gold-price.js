export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache'
  };

  const trySource1 = async () => {
    try {
      const response = await fetch('https://www.gold-price-today.com/egypt/', { headers, next: { revalidate: 60 } });
      if (!response.ok) return null;
      const html = await response.text();
      
      // Try JSON-LD schema first
      const schemaMatch = html.match(/"price"\s*:\s*"([0-9,]+)"\s*,\s*"priceCurrency"\s*:\s*"EGP"/i);
      if (schemaMatch && schemaMatch[1]) {
        const p = parseFloat(schemaMatch[1].replace(/,/g, ''));
        if (p > 3000 && p < 15000) return p;
      }

      // Try text match around عيار 21
      const textMatch = html.match(/عيار\s*21[\s\S]{1,300}?([0-9,]{4,5})/i);
      if (textMatch && textMatch[1]) {
        const p = parseFloat(textMatch[1].replace(/,/g, ''));
        if (p > 3000 && p < 15000) return p;
      }
    } catch (e) {
      console.error('Source 1 error:', e.message);
    }
    return null;
  };

  const trySource2 = async () => {
    try {
      const response = await fetch('https://goldpriceegy.com/', { headers, next: { revalidate: 60 } });
      if (!response.ok) return null;
      const html = await response.text();
      const match = html.match(/عيار\s*21[\s\S]{1,300}?([0-9,]{4,5})/i);
      if (match && match[1]) {
        const p = parseFloat(match[1].replace(/,/g, ''));
        if (p > 3000 && p < 15000) return p;
      }
    } catch (e) {
      console.error('Source 2 error:', e.message);
    }
    return null;
  };

  const trySource3 = async () => {
    try {
      const response = await fetch('https://gold-price-live.com/21-karat-gold-price-in-egypt/', { headers, next: { revalidate: 60 } });
      if (!response.ok) return null;
      const html = await response.text();
      const match = html.match(/([0-9,]{4,5})\s*(?:جنيه|EGP|ج\.م)/i);
      if (match && match[1]) {
        const p = parseFloat(match[1].replace(/,/g, ''));
        if (p > 3000 && p < 15000) return p;
      }
    } catch (e) {
      console.error('Source 3 error:', e.message);
    }
    return null;
  };

  let price = await trySource1();
  let source = 'gold-price-today.com';

  if (!price) {
    price = await trySource2();
    source = 'goldpriceegy.com';
  }

  if (!price) {
    price = await trySource3();
    source = 'gold-price-live.com';
  }

  if (price) {
    return res.status(200).json({
      success: true,
      price: price,
      currency: 'EGP',
      karat: 21,
      source: source,
      timestamp: Date.now()
    });
  } else {
    // Ultimate fallback if all external sites block/fail: return 6000 as approximate market price
    return res.status(200).json({
      success: false,
      price: 6000,
      currency: 'EGP',
      karat: 21,
      source: 'fallback-approx',
      timestamp: Date.now()
    });
  }
}

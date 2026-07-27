export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const TIMEOUT_MS = 7000;
  const withTimeout = (promise, ms) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);

  // ─── 1. Fetch Gold (XAU/USD) ─────────────────────────────────────────────
  const fetchGoldFromGoldApi = async () => {
    try {
      const res = await withTimeout(
        fetch('https://api.gold-api.com/price/XAU', { headers: { Accept: 'application/json' } }),
        TIMEOUT_MS
      );
      if (!res.ok) return null;
      const data = await res.json();
      const price = Number(data?.price ?? data?.Price);
      if (!price || price < 1000) return null;
      return { price, changePct: Number(data?.chp ?? 0) };
    } catch { return null; }
  };

  const fetchGoldFromMetalsLive = async () => {
    try {
      const res = await withTimeout(
        fetch('https://api.metals.live/v1/spot', { headers: { Accept: 'application/json' } }),
        TIMEOUT_MS
      );
      if (!res.ok) return null;
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [data];
      const gold = arr[0]?.gold;
      if (!gold) return null;
      return { price: Number(gold), changePct: 0 };
    } catch { return null; }
  };

  const fetchYahooV8 = async (symbol) => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
      const res = await withTimeout(
        fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
            Accept: 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            Referer: 'https://finance.yahoo.com',
          }
        }),
        TIMEOUT_MS
      );
      if (!res.ok) return null;
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta) return null;
      const price = meta.regularMarketPrice ?? meta.previousClose ?? 0;
      const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
      const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
      return { price, changePct };
    } catch { return null; }
  };

  const fetchYahooV7 = async (symbol) => {
    try {
      const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
      const res = await withTimeout(
        fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)', Accept: 'application/json' }
        }),
        TIMEOUT_MS
      );
      if (!res.ok) return null;
      const data = await res.json();
      const quote = data?.quoteResponse?.result?.[0];
      if (!quote) return null;
      return { price: quote.regularMarketPrice ?? 0, changePct: quote.regularMarketChangePercent ?? 0 };
    } catch { return null; }
  };

  // ─── 2. Fetch USD/EGP ────────────────────────────────────────────────────
  const fetchUsdEgpFromTwelveData = async () => {
    try {
      const apiKey = process.env.TWELVEDATA_API_KEY;
      if (!apiKey) return null;
      const res = await withTimeout(
        fetch(`https://api.twelvedata.com/time_series?symbol=USD/EGP&interval=1h&outputsize=1&apikey=${apiKey}&format=JSON`),
        5000
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (data.values && data.values.length > 0) {
        const price = parseFloat(data.values[0].close);
        if (price > 40 && price < 200) return { price, changePct: 0 };
      }
      return null;
    } catch { return null; }
  };

  const fetchUsdEgpFromOpenEr = async () => {
    try {
      const res = await withTimeout(
        fetch('https://open.er-api.com/v6/latest/USD', { headers: { Accept: 'application/json' } }),
        TIMEOUT_MS
      );
      if (!res.ok) return null;
      const data = await res.json();
      const rate = data?.rates?.EGP;
      if (!rate) return null;
      return { price: Number(rate), changePct: 0 };
    } catch { return null; }
  };

  // ─── 3. Fetch Egyptian Gold 21K price from local sites ─────────────────
  const fetchLocalGoldSite = async () => {
    try {
      const res = await withTimeout(
        fetch('https://www.gold-price-today.com/egypt/', {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        }),
        TIMEOUT_MS
      );
      if (!res.ok) return null;
      const html = await res.text();
      const schemaMatch = html.match(/"price"\s*:\s*"([0-9,]+)"\s*,\s*"priceCurrency"\s*:\s*"EGP"/i);
      if (schemaMatch) {
        const p = parseFloat(schemaMatch[1].replace(/,/g, ''));
        if (p > 3000 && p < 15000) return p;
      }
      return null;
    } catch { return null; }
  };

  // ─── Run all in parallel ─────────────────────────────────────────────────
  const [
    goldGoldApi, goldMetals, goldYahooV8, goldYahooV7,
    egpTwelve, egpYahooV8, egpYahooV7, egpOpenEr,
    localGoldSitePrice
  ] = await Promise.all([
    fetchGoldFromGoldApi(),
    fetchGoldFromMetalsLive(),
    fetchYahooV8('GC=F'),
    fetchYahooV7('GC=F'),
    fetchUsdEgpFromTwelveData(),
    fetchYahooV8('USDEGP=X'),
    fetchYahooV7('USDEGP=X'),
    fetchUsdEgpFromOpenEr(),
    fetchLocalGoldSite(),
  ]);

  // ─── Pick best source ───────────────────────────────────────────────────
  const gold   = goldGoldApi ?? goldMetals ?? goldYahooV8 ?? goldYahooV7 ?? { price: 3345, changePct: 0 };
  const usdEgp = egpTwelve ?? egpYahooV8 ?? egpYahooV7 ?? egpOpenEr ?? { price: 50.85, changePct: 0 };

  // Egyptian gold: either from local site directly, or calculated
  const calcPrice = Math.round((gold.price / 31.1035) * usdEgp.price * (21 / 24));
  const egyptianGoldPrice = localGoldSitePrice ?? calcPrice;

  const goldSource = goldGoldApi ? 'gold-api.com' : goldMetals ? 'metals.live' : goldYahooV8 ? 'yahoo-v8(GC=F)' : goldYahooV7 ? 'yahoo-v7(GC=F)' : 'fallback';
  const egpSource  = egpTwelve ? 'twelve-data' : egpYahooV8 ? 'yahoo-v8(USDEGP=X)' : egpYahooV7 ? 'yahoo-v7(USDEGP=X)' : egpOpenEr ? 'open.er-api' : 'fallback';
  const localGoldSource = localGoldSitePrice ? 'gold-price-today.com(direct)' : 'calculated';

  return res.status(200).json({
    success: true,
    // Egyptian gold 21K
    price: egyptianGoldPrice,
    currency: 'EGP',
    karat: 21,
    source: localGoldSource,
    // USD/EGP
    usdEgp: {
      price: usdEgp.price,
      changePct: usdEgp.changePct,
      source: egpSource
    },
    // Global gold (XAU/USD)
    xauUsd: {
      price: gold.price,
      changePct: gold.changePct,
      source: goldSource
    },
    timestamp: Date.now()
  });
}

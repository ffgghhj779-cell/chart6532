import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, ColorType, CandlestickSeries, HistogramSeries, Time, CandlestickData, HistogramData, IPriceLine } from 'lightweight-charts';
import { supabase } from '../utils/supabaseClient';

type SymbolType = 'XAUUSD' | 'BTCUSDT' | 'WTIUSD' | 'USDEGP' | 'XAUEGP' | 'BTCEGP';

interface ChartLevels {
  r4: number;
  r3: number;
  r2: number;
  r1: number;
  pivot: number;
  s1: number;
  s2: number;
  s3: number;
  s4: number;
}

const GOLD_LEVELS: ChartLevels = {
  r4: 4120.000,
  r3: 4106.000,
  r2: 4094.000,
  r1: 4078.000,
  pivot: 4077.000,
  s1: 4063.000,
  s2: 4051.000,
  s3: 4035.000,
  s4: 4021.000,
};

function calculateProfessionalLevels(high: number, low: number, close: number): ChartLevels {
  const pivot = (high + low + close) / 3;
  const r1 = (2 * pivot) - low;
  const s1 = (2 * pivot) - high;
  const r2 = pivot + (high - low);
  const s2 = pivot - (high - low);
  const r3 = high + 2 * (pivot - low);
  const s3 = low - 2 * (high - pivot);
  const r4 = r3 + (high - low);
  const s4 = s3 - (high - low);
  return { r4, r3, r2, r1, pivot, s1, s2, s3, s4 };
}

function calculateRSI(closes: number[], periods: number = 14): number {
  if (closes.length <= periods) return 50; 
  let gains = 0; let losses = 0;
  for (let i = 1; i <= periods; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / periods; let avgLoss = losses / periods;
  for (let i = periods + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (periods - 1) + diff) / periods;
      avgLoss = (avgLoss * (periods - 1)) / periods;
    } else {
      avgGain = (avgGain * (periods - 1)) / periods;
      avgLoss = (avgLoss * (periods - 1) - diff) / periods;
    }
  }
  if (avgLoss === 0) return 100; 
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

const fetchBinanceHistoryRaw = async (symbol: string, timeframe: string) => {
  let interval = timeframe.toLowerCase(); 
  if (interval === '1d') interval = '1d';
  const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=100`);
  return await res.json();
};

const fetchTwelveDataHistoryRaw = async (symbol: string, timeframe: string) => {
  let interval = '30min';
  if (timeframe === '15M') interval = '15min';
  if (timeframe === '30M') interval = '30min';
  if (timeframe === '1H') interval = '1h';
  if (timeframe === '4H') interval = '4h';
  if (timeframe === '1D') interval = '1day';

  const res = await fetch(`https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${interval}&outputsize=100&apikey=0c5eb27deca246138223f51b4fdad554`);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(data.message || 'Error fetching twelve data');
  return [...data.values].reverse();
};

const generateMockData = (basePrice: number, volatility: number) => {
  const mockData = [];
  let time = Math.floor(Date.now() / 1000) - 100 * 30 * 60;
  time -= time % (30 * 60);
  let price = basePrice;
  for (let i = 0; i < 100; i++) {
    const open = price;
    const high = open + Math.random() * volatility;
    const low = open - Math.random() * volatility;
    const close = low + Math.random() * (high - low);
    mockData.push({ time: time as Time, open, high, low, close, volume: Math.random() * 100 + 50 });
    price = close; time += 30 * 60;
  }
  return mockData;
};

const getHistoricalData = async (symbol: SymbolType, timeframe: string) => {
  // Try Cache first
  const { data: cachedData } = await supabase
    .from('historical_candles')
    .select('*')
    .eq('symbol', symbol)
    .eq('timeframe', timeframe)
    .order('timestamp', { ascending: true })
    .limit(100);

  if (cachedData && cachedData.length >= 50) { 
    return cachedData.map((d: any) => ({
      time: d.timestamp as Time, open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume
    }));
  }

  let fetchedData: any[] = [];
  try {
    if (symbol === 'BTCUSDT') {
      const raw = await fetchBinanceHistoryRaw('BTCUSDT', timeframe);
      fetchedData = raw.map((d: any) => ({ time: (d[0]/1000) as Time, open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5]) }));
    } else if (symbol === 'XAUUSD' || symbol === 'WTIUSD' || symbol === 'USDEGP') {
      const apiSymbol = symbol === 'XAUUSD' ? 'XAU/USD' : symbol === 'WTIUSD' ? 'WTI/USD' : 'USD/EGP';
      const raw = await fetchTwelveDataHistoryRaw(apiSymbol, timeframe);
      fetchedData = raw.map((d: any) => ({ time: (new Date(d.datetime).getTime()/1000) as Time, open: parseFloat(d.open), high: parseFloat(d.high), low: parseFloat(d.low), close: parseFloat(d.close), volume: d.volume ? parseFloat(d.volume) : 100 }));
    } else if (symbol === 'XAUEGP') {
      // SYNTHETIC LOCAL GOLD 21K
      const [goldRaw, usdRaw] = await Promise.all([
        fetchTwelveDataHistoryRaw('XAU/USD', timeframe),
        fetchTwelveDataHistoryRaw('USD/EGP', timeframe)
      ]);
      fetchedData = goldRaw.map((g: any, i: number) => {
        const u = usdRaw[i] || usdRaw[usdRaw.length - 1];
        return {
          time: (new Date(g.datetime).getTime()/1000) as Time,
          open: (parseFloat(g.open) / 31.103) * (21/24) * parseFloat(u.open),
          high: (parseFloat(g.high) / 31.103) * (21/24) * parseFloat(u.high),
          low: (parseFloat(g.low) / 31.103) * (21/24) * parseFloat(u.low),
          close: (parseFloat(g.close) / 31.103) * (21/24) * parseFloat(u.close),
          volume: g.volume ? parseFloat(g.volume) : 100
        };
      });
    } else if (symbol === 'BTCEGP') {
      // SYNTHETIC LOCAL BITCOIN
      const [btcRaw, usdRaw] = await Promise.all([
        fetchBinanceHistoryRaw('BTCUSDT', timeframe),
        fetchTwelveDataHistoryRaw('USD/EGP', timeframe)
      ]);
      // Normalize lengths (Binance has 100, TwelveData has 100, but time alignments might vary slightly. We map by index for simplicity here)
      fetchedData = btcRaw.map((b: any, i: number) => {
        const u = usdRaw[i] || usdRaw[usdRaw.length - 1];
        return {
          time: (b[0]/1000) as Time,
          open: parseFloat(b[1]) * parseFloat(u.open),
          high: parseFloat(b[2]) * parseFloat(u.high),
          low: parseFloat(b[3]) * parseFloat(u.low),
          close: parseFloat(b[4]) * parseFloat(u.close),
          volume: parseFloat(b[5])
        };
      });
    }
  } catch (err) {
    console.error(`Failed to fetch ${symbol}, generating mock data...`, err);
    let basePrice = 4077; let vol = 2;
    if (symbol === 'WTIUSD') { basePrice = 82.50; vol = 0.5; }
    if (symbol === 'BTCUSDT') { basePrice = 65000; vol = 100; }
    if (symbol === 'USDEGP') { basePrice = 48.5; vol = 0.1; }
    if (symbol === 'XAUEGP') { basePrice = 3300; vol = 50; } // Gram 21k EGP
    if (symbol === 'BTCEGP') { basePrice = 3150000; vol = 5000; }
    fetchedData = generateMockData(basePrice, vol);
  }

  if (fetchedData.length > 0) {
    const insertPayload = fetchedData.map(d => ({ symbol, timeframe, timestamp: d.time, open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume || 0 }));
    supabase.from('historical_candles').insert(insertPayload).then(({ error }) => {
      if (error) console.error('Supabase Cache Error:', error);
    });
  }

  return fetchedData;
};

export const LiveFinancialChart: React.FC = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const binanceWsRef = useRef<WebSocket | null>(null); // For dual connections
  const tooltipRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mockIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const demandZoneRef = useRef<HTMLDivElement>(null);
  const countdownRef = useRef<HTMLDivElement>(null);
  const currentCandleRef = useRef<CandlestickData | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const priceDisplayRef = useRef<HTMLParagraphElement>(null);
  const priceChangeRef = useRef<HTMLParagraphElement>(null);
  const levelsDisplayRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  // Synthetic Live Streams Refs
  const liveBaseRef = useRef<number>(0);
  const liveMultiplierRef = useRef<number>(0);

  const [symbol, setSymbol] = useState<SymbolType>('XAUEGP');
  const [timeframe, setTimeframe] = useState<string>('30M');
  const [connectionStatus, setConnectionStatus] = useState<'real' | 'simulated' | 'loading'>('loading');
  const [trend, setTrend] = useState({ bullish: 50, bearish: 50 });

  const levelsRef = useRef<ChartLevels>(GOLD_LEVELS);
  const startPriceRef = useRef<number>(0);

  const updateLevelsDOM = useCallback((levels: ChartLevels) => {
    levelsRef.current = levels;
    ['r4', 'r3', 'r2', 'r1', 'pivot', 's1', 's2', 's3', 's4'].forEach((lvl) => {
      const el = levelsDisplayRefs.current[lvl];
      if (el) el.textContent = levels[lvl as keyof ChartLevels].toFixed(3);
    });
  }, []);

  const updatePriceLines = useCallback((levels: ChartLevels) => {
    if (!seriesRef.current) return;
    const series = seriesRef.current;
    
    priceLinesRef.current.forEach(line => series.removePriceLine(line));
    priceLinesRef.current = [];

    const addLine = (price: number, color: string, title: string, style: number = 2) => {
      const line = series.createPriceLine({ 
        price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title,
        axisLabelColor: '#FFF100', axisLabelTextColor: '#000000'
      } as any);
      priceLinesRef.current.push(line);
    };

    addLine(levels.r4, '#ef5350', 'R4', 3);
    addLine(levels.r3, '#ef5350', 'R3', 3);
    addLine(levels.r2, '#ef5350', 'R2', 3);
    addLine(levels.r1, '#ef5350', 'R1', 3);
    addLine(levels.pivot, '#ffffff', 'PIVOT', 1);
    addLine(levels.s1, '#00bfa5', 'S1', 3); 
    addLine(levels.s2, '#00bfa5', 'S2', 3);
    addLine(levels.s3, '#00bfa5', 'S3', 3);
    addLine(levels.s4, '#00bfa5', 'S4', 3);
  }, []);

  const syncOverlays = useCallback(() => {
    if (!seriesRef.current || !currentCandleRef.current) return;
    const series = seriesRef.current;
    
    if (demandZoneRef.current) {
      const y1 = series.priceToCoordinate(levelsRef.current.s1);
      const y2 = series.priceToCoordinate(levelsRef.current.s2);
      if (y1 !== null && y2 !== null) {
        const top = Math.min(y1, y2);
        const height = Math.abs(y1 - y2);
        demandZoneRef.current.style.transform = `translate3d(0, ${top}px, 0)`;
        demandZoneRef.current.style.height = `${height}px`;
        demandZoneRef.current.style.opacity = '1';
      }
    }

    if (countdownRef.current) {
      const y = series.priceToCoordinate(currentCandleRef.current.close);
      if (y !== null) {
        countdownRef.current.style.transform = `translate3d(0, ${y + 12}px, 0)`;
        countdownRef.current.style.opacity = '1';
      }
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!countdownRef.current) return;
      const now = Math.floor(Date.now() / 1000);
      let secondsInTimeframe = 30 * 60;
      if (timeframe === '15M') secondsInTimeframe = 15 * 60;
      if (timeframe === '1H') secondsInTimeframe = 60 * 60;
      if (timeframe === '4H') secondsInTimeframe = 4 * 60 * 60;
      if (timeframe === '1D') secondsInTimeframe = 24 * 60 * 60;

      const remaining = secondsInTimeframe - (now % secondsInTimeframe);
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      countdownRef.current.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }, 1000);
    return () => clearInterval(interval);
  }, [timeframe]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: 'rgba(255, 255, 255, 0.5)', fontFamily: "'Inter', sans-serif" },
      grid: { vertLines: { color: 'rgba(255, 255, 255, 0.02)', style: 4 }, horzLines: { color: 'rgba(255, 255, 255, 0.02)', style: 4 } },
      crosshair: { mode: 1, vertLine: { color: 'rgba(255, 255, 255, 0.15)', style: 3 }, horzLine: { color: 'rgba(255, 255, 255, 0.15)', style: 3 } },
      timeScale: { borderColor: 'rgba(255, 255, 255, 0.05)' },
      rightPriceScale: { 
        borderColor: 'rgba(255, 255, 255, 0.05)', 
        autoScale: true,
        scaleMargins: { top: 0.3, bottom: 0.3 },
        minimumWidth: 80, 
      },
      handleScroll: { pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true, mouseWheel: true },
      handleScale: { axisPressedMouseMove: { time: true, price: true }, mouseWheel: true, pinch: true },
      kineticScroll: { touch: true, mouse: true },
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00bfa5', downColor: '#ef5350', borderVisible: false,
      wickUpColor: '#00bfa5', wickDownColor: '#ef5350',
      priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
    });
    seriesRef.current = candlestickSeries;

    const volumeSeries = chart.addSeries(HistogramSeries, { color: '#00bfa5', priceFormat: { type: 'volume' }, priceScaleId: '' });
    chart.priceScale('').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    volumeSeriesRef.current = volumeSeries;

    const startSyncLoop = () => {
      syncOverlays();
      animationFrameRef.current = requestAnimationFrame(startSyncLoop);
    };
    startSyncLoop();

    chart.subscribeCrosshairMove((param) => {
      if (!tooltipRef.current || !chartContainerRef.current || !seriesRef.current) return;
      const tooltip = tooltipRef.current;
      if (param.point === undefined || !param.time) { tooltip.style.opacity = '0'; return; }
      
      const data = param.seriesData.get(seriesRef.current) as CandlestickData;
      if (data) {
        tooltip.style.opacity = '1';
        let left = param.point.x + 15; let top = param.point.y + 15;
        if (left + 140 > chartContainerRef.current.clientWidth) left = param.point.x - 140 - 15;
        if (top + 140 > chartContainerRef.current.clientHeight) top = param.point.y - 140 - 15;
        tooltip.style.transform = `translate3d(${left}px, ${top}px, 0)`;
        const color = data.close >= data.open ? '#00bfa5' : '#ef5350';
        tooltip.innerHTML = `
          <div style="font-size: 9px; font-weight: 800; color: rgba(255,255,255,0.4); margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">OHLC Details</div>
          <div style="display: flex; justify-content: space-between; font-size: 11px;"><span style="color: rgba(255,255,255,0.6);">O</span> <span style="font-weight: 600; color: ${color};">${data.open.toFixed(3)}</span></div>
          <div style="display: flex; justify-content: space-between; font-size: 11px;"><span style="color: rgba(255,255,255,0.6);">H</span> <span style="font-weight: 600; color: ${color};">${data.high.toFixed(3)}</span></div>
          <div style="display: flex; justify-content: space-between; font-size: 11px;"><span style="color: rgba(255,255,255,0.6);">L</span> <span style="font-weight: 600; color: ${color};">${data.low.toFixed(3)}</span></div>
          <div style="display: flex; justify-content: space-between; font-size: 11px;"><span style="color: rgba(255,255,255,0.6);">C</span> <span style="font-weight: 600; color: ${color};">${data.close.toFixed(3)}</span></div>
        `;
      } else {
        tooltip.style.opacity = '0';
      }
    });

    const handleResize = () => { if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight }); };
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      chart.remove();
    };
  }, [syncOverlays]);

  useEffect(() => {
    if (!seriesRef.current || !volumeSeriesRef.current || !chartRef.current) return;
    const series = seriesRef.current;
    const vSeries = volumeSeriesRef.current;

    setConnectionStatus('loading');
    
    let watermarkText = symbol;
    if (symbol === 'XAUEGP') watermarkText = 'GOLD 21k (EGP)';
    else if (symbol === 'USDEGP') watermarkText = 'USD/EGP';
    else if (symbol === 'BTCEGP') watermarkText = 'BTC/EGP';
    chartRef.current.applyOptions({ watermark: { text: watermarkText, visible: true, fontSize: 60, horzAlign: 'center', vertAlign: 'center', color: 'rgba(255, 255, 255, 0.02)', fontFamily: "'Inter', sans-serif" } });

    let isIntentionalClose = false;

    const updatePriceUI = (price: number, open: number) => {
      if (priceDisplayRef.current) {
        priceDisplayRef.current.textContent = price.toFixed(3);
        const isUp = price >= open;
        priceDisplayRef.current.className = `font-mono font-bold text-[24px] sm:text-3xl tracking-tight transition-colors duration-300 ${isUp ? 'text-[#00bfa5] drop-shadow-[0_0_8px_rgba(0,191,165,0.4)]' : 'text-[#ef5350] drop-shadow-[0_0_8px_rgba(239,83,80,0.4)]'}`;
      }
      if (priceChangeRef.current) {
        const change = price - open;
        const percent = (change / open) * 100;
        const isUp = change >= 0;
        priceChangeRef.current.textContent = `${isUp ? '+' : ''}${change.toFixed(3)} (${percent.toFixed(2)}%)`;
        priceChangeRef.current.className = `text-[10px] sm:text-xs font-semibold mt-0.5 sm:mt-1 transition-colors duration-300 ${isUp ? 'text-[#00bfa5]/90' : 'text-[#ef5350]/90'}`;
      }
    };

    const handleTick = (price: number) => {
      if (!currentCandleRef.current) return;
      const currentCandle = currentCandleRef.current;
      const time = currentCandle.time;
      const now = Math.floor(Date.now() / 1000);
      const timeDiff = now - (time as number);
      const volColor = price >= currentCandle.open ? 'rgba(0, 191, 165, 0.25)' : 'rgba(239, 83, 80, 0.25)';

      let updatedCandle: CandlestickData;
      let updatedVolume: HistogramData;

      if (timeDiff >= 30 * 60) { // Should dynamic based on timeframe in real app
        let newTime = (time as number) + 30 * 60;
        updatedCandle = { time: newTime as Time, open: currentCandle.close, high: Math.max(currentCandle.close, price), low: Math.min(currentCandle.close, price), close: price };
        updatedVolume = { time: newTime as Time, value: Math.random() * 5 + 1, color: volColor };
      } else {
        updatedCandle = { ...currentCandle, high: Math.max(currentCandle.high, price), low: Math.min(currentCandle.low, price), close: price };
        updatedVolume = { time: time as Time, value: Math.random() * 0.5 + 5, color: volColor };
      }
      
      currentCandleRef.current = updatedCandle;
      series.update(updatedCandle);
      vSeries.update(updatedVolume);
      updatePriceUI(price, updatedCandle.open);
    };

    const startMockData = () => {
      setConnectionStatus('simulated');
      if (mockIntervalRef.current) clearInterval(mockIntervalRef.current);
      mockIntervalRef.current = setInterval(() => {
        if (!currentCandleRef.current) return;
        const volatility = currentCandleRef.current.close * 0.0005; // 0.05%
        const price = currentCandleRef.current.close + (Math.random() - 0.5) * volatility;
        handleTick(price);
      }, 1000);
    };

    const connectWS = () => {
      if (wsRef.current) wsRef.current.close();
      if (binanceWsRef.current) binanceWsRef.current.close();

      setConnectionStatus('real');

      if (symbol === 'BTCUSDT') {
        const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@ticker');
        binanceWsRef.current = ws;
        ws.onmessage = (e) => { const d = JSON.parse(e.data); if (d.c) handleTick(parseFloat(d.c)); };
      } 
      else if (symbol === 'BTCEGP') {
        // Dual connection for Synthetic BTCEGP
        const wsBtc = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@ticker');
        const wsUsd = new WebSocket('wss://ws.twelvedata.com/v1/quotes/price?apikey=0c5eb27deca246138223f51b4fdad554');
        binanceWsRef.current = wsBtc; wsRef.current = wsUsd;
        
        wsBtc.onmessage = (e) => { const d = JSON.parse(e.data); if (d.c) liveBaseRef.current = parseFloat(d.c); if (liveMultiplierRef.current) handleTick(liveBaseRef.current * liveMultiplierRef.current); };
        wsUsd.onopen = () => wsUsd.send(JSON.stringify({ action: 'subscribe', params: { symbols: 'USD/EGP' } }));
        wsUsd.onmessage = (e) => { const d = JSON.parse(e.data); if (d.price) liveMultiplierRef.current = parseFloat(d.price); };
      }
      else {
        // TwelveData assets (XAUUSD, WTIUSD, USDEGP, XAUEGP)
        const ws = new WebSocket('wss://ws.twelvedata.com/v1/quotes/price?apikey=0c5eb27deca246138223f51b4fdad554');
        wsRef.current = ws;
        
        let wsSymbols = symbol === 'XAUUSD' ? 'XAU/USD' : symbol === 'WTIUSD' ? 'WTI/USD' : symbol === 'USDEGP' ? 'USD/EGP' : 'XAU/USD,USD/EGP';
        
        ws.onopen = () => ws.send(JSON.stringify({ action: 'subscribe', params: { symbols: wsSymbols } }));
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.event !== 'price' || !data.price) return;
            
            if (symbol === 'XAUEGP') {
              if (data.symbol === 'XAU/USD') liveBaseRef.current = parseFloat(data.price);
              if (data.symbol === 'USD/EGP') liveMultiplierRef.current = parseFloat(data.price);
              if (liveBaseRef.current > 0 && liveMultiplierRef.current > 0) {
                 handleTick((liveBaseRef.current / 31.103) * (21/24) * liveMultiplierRef.current);
              }
            } else {
              handleTick(parseFloat(data.price));
            }
          } catch (e) {}
        };
        ws.onclose = () => { if (!isIntentionalClose) { setConnectionStatus('simulated'); startMockData(); } };
      }
    };

    (async () => {
      try {
        const fetchedHistory = await getHistoricalData(symbol, timeframe);
        const candles = fetchedHistory.map(d => ({ time: d.time as Time, open: d.open, high: d.high, low: d.low, close: d.close }));
        const volumes = fetchedHistory.map(d => ({ time: d.time as Time, value: d.volume, color: d.close >= d.open ? 'rgba(0, 191, 165, 0.25)' : 'rgba(239, 83, 80, 0.25)' }));

        series.setData(candles);
        vSeries.setData(volumes);

        currentCandleRef.current = { ...candles[candles.length - 1] };
        const startPrice = currentCandleRef.current.close;
        startPriceRef.current = startPrice;

        // Initialize Live Refs for synthetic streams to the last known close
        if (symbol === 'XAUEGP' || symbol === 'BTCEGP') {
           // Fallback initialization just in case ws is slow
           liveMultiplierRef.current = 48.0; // safe approx
           liveBaseRef.current = symbol === 'XAUEGP' ? startPrice / liveMultiplierRef.current * (24/21) * 31.103 : startPrice / liveMultiplierRef.current;
        }

        const historyHigh = Math.max(...candles.map(c => c.high));
        const historyLow = Math.min(...candles.map(c => c.low));
        
        const newLevels = calculateProfessionalLevels(historyHigh, historyLow, startPrice);
        updateLevelsDOM(newLevels);
        updatePriceLines(newLevels);

        const closes = candles.map(c => c.close);
        const rsiValue = calculateRSI(closes, 14);
        setTrend({ bullish: Math.round(rsiValue), bearish: 100 - Math.round(rsiValue) });

        if (priceDisplayRef.current) priceDisplayRef.current.textContent = startPrice.toFixed(3);
        if (priceChangeRef.current) priceChangeRef.current.textContent = `+0.000 (0.00%)`;

        if (!isIntentionalClose) connectWS();
      } catch (err) {
        console.error('Critical initialization error:', err);
      }
    })();

    return () => {
      isIntentionalClose = true;
      if (mockIntervalRef.current) clearInterval(mockIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
      if (binanceWsRef.current) binanceWsRef.current.close();
    };
  }, [symbol, timeframe, updateLevelsDOM, updatePriceLines]);

  const assetName = symbol === 'XAUUSD' ? 'GOLD' : symbol === 'WTIUSD' ? 'WTI' : symbol === 'BTCUSDT' ? 'BTC' : symbol === 'USDEGP' ? 'USD (EGP)' : symbol === 'XAUEGP' ? 'GOLD 21k' : 'BTC (EGP)';
  const assetTitle = symbol === 'XAUUSD' ? 'Gold vs US Dollar' : symbol === 'WTIUSD' ? 'WTI Crude Oil' : symbol === 'BTCUSDT' ? 'Bitcoin vs Tether' : symbol === 'USDEGP' ? 'US Dollar vs EGP' : symbol === 'XAUEGP' ? 'Gold Gram 21K vs EGP' : 'Bitcoin vs EGP';
  const timeframes = ['15M', '30M', '1H', '4H', '1D'];

  return (
    <div className="relative w-full h-full min-h-screen bg-[#07090e] overflow-hidden font-sans">
      
      <div className="absolute top-4 sm:top-6 left-4 right-4 sm:left-auto sm:right-8 z-20 flex sm:justify-end items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar pb-2 sm:pb-0">
        
        <div className="flex shrink-0 bg-[#0b0e14] border border-white/5 rounded-lg shadow-lg p-1 gap-1">
           {timeframes.map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)} className={`px-2 py-1 sm:px-3 sm:py-1 text-[10px] sm:text-[11px] font-bold tracking-wide rounded-md transition-all duration-300 ${timeframe === tf ? 'bg-white/10 text-[#00bfa5] shadow-sm ring-1 ring-white/10' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>{tf}</button>
           ))}
        </div>

        <div className="relative group shrink-0">
          <select 
            className="appearance-none bg-[#0b0e14] border border-white/5 pl-3 pr-8 sm:pl-4 sm:pr-10 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs tracking-wide text-white font-semibold outline-none cursor-pointer shadow-lg focus:border-white/20 transition-all duration-300 hover:bg-white/10"
            value={symbol} onChange={(e) => setSymbol(e.target.value as SymbolType)}
          >
            <optgroup label="Global Markets">
              <option value="XAUUSD" className="bg-[#0b0e14]">🥇 XAU/USD (Gold)</option>
              <option value="BTCUSDT" className="bg-[#0b0e14]">₿ BTC/USDT</option>
              <option value="WTIUSD" className="bg-[#0b0e14]">🛢️ WTI/USD (Oil)</option>
            </optgroup>
            <optgroup label="Local Markets (EGP)">
              <option value="USDEGP" className="bg-[#0b0e14]">🇪🇬 USD/EGP</option>
              <option value="XAUEGP" className="bg-[#0b0e14]">🇪🇬 Gold 21K (EGP)</option>
              <option value="BTCEGP" className="bg-[#0b0e14]">🇪🇬 BTC/EGP</option>
            </optgroup>
          </select>
          <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-white"><svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M6 9l6 6 6-6"></path></svg></div>
        </div>

        <div className="flex shrink-0 items-center space-x-1.5 sm:space-x-2 bg-[#0b0e14] border border-white/5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg shadow-lg ring-1 ring-white/5">
          <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-pulse shadow-[0_0_12px_currentColor] ${connectionStatus === 'real' ? 'bg-[#00bfa5] text-[#00bfa5]' : connectionStatus === 'loading' ? 'bg-[#fb8c00] text-[#fb8c00]' : 'bg-[#ef5350] text-[#ef5350]'}`}></div>
          <span className="text-white font-bold tracking-[0.1em] sm:tracking-[0.15em] text-[8px] sm:text-[9px] mt-0.5 whitespace-nowrap">{connectionStatus === 'real' ? 'LIVE DATA' : connectionStatus === 'loading' ? 'LOADING...' : 'API ERROR'}</span>
        </div>
      </div>

      <div className="absolute top-[64px] sm:top-6 left-4 right-4 sm:right-auto sm:left-6 z-10 bg-[#07090e]/80 sm:bg-[#07090e]/70 backdrop-blur-2xl sm:backdrop-blur-3xl border border-white/5 rounded-2xl p-4 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.8),_inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-white/5 text-white sm:w-[340px] pointer-events-none flex flex-col gap-4 sm:gap-7 transition-all duration-500">
        <div className="flex justify-between items-center sm:items-start">
          <div className="space-y-0.5 sm:space-y-1.5">
            <h1 className="text-white font-extrabold text-[22px] sm:text-[28px] tracking-tighter leading-none drop-shadow-[0_0_12px_rgba(255,255,255,0.1)]">{symbol}</h1>
            <p className="text-[10px] sm:text-xs text-gray-400 font-semibold tracking-wide uppercase">{assetTitle} <span className="opacity-30 mx-1">•</span> {timeframe}</p>
          </div>
          <div className="text-right">
            <p ref={priceDisplayRef} className="font-mono font-bold text-[24px] sm:text-3xl tracking-tight text-[#00bfa5] drop-shadow-[0_0_8px_rgba(0,191,165,0.4)]">0.000</p>
            <p ref={priceChangeRef} className="text-[10px] sm:text-xs font-semibold mt-0.5 sm:mt-1 text-[#00bfa5]/90">+0.000 (0.00%)</p>
          </div>
        </div>

        <div className="hidden sm:block">
          <p className="text-[9px] font-extrabold text-white/30 uppercase tracking-[0.25em] mb-3">{assetName} SELLING AREAS</p>
          <div className="grid grid-cols-2 gap-2.5">
            {['R4', 'R3', 'R2', 'R1'].map(lvl => (
               <div key={lvl} className="flex justify-between items-center bg-[#0b0e14] border border-white/[0.03] px-3 py-2 rounded-xl transition-all duration-300">
                 <span className="text-[10px] font-bold text-gray-500 tracking-wider">{lvl}</span>
                 <span ref={el => levelsDisplayRefs.current[lvl.toLowerCase()] = el} className="text-[12px] text-[#ef5350] font-mono font-bold drop-shadow-[0_0_4px_rgba(239,83,80,0.3)]">0.000</span>
               </div>
            ))}
          </div>
        </div>

        <div className="hidden sm:block">
          <p className="text-[9px] font-extrabold text-[#00bfa5]/30 uppercase tracking-[0.25em] mb-3">{assetName} DEMAND ZONE</p>
          <div className="grid grid-cols-2 gap-2.5">
             {['S1', 'S2', 'S3', 'S4'].map(lvl => (
               <div key={lvl} className="flex justify-between items-center bg-[#0b0e14] border border-white/[0.03] px-3 py-2 rounded-xl transition-all duration-300">
                 <span className="text-[10px] font-bold text-gray-500 tracking-wider">{lvl}</span>
                 <span ref={el => levelsDisplayRefs.current[lvl.toLowerCase()] = el} className="text-[12px] text-[#00bfa5] font-mono font-bold drop-shadow-[0_0_4px_rgba(0,191,165,0.3)]">0.000</span>
               </div>
            ))}
          </div>
        </div>

        <div className="flex sm:flex-col gap-4 sm:gap-7 items-center sm:items-stretch">
          <div className="flex-1 sm:flex-none flex items-center sm:justify-between bg-[#0b0e14] border border-white/[0.05] p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] justify-between">
            <p className="text-[9px] sm:text-[10px] font-extrabold text-white/40 uppercase tracking-[0.15em] sm:tracking-[0.25em]">{assetName} PIVOT</p>
            <div className="bg-white/10 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg shadow-inner ring-1 ring-white/10">
              <span ref={el => levelsDisplayRefs.current['pivot'] = el} className="text-[11px] sm:text-[13px] font-mono font-bold text-[#FFF100] drop-shadow-[0_0_6px_rgba(255,241,0,0.5)]">0.000</span>
            </div>
          </div>
          <div className="flex-1 sm:flex-none w-full">
            <p className="hidden sm:block text-[9px] font-extrabold text-white/30 uppercase tracking-[0.25em] mb-3">{assetName} TREND NOW</p>
            <div className="flex justify-between mb-1.5 sm:mb-2">
              <span className="text-[9px] sm:text-[10px] text-[#ef5350] font-bold tracking-[0.1em] drop-shadow-[0_0_4px_rgba(239,83,80,0.3)]">{trend.bearish}%</span>
              <span className="text-[9px] sm:text-[10px] text-[#00bfa5] font-bold tracking-[0.1em] drop-shadow-[0_0_4px_rgba(0,191,165,0.3)]">{trend.bullish}%</span>
            </div>
            <div className="flex w-full bg-white/[0.02] rounded-full overflow-hidden h-1 sm:h-1.5 shadow-inner ring-1 ring-white/5">
              <div className="bg-gradient-to-r from-[#ef5350]/80 to-[#ef5350] transition-all duration-1000 ease-out" style={{ width: `${trend.bearish}%` }} />
              <div className="bg-gradient-to-r from-[#00bfa5] to-[#00bfa5]/80 transition-all duration-1000 ease-out" style={{ width: `${trend.bullish}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div ref={chartContainerRef} className="absolute inset-0 touch-none" />
      
      <div ref={demandZoneRef} className="absolute left-0 right-[80px] bg-[#00bfa5]/5 pointer-events-none transition-transform duration-75 will-change-transform z-0" style={{ opacity: 0, height: 0, borderTop: '1px dashed rgba(0,191,165,0.1)', borderBottom: '1px dashed rgba(0,191,165,0.1)' }} />
      <div ref={countdownRef} className="absolute right-0 w-[80px] text-center font-mono font-bold text-[10px] text-[#00bfa5] pointer-events-none transition-transform duration-75 will-change-transform z-10 bg-[#07090e]/80 py-0.5 border-t border-b border-[#00bfa5]/20 shadow-[0_0_8px_rgba(0,191,165,0.2)]" style={{ opacity: 0 }}>00:00</div>
      <div ref={tooltipRef} className="absolute z-50 left-0 top-0 bg-[#07090e]/95 backdrop-blur-3xl border border-white/10 p-3 sm:p-4 rounded-xl text-white shadow-[0_16px_40px_rgba(0,0,0,0.9),_inset_0_1px_0_rgba(255,255,255,0.1)] pointer-events-none transition-all duration-75 ease-out origin-top-left will-change-transform" style={{ opacity: 0, transform: 'translate3d(-999px, -999px, 0)' }} />
    </div>
  );
};

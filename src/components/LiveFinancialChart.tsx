import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, ColorType, CandlestickSeries, HistogramSeries, Time, CandlestickData, HistogramData, IPriceLine } from 'lightweight-charts';

type SymbolType = 'XAUUSD' | 'BTCUSDT' | 'WTIUSD';

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
  r4: 4120.00,
  r3: 4106.00,
  r2: 4094.00,
  r1: 4078.00,
  pivot: 4077.00,
  s1: 4063.00,
  s2: 4051.00,
  s3: 4035.00,
  s4: 4021.00,
};

function calculateLevels(currentPrice: number): ChartLevels {
  const pivot = Math.floor(currentPrice);
  const range = currentPrice * 0.005; 
  return {
    r4: pivot + range * 4,
    r3: pivot + range * 3,
    r2: pivot + range * 2,
    r1: pivot + range * 1,
    pivot: pivot,
    s1: pivot - range * 1,
    s2: pivot - range * 2,
    s3: pivot - range * 3,
    s4: pivot - range * 4,
  };
}

function generateHistoricalData(currentPrice: number, count: number = 100): { candles: CandlestickData[], volumes: HistogramData[] } {
  const candles: CandlestickData[] = [];
  const volumes: HistogramData[] = [];
  let price = currentPrice;
  let time = Math.floor(Date.now() / 1000) - count * 30 * 60;
  time -= time % (30 * 60);

  const volatility = currentPrice * 0.001;

  for (let i = 0; i < count; i++) {
    const open = price;
    const high = open + Math.random() * volatility;
    const low = open - Math.random() * volatility;
    const close = low + Math.random() * (high - low);
    
    candles.push({
      time: time as Time,
      open,
      high: Math.max(open, close, high),
      low: Math.min(open, close, low),
      close,
    });

    const isGreen = close >= open;
    volumes.push({
      time: time as Time,
      value: Math.random() * 100 + 50,
      color: isGreen ? 'rgba(38, 166, 154, 0.25)' : 'rgba(239, 83, 80, 0.25)',
    });

    price = close;
    time += 30 * 60;
  }
  return { candles, volumes };
}

export const LiveFinancialChart: React.FC = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mockIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // DOM Refs for High-Frequency Updates (Prevents React Re-Renders)
  const priceDisplayRef = useRef<HTMLParagraphElement>(null);
  const priceChangeRef = useRef<HTMLParagraphElement>(null);
  const levelsDisplayRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  const [symbol, setSymbol] = useState<SymbolType>('XAUUSD');
  const [timeframe, setTimeframe] = useState<string>('30M');
  const [connectionStatus, setConnectionStatus] = useState<'real' | 'simulated'>('simulated');

  // We keep levels in ref to be able to access them in ws closure without dependency array mess
  const levelsRef = useRef<ChartLevels>(GOLD_LEVELS);
  const startPriceRef = useRef<number>(0);

  const updateLevelsDOM = useCallback((levels: ChartLevels) => {
    levelsRef.current = levels;
    ['r4', 'r3', 'r2', 'r1', 'pivot', 's1', 's2', 's3', 's4'].forEach((lvl) => {
      const el = levelsDisplayRefs.current[lvl];
      if (el) {
        el.textContent = levels[lvl as keyof ChartLevels].toFixed(2);
      }
    });
  }, []);

  const updatePriceLines = useCallback((levels: ChartLevels) => {
    if (!seriesRef.current) return;
    const series = seriesRef.current;
    
    priceLinesRef.current.forEach(line => series.removePriceLine(line));
    priceLinesRef.current = [];

    const addLine = (price: number, color: string, title: string, style: number = 2) => {
      const line = series.createPriceLine({
        price,
        color,
        lineWidth: 1,
        lineStyle: style,
        axisLabelVisible: true,
        title,
      });
      priceLinesRef.current.push(line);
    };

    addLine(levels.r4, '#ef5350', 'R4', 3);
    addLine(levels.r3, '#ef5350', 'R3', 3);
    addLine(levels.r2, '#ef5350', 'R2', 3);
    addLine(levels.r1, '#ef5350', 'R1', 3);
    addLine(levels.pivot, '#ffffff', 'PIVOT', 1); // Premium white pivot line
    addLine(levels.s1, '#26a69a', 'S1', 3);
    addLine(levels.s2, '#26a69a', 'S2', 3);
    addLine(levels.s3, '#26a69a', 'S3', 3);
    addLine(levels.s4, '#26a69a', 'S4', 3);
  }, []);

  // Handle Chart Initialization & Resize
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(255, 255, 255, 0.5)',
        fontFamily: "'Inter', sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.02)', style: 4 }, // Dotted, very subtle
        horzLines: { color: 'rgba(255, 255, 255, 0.02)', style: 4 },
      },
      watermark: {
        visible: true,
        fontSize: 140,
        horzAlign: 'center',
        vertAlign: 'center',
        color: 'rgba(255, 255, 255, 0.015)', // Ultra-subtle watermark
        text: 'XAU/USD',
        fontFamily: "'Inter', sans-serif",
      },
      crosshair: {
        mode: 1,
        vertLine: { color: 'rgba(255, 255, 255, 0.15)', width: 1, style: 3, labelBackgroundColor: '#1e222d' },
        horzLine: { color: 'rgba(255, 255, 255, 0.15)', width: 1, style: 3, labelBackgroundColor: '#1e222d' },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.05)',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.05)',
        autoScale: true,
      },
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });

    seriesRef.current = candlestickSeries;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // Overlay series
    });
    
    chart.priceScale('').applyOptions({
      scaleMargins: {
        top: 0.85, 
        bottom: 0,
      },
    });

    volumeSeriesRef.current = volumeSeries;

    chart.subscribeCrosshairMove((param) => {
      if (!tooltipRef.current || !chartContainerRef.current || !seriesRef.current) return;
      const tooltip = tooltipRef.current;
      
      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > chartContainerRef.current.clientWidth ||
        param.point.y < 0 ||
        param.point.y > chartContainerRef.current.clientHeight
      ) {
        tooltip.style.opacity = '0';
      } else {
        const data = param.seriesData.get(seriesRef.current) as CandlestickData;
        if (data) {
          tooltip.style.opacity = '1';
          const tooltipWidth = 150;
          const tooltipHeight = 150;
          let left = param.point.x + 20;
          let top = param.point.y + 20;
          
          if (left + tooltipWidth > chartContainerRef.current.clientWidth) {
            left = param.point.x - tooltipWidth - 20;
          }
          if (top + tooltipHeight > chartContainerRef.current.clientHeight) {
            top = param.point.y - tooltipHeight - 20;
          }
          
          // Fluid Transform animation instead of layout-thrashing left/top
          tooltip.style.transform = `translate(${left}px, ${top}px)`;
          
          const isGreen = data.close >= data.open;
          const color = isGreen ? '#26a69a' : '#ef5350';
          
          tooltip.innerHTML = `
            <div style="font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.4); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">OHLC Details</div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px;"><span style="color: rgba(255,255,255,0.6);">Open</span> <span style="font-family: 'JetBrains Mono', monospace; font-weight: 600; color: ${color}; text-shadow: 0 0 8px ${color}40;">${data.open.toFixed(2)}</span></div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px;"><span style="color: rgba(255,255,255,0.6);">High</span> <span style="font-family: 'JetBrains Mono', monospace; font-weight: 600; color: ${color}; text-shadow: 0 0 8px ${color}40;">${data.high.toFixed(2)}</span></div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px;"><span style="color: rgba(255,255,255,0.6);">Low</span> <span style="font-family: 'JetBrains Mono', monospace; font-weight: 600; color: ${color}; text-shadow: 0 0 8px ${color}40;">${data.low.toFixed(2)}</span></div>
            <div style="display: flex; justify-content: space-between; font-size: 12px;"><span style="color: rgba(255,255,255,0.6);">Close</span> <span style="font-family: 'JetBrains Mono', monospace; font-weight: 600; color: ${color}; text-shadow: 0 0 8px ${color}40;">${data.close.toFixed(2)}</span></div>
          `;
        } else {
          tooltip.style.opacity = '0';
        }
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Handle WebSocket Data & Mock Fallback
  useEffect(() => {
    if (!seriesRef.current || !volumeSeriesRef.current || !chartRef.current) return;
    const series = seriesRef.current;
    const vSeries = volumeSeriesRef.current;

    // Update Watermark safely
    chartRef.current.applyOptions({
      watermark: { text: symbol === 'BTCUSDT' ? 'BTC/USDT' : symbol === 'WTIUSD' ? 'WTI/USD' : 'XAU/USD' }
    });

    // Reset data
    let startPrice = symbol === 'XAUUSD' ? 4077 : symbol === 'WTIUSD' ? 82.50 : 65000;
    startPriceRef.current = startPrice;
    
    let currentCandle: CandlestickData | null = null;
    let currentVolume: HistogramData | null = null;
    const { candles, volumes } = generateHistoricalData(startPrice, 100);
    
    series.setData(candles);
    vSeries.setData(volumes);

    currentCandle = { ...candles[candles.length - 1] };
    currentVolume = { ...volumes[volumes.length - 1] };
    
    const newLevels = symbol === 'BTCUSDT' || symbol === 'WTIUSD' ? calculateLevels(startPrice) : GOLD_LEVELS;
    updateLevelsDOM(newLevels);
    updatePriceLines(newLevels);

    if (priceDisplayRef.current) priceDisplayRef.current.textContent = startPrice.toFixed(2);
    if (priceChangeRef.current) priceChangeRef.current.textContent = `+0.00 (0.00%)`;

    const updatePriceUI = (price: number, open: number) => {
      if (priceDisplayRef.current) {
        priceDisplayRef.current.textContent = price.toFixed(2);
        const isUp = price >= open;
        priceDisplayRef.current.className = `font-mono font-bold text-3xl tracking-tight transition-colors duration-300 ${isUp ? 'text-[#26a69a] drop-shadow-[0_0_8px_rgba(38,166,154,0.4)]' : 'text-[#ef5350] drop-shadow-[0_0_8px_rgba(239,83,80,0.4)]'}`;
      }
      if (priceChangeRef.current) {
        const change = price - open;
        const percent = (change / open) * 100;
        const isUp = change >= 0;
        priceChangeRef.current.textContent = `${isUp ? '+' : ''}${change.toFixed(2)} (${percent.toFixed(2)}%)`;
        priceChangeRef.current.className = `text-xs font-semibold mt-1 transition-colors duration-300 ${isUp ? 'text-[#26a69a]/90' : 'text-[#ef5350]/90'}`;
      }
    };

    const handleTick = (price: number) => {
      if (!currentCandle || !currentVolume) return;
      
      const time = currentCandle.time;
      const now = Math.floor(Date.now() / 1000);
      const timeDiff = now - (time as number);
      const isGreen = price >= currentCandle.open;
      const volColor = isGreen ? 'rgba(38, 166, 154, 0.25)' : 'rgba(239, 83, 80, 0.25)';

      if (timeDiff >= 30 * 60) {
        let newTime = (time as number) + 30 * 60;
        currentCandle = {
          time: newTime as Time,
          open: currentCandle.close,
          high: Math.max(currentCandle.close, price),
          low: Math.min(currentCandle.close, price),
          close: price
        };
        currentVolume = {
          time: newTime as Time,
          value: Math.random() * 5 + 1,
          color: volColor
        };
      } else {
        currentCandle = {
          ...currentCandle,
          high: Math.max(currentCandle.high, price),
          low: Math.min(currentCandle.low, price),
          close: price
        };
        currentVolume = {
          ...currentVolume,
          value: currentVolume.value + Math.random() * 0.5,
          color: volColor
        };
      }
      
      series.update(currentCandle);
      vSeries.update(currentVolume);
      updatePriceUI(price, currentCandle.open);

      if (symbol !== 'XAUUSD') {
        const recalculatedLevels = calculateLevels(price);
        if (Math.abs(recalculatedLevels.pivot - levelsRef.current.pivot) > (price * 0.001)) {
          updateLevelsDOM(recalculatedLevels);
          updatePriceLines(recalculatedLevels);
        }
      }
    };

    const startMockData = () => {
      setConnectionStatus('simulated');
      if (mockIntervalRef.current) clearInterval(mockIntervalRef.current);
      mockIntervalRef.current = setInterval(() => {
        if (!currentCandle) return;
        const volatility = symbol === 'XAUUSD' ? 0.5 : symbol === 'WTIUSD' ? 0.05 : 5;
        const price = currentCandle.close + (Math.random() - 0.5) * volatility;
        handleTick(price);
      }, 1000);
    };

    let isIntentionalClose = false;

    const connectWS = () => {
      let firstTickLogged = false;
      if (wsRef.current) {
        wsRef.current.close();
      }

      let wsUrl = '';
      if (symbol === 'XAUUSD' || symbol === 'WTIUSD') {
        wsUrl = 'wss://ws.twelvedata.com/v1/quotes/price?apikey=0c5eb27deca246138223f51b4fdad554';
      } else {
        wsUrl = 'wss://stream.binance.com:9443/ws/btcusdt@ticker';
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`Connected to ${symbol} WebSocket`);
        setConnectionStatus('real');
        // Stop mock data when connected
        if (mockIntervalRef.current) {
          clearInterval(mockIntervalRef.current);
          mockIntervalRef.current = null;
        }

        if (symbol === 'XAUUSD') {
          ws.send(JSON.stringify({ action: 'subscribe', params: { symbols: 'XAU/USD' } }));
        } else if (symbol === 'WTIUSD') {
          ws.send(JSON.stringify({ action: 'subscribe', params: { symbols: 'WTI/USD' } }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          let price = 0;

          if ((symbol === 'XAUUSD' || symbol === 'WTIUSD') && data.event === 'price' && data.price) {
            price = parseFloat(data.price);
          } else if (symbol === 'BTCUSDT' && data.c) {
            price = parseFloat(data.c);
          }

          if (price > 0) {
            if (!firstTickLogged) {
              console.log('Real Tick Received:', price);
              firstTickLogged = true;
            }
            handleTick(price);
          }
        } catch (e) {
          console.error('Error parsing WS message', e);
        }
      };

      ws.onclose = () => {
        if (!isIntentionalClose) {
          console.log(`Disconnected from ${symbol} WebSocket. Starting mock fallback and scheduling reconnect...`);
          setConnectionStatus('simulated');
          startMockData();
          reconnectTimeoutRef.current = setTimeout(connectWS, 5000); 
        }
      };
      
      ws.onerror = () => {
        console.warn(`WebSocket error for ${symbol}. Closing socket to trigger reconnect.`);
        setConnectionStatus('simulated');
        ws.close();
      };
    };

    connectWS();

    return () => {
      isIntentionalClose = true;
      if (mockIntervalRef.current) clearInterval(mockIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [symbol, updateLevelsDOM, updatePriceLines]);

  const assetName = symbol === 'XAUUSD' ? 'GOLD' : symbol === 'WTIUSD' ? 'WTI' : 'BTC';
  const assetTitle = symbol === 'XAUUSD' ? 'Gold vs US Dollar' : symbol === 'WTIUSD' ? 'WTI Crude Oil' : 'Bitcoin vs Tether';
  const timeframes = ['15M', '30M', '1H', '4H', '1D'];

  const bearishPercent = symbol === 'BTCUSDT' ? 42 : 47;
  const bullishPercent = 100 - bearishPercent;

  return (
    <div className="relative w-full h-full min-h-screen bg-gradient-to-b from-[#050609] to-[#0b0e14] overflow-hidden font-sans">
      
      {/* Top Header Controls */}
      <div className="absolute top-6 right-4 sm:right-8 z-20 flex flex-wrap justify-end items-center gap-3">
        
        {/* Timeframe Selector */}
        <div className="flex bg-white/5 border border-white/5 rounded-lg overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-2xl p-1 gap-1">
           {timeframes.map(tf => (
              <button 
                 key={tf}
                 onClick={() => setTimeframe(tf)}
                 className={`px-3 py-1 text-[11px] font-bold tracking-wide rounded-md transition-all duration-300 ${timeframe === tf ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
              >
                {tf}
              </button>
           ))}
        </div>

        {/* Market Switcher */}
        <div className="relative group">
          <select 
            className="appearance-none bg-white/5 border border-white/5 pl-4 pr-10 py-1.5 rounded-lg text-xs tracking-wide text-white font-semibold outline-none cursor-pointer shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-2xl focus:border-white/20 transition-all duration-300 hover:bg-white/10"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value as SymbolType)}
          >
            <option value="XAUUSD" className="bg-[#0b0e14]">🥇 XAU/USD</option>
            <option value="BTCUSDT" className="bg-[#0b0e14]">₿ BTC/USDT</option>
            <option value="WTIUSD" className="bg-[#0b0e14]">🛢️ WTI/USD</option>
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 transition-colors group-hover:text-white">
             <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"><path d="M6 9l6 6 6-6"></path></svg>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-white/5 border border-white/5 px-3 py-1.5 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-2xl ring-1 ring-white/5">
          <div className={`w-2 h-2 rounded-full animate-pulse shadow-[0_0_12px_currentColor] ${connectionStatus === 'real' ? 'bg-[#26a69a] text-[#26a69a]' : 'bg-[#ef5350] text-[#ef5350]'}`}></div>
          <span className="text-white font-bold tracking-[0.15em] text-[9px] mt-0.5">
            {connectionStatus === 'real' ? 'LIVE DATA' : 'API ERROR'}
          </span>
        </div>
      </div>

      {/* Floating UI Overlay */}
      <div className="absolute top-[80px] sm:top-6 left-4 sm:left-6 z-10 bg-[#07090e]/70 backdrop-blur-3xl border border-white/5 rounded-2xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.8),_inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-white/5 text-white w-[calc(100%-2rem)] sm:w-[340px] pointer-events-none space-y-7 transition-all duration-500">
        
        <div className="flex justify-between items-start">
          <div className="space-y-1.5">
            <h1 className="text-white font-bold text-[28px] tracking-tighter leading-none drop-shadow-[0_0_12px_rgba(255,255,255,0.1)]">{symbol}</h1>
            <p className="text-xs text-gray-400 font-semibold tracking-wide uppercase">{assetTitle} <span className="opacity-30 mx-1">•</span> {timeframe}</p>
          </div>
          <div className="text-right">
            <p ref={priceDisplayRef} className="font-mono font-bold text-3xl tracking-tight text-[#26a69a] drop-shadow-[0_0_8px_rgba(38,166,154,0.4)]">
              0.00
            </p>
            <p ref={priceChangeRef} className="text-xs font-semibold mt-1 text-[#26a69a]/90">
              +0.00 (0.00%)
            </p>
          </div>
        </div>

        {/* SELLING AREAS */}
        <div>
          <p className="text-[9px] font-extrabold text-white/30 uppercase tracking-[0.25em] mb-3">{assetName} SELLING AREAS</p>
          <div className="grid grid-cols-2 gap-2.5">
            {['R4', 'R3', 'R2', 'R1'].map(lvl => (
               <div key={lvl} className="flex justify-between items-center bg-white/[0.03] border border-white/[0.03] px-3 py-2 rounded-xl transition-all duration-300">
                 <span className="text-[10px] font-bold text-gray-500 tracking-wider">{lvl}</span>
                 <span ref={el => levelsDisplayRefs.current[lvl.toLowerCase()] = el} className="text-[12px] text-[#ef5350] font-mono font-bold drop-shadow-[0_0_4px_rgba(239,83,80,0.3)]">0.00</span>
               </div>
            ))}
          </div>
        </div>

        {/* BUYING AREAS */}
        <div>
          <p className="text-[9px] font-extrabold text-white/30 uppercase tracking-[0.25em] mb-3">{assetName} BUYING AREAS</p>
          <div className="grid grid-cols-2 gap-2.5">
             {['S1', 'S2', 'S3', 'S4'].map(lvl => (
               <div key={lvl} className="flex justify-between items-center bg-white/[0.03] border border-white/[0.03] px-3 py-2 rounded-xl transition-all duration-300">
                 <span className="text-[10px] font-bold text-gray-500 tracking-wider">{lvl}</span>
                 <span ref={el => levelsDisplayRefs.current[lvl.toLowerCase()] = el} className="text-[12px] text-[#26a69a] font-mono font-bold drop-shadow-[0_0_4px_rgba(38,166,154,0.3)]">0.00</span>
               </div>
            ))}
          </div>
        </div>

        {/* PIVOT POINT */}
        <div className="flex items-center justify-between bg-white/[0.03] border border-white/[0.05] p-4 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          <p className="text-[10px] font-extrabold text-white/40 uppercase tracking-[0.25em]">{assetName} PIVOT POINT</p>
          <div className="bg-white/10 px-3 py-1.5 rounded-lg shadow-inner ring-1 ring-white/10">
            <span ref={el => levelsDisplayRefs.current['pivot'] = el} className="text-[13px] font-mono font-bold text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.5)]">0.00</span>
          </div>
        </div>

        {/* TREND NOW */}
        <div>
          <p className="text-[9px] font-extrabold text-white/30 uppercase tracking-[0.25em] mb-3">{assetName} TREND NOW</p>
          <div className="flex justify-between mb-2">
            <span className="text-[10px] text-[#ef5350] font-bold tracking-[0.1em] drop-shadow-[0_0_4px_rgba(239,83,80,0.3)]">BEARISH {bearishPercent}%</span>
            <span className="text-[10px] text-[#26a69a] font-bold tracking-[0.1em] drop-shadow-[0_0_4px_rgba(38,166,154,0.3)]">BULLISH {bullishPercent}%</span>
          </div>
          <div className="flex w-full bg-white/[0.02] rounded-full overflow-hidden h-1.5 shadow-inner ring-1 ring-white/5">
            <div className="bg-gradient-to-r from-[#ef5350]/80 to-[#ef5350] transition-all duration-1000 ease-out" style={{ width: `${bearishPercent}%` }} />
            <div className="bg-gradient-to-r from-[#26a69a] to-[#26a69a]/80 transition-all duration-1000 ease-out" style={{ width: `${bullishPercent}%` }} />
          </div>
        </div>

      </div>

      <div ref={chartContainerRef} className="absolute inset-0" />
      
      {/* Dynamic Tooltip */}
      <div 
        ref={tooltipRef} 
        className="absolute z-50 left-0 top-0 bg-[#07090e]/95 backdrop-blur-3xl border border-white/10 p-4 rounded-xl text-white shadow-[0_16px_40px_rgba(0,0,0,0.9),_inset_0_1px_0_rgba(255,255,255,0.1)] pointer-events-none transition-all duration-150 ease-out origin-top-left"
        style={{ opacity: 0, transform: 'translate(-999px, -999px)' }}
      />
    </div>
  );
};

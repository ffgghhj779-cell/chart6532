import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, ColorType, CandlestickSeries, Time, CandlestickData, IPriceLine } from 'lightweight-charts';

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

function generateHistoricalData(currentPrice: number, count: number = 100): CandlestickData[] {
  const data: CandlestickData[] = [];
  let price = currentPrice;
  let time = Math.floor(Date.now() / 1000) - count * 30 * 60;
  time -= time % (30 * 60);

  const volatility = currentPrice * 0.001;

  for (let i = 0; i < count; i++) {
    const open = price;
    const high = open + Math.random() * volatility;
    const low = open - Math.random() * volatility;
    const close = low + Math.random() * (high - low);
    
    data.push({
      time: time as Time,
      open,
      high,
      low,
      close,
    });

    price = close;
    time += 30 * 60;
  }
  return data;
}

export const LiveFinancialChart: React.FC = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const [symbol, setSymbol] = useState<SymbolType>('XAUUSD');
  const [timeframe, setTimeframe] = useState<string>('30M');
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [levels, setLevels] = useState<ChartLevels>(GOLD_LEVELS);
  const [priceChange, setPriceChange] = useState<{ value: number; percent: number }>({ value: 0, percent: 0 });

  // Handle Chart Initialization & Resize
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8a93a8',
        fontFamily: "'Inter', sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)', style: 1 },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)', style: 1 },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: 'rgba(255, 255, 255, 0.3)', width: 1, style: 3, labelBackgroundColor: '#1e222d' },
        horzLine: { color: 'rgba(255, 255, 255, 0.3)', width: 1, style: 3, labelBackgroundColor: '#1e222d' },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
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
        tooltip.style.display = 'none';
      } else {
        const data = param.seriesData.get(seriesRef.current) as CandlestickData;
        if (data) {
          tooltip.style.display = 'block';
          // Keep tooltip on screen
          const tooltipWidth = 140;
          const tooltipHeight = 140;
          let left = param.point.x + 15;
          let top = param.point.y + 15;
          
          if (left + tooltipWidth > chartContainerRef.current.clientWidth) {
            left = param.point.x - tooltipWidth - 15;
          }
          if (top + tooltipHeight > chartContainerRef.current.clientHeight) {
            top = param.point.y - tooltipHeight - 15;
          }
          
          tooltip.style.left = left + 'px';
          tooltip.style.top = top + 'px';
          
          const isGreen = data.close >= data.open;
          const color = isGreen ? '#26a69a' : '#ef5350';
          
          tooltip.innerHTML = `
            <div style="font-size: 11px; font-weight: 700; color: #8a93a8; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1.5px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;">OHLC Details</div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px;"><span style="color: #a0a6b5;">Open</span> <span style="font-family: 'JetBrains Mono', monospace; font-weight: 600; color: ${color};">${data.open.toFixed(2)}</span></div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px;"><span style="color: #a0a6b5;">High</span> <span style="font-family: 'JetBrains Mono', monospace; font-weight: 600; color: ${color};">${data.high.toFixed(2)}</span></div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px;"><span style="color: #a0a6b5;">Low</span> <span style="font-family: 'JetBrains Mono', monospace; font-weight: 600; color: ${color};">${data.low.toFixed(2)}</span></div>
            <div style="display: flex; justify-content: space-between; font-size: 12px;"><span style="color: #a0a6b5;">Close</span> <span style="font-family: 'JetBrains Mono', monospace; font-weight: 600; color: ${color};">${data.close.toFixed(2)}</span></div>
          `;
        } else {
          tooltip.style.display = 'none';
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

  // Update Price Lines when levels change
  useEffect(() => {
    if (!seriesRef.current) return;
    const series = seriesRef.current;

    // Remove existing price lines
    priceLinesRef.current.forEach(line => series.removePriceLine(line));
    priceLinesRef.current = [];

    const addLine = (price: number, color: string, title: string) => {
      const line = series.createPriceLine({
        price,
        color,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title,
      });
      priceLinesRef.current.push(line);
    };

    addLine(levels.r4, '#ef5350', 'R4');
    addLine(levels.r3, '#ef5350', 'R3');
    addLine(levels.r2, '#ef5350', 'R2');
    addLine(levels.r1, '#ef5350', 'R1');
    addLine(levels.pivot, '#000000', 'PIVOT');
    addLine(levels.s1, '#26a69a', 'S1');
    addLine(levels.s2, '#26a69a', 'S2');
    addLine(levels.s3, '#26a69a', 'S3');
    addLine(levels.s4, '#26a69a', 'S4');
  }, [levels]);

  // Handle WebSocket Data
  useEffect(() => {
    if (!seriesRef.current) return;
    const series = seriesRef.current;

    // Reset data
    let startPrice = symbol === 'XAUUSD' ? 4077 : symbol === 'WTIUSD' ? 82.50 : 65000;
    let currentCandle: CandlestickData | null = null;
    let initialData = generateHistoricalData(startPrice, 100);
    
    series.setData(initialData);
    currentCandle = { ...initialData[initialData.length - 1] };
    
    if (symbol === 'BTCUSDT') {
       setLevels(calculateLevels(startPrice));
    } else {
       setLevels(GOLD_LEVELS);
    }
    setCurrentPrice(startPrice);

    // Reconnection logic and socket instantiation
    let mockInterval: NodeJS.Timeout;
    
    const connectWS = () => {
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
        if (symbol === 'XAUUSD') {
          ws.send(JSON.stringify({
            action: 'subscribe',
            params: { symbols: 'XAU/USD' }
          }));
        } else if (symbol === 'WTIUSD') {
          ws.send(JSON.stringify({
            action: 'subscribe',
            params: { symbols: 'WTI/USD' }
          }));
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

          if (price > 0 && currentCandle) {
            setCurrentPrice(price);
            
            // Update the current candle smoothly
            const time = currentCandle.time;
            
            // Periodically create a new candle (e.g. every 30 mins)
            const now = Math.floor(Date.now() / 1000);
            const timeDiff = now - (time as number);
            
            if (timeDiff >= 30 * 60) {
               // New candle
               let newTime = (time as number) + 30 * 60;
               currentCandle = {
                  time: newTime as Time,
                  open: currentCandle.close,
                  high: Math.max(currentCandle.close, price),
                  low: Math.min(currentCandle.close, price),
                  close: price
               };
            } else {
               // Update current candle
               currentCandle = {
                  ...currentCandle,
                  high: Math.max(currentCandle.high, price),
                  low: Math.min(currentCandle.low, price),
                  close: price
               };
            }
            
            series.update(currentCandle);
            
            // Simulate price change calculation for the UI
            const change = price - currentCandle.open;
            const percent = (change / currentCandle.open) * 100;
            setPriceChange({ value: change, percent });

            if (symbol !== 'XAUUSD') {
              setLevels(calculateLevels(price));
          }
          }
        } catch (e) {
          console.error('Error parsing WS message', e);
        }
      };

      ws.onclose = () => {
        console.log(`Disconnected from ${symbol} WebSocket. Starting mock fallback...`);
        // Start mock interval as fallback
        mockInterval = setInterval(() => {
          if (!currentCandle) return;
          const price = currentCandle.close + (Math.random() - 0.5) * (symbol === 'XAUUSD' ? 0.5 : symbol === 'WTIUSD' ? 0.05 : 5);
          
          setCurrentPrice(price);
          const time = currentCandle.time;
          const now = Math.floor(Date.now() / 1000);
          const timeDiff = now - (time as number);
          
          if (timeDiff >= 30 * 60) {
              let newTime = (time as number) + 30 * 60;
              currentCandle = {
                  time: newTime as Time,
                  open: currentCandle.close,
                  high: Math.max(currentCandle.close, price),
                  low: Math.min(currentCandle.close, price),
                  close: price
              };
          } else {
              currentCandle = {
                  ...currentCandle,
                  high: Math.max(currentCandle.high, price),
                  low: Math.min(currentCandle.low, price),
                  close: price
              };
          }
          series.update(currentCandle);
          
          const change = price - currentCandle.open;
          const percent = (change / currentCandle.open) * 100;
          setPriceChange({ value: change, percent });

          if (symbol !== 'XAUUSD') {
              setLevels(calculateLevels(price));
          }
        }, 1000);
      };
      
      ws.onerror = () => {
        console.warn(`WebSocket error for ${symbol}. Falling back to mock data.`);
        ws.close();
      };
    };

    connectWS();

    return () => {
      clearInterval(mockInterval);
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent auto-reconnect on unmount
        wsRef.current.close();
      }
    };
  }, [symbol]);

  const assetName = symbol === 'XAUUSD' ? 'GOLD' : symbol === 'WTIUSD' ? 'WTI' : 'BTC';
  const assetTitle = symbol === 'XAUUSD' ? 'Gold vs US Dollar' : symbol === 'WTIUSD' ? 'WTI Crude Oil' : 'Bitcoin vs Tether';
  const timeframes = ['15M', '30M', '1H', '4H', '1D'];

  return (
    <div className="relative w-full h-full min-h-screen bg-[#07090E] overflow-hidden font-sans">
      
      {/* Top Header Controls */}
      <div className="absolute top-6 right-6 sm:right-12 z-20 flex flex-col sm:flex-row items-end sm:items-center gap-4">
        
        {/* Timeframe Selector */}
        <div className="flex bg-white/5 border border-white/10 rounded-lg overflow-hidden shadow-2xl backdrop-blur-xl p-1 gap-1">
           {timeframes.map(tf => (
              <button 
                 key={tf}
                 onClick={() => setTimeframe(tf)}
                 className={`px-3 py-1 text-xs font-semibold rounded-md transition-all duration-200 ${timeframe === tf ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
              >
                {tf}
              </button>
           ))}
        </div>

        {/* Market Switcher */}
        <div className="relative group">
          <select 
            className="appearance-none bg-white/5 border border-white/10 pl-4 pr-10 py-1.5 rounded-lg text-sm text-white font-medium outline-none cursor-pointer shadow-2xl backdrop-blur-xl focus:border-white/30 transition-all duration-200 hover:bg-white/10"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value as SymbolType)}
          >
            <option value="XAUUSD" className="bg-[#0b0e14]">🥇 XAU/USD (Gold)</option>
            <option value="BTCUSDT" className="bg-[#0b0e14]">₿ BTC/USDT (Crypto)</option>
            <option value="WTIUSD" className="bg-[#0b0e14]">🛢️ WTI/USD (Oil)</option>
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 transition-colors group-hover:text-white">
             <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"><path d="M6 9l6 6 6-6"></path></svg>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg shadow-2xl backdrop-blur-xl">
          <div className="w-2 h-2 rounded-full bg-[#26a69a] animate-pulse shadow-[0_0_8px_#26a69a]"></div>
          <span className="text-white font-bold tracking-widest text-[10px]">LIVE</span>
        </div>
      </div>

      {/* Floating UI Overlay */}
      <div className="absolute top-6 left-6 z-10 bg-[#0b0e14]/60 backdrop-blur-3xl border border-white/10 rounded-2xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.8)] ring-1 ring-white/5 text-white w-[340px] pointer-events-none space-y-7">
        
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h1 className="text-white font-bold text-2xl tracking-tight leading-none">{symbol}</h1>
            <p className="text-sm text-gray-400 font-medium">{assetTitle} <span className="opacity-50 mx-1">•</span> {timeframe}</p>
          </div>
          <div className="text-right">
            <p className={`font-mono font-bold text-2xl tracking-tight ${priceChange.value >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>
              {currentPrice.toFixed(2)}
            </p>
            <p className={`text-xs font-medium mt-0.5 ${priceChange.value >= 0 ? 'text-[#26a69a]/80' : 'text-[#ef5350]/80'}`}>
              {priceChange.value >= 0 ? '+' : ''}{priceChange.value.toFixed(2)} ({priceChange.percent.toFixed(2)}%)
            </p>
          </div>
        </div>

        {/* SELLING AREAS */}
        <div>
          <p className="text-[10px] font-bold text-gray-500/80 uppercase tracking-[0.2em] mb-3">{assetName} SELLING AREAS</p>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: 'R4', value: levels.r4 },
              { label: 'R3', value: levels.r3 },
              { label: 'R2', value: levels.r2 },
              { label: 'R1', value: levels.r1 }
            ].map(lvl => (
               <div key={lvl.label} className="flex justify-between items-center bg-white/5 border border-white/5 px-3 py-2 rounded-lg">
                 <span className="text-[11px] font-semibold text-gray-400">{lvl.label}</span>
                 <span className="text-[12px] text-[#ef5350] font-mono font-semibold">{lvl.value.toFixed(2)}</span>
               </div>
            ))}
          </div>
        </div>

        {/* BUYING AREAS */}
        <div>
          <p className="text-[10px] font-bold text-gray-500/80 uppercase tracking-[0.2em] mb-3">{assetName} BUYING AREAS</p>
          <div className="grid grid-cols-2 gap-2.5">
             {[
              { label: 'S1', value: levels.s1 },
              { label: 'S2', value: levels.s2 },
              { label: 'S3', value: levels.s3 },
              { label: 'S4', value: levels.s4 }
            ].map(lvl => (
               <div key={lvl.label} className="flex justify-between items-center bg-white/5 border border-white/5 px-3 py-2 rounded-lg">
                 <span className="text-[11px] font-semibold text-gray-400">{lvl.label}</span>
                 <span className="text-[12px] text-[#26a69a] font-mono font-semibold">{lvl.value.toFixed(2)}</span>
               </div>
            ))}
          </div>
        </div>

        {/* PIVOT POINT */}
        <div className="flex items-center justify-between bg-white/5 border border-white/5 p-3 rounded-xl">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">{assetName} PIVOT POINT</p>
          <div className="bg-white/10 px-3 py-1 rounded-md shadow-inner ring-1 ring-white/10">
            <span className="text-sm font-mono font-bold text-white">{levels.pivot.toFixed(2)}</span>
          </div>
        </div>

        {/* TREND NOW */}
        <div>
          <p className="text-[10px] font-bold text-gray-500/80 uppercase tracking-[0.2em] mb-3">{assetName} TREND NOW</p>
          <div className="flex justify-between mb-1.5">
            <span className="text-[10px] text-[#ef5350] font-bold tracking-wider">BEARISH 47%</span>
            <span className="text-[10px] text-[#26a69a] font-bold tracking-wider">BULLISH 53%</span>
          </div>
          <div className="flex w-full bg-white/5 rounded-full overflow-hidden h-1.5 shadow-inner">
            <div className="bg-gradient-to-r from-[#ef5350]/80 to-[#ef5350]" style={{ width: '47%' }} />
            <div className="bg-gradient-to-r from-[#26a69a] to-[#26a69a]/80" style={{ width: '53%' }} />
          </div>
        </div>

      </div>

      <div ref={chartContainerRef} className="absolute inset-0" />
      
      {/* Dynamic Tooltip */}
      <div 
        ref={tooltipRef} 
        className="absolute z-50 bg-[#0b0e14]/90 backdrop-blur-xl border border-white/10 p-3.5 rounded-xl text-white shadow-[0_12px_40px_rgba(0,0,0,0.8)] pointer-events-none transition-opacity duration-150"
        style={{ display: 'none' }}
      />
    </div>
  );
};

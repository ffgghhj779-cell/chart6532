import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, IPriceLine, ColorType, CandlestickSeries } from 'lightweight-charts';
import { OverlayCard } from './OverlayCard';
import { generateInitialData, calculateLevels, generateNextTick, generateNewCandle, ChartLevels, Trend } from '../utils/mockData';

export const TradingChart: React.FC = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);

  const [levels, setLevels] = useState<ChartLevels | null>(null);
  const [trend, setTrend] = useState<Trend>({ bullish: 58, bearish: 42 });

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Initialize Chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2b3139', style: 1 },
        horzLines: { color: '#2b3139', style: 1 },
      },
      crosshair: {
        mode: 1,
        vertLine: {
            color: '#758696',
            width: 1,
            style: 3,
            labelBackgroundColor: '#758696',
        },
        horzLine: {
            color: '#758696',
            width: 1,
            style: 3,
            labelBackgroundColor: '#758696',
        },
      },
      timeScale: {
        borderColor: '#2b3139',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#2b3139',
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
    });

    seriesRef.current = candlestickSeries;

    const initialData = generateInitialData(150);
    candlestickSeries.setData(initialData);

    const lastCandle = initialData[initialData.length - 1];
    
    const initialLevels = calculateLevels(lastCandle.close);
    setLevels(initialLevels);

    // Draw Price Lines
    const addPriceLine = (price: number, color: string, title: string) => {
      const line = candlestickSeries.createPriceLine({
        price: price,
        color: color,
        lineWidth: 1,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: title,
      });
      priceLinesRef.current.push(line);
    };

    addPriceLine(initialLevels.r4, '#ef5350', 'R4');
    addPriceLine(initialLevels.r3, '#ef5350', 'R3');
    addPriceLine(initialLevels.r2, '#ef5350', 'R2');
    addPriceLine(initialLevels.r1, '#ef5350', 'R1');
    addPriceLine(initialLevels.pivot, '#787b86', 'PIVOT'); // Grayish/Black for Pivot
    addPriceLine(initialLevels.s1, '#26a69a', 'S1');
    addPriceLine(initialLevels.s2, '#26a69a', 'S2');
    addPriceLine(initialLevels.s3, '#26a69a', 'S3');
    addPriceLine(initialLevels.s4, '#26a69a', 'S4');

    // Resize handler
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

    // Real-time tick simulation
    let currentCandle = { ...lastCandle };
    let tickCount = 0;

    const interval = setInterval(() => {
      tickCount++;
      
      if (tickCount % 30 === 0) {
        currentCandle = generateNewCandle(currentCandle);
      } else {
        currentCandle = generateNextTick(currentCandle);
      }
      
      candlestickSeries.update(currentCandle);

      setTrend(prev => {
        const change = Math.floor(Math.random() * 3) - 1;
        let newBullish = prev.bullish + change;
        if (newBullish > 90) newBullish = 90;
        if (newBullish < 10) newBullish = 10;
        return { bullish: newBullish, bearish: 100 - newBullish };
      });

    }, 1000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-screen bg-gradient-to-b from-[#0b0e11] to-[#131722] overflow-hidden">
      {levels && <OverlayCard levels={levels} trend={trend} />}
      <div ref={chartContainerRef} className="absolute inset-0" />
    </div>
  );
};

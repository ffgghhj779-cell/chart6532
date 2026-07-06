import { CandlestickData, Time } from 'lightweight-charts';

export interface ChartLevels {
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

export interface Trend {
  bullish: number;
  bearish: number;
}

const START_PRICE = 2345.50; // Approximated XAUUSD price
const VOLATILITY = 2.5; // XAUUSD volatility per 30M

export function generateInitialData(count: number = 100): CandlestickData[] {
  const data: CandlestickData[] = [];
  let currentPrice = START_PRICE;
  let time = Math.floor(Date.now() / 1000) - count * 30 * 60;
  time -= time % (30 * 60);

  for (let i = 0; i < count; i++) {
    const open = currentPrice;
    const high = open + Math.random() * VOLATILITY;
    const low = open - Math.random() * VOLATILITY;
    const close = low + Math.random() * (high - low);
    
    data.push({
      time: time as Time,
      open,
      high,
      low,
      close,
    });

    currentPrice = close;
    time += 30 * 60;
  }
  return data;
}

export function calculateLevels(currentPrice: number): ChartLevels {
  const pivot = Math.floor(currentPrice / 5) * 5; // Round to nearest 5
  const range = 5.0; // Simulated range
  
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

export function generateNextTick(lastCandle: CandlestickData): CandlestickData {
  const time = lastCandle.time;
  const open = lastCandle.open;
  
  const change = (Math.random() - 0.5) * 1.5;
  const currentPrice = lastCandle.close + change;
  
  const high = Math.max(lastCandle.high, currentPrice);
  const low = Math.min(lastCandle.low, currentPrice);
  const close = currentPrice;

  return {
    time,
    open,
    high,
    low,
    close,
  };
}

export function generateNewCandle(lastCandle: CandlestickData): CandlestickData {
    const time = (lastCandle.time as number) + 30 * 60;
    const open = lastCandle.close;
    const change = (Math.random() - 0.5) * VOLATILITY;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * 0.5;
    const low = Math.min(open, close) - Math.random() * 0.5;

    return {
        time: time as Time,
        open,
        high,
        low,
        close
    };
}

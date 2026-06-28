// 8种交易策略 — 与回测引擎逻辑一致
import { OHLCV, ema, rsi, atr as calcAtr, bollingerBands, macd } from './indicators';

export type Direction = 'long' | 'short';

export interface Signal {
  direction: Direction;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  atrValue: number;
}

export function detectSignal(candles: OHLCV[], strategy: string): Signal | null {
  if (candles.length < 60) return null;

  const i = candles.length - 1; // 当前bar
  const p = candles.length - 2; // 前一根bar

  const closes = candles.map(c => c.close);
  const atrs = calcAtr(candles, 14);
  const atrVal = atrs[i];
  if (!atrVal || atrVal <= 0) return null;

  switch (strategy) {
    case 'ema_cross': return emaCross(candles, closes, atrVal, p, i);
    case 'rsi_reversion': return rsiReversion(candles, closes, atrVal, p, i);
    case 'bollinger_breakout': return bollingerBreakout(candles, closes, atrVal, p, i);
    case 'macd_cross': return macdCross(candles, closes, atrVal, p, i);
    case 'ema_trend': return emaTrend(candles, closes, atrVal, p, i);
    case 'rsi_trend': return rsiTrend(candles, closes, atrVal, p, i);
    case 'breakout': return breakout(candles, closes, atrVal, p, i);
    case 'ema_rsi': return emaRsi(candles, closes, atrVal, p, i);
    default: return null;
  }
}

function makeSignal(direction: Direction, entry: number, atr: number): Signal {
  if (direction === 'long') {
    return { direction, entry, stopLoss: entry - 1.5 * atr, takeProfit: entry + 3 * atr, atrValue: atr };
  } else {
    return { direction, entry, stopLoss: entry + 1.5 * atr, takeProfit: entry - 3 * atr, atrValue: atr };
  }
}

function emaCross(c: OHLCV[], closes: number[], atr: number, p: number, i: number): Signal | null {
  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  if (ema9[p] === 0 || ema21[p] === 0) return null;
  if (ema9[p] <= ema21[p] && ema9[i] > ema21[i]) return makeSignal('long', closes[i], atr);
  if (ema9[p] >= ema21[p] && ema9[i] < ema21[i]) return makeSignal('short', closes[i], atr);
  return null;
}

function rsiReversion(c: OHLCV[], closes: number[], atr: number, p: number, i: number): Signal | null {
  const rsiVals = rsi(closes, 14);
  if (rsiVals[p] <= 30 && rsiVals[i] > 30) return makeSignal('long', closes[i], atr);
  if (rsiVals[p] >= 70 && rsiVals[i] < 70) return makeSignal('short', closes[i], atr);
  return null;
}

function bollingerBreakout(c: OHLCV[], closes: number[], atr: number, p: number, i: number): Signal | null {
  const bb = bollingerBands(closes, 20, 2);
  if (bb.upper[p] === 0) return null;
  if (c[i].close > bb.upper[i] && c[p].close <= bb.upper[p]) return makeSignal('long', closes[i], atr);
  if (c[i].close < bb.lower[i] && c[p].close >= bb.lower[p]) return makeSignal('short', closes[i], atr);
  return null;
}

function macdCross(c: OHLCV[], closes: number[], atr: number, p: number, i: number): Signal | null {
  const m = macd(closes, 12, 26, 9);
  if (m.histogram.length <= i) return null;
  if (m.histogram[p] <= 0 && m.histogram[i] > 0) return makeSignal('long', closes[i], atr);
  if (m.histogram[p] >= 0 && m.histogram[i] < 0) return makeSignal('short', closes[i], atr);
  return null;
}

function emaTrend(c: OHLCV[], closes: number[], atr: number, p: number, i: number): Signal | null {
  const ema50 = ema(closes, 50);
  if (ema50[i] === 0) return null;
  if (c[p].close <= ema50[p] && c[i].close > ema50[i]) return makeSignal('long', closes[i], atr);
  if (c[p].close >= ema50[p] && c[i].close < ema50[i]) return makeSignal('short', closes[i], atr);
  return null;
}

function rsiTrend(c: OHLCV[], closes: number[], atr: number, p: number, i: number): Signal | null {
  const rsiVals = rsi(closes, 14);
  if (rsiVals[p] <= 50 && rsiVals[i] > 50) return makeSignal('long', closes[i], atr);
  if (rsiVals[p] >= 50 && rsiVals[i] < 50) return makeSignal('short', closes[i], atr);
  return null;
}

function breakout(c: OHLCV[], closes: number[], atr: number, p: number, i: number): Signal | null {
  const period = 20;
  if (i < period) return null;
  const highs = c.slice(i - period, i).map(x => x.high);
  const lows = c.slice(i - period, i).map(x => x.low);
  const highest = Math.max(...highs);
  const lowest = Math.min(...lows);
  if (c[i].close > highest) return makeSignal('long', closes[i], atr);
  if (c[i].close < lowest) return makeSignal('short', closes[i], atr);
  return null;
}

function emaRsi(c: OHLCV[], closes: number[], atr: number, p: number, i: number): Signal | null {
  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const rsiVals = rsi(closes, 14);
  if (ema9[p] === 0 || ema21[p] === 0) return null;
  if (ema9[p] <= ema21[p] && ema9[i] > ema21[i] && rsiVals[i] > 40) return makeSignal('long', closes[i], atr);
  if (ema9[p] >= ema21[p] && ema9[i] < ema21[i] && rsiVals[i] < 60) return makeSignal('short', closes[i], atr);
  return null;
}

// 技术指标计算 (与回测引擎逻辑一致)

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function ema(data: number[], period: number): number[] {
  const result: number[] = [];
  const k = 2 / (period + 1);
  let prev = 0;
  let started = false;
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(0); continue; }
    if (!started) {
      prev = data.slice(0, period).reduce((s, v) => s + v, 0) / period;
      started = true;
    } else {
      prev = data[i] * k + prev * (1 - k);
    }
    result.push(prev);
  }
  return result;
}

export function sma(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(0); continue; }
    const slice = data.slice(i - period + 1, i + 1);
    result.push(slice.reduce((s, v) => s + v, 0) / period);
  }
  return result;
}

export function atr(candles: OHLCV[], period = 14): number[] {
  const result: number[] = [];
  const trs: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const prev = i > 0 ? candles[i - 1] : c;
    const tr = Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
    trs.push(tr);
  }
  // Use EMA for ATR
  return ema(trs, period);
}

export function rsi(closes: number[], period = 14): number[] {
  const result: number[] = [];
  let gainSum = 0, lossSum = 0;
  let avgGain = 0, avgLoss = 0;
  let started = false;

  for (let i = 0; i < closes.length; i++) {
    if (i === 0) { result.push(50); continue; }
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    if (i < period) {
      gainSum += gain;
      lossSum += loss;
      if (i === period - 1) {
        avgGain = gainSum / period;
        avgLoss = lossSum / period;
        started = true;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        result.push(100 - 100 / (1 + rs));
      } else {
        result.push(50);
      }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }
  }
  return result;
}

export function bollingerBands(closes: number[], period = 20, mult = 2): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = sma(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1 || middle[i] === 0) { upper.push(0); lower.push(0); continue; }
    const slice = closes.slice(i - period + 1, i + 1);
    const std = Math.sqrt(slice.reduce((s, v) => s + Math.pow(v - middle[i], 2), 0) / period);
    upper.push(middle[i] + mult * std);
    lower.push(middle[i] - mult * std);
  }
  return { upper, middle, lower };
}

export function macd(closes: number[], fast = 12, slow = 26, signal = 9): { line: number[]; signal: number[]; histogram: number[] } {
  const line = ema(closes, fast).map((v, i) => v - ema(closes, slow)[i]);
  const sig = ema(line.filter(v => v !== 0), signal);
  const histogram: number[] = [];
  let sigIdx = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === 0) { histogram.push(0); continue; }
    const s = sig[sigIdx] || 0;
    histogram.push(line[i] - s);
    sigIdx++;
  }
  return { line, signal: sig, histogram };
}

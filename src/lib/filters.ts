// 6维过滤器 — 与回测引擎逻辑一致
import { OHLCV, ema, atr } from './indicators';
import { Direction } from './strategies';

export interface FilterContext {
  candles: OHLCV[];          // 策略TF的K线
  btcCandles4h: OHLCV[];     // BTC 4h K线 (BTC Trend & MTF用)
  fundingRate: number;        // 当前资金费率
  oiHistory: { timestamp: number; oi: number; close: number }[]; // OI历史
  higherTFCandles?: OHLCV[]; // 高级TF K线 (MTF用)
}

export interface FilterResult {
  passed: boolean;
  reason?: string;
}

// 1. Volume Confirmation: 信号K线量 > 20日均量 x 1.5
export function filterVolume(candles: OHLCV[]): FilterResult {
  const i = candles.length - 1;
  if (i < 20) return { passed: true }; // 数据不足，默认通过
  const vol20 = candles.slice(i - 19, i + 1).reduce((s, c) => s + c.volume, 0) / 20;
  const currentVol = candles[i].volume;
  if (currentVol > vol20 * 1.5) return { passed: true };
  return { passed: false, reason: `Volume ${currentVol.toFixed(0)} < 20avg*1.5 (${(vol20 * 1.5).toFixed(0)})` };
}

// 2. OI Increase: OI增加 + 价格同向
export function filterOI(oiHistory: { timestamp: number; oi: number; close: number }[], direction: Direction): FilterResult {
  if (oiHistory.length < 2) return { passed: true }; // 数据不足，默认通过
  const latest = oiHistory[oiHistory.length - 1];
  const prev = oiHistory[oiHistory.length - 2];
  const oiIncreasing = latest.oi > prev.oi;
  const priceUp = latest.close > prev.close;
  
  // OI增加 + 价格同向 = 真突破
  if (oiIncreasing && ((direction === 'long' && priceUp) || (direction === 'short' && !priceUp))) {
    return { passed: true };
  }
  return { passed: false, reason: `OI ${oiIncreasing ? '↑' : '↓'} but price ${priceUp ? '↑' : '↓'} vs direction ${direction}` };
}

// 3. Funding Rate Crowding: 费率>0.05%不做多, <-0.05%不做空
export function filterFunding(fundingRate: number, direction: Direction): FilterResult {
  if (direction === 'long' && fundingRate > 0.0005) {
    return { passed: false, reason: `Funding ${(fundingRate * 100).toFixed(4)}% > 0.05%, crowded long` };
  }
  if (direction === 'short' && fundingRate < -0.0005) {
    return { passed: false, reason: `Funding ${(fundingRate * 100).toFixed(4)}% < -0.05%, crowded short` };
  }
  return { passed: true };
}

// 4. BTC Trend: BTC在EMA50上方只做多, 反之只做空
export function filterBtcTrend(btcCandles4h: OHLCV[], direction: Direction): FilterResult {
  if (btcCandles4h.length < 50) return { passed: true };
  const closes = btcCandles4h.map(c => c.close);
  const ema50 = ema(closes, 50);
  const lastEma = ema50[ema50.length - 1];
  if (lastEma === 0) return { passed: true };
  const btcPrice = closes[closes.length - 1];
  const btcBullish = btcPrice > lastEma;
  
  if (btcBullish && direction === 'long') return { passed: true };
  if (!btcBullish && direction === 'short') return { passed: true };
  return { passed: false, reason: `BTC ${btcBullish ? 'bullish' : 'bearish'} vs signal ${direction}` };
}

// 5. Volatility Regime: 震荡市不用趋势策略, 趋势市不用均值回归
export function filterVolatility(candles: OHLCV[], strategy: string): FilterResult {
  if (candles.length < 30) return { passed: true };
  const atrs = atr(candles, 14);
  const len = atrs.length;
  if (len < 20) return { passed: true };
  
  const avgAtr = atrs.slice(len - 20, len).reduce((s, v) => s + v, 0) / 20;
  const currentAtr = atrs[len - 1];
  const ratio = currentAtr / avgAtr;
  
  const isTrendStrategy = ['ema_cross', 'ema_trend', 'rsi_trend', 'macd_cross', 'ema_rsi', 'breakout', 'bollinger_breakout'].includes(strategy);
  const isReversionStrategy = strategy === 'rsi_reversion';
  
  // trending: ratio > 1.2, ranging: ratio < 0.8
  if (isTrendStrategy && ratio < 0.8) {
    return { passed: false, reason: `Low volatility regime (ratio ${ratio.toFixed(2)}), skip trend strategy` };
  }
  if (isReversionStrategy && ratio > 1.2) {
    return { passed: false, reason: `High volatility regime (ratio ${ratio.toFixed(2)}), skip reversion strategy` };
  }
  return { passed: true };
}

// 6. Multi-Timeframe Confluence: 高级TF趋势方向须一致
export function filterMTF(candles: OHLCV[], btcCandles4h: OHLCV[], direction: Direction, strategyTF: string): FilterResult {
  // 对于4h策略, 用BTC 4h EMA50确认方向
  // 对于1h策略, 用自身4h K线EMA50确认方向 (但需要单独获取, 简化用BTC 4h)
  if (btcCandles4h.length < 50) return { passed: true };
  
  const closes = btcCandles4h.map(c => c.close);
  const ema50 = ema(closes, 50);
  const lastEma = ema50[ema50.length - 1];
  if (lastEma === 0) return { passed: true };
  const lastPrice = closes[closes.length - 1];
  const bullish = lastPrice > lastEma;
  
  if (bullish && direction === 'long') return { passed: true };
  if (!bullish && direction === 'short') return { passed: true };
  return { passed: false, reason: `MTF: BTC 4h ${bullish ? 'bullish' : 'bearish'} vs ${direction}` };
}

// 统一应用所有激活的过滤器
export function applyFilters(
  dimensions: string[],
  direction: Direction,
  strategy: string,
  ctx: FilterContext
): { passed: boolean; details: Record<string, FilterResult> } {
  const details: Record<string, FilterResult> = {};
  let allPassed = true;

  for (const dim of dimensions) {
    let result: FilterResult = { passed: true };
    switch (dim) {
      case 'volume': result = filterVolume(ctx.candles); break;
      case 'OI': result = filterOI(ctx.oiHistory, direction); break;
      case 'funding': result = filterFunding(ctx.fundingRate, direction); break;
      case 'btc_trend': result = filterBtcTrend(ctx.btcCandles4h, direction); break;
      case 'volatility': result = filterVolatility(ctx.candles, strategy); break;
      case 'mtf': result = filterMTF(ctx.candles, ctx.btcCandles4h, direction, ''); break;
    }
    details[dim] = result;
    if (!result.passed) allPassed = false;
  }

  return { passed: allPassed, details };
}

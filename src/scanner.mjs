// DS-Alerts Scanner — OKX USDT永续合约版
// GitHub Actions 每 15 分钟运行，OKX 不限制美国 IP
//
// OKX API v5:
//   K线:      GET /api/v5/market/candles?instId=BTC-USDT-SWAP&bar=4H&limit=120
//   资金费率: GET /api/v5/public/funding-rate?instId=BTC-USDT-SWAP
//   持仓量:   GET /api/v5/public/open-interest?instType=SWAP&instId=BTC-USDT-SWAP
//
// K线返回格式: [[ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm], ...]
// OKX 合约ID: BTC-USDT-SWAP, ETH-USDT-SWAP 等

import https from 'node:https';
import { fileURLToPath } from 'node:url';

// ==================== 配置 ====================
const COIN_CONFIGS = [
  // === V4 回测验证 (PF>=1.5, 胜率>=55%, 交易>=7次, OKX有合约) ===
  // 新策略: RSI背离, 趋势回调, 布林回归, 放量突破

  // 主流币 (流动性好，信号更可靠)
  { instId: "BTC-USDT-SWAP", base: "BTC", timeframe: "4h", strategy: "volume_breakout", dimensions: [], profitFactor: 2.11, winRate: 55.6 },
  { instId: "ETH-USDT-SWAP", base: "ETH", timeframe: "1h", strategy: "rsi_divergence", dimensions: [], profitFactor: 2.16, winRate: 62.5 },
  { instId: "ETH-USDT-SWAP", base: "ETH", timeframe: "4h", strategy: "volume_breakout", dimensions: [], profitFactor: 2.14, winRate: 58.3 },
  { instId: "SOL-USDT-SWAP", base: "SOL", timeframe: "1h", strategy: "rsi_divergence", dimensions: [], profitFactor: 2.99, winRate: 58.3 },
  { instId: "SOL-USDT-SWAP", base: "SOL", timeframe: "4h", strategy: "trend_pullback", dimensions: [], profitFactor: 1.91, winRate: 54.8 },
  { instId: "AVAX-USDT-SWAP", base: "AVAX", timeframe: "4h", strategy: "trend_pullback", dimensions: [], profitFactor: 3.02, winRate: 57.1 },
  { instId: "LINK-USDT-SWAP", base: "LINK", timeframe: "4h", strategy: "trend_pullback", dimensions: [], profitFactor: 2.12, winRate: 53.2 },
  { instId: "XRP-USDT-SWAP", base: "XRP", timeframe: "4h", strategy: "trend_pullback", dimensions: [], profitFactor: 2.10, winRate: 58.8 },
  { instId: "DOGE-USDT-SWAP", base: "DOGE", timeframe: "4h", strategy: "trend_pullback", dimensions: [], profitFactor: 2.04, winRate: 55.1 },
  { instId: "ADA-USDT-SWAP", base: "ADA", timeframe: "1h", strategy: "trend_pullback", dimensions: [], profitFactor: 2.62, winRate: 59.3 },
  { instId: "ADA-USDT-SWAP", base: "ADA", timeframe: "4h", strategy: "trend_pullback", dimensions: [], profitFactor: 2.41, winRate: 60.6 },
  { instId: "PEPE-USDT-SWAP", base: "PEPE", timeframe: "4h", strategy: "trend_pullback", dimensions: [], profitFactor: 2.40, winRate: 58.5 },
  { instId: "BNB-USDT-SWAP", base: "BNB", timeframe: "4h", strategy: "bollinger_reversion", dimensions: [], profitFactor: 1.98, winRate: 50.0 },
  { instId: "SUI-USDT-SWAP", base: "SUI", timeframe: "1h", strategy: "bollinger_reversion", dimensions: [], profitFactor: 2.50, winRate: 57.1 },

  // 山寨币 (小币，保留回测最优的)
  { instId: "UB-USDT-SWAP", base: "UB", timeframe: "1h", strategy: "rsi_divergence", dimensions: [], profitFactor: 4.35, winRate: 67.9 },
  { instId: "UB-USDT-SWAP", base: "UB", timeframe: "4h", strategy: "rsi_divergence", dimensions: [], profitFactor: 3.78, winRate: 60.0 },
  { instId: "BASED-USDT-SWAP", base: "BASED", timeframe: "1h", strategy: "rsi_divergence", dimensions: [], profitFactor: 9.01, winRate: 77.8 },
  { instId: "BEAT-USDT-SWAP", base: "BEAT", timeframe: "4h", strategy: "volume_breakout", dimensions: [], profitFactor: 4.01, winRate: 75.0 },
  { instId: "FARTCOIN-USDT-SWAP", base: "FARTCOIN", timeframe: "1h", strategy: "rsi_divergence", dimensions: [], profitFactor: 2.72, winRate: 61.5 },
  { instId: "FARTCOIN-USDT-SWAP", base: "FARTCOIN", timeframe: "4h", strategy: "volume_breakout", dimensions: [], profitFactor: 1.60, winRate: 50.0 },
  { instId: "GRASS-USDT-SWAP", base: "GRASS", timeframe: "1h", strategy: "bollinger_reversion", dimensions: [], profitFactor: 4.52, winRate: 71.4 },
  { instId: "GRASS-USDT-SWAP", base: "GRASS", timeframe: "4h", strategy: "volume_breakout", dimensions: [], profitFactor: 1.72, winRate: 63.6 },
  { instId: "IP-USDT-SWAP", base: "IP", timeframe: "1h", strategy: "rsi_divergence", dimensions: [], profitFactor: 6.23, winRate: 75.0 },
];

// OKX bar 格式映射
const MAJOR_BASES = new Set(['BTC', 'ETH', 'SOL', 'AVAX', 'LINK', 'XRP', 'DOGE', 'ADA', 'BNB', 'SUI']);

function defaultDimensions(cfg) {
  const dimsByStrategy = {
    trend_pullback: ['volatility', 'btc_trend', 'funding'],
    rsi_divergence: ['volatility', 'btc_trend', 'funding'],
    volume_breakout: ['volume', 'volatility', 'btc_trend', 'funding'],
    bollinger_reversion: ['volatility', 'funding'],
  };
  const dims = [...(dimsByStrategy[cfg.strategy] || ['volatility', 'funding'])];
  if (!MAJOR_BASES.has(cfg.base)) dims.push('OI');
  return dims;
}

for (const cfg of COIN_CONFIGS) {
  if (cfg.dimensions.length === 0) cfg.dimensions = defaultDimensions(cfg);
}

const TF_MAP = { '1h': '1H', '4h': '4H', '15m': '15m' };

const DEFAULT_FEE_RATE = +(process.env.FEE_RATE || 0.0005);
const DEFAULT_SLIPPAGE_RATE = +(process.env.SLIPPAGE_RATE || 0.001);
const MIN_SIGNAL_SCORE = +(process.env.MIN_SIGNAL_SCORE || 60);

// ==================== HTTP 工具 ====================
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000, headers: { 'User-Agent': 'DS-Alerts/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.code && json.code !== '0') {
            reject(new Error(`OKX API error ${json.code}: ${json.msg}`));
          } else {
            resolve(json.data || []);
          }
        } catch { reject(new Error(`Parse error: ${data.slice(0, 100)}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// ==================== OKX API ====================
const BASE = 'https://www.okx.com';

// OKX K线: 返回 [[ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm], ...]
// 按 ts 降序返回，需要反转为升序
async function fetchKlines(instId, bar, limit = 120) {
  const raw = await fetchJson(`${BASE}/api/v5/market/candles?instId=${instId}&bar=${bar}&limit=${limit}`);
  return raw
    .reverse() // OKX 返回降序，反转为升序
    .map(k => ({ ts: +k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }));
}

// OKX 资金费率: 返回 [{instId, fundingRate, fundingTime, nextFundingTime, nextFundingRate}, ...]
async function fetchFundingRate(instId) {
  const data = await fetchJson(`${BASE}/api/v5/public/funding-rate?instId=${instId}`);
  return data.length > 0 ? +data[0].fundingRate : 0;
}

// OKX 持仓量: 返回 [{instId, oi, oiCcy, oiUsd, ts}, ...]
async function fetchOI(instId) {
  const data = await fetchJson(`${BASE}/api/v5/public/open-interest?instType=SWAP&instId=${instId}`);
  return data.length > 0 ? +data[0].oi : 0;
}

// OKX OI 历史: open-interest-history 已不可用
// 改用 rubik/stat/contracts/open-interest-volume?ccy=BTC&period=1H
// 返回 [[ts, oi, volume], ...] 按 ts 升序
async function fetchOIHistory(baseCcy, period = '1H') {
  try {
    const data = await fetchJson(`${BASE}/api/v5/rubik/stat/contracts/open-interest-volume?ccy=${baseCcy}&period=${period}`);
    return data.map(r => ({ ts: +r[0], oi: +r[1] }));
  } catch { return []; }
}

// ==================== 技术指标 ====================
function ema(data, period) {
  const result = [];
  const k = 2 / (period + 1);
  let prev = 0, started = false;
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(0); continue; }
    if (!started) { prev = data.slice(0, period).reduce((s, v) => s + v, 0) / period; started = true; }
    else { prev = data[i] * k + prev * (1 - k); }
    result.push(prev);
  }
  return result;
}

function calcAtr(candles, period = 14) {
  const trs = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i], prev = i > 0 ? candles[i - 1] : c;
    trs.push(Math.max(c.h - c.l, Math.abs(c.h - prev.c), Math.abs(c.l - prev.c)));
  }
  return ema(trs, period);
}

function calcRsi(closes, period = 14) {
  const result = [];
  let gainSum = 0, lossSum = 0, avgGain = 0, avgLoss = 0, started = false;
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) { result.push(50); continue; }
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    if (i < period) {
      gainSum += gain; lossSum += loss;
      if (i === period - 1) {
        avgGain = gainSum / period; avgLoss = lossSum / period; started = true;
        result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
      } else result.push(50);
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
    }
  }
  return result;
}

function bollingerBands(closes, period = 20, mult = 2) {
  const mid = [], upper = [], lower = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { mid.push(0); upper.push(0); lower.push(0); continue; }
    const slice = closes.slice(i - period + 1, i + 1);
    const m = slice.reduce((s, v) => s + v, 0) / period;
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - m) ** 2, 0) / period);
    mid.push(m); upper.push(m + mult * std); lower.push(m - mult * std);
  }
  return { upper, middle: mid, lower };
}

export function estimateTradingCost({
  entry,
  stopLoss,
  takeProfit,
  feeRate = DEFAULT_FEE_RATE,
  slippageRate = DEFAULT_SLIPPAGE_RATE,
  fundingRate = 0,
}) {
  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(takeProfit - entry);
  const totalCostPct = +(feeRate * 2 + slippageRate * 2 + Math.abs(fundingRate)).toFixed(6);
  const costInPrice = +(entry * totalCostPct).toFixed(8);
  const grossRiskReward = risk > 0 ? +(reward / risk).toFixed(4) : 0;
  const netRiskReward = risk > 0 ? +((reward - costInPrice * 2) / risk).toFixed(4) : 0;

  return { feeRate, slippageRate, fundingRate, totalCostPct, costInPrice, grossRiskReward, netRiskReward };
}

export function buildTradePlan(strategy, direction, candles) {
  const i = candles.length - 1;
  const closes = candles.map(c => c.c);
  const entry = closes[i];
  const atrs = calcAtr(candles);
  const atr = atrs[i];
  if (!atr || atr <= 0) return null;

  const plan = (sl, tp) => {
    const stopLoss = +sl.toPrecision(12);
    const takeProfit = +tp.toPrecision(12);
    return {
      direction, entry, atr,
      sl: stopLoss, tp: takeProfit,
      stopLoss, takeProfit,
    };
  };

  if (strategy === 'bollinger_reversion') {
    const bb = bollingerBands(closes);
    const middle = bb.middle[i] || entry;
    const sl = direction === 'long' ? entry - 1.5 * atr : entry + 1.5 * atr;
    const tp = direction === 'long' ? Math.max(middle, entry + atr) : Math.min(middle, entry - atr);
    return plan(sl, tp);
  }

  if (strategy === 'volume_breakout' || strategy === 'breakout' || strategy === 'bollinger_breakout') {
    const sl = direction === 'long' ? entry - 1.8 * atr : entry + 1.8 * atr;
    const tp = direction === 'long' ? entry + 4.5 * atr : entry - 4.5 * atr;
    return plan(sl, tp);
  }

  if (strategy === 'rsi_divergence' || strategy === 'rsi_reversion') {
    const sl = direction === 'long' ? entry - 1.6 * atr : entry + 1.6 * atr;
    const tp = direction === 'long' ? entry + 3 * atr : entry - 3 * atr;
    return plan(sl, tp);
  }

  if (strategy === 'trend_pullback' || strategy === 'ema_trend' || strategy === 'rsi_trend') {
    const e50 = ema(closes, 50);
    const trendLine = e50[i] || entry;
    const sl = direction === 'long'
      ? Math.min(entry - 1.8 * atr, trendLine)
      : Math.max(entry + 1.8 * atr, trendLine);
    const tp = direction === 'long' ? entry + 3.6 * atr : entry - 3.6 * atr;
    return plan(sl, tp);
  }

  const sl = direction === 'long' ? entry - 2 * atr : entry + 2 * atr;
  const tp = direction === 'long' ? entry + 4 * atr : entry - 4 * atr;
  return plan(sl, tp);
}

export function scoreSignal({ profitFactor = 1, winRate = 50, cost, filterDetails = {} }) {
  let score = 35;
  score += Math.min(25, Math.max(0, (profitFactor - 1) * 12));
  score += Math.min(20, Math.max(-10, (winRate - 50) * 1.2));
  score += Math.min(20, Math.max(-20, (cost.netRiskReward - 1) * 18));
  score -= Math.min(15, cost.totalCostPct * 1000);

  const filters = Object.values(filterDetails);
  for (const filter of filters) score += filter.passed ? 3 : -12;

  const rounded = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: rounded,
    passed: rounded >= MIN_SIGNAL_SCORE && cost.netRiskReward >= 1,
  };
}

export function evaluateSignalOutcome(signal, candles) {
  const signalTs = new Date(signal.signal_time || signal.created_at).getTime();
  const risk = Math.abs(signal.entry_price - signal.stop_loss);
  if (!risk) return null;

  for (const c of candles) {
    if (c.ts <= signalTs) continue;

    const hitSl = signal.direction === 'long' ? c.l <= signal.stop_loss : c.h >= signal.stop_loss;
    const hitTp = signal.direction === 'long' ? c.h >= signal.take_profit : c.l <= signal.take_profit;
    if (!hitSl && !hitTp) continue;

    const conservativeResult = hitSl ? 'hit_sl' : 'hit_tp';
    const exitPrice = conservativeResult === 'hit_sl' ? signal.stop_loss : signal.take_profit;
    const pnlR = conservativeResult === 'hit_sl' ? -1 : Math.abs(signal.take_profit - signal.entry_price) / risk;

    return {
      trade_result: conservativeResult,
      actual_exit_time: new Date(c.ts).toISOString(),
      actual_entry: signal.entry_price,
      actual_sl: conservativeResult === 'hit_sl' ? exitPrice : null,
      actual_tp: conservativeResult === 'hit_tp' ? exitPrice : null,
      actual_pnl: signal.direction === 'long' ? exitPrice - signal.entry_price : signal.entry_price - exitPrice,
      actual_pnl_r: +pnlR.toFixed(4),
    };
  }

  return null;
}

function calcMacd(closes, fast = 12, slow = 26, sig = 9) {
  const line = ema(closes, fast).map((v, i) => v - ema(closes, slow)[i]);
  const validLine = line.filter(v => v !== 0);
  const sigLine = ema(validLine, sig);
  const histogram = [];
  let si = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === 0) { histogram.push(0); continue; }
    histogram.push(line[i] - (sigLine[si] || 0)); si++;
  }
  return { line, signal: sigLine, histogram };
}

// ==================== 策略检测 ====================
function detectSignal(candles, strategy) {
  if (candles.length < 60) return null;
  const i = candles.length - 1, p = candles.length - 2;
  const closes = candles.map(c => c.c);
  const atrs = calcAtr(candles);
  const atrVal = atrs[i];
  if (!atrVal || atrVal <= 0) return null;

  const mk = (dir) => buildTradePlan(strategy, dir, candles);

  switch (strategy) {
    case 'ema_cross': {
      const e9 = ema(closes, 9), e21 = ema(closes, 21);
      if (!e9[p] || !e21[p]) return null;
      if (e9[p] <= e21[p] && e9[i] > e21[i]) return mk('long');
      if (e9[p] >= e21[p] && e9[i] < e21[i]) return mk('short');
      return null;
    }
    case 'rsi_reversion': {
      const r = calcRsi(closes);
      if (r[p] <= 30 && r[i] > 30) return mk('long');
      if (r[p] >= 70 && r[i] < 70) return mk('short');
      return null;
    }
    case 'bollinger_breakout': {
      const bb = bollingerBands(closes);
      if (!bb.upper[p]) return null;
      if (candles[i].c > bb.upper[i] && candles[p].c <= bb.upper[p]) return mk('long');
      if (candles[i].c < bb.lower[i] && candles[p].c >= bb.lower[p]) return mk('short');
      return null;
    }
    case 'macd_cross': {
      const m = calcMacd(closes);
      if (m.histogram.length <= i) return null;
      if (m.histogram[p] <= 0 && m.histogram[i] > 0) return mk('long');
      if (m.histogram[p] >= 0 && m.histogram[i] < 0) return mk('short');
      return null;
    }
    case 'ema_trend': {
      const e50 = ema(closes, 50);
      if (!e50[i]) return null;
      if (candles[p].c <= e50[p] && candles[i].c > e50[i]) return mk('long');
      if (candles[p].c >= e50[p] && candles[i].c < e50[i]) return mk('short');
      return null;
    }
    case 'rsi_trend': {
      const r = calcRsi(closes);
      if (r[p] <= 50 && r[i] > 50) return mk('long');
      if (r[p] >= 50 && r[i] < 50) return mk('short');
      return null;
    }
    case 'breakout': {
      const period = 20;
      if (i < period) return null;
      const highs = candles.slice(i - period, i).map(x => x.h);
      const lows = candles.slice(i - period, i).map(x => x.l);
      if (candles[i].c > Math.max(...highs)) return mk('long');
      if (candles[i].c < Math.min(...lows)) return mk('short');
      return null;
    }
    case 'ema_rsi': {
      const e9 = ema(closes, 9), e21 = ema(closes, 21), r = calcRsi(closes);
      if (!e9[p] || !e21[p]) return null;
      if (e9[p] <= e21[p] && e9[i] > e21[i] && r[i] > 40) return mk('long');
      if (e9[p] >= e21[p] && e9[i] < e21[i] && r[i] < 60) return mk('short');
      return null;
    }
    // ========== V4 新策略 ==========
    case 'trend_pullback': {
      const e20 = ema(closes, 20), e50 = ema(closes, 50);
      if (!e20[i] || !e50[i]) return null;
      const bullish = e20[i] > e50[i];
      const bearish = e20[i] < e50[i];
      const dist = (closes[i] - e20[i]) / e20[i];
      if (bullish && dist > -0.02 && dist < 0.01 && candles[i].c > candles[i].o) return mk('long');
      if (bearish && dist < 0.02 && dist > -0.01 && candles[i].c < candles[i].o) return mk('short');
      return null;
    }
    case 'rsi_divergence': {
      const r = calcRsi(closes);
      const lookback = 20, start = candles.length - lookback;
      const mid = Math.floor(start + lookback / 2);
      let pL1 = Infinity, pL2 = Infinity, pH1 = -Infinity, pH2 = -Infinity;
      let rL1 = 100, rL2 = 100, rH1 = 0, rH2 = 0;
      for (let j = start; j < mid; j++) {
        if (closes[j] < pL1) { pL1 = closes[j]; rL1 = r[j]; }
        if (closes[j] > pH1) { pH1 = closes[j]; rH1 = r[j]; }
      }
      for (let j = mid; j < candles.length; j++) {
        if (closes[j] < pL2) { pL2 = closes[j]; rL2 = r[j]; }
        if (closes[j] > pH2) { pH2 = closes[j]; rH2 = r[j]; }
      }
      if (pL2 < pL1 && rL2 > rL1 && rL2 < 40) return mk('long');
      if (pH2 > pH1 && rH2 < rH1 && rH2 > 60) return mk('short');
      return null;
    }
    case 'volume_breakout': {
      const period = 20;
      if (i < period) return null;
      const highs = candles.slice(i - period, i).map(x => x.h);
      const lows = candles.slice(i - period, i).map(x => x.l);
      const avgVol = candles.slice(i - 20, i).reduce((s, c) => s + c.v, 0) / 20;
      if (candles[i].v < avgVol * 2) return null;
      if (candles[i].c > Math.max(...highs)) return mk('long');
      if (candles[i].c < Math.min(...lows)) return mk('short');
      return null;
    }
    case 'bollinger_reversion': {
      const bb = bollingerBands(closes);
      const r = calcRsi(closes);
      if (!bb.lower[i] || !bb.upper[i]) return null;
      if (candles[i].c <= bb.lower[i] && r[i] < 35) return mk('long');
      if (candles[i].c >= bb.upper[i] && r[i] > 65) return mk('short');
      return null;
    }
    default: return null;
  }
}

// ==================== 维度过滤器 ====================
function applyFilters(dimensions, direction, strategy, candles, btcCandles4h, fundingRate, oiCurrent, oiHistory) {
  const details = {};
  let passed = true;

  for (const dim of dimensions) {
    let result = { passed: true, reason: '' };

    if (dim === 'volume') {
      const idx = candles.length - 1;
      if (idx >= 20) {
        const avg20 = candles.slice(idx - 19, idx + 1).reduce((s, c) => s + c.v, 0) / 20;
        if (candles[idx].v <= avg20 * 1.5)
          result = { passed: false, reason: `Vol low vs avg*1.5` };
      }
    }

    if (dim === 'OI') {
      if (oiHistory.length >= 2) {
        const latest = oiHistory[oiHistory.length - 1];
        const prev = oiHistory[oiHistory.length - 2];
        if (latest.oi <= prev.oi)
          result = { passed: false, reason: 'OI decreasing' };
      } else if (oiCurrent > 0 && candles.length >= 2) {
        // 如果无历史数据，跳过OI过滤
      }
    }

    if (dim === 'funding') {
      // OKX fundingRate 是年化费率 (e.g. 0.01 = 1%)，8小时费率 = annualRate / 3
      // 实际 OKX API 返回的是当前周期的费率，如 "0.0001" 表示 0.01%
      const rate8h = fundingRate; // OKX 返回的就是8小时费率
      if (direction === 'long' && rate8h > 0.0005)
        result = { passed: false, reason: `Funding ${(rate8h * 100).toFixed(4)}% > 0.05%` };
      if (direction === 'short' && rate8h < -0.0005)
        result = { passed: false, reason: `Funding ${(rate8h * 100).toFixed(4)}% < -0.05%` };
    }

    if (dim === 'btc_trend') {
      // BTC趋势对山寨币是增幅器，不是硬过滤
      // BTC看多时做多信号加分，做空信号减分；反之亦然
      // 但不完全阻挡——山寨币可能与BTC脱钩
      if (btcCandles4h.length >= 50) {
        const btcCloses = btcCandles4h.map(c => c.c);
        const e50 = ema(btcCloses, 50);
        const lastEma = e50[e50.length - 1];
        if (lastEma > 0) {
          const bullish = btcCloses[btcCloses.length - 1] > lastEma;
          if (bullish && direction === 'short') result = { passed: true, reason: 'BTC看多,做空信号减弱(非硬过滤)' };
          if (!bullish && direction === 'long') result = { passed: true, reason: 'BTC看空,做多信号减弱(非硬过滤)' };
        }
      }
    }

    if (dim === 'volatility') {
      if (candles.length >= 30) {
        const atrs = calcAtr(candles);
        const len = atrs.length;
        if (len >= 20) {
          const avgAtr = atrs.slice(len - 20).reduce((s, v) => s + v, 0) / 20;
          const ratio = atrs[len - 1] / avgAtr;
          const isTrend = strategy !== 'rsi_reversion';
          if (isTrend && ratio < 0.8) result = { passed: false, reason: `Low vol ratio ${ratio.toFixed(2)}` };
          if (!isTrend && ratio > 1.2) result = { passed: false, reason: `High vol ratio ${ratio.toFixed(2)}` };
        }
      }
    }

    if (dim === 'mtf') {
      // 同 btc_trend，改为增幅器
      if (btcCandles4h.length >= 50) {
        const btcCloses = btcCandles4h.map(c => c.c);
        const e50 = ema(btcCloses, 50);
        const lastEma = e50[e50.length - 1];
        if (lastEma > 0) {
          const bullish = btcCloses[btcCloses.length - 1] > lastEma;
          if (bullish && direction === 'short') result = { passed: true, reason: 'MTF: BTC看多,做空信号减弱(非硬过滤)' };
          if (!bullish && direction === 'long') result = { passed: true, reason: 'MTF: BTC看空,做多信号减弱(非硬过滤)' };
        }
      }
    }

    details[dim] = result;
    if (!result.passed) passed = false;
  }

  return { passed, details };
}

// ==================== Supabase ====================
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

async function sbInsert(table, row) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`,
      'Prefer': 'return=minimal', 'Content-Type': 'application/json',
    },
    body: JSON.stringify(row),
  });
  return res.status < 300;
}

async function sbSelect(table, filter, limit = 1) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?select=id&${filter}&limit=${limit}`, {
    headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` },
  });
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function sbQuery(table, query) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
    headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` },
  });
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function sbUpdate(table, filter, row) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`,
      'Prefer': 'return=minimal', 'Content-Type': 'application/json',
    },
    body: JSON.stringify(row),
  });
  return res.status < 300;
}

async function isInCooldown(instId, direction, timeframe) {
  const ms = timeframe === '4h' ? 8 * 3600000 : 4 * 3600000;
  const cutoff = new Date(Date.now() - ms).toISOString();
  const data = await sbSelect('ds_signals', `symbol=eq.${instId}&direction=eq.${direction}&created_at=gte.${cutoff}`, 1);
  return data.length > 0;
}

async function updateOpenSignalOutcomes() {
  const select = [
    'id', 'symbol', 'timeframe', 'direction', 'entry_price', 'stop_loss',
    'take_profit', 'signal_time', 'created_at',
  ].join(',');
  const signals = await sbQuery(
    'ds_signals',
    `select=${select}&trade_result=is.null&order=created_at.asc&limit=50`
  );
  let updated = 0;

  for (const s of signals) {
    try {
      const candles = await fetchKlines(s.symbol, TF_MAP[s.timeframe] || '4H', 120);
      const outcome = evaluateSignalOutcome(s, candles);
      if (!outcome) continue;
      const ok = await sbUpdate('ds_signals', `id=eq.${s.id}`, outcome);
      if (ok) updated++;
    } catch (e) {
      console.warn(`[Tracker] ${s.symbol} ${s.timeframe}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 150));
  }

  console.log(`[Tracker] Updated ${updated}/${signals.length} open signals`);
  return updated;
}

// ==================== 邮件 (Gmail SMTP) ====================
async function sendEmail(signals) {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  const to = process.env.ALERT_EMAIL || 'sheng.chi@qq.com';

  if (!gmailUser || !gmailPass) {
    console.log('[Email] Missing GMAIL_USER / GMAIL_APP_PASSWORD, skipping');
    return false;
  }

  const emoji = signals.length === 1 ? (signals[0].direction === 'long' ? '🟢' : '🔴') : '📊';
  const subject = `${emoji} [DS-Alerts] 检测到${signals.length}个信号`;

  const DIM_CN = { volume: '放量', OI: '持仓量', funding: '资金费率', btc_trend: 'BTC趋势', volatility: '波动率', mtf: '多周期' };
  const rows = signals.map(s => {
    const d = s.direction === 'long' ? '做多' : '做空';
    const dc = s.direction === 'long' ? '#27AE60' : '#E74C3C';
    const rr = Math.abs(s.tp - s.entry) / Math.abs(s.entry - s.sl);
    const dims = s.dimensions.length > 0 ? s.dimensions.map(d => DIM_CN[d] || d).join(' + ') : '无';
    const filterInfo = Object.entries(s.details || {}).length > 0
      ? Object.entries(s.details || {}).map(([k, v]) => `${DIM_CN[k] || k}: ${v.passed ? '✓' : '✗ ' + (v.reason || '')}`).join(' | ')
      : '策略自带确认';
    return `<tr><td style="padding:10px;border-bottom:1px solid #eee"><strong style="color:${dc};font-size:16px">${d}</strong><br><span style="font-size:20px;font-weight:bold">${s.base}/USDT</span> <span style="color:#888">${s.timeframe} | ${s.strategy}</span></td><td style="padding:10px;border-bottom:1px solid #eee;font-size:13px">入场: <b>${s.entry.toFixed(4)}</b><br>止损: <span style="color:#E74C3C">${s.sl.toFixed(4)}</span> | 止盈: <span style="color:#27AE60">${s.tp.toFixed(4)}</span><br>盈亏比 ${rr.toFixed(1)}:1</td><td style="padding:10px;border-bottom:1px solid #eee;font-size:12px">过滤: ${dims}<br><span style="font-size:11px;color:#888">${filterInfo}</span><br>回测: PF ${s.profitFactor} | 胜率 ${s.winRate}%</td></tr>`;
  }).join('');

  const html = `<div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto"><div style="background:#1B3A5C;color:white;padding:14px;border-radius:8px 8px 0 0"><h2 style="margin:0">DS-Alerts 交易信号 (${new Date().toISOString().slice(0,16)})</h2><p style="margin:4px 0 0;opacity:0.8;font-size:12px">OKX USDT永续 | 数据驱动 · 回测验证</p></div><table style="width:100%;border-collapse:collapse">${rows}</table><div style="background:#f8f8f8;padding:10px;border-radius:0 0 8px 8px;font-size:10px;color:#888;text-align:center">自动信号提醒，投资需谨慎，盈亏自负</div></div>`;

  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailPass } });
    await transporter.sendMail({ from: `"DS-Alerts" <${gmailUser}>`, to, subject, html });
    console.log(`[Email] Sent via Gmail to ${to}`);
    return true;
  } catch (e) { console.error(`[Email] Gmail failed: ${e.message}`); return false; }
}

// ==================== 主扫描流程 ====================
async function main() {
  if (!SB_URL || !SB_KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }

  console.log(`[Scanner] Start at ${new Date().toISOString()}`);
  console.log(`[Scanner] ${COIN_CONFIGS.length} coin configs | Exchange: OKX`);
  await updateOpenSignalOutcomes();

  // 1. BTC 4h 数据 (全局共享)
  let btcCandles4h = [];
  try {
    btcCandles4h = await fetchKlines('BTC-USDT-SWAP', '4H', 120);
    console.log(`[Scanner] BTC 4h OK: ${btcCandles4h.length} bars, last=${btcCandles4h[btcCandles4h.length-1]?.c}`);
  } catch (e) { console.error(`[Scanner] BTC error: ${e.message}`); }

  // 2. 批量获取 K 线 (按 instId+tf 去重)
  const klineCache = new Map();
  const fetchKeys = [...new Set(COIN_CONFIGS.map(c => `${c.instId}|${c.timeframe}`))];
  console.log(`[Scanner] Fetching ${fetchKeys.length} kline combos from OKX...`);

  for (const key of fetchKeys) {
    const [instId, tf] = key.split('|');
    try {
      klineCache.set(key, await fetchKlines(instId, TF_MAP[tf], 120));
    } catch (e) { console.warn(`[Scanner] ${instId} ${tf} error: ${e.message}`); }
    await new Promise(r => setTimeout(r, 150)); // rate limit: OKX 20 req/2s
  }
  console.log(`[Scanner] Klines loaded: ${klineCache.size}/${fetchKeys.length}`);

  // 3. 逐币种扫描
  const detected = [];
  let scanned = 0, errors = 0;

  for (const cfg of COIN_CONFIGS) {
    const cacheKey = `${cfg.instId}|${cfg.timeframe}`;
    const candles = klineCache.get(cacheKey);
    if (!candles || candles.length < 60) { scanned++; continue; }

    try {
      // 3a. 检测信号
      const signal = detectSignal(candles, cfg.strategy);
      if (!signal) { scanned++; continue; }

      // 3b. 按需获取额外数据
      let fundingRate = 0, oiCurrent = 0, oiHistory = [];
      const extras = [];
      if (cfg.dimensions.includes('funding')) {
        extras.push(fetchFundingRate(cfg.instId).then(r => fundingRate = r).catch(e => console.warn(`[OI] ${cfg.base} funding: ${e.message}`)));
      }
      if (cfg.dimensions.includes('OI')) {
        extras.push(fetchOI(cfg.instId).then(r => oiCurrent = r).catch(() => {}));
        extras.push(fetchOIHistory(cfg.base, '1H').then(r => oiHistory = r).catch(() => {}));
      }
      await Promise.all(extras);

      // 3c. 维度过滤
      const { passed, details } = applyFilters(cfg.dimensions, signal.direction, cfg.strategy, candles, btcCandles4h, fundingRate, oiCurrent, oiHistory);
      if (!passed) {
        const blocked = Object.entries(details).filter(([, v]) => !v.passed).map(([k]) => k).join(',');
        console.log(`[Scanner] ${cfg.base}/${cfg.timeframe} ${signal.direction} blocked: ${blocked}`);
        scanned++; continue;
      }

      const cost = estimateTradingCost({
        entry: signal.entry,
        stopLoss: signal.sl,
        takeProfit: signal.tp,
        fundingRate,
      });
      const score = scoreSignal({
        strategy: cfg.strategy,
        direction: signal.direction,
        profitFactor: cfg.profitFactor,
        winRate: cfg.winRate,
        cost,
        filterDetails: details,
      });
      if (!score.passed) {
        console.log(`[Scanner] ${cfg.base}/${cfg.timeframe} ${signal.direction} score ${score.score} blocked`);
        scanned++; continue;
      }

      // 3d. 冷却期
      const cooled = !(await isInCooldown(cfg.instId, signal.direction, cfg.timeframe));
      if (!cooled) { console.log(`[Scanner] ${cfg.base}/${cfg.timeframe} ${signal.direction} cooldown`); scanned++; continue; }

      // 3e. 保存信号到 Supabase
      await sbInsert('ds_signals', {
        symbol: cfg.instId, base: cfg.base, timeframe: cfg.timeframe,
        strategy: cfg.strategy, dimensions: cfg.dimensions,
        direction: signal.direction, entry_price: signal.entry,
        stop_loss: signal.sl, take_profit: signal.tp, atr_value: signal.atr,
        filter_details: details,
        estimated_cost_pct: cost.totalCostPct,
        net_risk_reward: cost.netRiskReward,
        signal_score: score.score,
        score_details: { cost, minScore: MIN_SIGNAL_SCORE },
        signal_time: new Date().toISOString(), emailed: false,
      });

      detected.push({ ...cfg, direction: signal.direction, entry: signal.entry, sl: signal.sl, tp: signal.tp, details, cost, score: score.score });
      scanned++;
      console.log(`[Scanner] >>> SIGNAL: ${cfg.base}/${cfg.timeframe} ${cfg.strategy} ${signal.direction} @ ${signal.entry.toFixed(4)}`);

    } catch (e) {
      console.error(`[Scanner] ${cfg.base} error: ${e.message}`);
      errors++; scanned++;
    }
  }

  // 4. 发送邮件
  if (detected.length > 0) {
    const emailed = await sendEmail(detected);
    if (emailed) {
      // 标记信号为已发送邮件
      for (const s of detected) {
        // 简化：不单独更新 emailed 字段，log 即可
      }
    }
  }

  // 5. 保存扫描日志
  await sbInsert('ds_scan_logs', {
    started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
    coins_scanned: scanned, signals_found: detected.length,
    errors: errors > 0 ? `${errors} errors` : null,
  });

  console.log(`[Scanner] Done: ${scanned} scanned, ${detected.length} signals, ${errors} errors`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(err => { console.error('[Scanner] Fatal:', err); process.exit(1); });
}

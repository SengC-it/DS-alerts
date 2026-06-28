// DS-Alerts Scanner — Supabase Edge Function
// 运行在 Deno Deploy 全球节点（非美国 IP），直连 Binance 无需代理
// 由 pg_cron + pg_net 每 15 分钟定时触发

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// ==================== 配置 ====================
const COIN_CONFIGS = [
  { symbol: "UB/USDT:USDT", base: "UB", timeframe: "4h", strategy: "rsi_trend", dimensions: ["OI","btc_trend","volatility"], profitFactor: 5.11, winRate: 54.8 },
  { symbol: "LAB/USDT:USDT", base: "LAB", timeframe: "4h", strategy: "rsi_trend", dimensions: ["btc_trend"], profitFactor: 2.62, winRate: 48.7 },
  { symbol: "MYX/USDT:USDT", base: "MYX", timeframe: "4h", strategy: "breakout", dimensions: ["OI","btc_trend"], profitFactor: 2.96, winRate: 54.3 },
  { symbol: "H/USDT:USDT", base: "H", timeframe: "4h", strategy: "breakout", dimensions: ["funding"], profitFactor: 2.58, winRate: 57.4 },
  { symbol: "BASED/USDT:USDT", base: "BASED", timeframe: "1h", strategy: "rsi_trend", dimensions: ["btc_trend"], profitFactor: 5.29, winRate: 66.7 },
  { symbol: "DEXE/USDT:USDT", base: "DEXE", timeframe: "4h", strategy: "bollinger_breakout", dimensions: ["OI"], profitFactor: 2.82, winRate: 60.4 },
  { symbol: "BEAT/USDT:USDT", base: "BEAT", timeframe: "4h", strategy: "breakout", dimensions: ["volume","funding"], profitFactor: 2.34, winRate: 45.5 },
  { symbol: "GUA/USDT:USDT", base: "GUA", timeframe: "4h", strategy: "rsi_trend", dimensions: ["OI","btc_trend"], profitFactor: 2.15, winRate: 45.5 },
  { symbol: "GUA/USDT:USDT", base: "GUA", timeframe: "4h", strategy: "ema_trend", dimensions: ["btc_trend","volatility"], profitFactor: 3.30, winRate: 60.0 },
  { symbol: "BEAT/USDT:USDT", base: "BEAT", timeframe: "1h", strategy: "rsi_trend", dimensions: ["mtf"], profitFactor: 3.25, winRate: 61.0 },
  { symbol: "FARTCOIN/USDT:USDT", base: "FARTCOIN", timeframe: "4h", strategy: "bollinger_breakout", dimensions: ["volatility"], profitFactor: 2.58, winRate: 56.8 },
  { symbol: "BASED/USDT:USDT", base: "BASED", timeframe: "1h", strategy: "breakout", dimensions: ["volatility","mtf"], profitFactor: 3.56, winRate: 61.8 },
  { symbol: "LAB/USDT:USDT", base: "LAB", timeframe: "1h", strategy: "rsi_trend", dimensions: ["btc_trend"], profitFactor: 2.88, winRate: 55.7 },
  { symbol: "AIN/USDT:USDT", base: "AIN", timeframe: "4h", strategy: "ema_cross", dimensions: ["OI"], profitFactor: 2.10, winRate: 48.7 },
  { symbol: "GRASS/USDT:USDT", base: "GRASS", timeframe: "4h", strategy: "rsi_trend", dimensions: ["btc_trend"], profitFactor: 2.79, winRate: 56.3 },
  { symbol: "CLO/USDT:USDT", base: "CLO", timeframe: "1h", strategy: "rsi_trend", dimensions: ["mtf"], profitFactor: 2.46, winRate: 50.0 },
  { symbol: "IP/USDT:USDT", base: "IP", timeframe: "4h", strategy: "breakout", dimensions: ["volatility"], profitFactor: 2.62, winRate: 54.1 },
  { symbol: "BAS/USDT:USDT", base: "BAS", timeframe: "4h", strategy: "breakout", dimensions: ["volume"], profitFactor: 1.86, winRate: 53.1 },
  { symbol: "MMT/USDT:USDT", base: "MMT", timeframe: "1h", strategy: "rsi_trend", dimensions: ["mtf"], profitFactor: 4.32, winRate: 66.7 },
  { symbol: "MYX/USDT:USDT", base: "MYX", timeframe: "4h", strategy: "ema_cross", dimensions: ["volatility"], profitFactor: 2.96, winRate: 55.0 },
  { symbol: "SIREN/USDT:USDT", base: "SIREN", timeframe: "4h", strategy: "bollinger_breakout", dimensions: ["funding"], profitFactor: 1.41, winRate: 37.8 },
  { symbol: "STG/USDT:USDT", base: "STG", timeframe: "4h", strategy: "breakout", dimensions: ["OI"], profitFactor: 1.68, winRate: 45.6 },
];

const BASE = 'https://fapi.binance.com';
const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ==================== HTTP 工具 ====================
async function httpGet(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url.slice(0, 80)}`);
  return res.json();
}

async function sbInsert(table: string, row: Record<string, any>): Promise<boolean> {
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

async function sbSelect(table: string, filter: string, limit = 1): Promise<any[]> {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?select=id&${filter}&limit=${limit}`, {
    headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` },
  });
  return res.json();
}

// ==================== Binance API ====================
function toApiSymbol(symbol: string): string { return symbol.replace('/USDT:USDT', 'USDT'); }

async function fetchKlines(symbol: string, interval: string, limit = 120) {
  const apiSym = toApiSymbol(symbol);
  const raw: any[][] = await httpGet(`${BASE}/fapi/v1/klines?symbol=${apiSym}&interval=${interval}&limit=${limit}`);
  return raw.map(k => ({ ts: k[0] as number, o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }));
}

async function fetchFundingRate(symbol: string): Promise<number> {
  const apiSym = toApiSymbol(symbol);
  const raw: any[] = await httpGet(`${BASE}/fapi/v1/fundingRate?symbol=${apiSym}&limit=1`);
  return raw.length > 0 ? +raw[0].fundingRate : 0;
}

async function fetchOIHistory(symbol: string) {
  const apiSym = toApiSymbol(symbol);
  try {
    const raw: any[] = await httpGet(`${BASE}/fapi/v1/openInterestHist?symbol=${apiSym}&period=4h&limit=30`);
    return raw.map(r => ({ ts: r.timestamp as number, oi: +r.openInterest }));
  } catch { return []; }
}

// ==================== 技术指标 ====================
function ema(data: number[], period: number): number[] {
  const result: number[] = [];
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

function calcAtr(candles: any[], period = 14): number[] {
  const trs: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i], prev = i > 0 ? candles[i - 1] : c;
    trs.push(Math.max(c.h - c.l, Math.abs(c.h - prev.c), Math.abs(c.l - prev.c)));
  }
  return ema(trs, period);
}

function calcRsi(closes: number[], period = 14): number[] {
  const result: number[] = [];
  let gainSum = 0, lossSum = 0, avgGain = 0, avgLoss = 0;
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) { result.push(50); continue; }
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    if (i < period) {
      gainSum += gain; lossSum += loss;
      if (i === period - 1) {
        avgGain = gainSum / period; avgLoss = lossSum / period;
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

function bollingerBands(closes: number[], period = 20, mult = 2) {
  const mid: number[] = [], upper: number[] = [], lower: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { mid.push(0); upper.push(0); lower.push(0); continue; }
    const slice = closes.slice(i - period + 1, i + 1);
    const m = slice.reduce((s, v) => s + v, 0) / period;
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - m) ** 2, 0) / period);
    mid.push(m); upper.push(m + mult * std); lower.push(m - mult * std);
  }
  return { upper, middle: mid, lower };
}

function calcMacd(closes: number[], fast = 12, slow = 26, sig = 9) {
  const line = ema(closes, fast).map((v, i) => v - ema(closes, slow)[i]);
  const validLine = line.filter(v => v !== 0);
  const sigLine = ema(validLine, sig);
  const histogram: number[] = [];
  let si = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === 0) { histogram.push(0); continue; }
    histogram.push(line[i] - (sigLine[si] || 0)); si++;
  }
  return { line, signal: sigLine, histogram };
}

// ==================== 策略检测 ====================
interface Signal { direction: 'long' | 'short'; entry: number; sl: number; tp: number; atr: number; }

function detectSignal(candles: any[], strategy: string): Signal | null {
  if (candles.length < 60) return null;
  const i = candles.length - 1, p = candles.length - 2;
  const closes = candles.map((c: any) => c.c);
  const atrs = calcAtr(candles);
  const atrVal = atrs[i];
  if (!atrVal || atrVal <= 0) return null;

  const mk = (dir: 'long' | 'short'): Signal => ({
    direction: dir, entry: closes[i], atr: atrVal,
    sl: dir === 'long' ? closes[i] - 1.5 * atrVal : closes[i] + 1.5 * atrVal,
    tp: dir === 'long' ? closes[i] + 3 * atrVal : closes[i] - 3 * atrVal,
  });

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
      const highs = candles.slice(i - period, i).map((x: any) => x.h);
      const lows = candles.slice(i - period, i).map((x: any) => x.l);
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
    default: return null;
  }
}

// ==================== 维度过滤器 ====================
function applyFilters(
  dimensions: string[], direction: string, strategy: string,
  candles: any[], btcCandles4h: any[], fundingRate: number, oiHistory: any[]
) {
  const details: Record<string, { passed: boolean; reason?: string }> = {};
  let passed = true;

  for (const dim of dimensions) {
    let result: { passed: boolean; reason?: string } = { passed: true };

    if (dim === 'volume') {
      const idx = candles.length - 1;
      if (idx >= 20) {
        const avg20 = candles.slice(idx - 19, idx + 1).reduce((s: number, c: any) => s + c.v, 0) / 20;
        if (candles[idx].v <= avg20 * 1.5)
          result = { passed: false, reason: `Vol low vs avg*1.5` };
      }
    }
    if (dim === 'OI') {
      if (oiHistory.length >= 2) {
        const latest = oiHistory[oiHistory.length - 1];
        const prev = oiHistory[oiHistory.length - 2];
        if (latest.oi <= prev.oi) result = { passed: false, reason: 'OI decreasing' };
      }
    }
    if (dim === 'funding') {
      if (direction === 'long' && fundingRate > 0.0005)
        result = { passed: false, reason: `Funding ${(fundingRate * 100).toFixed(4)}% > 0.05%` };
      if (direction === 'short' && fundingRate < -0.0005)
        result = { passed: false, reason: `Funding ${(fundingRate * 100).toFixed(4)}% < -0.05%` };
    }
    if (dim === 'btc_trend') {
      if (btcCandles4h.length >= 50) {
        const btcCloses = btcCandles4h.map((c: any) => c.c);
        const e50 = ema(btcCloses, 50);
        const lastEma = e50[e50.length - 1];
        if (lastEma > 0) {
          const bullish = btcCloses[btcCloses.length - 1] > lastEma;
          if (bullish && direction === 'short') result = { passed: false, reason: 'BTC bullish, skip short' };
          if (!bullish && direction === 'long') result = { passed: false, reason: 'BTC bearish, skip long' };
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
      if (btcCandles4h.length >= 50) {
        const btcCloses = btcCandles4h.map((c: any) => c.c);
        const e50 = ema(btcCloses, 50);
        const lastEma = e50[e50.length - 1];
        if (lastEma > 0) {
          const bullish = btcCloses[btcCloses.length - 1] > lastEma;
          if (bullish && direction === 'short') result = { passed: false, reason: 'MTF: BTC bullish, skip short' };
          if (!bullish && direction === 'long') result = { passed: false, reason: 'MTF: BTC bearish, skip long' };
        }
      }
    }

    details[dim] = result;
    if (!result.passed) passed = false;
  }
  return { passed, details };
}

// ==================== 冷却期 ====================
async function isInCooldown(symbol: string, direction: string, timeframe: string): Promise<boolean> {
  const ms = timeframe === '4h' ? 8 * 3600000 : 4 * 3600000;
  const cutoff = new Date(Date.now() - ms).toISOString();
  const data = await sbSelect('signals', `symbol=eq.${symbol}&direction=eq.${direction}&created_at=gte.${cutoff}`, 1);
  return Array.isArray(data) && data.length > 0;
}

// ==================== Gmail (通过 Supabase 内置 SMTP 或直接 fetch) ====================
async function sendEmail(signals: any[]) {
  const user = Deno.env.get('GMAIL_USER');
  const pass = Deno.env.get('GMAIL_APP_PASSWORD');
  const to = Deno.env.get('ALERT_EMAIL') || 'sheng.chi@qq.com';
  if (!user || !pass) { console.log('[Email] Missing credentials, skip'); return false; }

  // 使用 Gmail SMTP (Edge Function 运行在非 US IP，可以直连 Google)
  const dir = signals.length === 1 ? signals[0].direction : '';
  const emoji = dir === 'long' ? '🟢' : dir === 'short' ? '🔴' : '📊';
  const subject = `${emoji} [DS-Alerts] ${signals.length} Signal${signals.length > 1 ? 's' : ''}`;

  const rows = signals.map(s => {
    const d = s.direction === 'long' ? 'LONG' : 'SHORT';
    const dc = s.direction === 'long' ? '#27AE60' : '#E74C3C';
    const rr = Math.abs(s.tp - s.entry) / Math.abs(s.entry - s.sl);
    const dims = s.dimensions.join(' + ');
    return `<tr><td style="padding:10px;border-bottom:1px solid #eee"><strong style="color:${dc};font-size:16px">${d}</strong><br><span style="font-size:20px;font-weight:bold">${s.base}/USDT</span> <span style="color:#888">${s.timeframe} | ${s.strategy}</span></td><td style="padding:10px;border-bottom:1px solid #eee;font-size:13px">Entry: <b>${s.entry.toFixed(4)}</b><br>SL: <span style="color:#E74C3C">${s.sl.toFixed(4)}</span> | TP: <span style="color:#27AE60">${s.tp.toFixed(4)}</span><br>R:R ${rr.toFixed(1)}:1</td><td style="padding:10px;border-bottom:1px solid #eee;font-size:12px">Filters: ${dims}<br>Backtest: PF ${s.profitFactor} | WR ${s.winRate}%</td></tr>`;
  }).join('');

  const html = `<div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto"><div style="background:#1B3A5C;color:white;padding:14px;border-radius:8px 8px 0 0"><h2 style="margin:0">DS-Alerts Signal</h2><p style="margin:4px 0 0;opacity:0.8;font-size:12px">${new Date().toISOString()}</p></div><table style="width:100%;border-collapse:collapse">${rows}</table><div style="background:#f8f8f8;padding:10px;border-radius:0 0 8px 8px;font-size:10px;color:#888;text-align:center">Automated signal. Trade at your own risk.</div></div>`;

  // Deno 不自带 SMTP，改用 Resend 邮件 API（免费 100封/天）
  // 或者用 Gmail API REST endpoint
  // 最简方案：用 Brevo (ex-Sendinblue) 免费SMTP API，300封/天
  // 这里使用 Gmail API (OAuth2 App Password → Base64 login)
  try {
    // 方案：使用 SMTP over TLS via Deno's connect
    // 但 Deno 标准库没有内置 SMTP 客户端
    // 最简单的免费方案：用 Brevo API (免费300封/天, 无需代理)
    const brevoKey = Deno.env.get('BREVO_API_KEY');
    if (brevoKey) {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { name: 'DS-Alerts', email: user },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        }),
      });
      if (res.ok) { console.log(`[Email] Sent via Brevo to ${to}`); return true; }
      console.error(`[Email] Brevo error: ${res.status}`);
    }

    // Fallback: Gmail SMTP via deno-smtp (动态 import)
    // 或者简单用 Supabase 的 pg_net 回调
    console.log('[Email] No BREVO_API_KEY, logging signal only');
    console.log(`[Email] Subject: ${subject}`);
    return false;
  } catch (err: any) {
    console.error(`[Email] Failed: ${err.message}`);
    return false;
  }
}

// ==================== 主扫描流程 ====================
async function runScan() {
  console.log(`[Scanner] Start at ${new Date().toISOString()}`);
  console.log(`[Scanner] ${COIN_CONFIGS.length} coin configs`);

  // 1. BTC 4h
  let btcCandles4h: any[] = [];
  try { btcCandles4h = await fetchKlines('BTC/USDT:USDT', '4h', 120); console.log(`[Scanner] BTC 4h: ${btcCandles4h.length} bars`); }
  catch (e: any) { console.error(`[Scanner] BTC error: ${e.message}`); }

  // 2. 获取所有需要的K线 (去重)
  const klineCache = new Map<string, any[]>();
  const fetchKeys = [...new Set(COIN_CONFIGS.map(c => `${c.symbol}|${c.timeframe}`))];
  console.log(`[Scanner] Fetching ${fetchKeys.length} kline combos...`);

  for (const key of fetchKeys) {
    const [symbol, tf] = key.split('|');
    try { klineCache.set(key, await fetchKlines(symbol, tf, 120)); }
    catch (e: any) { console.warn(`[Scanner] ${symbol} ${tf} error: ${e.message}`); }
    await new Promise(r => setTimeout(r, 100));
  }

  // 3. 扫描信号
  const detected: any[] = [];
  let scanned = 0;

  for (const cfg of COIN_CONFIGS) {
    const cacheKey = `${cfg.symbol}|${cfg.timeframe}`;
    const candles = klineCache.get(cacheKey);
    if (!candles || candles.length < 60) { scanned++; continue; }

    const signal = detectSignal(candles, cfg.strategy);
    if (!signal) { scanned++; continue; }

    // 按需获取额外数据
    let fundingRate = 0, oiHistory: any[] = [];
    const extras: Promise<void>[] = [];
    if (cfg.dimensions.includes('funding')) {
      extras.push(fetchFundingRate(cfg.symbol).then(r => fundingRate = r).catch(() => {}));
    }
    if (cfg.dimensions.includes('OI')) {
      extras.push(fetchOIHistory(cfg.symbol).then(r => oiHistory = r).catch(() => {}));
    }
    await Promise.all(extras);

    // 维度过滤
    const { passed, details } = applyFilters(cfg.dimensions, signal.direction, cfg.strategy, candles, btcCandles4h, fundingRate, oiHistory);
    if (!passed) {
      const blocked = Object.entries(details).filter(([, v]) => !v.passed).map(([k]) => k).join(',');
      console.log(`[Scanner] ${cfg.base}/${cfg.timeframe} ${signal.direction} blocked: ${blocked}`);
      scanned++; continue;
    }

    // 冷却期
    const cooled = !(await isInCooldown(cfg.symbol, signal.direction, cfg.timeframe));
    if (!cooled) { console.log(`[Scanner] ${cfg.base}/${cfg.timeframe} cooldown`); scanned++; continue; }

    // 保存信号
    await sbInsert('signals', {
      symbol: cfg.symbol, base: cfg.base, timeframe: cfg.timeframe,
      strategy: cfg.strategy, dimensions: cfg.dimensions,
      direction: signal.direction, entry_price: signal.entry,
      stop_loss: signal.sl, take_profit: signal.tp, atr_value: signal.atr,
      filter_details: details, signal_time: new Date().toISOString(), emailed: false,
    });

    detected.push({ ...cfg, direction: signal.direction, entry: signal.entry, sl: signal.sl, tp: signal.tp, details });
    scanned++;
    console.log(`[Scanner] SIGNAL: ${cfg.base}/${cfg.timeframe} ${cfg.strategy} ${signal.direction} @ ${signal.entry.toFixed(4)}`);
  }

  // 发送邮件
  if (detected.length > 0) await sendEmail(detected);

  // 保存扫描日志
  await sbInsert('scan_logs', {
    started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
    coins_scanned: scanned, signals_found: detected.length, errors: null,
  });

  console.log(`[Scanner] Done: ${scanned} scanned, ${detected.length} signals`);
  return { scanned, signals: detected.length };
}

// ==================== HTTP Handler ====================
serve(async (req: Request) => {
  // 验证授权 (来自 pg_cron 或手动触发)
  const authHeader = req.headers.get('authorization');
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const result = await runScan();
    return new Response(JSON.stringify({ success: true, ...result, timestamp: new Date().toISOString() }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[Scanner] Fatal:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
});

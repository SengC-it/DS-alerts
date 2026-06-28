// DS-Alerts Scanner — 直接在 GitHub Actions / Node.js 中运行
// 无需 Next.js、无需服务器，纯 Node.js ESM 脚本
//
// 架构：GitHub Actions (cron 15min) → 运行此脚本 → Binance API → 信号检测 → Supabase 存储 + Gmail 通知

import https from 'node:https';

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

// ==================== HTTP 工具 ====================
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Parse error: ${data.slice(0, 100)}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function httpsPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = { hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { resolve({ status: res.statusCode, body: data }); });
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

// ==================== Binance API ====================
function toApiSymbol(symbol) { return symbol.replace('/USDT:USDT', 'USDT'); }
const BASE = 'https://fapi.binance.com';

async function fetchKlines(symbol, interval, limit = 120) {
  const apiSym = toApiSymbol(symbol);
  const raw = await httpsGet(`${BASE}/fapi/v1/klines?symbol=${apiSym}&interval=${interval}&limit=${limit}`);
  return raw.map(k => ({ ts: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }));
}

async function fetchFundingRate(symbol) {
  const apiSym = toApiSymbol(symbol);
  const raw = await httpsGet(`${BASE}/fapi/v1/fundingRate?symbol=${apiSym}&limit=1`);
  return raw.length > 0 ? +raw[0].fundingRate : 0;
}

async function fetchOIHistory(symbol) {
  const apiSym = toApiSymbol(symbol);
  try {
    const raw = await httpsGet(`${BASE}/fapi/v1/openInterestHist?symbol=${apiSym}&period=4h&limit=30`);
    return raw.map(r => ({ ts: r.timestamp, oi: +r.openInterest }));
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
  const mid = []; const upper = []; const lower = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { mid.push(0); upper.push(0); lower.push(0); continue; }
    const slice = closes.slice(i - period + 1, i + 1);
    const m = slice.reduce((s, v) => s + v, 0) / period;
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - m) ** 2, 0) / period);
    mid.push(m); upper.push(m + mult * std); lower.push(m - mult * std);
  }
  return { upper, middle: mid, lower };
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

  const makeSig = (dir) => ({
    direction: dir, entry: closes[i], atr: atrVal,
    sl: dir === 'long' ? closes[i] - 1.5 * atrVal : closes[i] + 1.5 * atrVal,
    tp: dir === 'long' ? closes[i] + 3 * atrVal : closes[i] - 3 * atrVal,
  });

  switch (strategy) {
    case 'ema_cross': {
      const e9 = ema(closes, 9), e21 = ema(closes, 21);
      if (!e9[p] || !e21[p]) return null;
      if (e9[p] <= e21[p] && e9[i] > e21[i]) return makeSig('long');
      if (e9[p] >= e21[p] && e9[i] < e21[i]) return makeSig('short');
      return null;
    }
    case 'rsi_reversion': {
      const r = calcRsi(closes);
      if (r[p] <= 30 && r[i] > 30) return makeSig('long');
      if (r[p] >= 70 && r[i] < 70) return makeSig('short');
      return null;
    }
    case 'bollinger_breakout': {
      const bb = bollingerBands(closes);
      if (!bb.upper[p]) return null;
      if (candles[i].c > bb.upper[i] && candles[p].c <= bb.upper[p]) return makeSig('long');
      if (candles[i].c < bb.lower[i] && candles[p].c >= bb.lower[p]) return makeSig('short');
      return null;
    }
    case 'macd_cross': {
      const m = calcMacd(closes);
      if (m.histogram.length <= i) return null;
      if (m.histogram[p] <= 0 && m.histogram[i] > 0) return makeSig('long');
      if (m.histogram[p] >= 0 && m.histogram[i] < 0) return makeSig('short');
      return null;
    }
    case 'ema_trend': {
      const e50 = ema(closes, 50);
      if (!e50[i]) return null;
      if (candles[p].c <= e50[p] && candles[i].c > e50[i]) return makeSig('long');
      if (candles[p].c >= e50[p] && candles[i].c < e50[i]) return makeSig('short');
      return null;
    }
    case 'rsi_trend': {
      const r = calcRsi(closes);
      if (r[p] <= 50 && r[i] > 50) return makeSig('long');
      if (r[p] >= 50 && r[i] < 50) return makeSig('short');
      return null;
    }
    case 'breakout': {
      const period = 20;
      if (i < period) return null;
      const highs = candles.slice(i - period, i).map(x => x.h);
      const lows = candles.slice(i - period, i).map(x => x.l);
      if (candles[i].c > Math.max(...highs)) return makeSig('long');
      if (candles[i].c < Math.min(...lows)) return makeSig('short');
      return null;
    }
    case 'ema_rsi': {
      const e9 = ema(closes, 9), e21 = ema(closes, 21), r = calcRsi(closes);
      if (!e9[p] || !e21[p]) return null;
      if (e9[p] <= e21[p] && e9[i] > e21[i] && r[i] > 40) return makeSig('long');
      if (e9[p] >= e21[p] && e9[i] < e21[i] && r[i] < 60) return makeSig('short');
      return null;
    }
    default: return null;
  }
}

// ==================== 维度过滤器 ====================
function applyFilters(dimensions, direction, strategy, candles, btcCandles4h, fundingRate, oiHistory) {
  const details = {};
  let passed = true;

  for (const dim of dimensions) {
    let result = { passed: true, reason: '' };

    if (dim === 'volume') {
      const idx = candles.length - 1;
      if (idx >= 20) {
        const avg20 = candles.slice(idx - 19, idx + 1).reduce((s, c) => s + c.v, 0) / 20;
        if (candles[idx].v <= avg20 * 1.5) {
          result = { passed: false, reason: `Vol ${(candles[idx].v / 1e6).toFixed(1)}M < avg*1.5` };
        }
      }
    }

    if (dim === 'OI') {
      if (oiHistory.length >= 2) {
        const latest = oiHistory[oiHistory.length - 1];
        const prev = oiHistory[oiHistory.length - 2];
        const oiUp = latest.oi > prev.oi;
        if (!oiUp) result = { passed: false, reason: 'OI decreasing' };
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
        const btcCloses = btcCandles4h.map(c => c.c);
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
        const btcCloses = btcCandles4h.map(c => c.c);
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

// ==================== Supabase ====================
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function sbSelect(table, query = 'id', filter = '', limit = 50, order = 'created_at.desc') {
  const [col, dir] = order.split('.');
  let url = `${SB_URL}/rest/v1/${table}?select=${query}&order=${col}.${dir}&limit=${limit}`;
  if (filter) url += `&${filter}`;
  return httpsGet(url);
}

async function sbInsert(table, row) {
  const { status } = await httpsPost(`${SB_URL}/rest/v1/${table}`, row, {
    'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Prefer': 'return=minimal',
    'Content-Type': 'application/json',
  });
  return status < 300;
}

async function isInCooldown(symbol, direction, timeframe) {
  const ms = timeframe === '4h' ? 8 * 3600000 : 4 * 3600000;
  const cutoff = new Date(Date.now() - ms).toISOString();
  const data = await sbSelect('signals', 'id', `symbol=eq.${symbol}&direction=eq.${direction}&created_at=gte.${cutoff}`, 1);
  return data && data.length > 0;
}

// ==================== Gmail ====================
async function sendEmail(signals) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const to = process.env.ALERT_EMAIL || 'sheng.chi@qq.com';
  if (!user || !pass) { console.log('[Email] Missing credentials, skipping'); return false; }

  // 使用 Supabase Edge Function 或 simple SMTP via nodemailer
  // 由于 GitHub Actions 无法直连 Gmail SMTP (需要代理),
  // 改用 Supabase Edge Function 发邮件，或用 Resend 等免费服务
  // 这里用 Gmail API (OAuth) 或者更简单的: 用 Gmail SMTP 直连 (GitHub Actions 服务器可以直连)
  
  // 动态 import nodemailer
  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({ service: 'gmail', auth: { user, pass } });
    
    const dir = signals.length === 1 ? signals[0].direction : '';
    const emoji = dir === 'long' ? '🟢' : dir === 'short' ? '🔴' : '📊';
    const subject = `${emoji} [DS-Alerts] ${signals.length} Signal${signals.length > 1 ? 's' : ''} Detected`;

    const rows = signals.map(s => {
      const d = s.direction === 'long' ? 'LONG' : 'SHORT';
      const dc = s.direction === 'long' ? '#27AE60' : '#E74C3C';
      const rr = Math.abs(s.tp - s.entry) / Math.abs(s.entry - s.sl);
      const dims = s.dimensions.join(' + ');
      return `<tr><td style="padding:10px;border-bottom:1px solid #eee"><strong style="color:${dc};font-size:16px">${d}</strong><br><span style="font-size:20px;font-weight:bold">${s.base}/USDT</span> <span style="color:#888">${s.timeframe} | ${s.strategy}</span></td><td style="padding:10px;border-bottom:1px solid #eee;font-size:13px">Entry: <b>${s.entry.toFixed(4)}</b><br>SL: <span style="color:#E74C3C">${s.sl.toFixed(4)}</span> | TP: <span style="color:#27AE60">${s.tp.toFixed(4)}</span><br>R:R ${rr.toFixed(1)}:1</td><td style="padding:10px;border-bottom:1px solid #eee;font-size:12px">Filters: ${dims}<br>Backtest: PF ${s.profitFactor} | WR ${s.winRate}%</td></tr>`;
    }).join('');

    const html = `<div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto"><div style="background:#1B3A5C;color:white;padding:14px;border-radius:8px 8px 0 0"><h2 style="margin:0">DS-Alerts Signal</h2><p style="margin:4px 0 0;opacity:0.8;font-size:12px">${new Date().toISOString()}</p></div><table style="width:100%;border-collapse:collapse">${rows}</table><div style="background:#f8f8f8;padding:10px;border-radius:0 0 8px 8px;font-size:10px;color:#888;text-align:center">Automated signal. Trade at your own risk.</div></div>`;

    await transporter.sendMail({ from: `"DS-Alerts" <${user}>`, to, subject, html });
    console.log(`[Email] Sent ${signals.length} signal(s) to ${to}`);
    return true;
  } catch (err) {
    console.error('[Email] Failed:', err.message);
    return false;
  }
}

// ==================== 主扫描流程 ====================
async function main() {
  if (!SB_URL || !SB_KEY) { console.error('Missing Supabase env vars'); process.exit(1); }

  console.log(`[Scanner] Start at ${new Date().toISOString()}`);
  console.log(`[Scanner] ${COIN_CONFIGS.length} coin configs`);

  // 1. BTC 4h K线 (全局共享)
  let btcCandles4h = [];
  try { btcCandles4h = await fetchKlines('BTC/USDT:USDT', '4h', 120); console.log(`[Scanner] BTC 4h: ${btcCandles4h.length} bars`); }
  catch (e) { console.error(`[Scanner] BTC fetch error: ${e.message}`); }

  // 2. 按 (symbol, timeframe) 去重获取K线
  const klineCache = new Map();
  const fetchKeys = [...new Set(COIN_CONFIGS.map(c => `${c.symbol}|${c.timeframe}`))];
  console.log(`[Scanner] Fetching ${fetchKeys.length} unique kline combos...`);

  for (const key of fetchKeys) {
    const [symbol, tf] = key.split('|');
    try { klineCache.set(key, await fetchKlines(symbol, tf, 120)); }
    catch (e) { console.warn(`[Scanner] ${symbol} ${tf} error: ${e.message}`); }
    await new Promise(r => setTimeout(r, 100)); // rate limit
  }

  // 3. 逐币种扫描
  const detected = [];
  let scanned = 0;

  for (const cfg of COIN_CONFIGS) {
    const cacheKey = `${cfg.symbol}|${cfg.timeframe}`;
    const candles = klineCache.get(cacheKey);
    if (!candles || candles.length < 60) { scanned++; continue; }

    // 3a. 检测信号
    const signal = detectSignal(candles, cfg.strategy);
    if (!signal) { scanned++; continue; }

    // 3b. 获取额外数据 (按需)
    let fundingRate = 0, oiHistory = [];
    const extraPromises = [];
    if (cfg.dimensions.includes('funding')) {
      extraPromises.push(fetchFundingRate(cfg.symbol).then(r => fundingRate = r).catch(() => {}));
    }
    if (cfg.dimensions.includes('OI')) {
      extraPromises.push(fetchOIHistory(cfg.symbol).then(r => oiHistory = r).catch(() => {}));
    }
    await Promise.all(extraPromises);

    // 3c. 维度过滤
    const { passed, details } = applyFilters(cfg.dimensions, signal.direction, cfg.strategy, candles, btcCandles4h, fundingRate, oiHistory);
    if (!passed) {
      const blocked = Object.entries(details).filter(([, v]) => !v.passed).map(([k]) => k).join(',');
      console.log(`[Scanner] ${cfg.base}/${cfg.timeframe} ${signal.direction} blocked: ${blocked}`);
      scanned++; continue;
    }

    // 3d. 冷却期
    const cooled = !(await isInCooldown(cfg.symbol, signal.direction, cfg.timeframe));
    if (!cooled) { console.log(`[Scanner] ${cfg.base}/${cfg.timeframe} ${signal.direction} cooldown`); scanned++; continue; }

    // 3e. 保存信号
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

  // 4. 发送邮件
  if (detected.length > 0) await sendEmail(detected);

  // 5. 保存扫描日志
  await sbInsert('scan_logs', {
    started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
    coins_scanned: scanned, signals_found: detected.length, errors: null,
  });

  console.log(`[Scanner] Done: ${scanned} scanned, ${detected.length} signals`);
}

main().catch(err => { console.error('[Scanner] Fatal:', err); process.exit(1); });

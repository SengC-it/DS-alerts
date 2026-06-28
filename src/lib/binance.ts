// Binance Futures API 客户端 — 直接调用REST API（无需CCXT，体积小）
import { OHLCV } from './indicators';

const BASE = 'https://fapi.binance.com';

// 将Binance symbol格式 (LAB/USDT:USDT) 转为API格式 (LABUSDT)
export function toApiSymbol(symbol: string): string {
  return symbol.replace('/USDT:USDT', 'USDT').replace('/USDT', 'USDT');
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Binance API error: ${res.status} ${res.statusText} url=${url}`);
  return res.json();
}

// 获取K线数据
export async function fetchKlines(symbol: string, interval: string, limit = 120): Promise<OHLCV[]> {
  const apiSymbol = toApiSymbol(symbol);
  const url = `${BASE}/fapi/v1/klines?symbol=${apiSymbol}&interval=${interval}&limit=${limit}`;
  const raw: any[][] = await fetchJson(url);
  return raw.map(k => ({
    timestamp: k[0] as number,
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

// 获取BTC 4h K线 (共享数据)
export async function fetchBTC4h(limit = 120): Promise<OHLCV[]> {
  return fetchKlines('BTC/USDT:USDT', '4h', limit);
}

// 获取资金费率 (最近一条)
export async function fetchFundingRate(symbol: string): Promise<number> {
  const apiSymbol = toApiSymbol(symbol);
  const url = `${BASE}/fapi/v1/fundingRate?symbol=${apiSymbol}&limit=1`;
  const raw: any[] = await fetchJson(url);
  if (raw.length === 0) return 0;
  return parseFloat(raw[0].fundingRate);
}

// 获取OI历史 (最近30条, 4h间隔)
export async function fetchOIHistory(symbol: string): Promise<{ timestamp: number; oi: number; close: number }[]> {
  const apiSymbol = toApiSymbol(symbol);
  const url = `${BASE}/fapi/v1/openInterestHist?symbol=${apiSymbol}&period=4h&limit=30`;
  const raw: any[] = await fetchJson(url);
  return raw.map(r => ({
    timestamp: r.timestamp as number,
    oi: parseFloat(r.openInterest),
    close: 0, // OI历史不含价格，需要从K线补充
  }));
}

// 批量获取K线 (并行，带速率限制)
export async function fetchKlinesBatch(
  symbols: string[],
  interval: string,
  limit = 120,
  concurrency = 5
): Promise<Map<string, OHLCV[]>> {
  const result = new Map<string, OHLCV[]>();
  const errors: string[] = [];

  for (let i = 0; i < symbols.length; i += concurrency) {
    const batch = symbols.slice(i, i + concurrency);
    const promises = batch.map(async (sym) => {
      try {
        const data = await fetchKlines(sym, interval, limit);
        result.set(sym, data);
      } catch (e: any) {
        errors.push(`${sym}: ${e.message}`);
      }
    });
    await Promise.all(promises);
    // 速率限制：每批之间等待100ms
    if (i + concurrency < symbols.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  if (errors.length > 0) {
    console.warn(`[Binance] ${errors.length} errors: ${errors.slice(0, 3).join('; ')}`);
  }

  return result;
}

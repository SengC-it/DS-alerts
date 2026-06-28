// 信号扫描引擎 — 主调度器
import { COIN_CONFIGS, CoinConfig } from './config';
import { OHLCV } from './indicators';
import { detectSignal } from './strategies';
import { applyFilters, FilterContext } from './filters';
import { fetchKlines, fetchBTC4h, fetchFundingRate, fetchOIHistory } from './binance';
import { isInCooldown, saveSignal, saveScanLog, DBSignal } from './supabase';
import { sendSignalEmail, SignalEmailData } from './email';

export interface ScanResult {
  scanned: number;
  skipped: number;
  signals: number;
  errors: string[];
}

export async function runScan(): Promise<ScanResult> {
  const startTime = new Date();
  const errors: string[] = [];
  let scanned = 0;
  let signalCount = 0;

  console.log(`[Scanner] Starting scan at ${startTime.toISOString()}`);
  console.log(`[Scanner] ${COIN_CONFIGS.length} coin configs loaded`);

  try {
    // 1. 获取BTC 4h K线 (全局共享)
    let btcCandles4h: OHLCV[] = [];
    try {
      btcCandles4h = await fetchBTC4h(120);
      console.log(`[Scanner] BTC 4h data loaded: ${btcCandles4h.length} bars`);
    } catch (e: any) {
      errors.push(`BTC data: ${e.message}`);
      console.error(`[Scanner] Failed to fetch BTC data: ${e.message}`);
    }

    // 2. 按 (symbol, timeframe) 分组，避免重复获取K线
    const dataCache = new Map<string, OHLCV[]>(); // key: "symbol|tf"
    const uniqueFetches = new Set<string>();
    for (const cfg of COIN_CONFIGS) {
      uniqueFetches.add(`${cfg.symbol}|${cfg.timeframe}`);
    }

    // 3. 批量获取K线
    console.log(`[Scanner] Fetching ${uniqueFetches.size} unique symbol+TF combos...`);
    for (const key of uniqueFetches) {
      const [symbol, tf] = key.split('|');
      try {
        const klines = await fetchKlines(symbol, tf, 120);
        dataCache.set(key, klines);
      } catch (e: any) {
        errors.push(`${symbol} ${tf}: ${e.message}`);
      }
    }

    // 4. 逐币种扫描信号
    const detectedSignals: SignalEmailData[] = [];

    for (const cfg of COIN_CONFIGS) {
      try {
        const cacheKey = `${cfg.symbol}|${cfg.timeframe}`;
        const candles = dataCache.get(cacheKey);
        if (!candles || candles.length < 60) {
          scanned++;
          continue;
        }

        // 4a. 检测策略信号
        const signal = detectSignal(candles, cfg.strategy);
        if (!signal) {
          scanned++;
          continue;
        }

        // 4b. 构建过滤器上下文
        const ctx = await buildFilterContext(cfg, candles, btcCandles4h);

        // 4c. 应用维度过滤器
        const { passed, details } = applyFilters(cfg.dimensions, signal.direction, cfg.strategy, ctx);

        if (!passed) {
          const blockedBy = Object.entries(details)
            .filter(([, v]) => !v.passed)
            .map(([k]) => k)
            .join(',');
          console.log(`[Scanner] ${cfg.base}/${cfg.timeframe} ${signal.direction} signal blocked by: ${blockedBy}`);
          scanned++;
          continue;
        }

        // 4d. 检查冷却期
        const cooledDown = !(await isInCooldown(cfg.symbol, signal.direction, cfg.timeframe));
        if (!cooledDown) {
          console.log(`[Scanner] ${cfg.base}/${cfg.timeframe} ${signal.direction} in cooldown`);
          scanned++;
          continue;
        }

        // 4e. 信号通过！保存到数据库
        const dbSignal: DBSignal = {
          symbol: cfg.symbol,
          base: cfg.base,
          timeframe: cfg.timeframe,
          strategy: cfg.strategy,
          dimensions: cfg.dimensions,
          direction: signal.direction,
          entry_price: signal.entry,
          stop_loss: signal.stopLoss,
          take_profit: signal.takeProfit,
          atr_value: signal.atrValue,
          filter_details: details,
          signal_time: new Date().toISOString(),
          emailed: false,
        };
        await saveSignal(dbSignal);

        // 4f. 加入邮件列表
        detectedSignals.push({
          base: cfg.base,
          symbol: cfg.symbol,
          direction: signal.direction,
          entry: signal.entry,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit,
          strategy: cfg.strategy,
          timeframe: cfg.timeframe,
          dimensions: cfg.dimensions,
          profitFactor: cfg.profitFactor,
          winRate: cfg.winRate,
          filterDetails: details,
        });

        signalCount++;
        scanned++;
        console.log(`[Scanner] SIGNAL: ${cfg.base}/${cfg.timeframe} ${cfg.strategy} ${signal.direction} @ ${signal.entry.toFixed(4)}`);

      } catch (e: any) {
        errors.push(`${cfg.symbol}: ${e.message}`);
        scanned++;
      }
    }

    // 5. 发送邮件
    if (detectedSignals.length > 0) {
      const emailed = await sendSignalEmail(detectedSignals);
      if (emailed) {
        console.log(`[Scanner] Email sent with ${detectedSignals.length} signal(s)`);
      }
    }

    // 6. 保存扫描日志
    await saveScanLog({
      started_at: startTime.toISOString(),
      finished_at: new Date().toISOString(),
      coins_scanned: scanned,
      signals_found: signalCount,
      errors: errors.length > 0 ? errors.slice(0, 5).join('; ') : undefined,
    });

    console.log(`[Scanner] Done: ${scanned} scanned, ${signalCount} signals, ${errors.length} errors`);

    return { scanned, skipped: 0, signals: signalCount, errors };

  } catch (e: any) {
    errors.push(`Fatal: ${e.message}`);
    console.error(`[Scanner] Fatal error:`, e);

    await saveScanLog({
      started_at: startTime.toISOString(),
      finished_at: new Date().toISOString(),
      coins_scanned: scanned,
      signals_found: signalCount,
      errors: e.message,
    });

    return { scanned, skipped: 0, signals: signalCount, errors };
  }
}

async function buildFilterContext(
  cfg: CoinConfig,
  candles: OHLCV[],
  btcCandles4h: OHLCV[]
): Promise<FilterContext> {
  const ctx: FilterContext = { candles, btcCandles4h, fundingRate: 0, oiHistory: [] };

  // 按需获取数据
  const needsFunding = cfg.dimensions.includes('funding');
  const needsOI = cfg.dimensions.includes('OI');

  const extraPromises: Promise<void>[] = [];

  if (needsFunding) {
    extraPromises.push(
      fetchFundingRate(cfg.symbol)
        .then(rate => { ctx.fundingRate = rate; })
        .catch(() => { ctx.fundingRate = 0; })
    );
  }

  if (needsOI) {
    extraPromises.push(
      fetchOIHistory(cfg.symbol)
        .then(hist => { ctx.oiHistory = hist; })
        .catch(() => { ctx.oiHistory = []; })
    );
  }

  await Promise.all(extraPromises);
  return ctx;
}

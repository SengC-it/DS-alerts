import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTradePlan,
  estimateTradingCost,
  scoreSignal,
  evaluateSignalOutcome,
} from '../src/scanner.mjs';

function candle(ts, o, h, l, c, v = 100) {
  return { ts, o, h, l, c, v };
}

function trendCandles(lastClose = 100) {
  const candles = [];
  for (let i = 0; i < 70; i++) {
    const c = lastClose - 7 + i * 0.1;
    candles.push(candle(i * 3600000, c - 0.2, c + 0.8, c - 0.8, c, 100 + i));
  }
  return candles;
}

test('estimateTradingCost returns round-trip cost and net risk reward', () => {
  const result = estimateTradingCost({
    entry: 100,
    stopLoss: 96,
    takeProfit: 108,
    feeRate: 0.0005,
    slippageRate: 0.001,
    fundingRate: 0.0002,
  });

  assert.equal(result.grossRiskReward, 2);
  assert.equal(result.totalCostPct, 0.0032);
  assert.equal(result.costInPrice, 0.32);
  assert.equal(result.netRiskReward, 1.84);
});

test('buildTradePlan uses strategy-specific exits instead of one fixed ATR template', () => {
  const candles = trendCandles(100);
  const trend = buildTradePlan('trend_pullback', 'long', candles);
  const reversion = buildTradePlan('bollinger_reversion', 'long', candles);

  assert.equal(trend.direction, 'long');
  assert.equal(reversion.direction, 'long');
  assert.notEqual(trend.takeProfit, reversion.takeProfit);
  assert.ok(trend.takeProfit > trend.entry);
  assert.ok(reversion.takeProfit > reversion.entry);
  assert.ok(trend.stopLoss < trend.entry);
});

test('scoreSignal rewards clean confirmations and penalizes weak cost-adjusted trades', () => {
  const strong = scoreSignal({
    strategy: 'trend_pullback',
    direction: 'long',
    profitFactor: 2.4,
    winRate: 60,
    cost: { netRiskReward: 1.8, totalCostPct: 0.002 },
    filterDetails: {
      volume: { passed: true },
      funding: { passed: true },
      volatility: { passed: true },
    },
  });
  const weak = scoreSignal({
    strategy: 'trend_pullback',
    direction: 'long',
    profitFactor: 1.2,
    winRate: 48,
    cost: { netRiskReward: 0.9, totalCostPct: 0.01 },
    filterDetails: {
      volume: { passed: false },
      funding: { passed: true },
    },
  });

  assert.ok(strong.score >= 70);
  assert.ok(weak.score < 60);
});

test('evaluateSignalOutcome records whichever of stop loss or take profit is hit first', () => {
  const signal = {
    direction: 'long',
    entry_price: 100,
    stop_loss: 96,
    take_profit: 108,
    signal_time: new Date(0).toISOString(),
  };
  const hitTp = evaluateSignalOutcome(signal, [
    candle(3600000, 100, 104, 99, 103),
    candle(7200000, 103, 109, 102, 108),
  ]);
  const hitSl = evaluateSignalOutcome(signal, [
    candle(3600000, 100, 101, 97, 98),
    candle(7200000, 98, 99, 95, 96),
  ]);

  assert.equal(hitTp.trade_result, 'hit_tp');
  assert.equal(hitTp.actual_pnl_r, 2);
  assert.equal(hitSl.trade_result, 'hit_sl');
  assert.equal(hitSl.actual_pnl_r, -1);
});

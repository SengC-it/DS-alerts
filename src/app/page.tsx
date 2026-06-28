'use client';

import { useEffect, useState } from 'react';
import { COIN_CONFIGS } from '@/lib/config';

interface Signal {
  id: number;
  symbol: string;
  base: string;
  timeframe: string;
  strategy: string;
  dimensions: string[];
  direction: 'long' | 'short';
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  filter_details: Record<string, { passed: boolean; reason?: string }>;
  signal_time: string;
  emailed: boolean;
  created_at: string;
}

interface ScanLog {
  id: number;
  started_at: string;
  finished_at: string;
  coins_scanned: number;
  signals_found: number;
  errors: string | null;
}

const DIM_LABELS: Record<string, string> = {
  volume: 'Volume', OI: 'OI', funding: 'Funding',
  btc_trend: 'BTC Trend', volatility: 'Volatility', mtf: 'MTF',
};

export default function Home() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState('');

  const fetchData = async () => {
    try {
      const res = await fetch('/api/signals?limit=50');
      const data = await res.json();
      setSignals(data.signals || []);
      setLogs(data.scanLogs || []);
      setLastRefresh(new Date().toLocaleTimeString('zh-CN'));
    } catch (e) {
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // 每分钟刷新
    return () => clearInterval(interval);
  }, []);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const formatPrice = (p: number) => {
    if (p >= 1000) return p.toFixed(2);
    if (p >= 1) return p.toFixed(4);
    return p.toFixed(6);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">DS-Alerts</h1>
          <p className="text-sm text-gray-500">Data-Driven Trading Signals | Ablation Study Optimized</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Last refresh: {lastRefresh || '-'}</div>
          <div className="text-xs text-gray-600">{COIN_CONFIGS.length} coins monitored</div>
        </div>
      </div>

      {/* Monitored Coins */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-300 mb-3">Monitored Coins</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {COIN_CONFIGS.map((cfg, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
              <div className="font-semibold text-white text-sm">{cfg.base}<span className="text-gray-500 text-xs ml-1">{cfg.timeframe}</span></div>
              <div className="text-xs text-gray-500">{cfg.strategy} | {cfg.dimensions.map(d => DIM_LABELS[d] || d).join('+')}</div>
              <div className="text-xs text-gray-600">PF {cfg.profitFactor.toFixed(1)} | WR {cfg.winRate.toFixed(0)}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scan Logs */}
      {logs.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-300 mb-3">Scan History</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-800">
                  <th className="px-4 py-2 text-left">Time</th>
                  <th className="px-4 py-2">Scanned</th>
                  <th className="px-4 py-2">Signals</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 5).map((log) => (
                  <tr key={log.id} className="border-b border-gray-800/50">
                    <td className="px-4 py-2 text-gray-400">{formatTime(log.started_at)}</td>
                    <td className="px-4 py-2 text-gray-400 text-center">{log.coins_scanned}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={log.signals_found > 0 ? 'text-green-400 font-semibold' : 'text-gray-600'}>
                        {log.signals_found}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      {log.errors ? <span className="text-red-400 text-xs">Error</span> : <span className="text-green-600 text-xs">OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Signals */}
      <div>
        <h2 className="text-lg font-semibold text-gray-300 mb-3">
          Recent Signals {signals.length > 0 && <span className="text-gray-500 text-sm font-normal">({signals.length})</span>}
        </h2>
        
        {loading ? (
          <div className="text-center py-12 text-gray-600">Loading...</div>
        ) : signals.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center text-gray-600">
            No signals detected yet. The scanner runs every 15 minutes.
          </div>
        ) : (
          <div className="space-y-2">
            {signals.map((sig) => {
              const isLong = sig.direction === 'long';
              const rr = Math.abs(sig.take_profit - sig.entry_price) / Math.abs(sig.entry_price - sig.stop_loss);
              
              return (
                <div key={sig.id} className={`bg-gray-900 border rounded-lg p-4 ${isLong ? 'border-green-900/50' : 'border-red-900/50'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    {/* Left: Symbol & Direction */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${isLong ? 'text-green-400' : 'text-red-400'}`}>
                          {isLong ? 'LONG' : 'SHORT'}
                        </span>
                        <span className="text-xl font-bold text-white">{sig.base}/USDT</span>
                        <span className="text-sm text-gray-500">{sig.timeframe}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {sig.strategy} | {sig.dimensions.map(d => DIM_LABELS[d] || d).join(' + ')}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {formatTime(sig.created_at)} {sig.emailed ? '| Email sent' : ''}
                      </div>
                    </div>
                    
                    {/* Middle: Entry/SL/TP */}
                    <div className="text-sm">
                      <div className="flex gap-6">
                        <div><span className="text-gray-500 text-xs">Entry</span><br/><span className="font-mono text-white">{formatPrice(sig.entry_price)}</span></div>
                        <div><span className="text-gray-500 text-xs">Stop Loss</span><br/><span className="font-mono text-red-400">{formatPrice(sig.stop_loss)}</span></div>
                        <div><span className="text-gray-500 text-xs">Take Profit</span><br/><span className="font-mono text-green-400">{formatPrice(sig.take_profit)}</span></div>
                        <div><span className="text-gray-500 text-xs">R:R</span><br/><span className="font-mono text-gray-300">{rr.toFixed(1)}:1</span></div>
                      </div>
                    </div>

                    {/* Right: Filter Details */}
                    <div className="text-xs text-gray-500">
                      {Object.entries(sig.filter_details || {}).map(([dim, result]) => (
                        <div key={dim} className={result.passed ? 'text-green-700' : 'text-red-700'}>
                          {DIM_LABELS[dim] || dim}: {result.passed ? 'Pass' : `Fail${result.reason ? ' - ' + result.reason : ''}`}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-gray-800 text-center text-xs text-gray-700">
        DS-Alerts | Data-Driven by Ablation Study | Signals are for reference only, trade at your own risk
      </div>
    </div>
  );
}

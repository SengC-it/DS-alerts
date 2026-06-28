// Supabase 客户端
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 数据库表行类型
interface SignalRow {
  id?: number;
  symbol: string;
  base: string;
  timeframe: string;
  strategy: string;
  dimensions: string[];
  direction: 'long' | 'short';
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  atr_value: number;
  filter_details: Record<string, { passed: boolean; reason?: string }>;
  signal_time: string;
  emailed: boolean;
  created_at?: string;
}

interface ScanLogRow {
  id?: number;
  started_at: string;
  finished_at?: string;
  coins_scanned: number;
  signals_found: number;
  errors?: string;
  created_at?: string;
}

export type DBSignal = SignalRow;
export type DBScanLog = ScanLogRow;

// Database type definition for Supabase
interface Database {
  public: {
    Tables: {
      signals: { Row: SignalRow; Insert: Omit<SignalRow, 'id' | 'created_at'> };
      scan_logs: { Row: ScanLogRow; Insert: Omit<ScanLogRow, 'id' | 'created_at'> };
    };
  };
}

let supabaseInstance: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (supabaseInstance) return supabaseInstance;
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }
  
  supabaseInstance = createClient<Database>(url, key);
  return supabaseInstance;
}

// 冷却期检查: 同币种同方向在冷却期内不重复通知
const COOLDOWN_MS: Record<string, number> = {
  '1h': 4 * 60 * 60 * 1000,   // 1h策略: 4小时冷却
  '4h': 8 * 60 * 60 * 1000,   // 4h策略: 8小时冷却
};

export async function isInCooldown(symbol: string, direction: string, timeframe: string): Promise<boolean> {
  const db = getSupabase();
  const cooldownMs = COOLDOWN_MS[timeframe] || 4 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - cooldownMs).toISOString();
  
  const { data } = await db
    .from('signals')
    .select('id')
    .eq('symbol', symbol)
    .eq('direction', direction)
    .gte('created_at', cutoff)
    .limit(1);
  
  return !!(data && data.length > 0);
}

export async function saveSignal(signal: Omit<SignalRow, 'id' | 'created_at'>): Promise<void> {
  const db = getSupabase();
  const { error } = await db.from('signals').insert(signal as any);
  if (error) console.error('[Supabase] Save signal error:', error.message);
}

export async function saveScanLog(log: Omit<ScanLogRow, 'id' | 'created_at'>): Promise<void> {
  const db = getSupabase();
  const { error } = await db.from('scan_logs').insert(log as any);
  if (error) console.error('[Supabase] Save scan log error:', error.message);
}

export async function getRecentSignals(limit = 50): Promise<SignalRow[]> {
  const db = getSupabase();
  const { data, error } = await db
    .from('signals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('[Supabase] Get signals error:', error.message); return []; }
  return (data as SignalRow[]) || [];
}

export async function getRecentScanLogs(limit = 10): Promise<ScanLogRow[]> {
  const db = getSupabase();
  const { data, error } = await db
    .from('scan_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data as ScanLogRow[]) || [];
}

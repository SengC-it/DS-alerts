-- DS-Alerts 数据库表结构
-- 在 Supabase SQL Editor 中执行
-- 扫描由 GitHub Actions cron 触发 (不再使用 pg_cron + Edge Function)

-- ==================== 第 1 步：建表 ====================

-- 信号记录表
CREATE TABLE IF NOT EXISTS signals (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  base TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  strategy TEXT NOT NULL,
  dimensions TEXT[] NOT NULL DEFAULT '{}',
  direction TEXT NOT NULL CHECK (direction IN ('long', 'short')),
  entry_price DOUBLE PRECISION NOT NULL,
  stop_loss DOUBLE PRECISION NOT NULL,
  take_profit DOUBLE PRECISION NOT NULL,
  atr_value DOUBLE PRECISION NOT NULL DEFAULT 0,
  filter_details JSONB NOT NULL DEFAULT '{}',
  signal_time TIMESTAMPTZ NOT NULL,
  emailed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signals_symbol_dir_created ON signals (symbol, direction, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_created_at ON signals (created_at DESC);

-- 扫描日志表
CREATE TABLE IF NOT EXISTS scan_logs (
  id BIGSERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  coins_scanned INTEGER NOT NULL DEFAULT 0,
  signals_found INTEGER NOT NULL DEFAULT 0,
  errors TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_logs_created_at ON scan_logs (created_at DESC);

-- RLS 策略
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read on signals" ON signals FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous insert on signals" ON signals FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow service_role full access on signals" ON signals FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow anonymous read on scan_logs" ON scan_logs FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous insert on scan_logs" ON scan_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow service_role full access on scan_logs" ON scan_logs FOR ALL TO service_role USING (true) WITH CHECK (true);



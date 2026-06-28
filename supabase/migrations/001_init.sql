-- DS-Alerts 数据库表结构 + pg_cron 定时扫描
-- 在 Supabase SQL Editor 中按顺序执行

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

-- ==================== 第 2 步：启用 pg_cron + pg_net ====================
-- 注意：需要先在 Supabase Dashboard → Database → Extensions 中启用 pg_cron 和 pg_net

-- 启用扩展 (如果还没启用)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ==================== 第 3 步：配置定时任务 ====================
-- 每 15 分钟触发 Edge Function scanner
-- 注意：将 <PROJECT_REF> 和 <CRON_SECRET> 替换为你的实际值

-- 先删除已有的同名任务（如果存在）
SELECT cron.unschedule('scanner-cron');

-- 创建定时任务：每 15 分钟调用 Edge Function
SELECT cron.schedule(
  'scanner-cron',
  '0,15,30,45 * * * *',  -- 每15分钟
  $$
  SELECT
    net.http_post(
      url := 'https://<PROJECT_REF>.supabase.co/functions/v1/scanner',
      headers := jsonb_build_object(
        'Authorization', 'Bearer <CRON_SECRET>',
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- 验证任务已创建
SELECT * FROM cron.job WHERE jobname = 'scanner-cron';

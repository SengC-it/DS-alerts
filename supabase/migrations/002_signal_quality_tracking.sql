-- Phase 1/2 reminder-only trading quality fields.
-- These fields support cost-aware alerts and post-alert outcome tracking.

ALTER TABLE ds_signals
  ADD COLUMN IF NOT EXISTS estimated_cost_pct DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS net_risk_reward DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS signal_score INTEGER,
  ADD COLUMN IF NOT EXISTS score_details JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS actual_pnl_r DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_ds_signals_open_created
  ON ds_signals (created_at ASC)
  WHERE trade_result IS NULL;

CREATE INDEX IF NOT EXISTS idx_ds_signals_score_created
  ON ds_signals (signal_score DESC, created_at DESC);

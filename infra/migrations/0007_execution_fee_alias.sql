ALTER TABLE execution_depth_snapshots
ADD COLUMN IF NOT EXISTS total_fee_usd numeric GENERATED ALWAYS AS (fee_usd) STORED;

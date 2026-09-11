DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='timescaledb') THEN
    EXECUTE $sql$
      CREATE OR REPLACE VIEW cagg_market_hourly AS
      SELECT DISTINCT ON (market_id,date_trunc('hour',observed_at))
        market_id,
        date_trunc('hour',observed_at) AS bucket,
        supply_apr,borrow_apr,fixed_apy,implied_apy,underlying_apy,
        liquidity_usd,tvl_usd,utilization
      FROM market_snapshots
      ORDER BY market_id,date_trunc('hour',observed_at),observed_at DESC
    $sql$;
    EXECUTE $sql$
      CREATE OR REPLACE VIEW cagg_market_daily AS
      SELECT DISTINCT ON (market_id,date_trunc('day',observed_at))
        market_id,
        date_trunc('day',observed_at) AS bucket,
        supply_apr,borrow_apr,fixed_apy,implied_apy,underlying_apy,
        liquidity_usd,tvl_usd,utilization
      FROM market_snapshots
      ORDER BY market_id,date_trunc('day',observed_at),observed_at DESC
    $sql$;
  END IF;
END
$do$;

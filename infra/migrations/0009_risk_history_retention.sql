-- Risk-product retention: keep compact aggregates/features long-term, not raw observations.
-- Existing cagg_market_daily preserves durable daily market history before raw chunks age out.
DO $do$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='timescaledb') THEN
  PERFORM add_retention_policy('market_snapshots',INTERVAL '14 days',if_not_exists=>TRUE);
  PERFORM add_retention_policy('execution_depth_snapshots',INTERVAL '30 days',if_not_exists=>TRUE);
  PERFORM add_retention_policy('basis_snapshots',INTERVAL '90 days',if_not_exists=>TRUE);
 END IF;
END $do$;
CREATE INDEX IF NOT EXISTS risk_observations_entity_time_idx ON risk_observations(entity_type,entity_id,observed_at DESC);
CREATE INDEX IF NOT EXISTS entity_dependencies_observed_idx ON entity_dependencies(observed_at DESC);

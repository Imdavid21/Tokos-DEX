DROP MATERIALIZED VIEW IF EXISTS mv_latest_markets CASCADE;
CREATE MATERIALIZED VIEW mv_latest_markets AS
SELECT m.id,m.provider,m.provider_market_id,m.protocol_id,p.name protocol_name,p.slug protocol_slug,m.chain_id,c.name chain_name,c.slug chain_slug,m.asset_id,a.symbol asset_symbol,a.name asset_name,a.asset_group,m.market_type,m.rate_type,m.maturity,m.market_address,m.market_name,m.status,m.execution_model,s.observed_at,s.source_observed_at,s.ingested_at,s.supply_apr,s.borrow_apr,s.fixed_apy,s.implied_apy,s.underlying_apy,s.deposits_usd,s.debt_usd,s.liquidity_usd,s.tvl_usd,s.utilization,s.volume_24h_usd,s.reward_apr,s.intrinsic_apr,s.apr_ex_rewards,s.stale,
(SELECT(COALESCE(s.supply_apr,s.fixed_apy,s.implied_apy)-COALESCE(prev.supply_apr,prev.fixed_apy,prev.implied_apy))*10000 FROM market_snapshots prev WHERE prev.market_id=m.id AND prev.observed_at<=s.observed_at-interval'24 hours' AND prev.observed_at>=s.observed_at-interval'27 hours' ORDER BY prev.observed_at DESC LIMIT 1)change_24h_bps
FROM markets m JOIN protocols p ON p.id=m.protocol_id JOIN chains c ON c.id=m.chain_id JOIN assets a ON a.id=m.asset_id LEFT JOIN LATERAL(SELECT*FROM market_snapshots x WHERE x.market_id=m.id ORDER BY x.observed_at DESC LIMIT 1)s ON TRUE;
CREATE UNIQUE INDEX mv_latest_markets_id_idx ON mv_latest_markets(id);
CREATE INDEX mv_latest_markets_asset_idx ON mv_latest_markets(asset_id,status);
CREATE INDEX mv_latest_markets_group_idx ON mv_latest_markets(asset_group,status);
CREATE INDEX mv_latest_markets_rate_idx ON mv_latest_markets(supply_apr DESC NULLS LAST,fixed_apy DESC NULLS LAST);
CREATE INDEX mv_latest_markets_liquidity_idx ON mv_latest_markets(liquidity_usd DESC NULLS LAST);

DROP MATERIALIZED VIEW IF EXISTS mv_asset_summary CASCADE;
CREATE MATERIALIZED VIEW mv_asset_summary AS SELECT asset_id,max(asset_symbol)symbol,max(asset_name)name,max(asset_group)asset_group,count(*)FILTER(WHERE status='active')market_count,count(DISTINCT protocol_id)protocol_count,count(DISTINCT chain_id)chain_count,percentile_cont(.5)WITHIN GROUP(ORDER BY COALESCE(supply_apr,fixed_apy,implied_apy))FILTER(WHERE COALESCE(supply_apr,fixed_apy,implied_apy)IS NOT NULL AND status='active')median_rate,max(COALESCE(supply_apr,fixed_apy,implied_apy))FILTER(WHERE status='active'AND NOT stale)best_rate,sum(COALESCE(deposits_usd,tvl_usd,0))FILTER(WHERE status='active')tracked_deposits_usd,sum(COALESCE(liquidity_usd,0))FILTER(WHERE status='active')liquidity_usd,max(observed_at)as_of FROM mv_latest_markets GROUP BY asset_id;
CREATE UNIQUE INDEX mv_asset_summary_id_idx ON mv_asset_summary(asset_id);

DROP MATERIALIZED VIEW IF EXISTS mv_protocol_summary CASCADE;
CREATE MATERIALIZED VIEW mv_protocol_summary AS SELECT protocol_id,max(protocol_name)name,count(*)FILTER(WHERE status='active')market_count,count(DISTINCT chain_id)chain_count,count(DISTINCT asset_id)asset_count,percentile_cont(.5)WITHIN GROUP(ORDER BY supply_apr)FILTER(WHERE supply_apr IS NOT NULL AND status='active')median_supply_apr,avg(utilization)FILTER(WHERE utilization IS NOT NULL AND status='active')avg_utilization,sum(COALESCE(deposits_usd,tvl_usd,0))FILTER(WHERE status='active')tracked_deposits_usd,sum(COALESCE(liquidity_usd,0))FILTER(WHERE status='active')liquidity_usd,max(observed_at)as_of FROM mv_latest_markets GROUP BY protocol_id;
CREATE UNIQUE INDEX mv_protocol_summary_id_idx ON mv_protocol_summary(protocol_id);

DROP MATERIALIZED VIEW IF EXISTS mv_chain_summary CASCADE;
CREATE MATERIALIZED VIEW mv_chain_summary AS SELECT chain_id,max(chain_name)name,max(chain_slug)slug,count(*)FILTER(WHERE status='active')market_count,count(DISTINCT protocol_id)protocol_count,count(DISTINCT asset_id)asset_count,sum(COALESCE(deposits_usd,tvl_usd,0))FILTER(WHERE status='active')tracked_deposits_usd,sum(COALESCE(liquidity_usd,0))FILTER(WHERE status='active')liquidity_usd,max(observed_at)as_of FROM mv_latest_markets GROUP BY chain_id;
CREATE UNIQUE INDEX mv_chain_summary_id_idx ON mv_chain_summary(chain_id);

DROP MATERIALIZED VIEW IF EXISTS mv_rate_movers CASCADE;
CREATE MATERIALIZED VIEW mv_rate_movers AS SELECT*FROM mv_latest_markets WHERE change_24h_bps IS NOT NULL ORDER BY abs(change_24h_bps)DESC;
CREATE UNIQUE INDEX mv_rate_movers_id_idx ON mv_rate_movers(id);

DROP VIEW IF EXISTS rate_snapshots;
CREATE VIEW rate_snapshots AS
SELECT market_id,observed_at,source_observed_at,ingested_at,
       CASE
         WHEN fixed_apy IS NOT NULL THEN fixed_apy
         WHEN implied_apy IS NOT NULL THEN implied_apy
         ELSE supply_apr
       END AS rate,
       CASE
         WHEN fixed_apy IS NOT NULL OR implied_apy IS NOT NULL THEN 'APY'
         WHEN supply_apr IS NOT NULL THEN 'APR'
         ELSE NULL
       END AS rate_convention,
       CASE
         WHEN fixed_apy IS NOT NULL THEN 'fixed_apy'
         WHEN implied_apy IS NOT NULL THEN 'implied_apy'
         WHEN supply_apr IS NOT NULL THEN 'supply_apr'
         ELSE NULL
       END AS rate_field,
       borrow_apr,reward_apr,apr_ex_rewards,liquidity_usd,tvl_usd,utilization,stale,raw_payload_hash
FROM market_snapshots;

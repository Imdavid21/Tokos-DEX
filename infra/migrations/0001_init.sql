CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS assets(id text PRIMARY KEY,symbol text NOT NULL,name text NOT NULL,asset_group text,decimals integer,logo_url text,category text NOT NULL,stablecoin_peg text,aliases text[] NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS chains(id text PRIMARY KEY,slug text UNIQUE NOT NULL,name text NOT NULL,logo_url text,native_asset_symbol text,active boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS protocols(id text PRIMARY KEY,slug text UNIQUE NOT NULL,name text NOT NULL,logo_url text,website_url text,categories text[] NOT NULL DEFAULT '{}',provider_keys jsonb NOT NULL DEFAULT '[]');
CREATE TABLE IF NOT EXISTS markets(id text PRIMARY KEY,provider text NOT NULL CHECK(provider IN('1delta','pendle')),provider_market_id text NOT NULL,protocol_id text NOT NULL REFERENCES protocols(id),chain_id text NOT NULL REFERENCES chains(id),asset_id text NOT NULL REFERENCES assets(id),quote_asset_id text REFERENCES assets(id),market_type text NOT NULL,rate_type text NOT NULL,maturity timestamptz,market_address text,market_name text NOT NULL,status text NOT NULL,execution_model text NOT NULL,metadata jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(provider,provider_market_id));
CREATE TABLE IF NOT EXISTS provider_observations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),provider text NOT NULL,endpoint text NOT NULL,request_fingerprint text NOT NULL,source_observed_at timestamptz,ingested_at timestamptz NOT NULL DEFAULT now(),http_status integer NOT NULL,success boolean NOT NULL,payload jsonb,payload_hash text NOT NULL,error_code text);
CREATE TABLE IF NOT EXISTS ingestion_health(provider text PRIMARY KEY,last_attempt timestamptz,last_success timestamptz,last_error text,consecutive_failures integer NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS market_snapshots(market_id text NOT NULL REFERENCES markets(id),observed_at timestamptz NOT NULL,source_observed_at timestamptz,ingested_at timestamptz NOT NULL DEFAULT now(),supply_apr double precision,borrow_apr double precision,fixed_apy double precision,implied_apy double precision,underlying_apy double precision,deposits_usd numeric,debt_usd numeric,liquidity_usd numeric,tvl_usd numeric,utilization double precision,volume_24h_usd numeric,reward_apr double precision,intrinsic_apr double precision,apr_ex_rewards double precision,stale boolean NOT NULL DEFAULT false,raw_payload_hash text,PRIMARY KEY(market_id,observed_at));
SELECT create_hypertable('market_snapshots',by_range('observed_at'),if_not_exists=>TRUE);
CREATE TABLE IF NOT EXISTS execution_depth_snapshots(market_id text NOT NULL REFERENCES markets(id),observed_at timestamptz NOT NULL,side text NOT NULL,notional_usd numeric NOT NULL,horizon_days integer,horizon_key integer GENERATED ALWAYS AS(COALESCE(horizon_days,-1)) STORED,headline_apr double precision,apr_at_amount double precision,effective_apr double precision,effective_apy double precision,cost_pct double precision,price_impact_bps double precision,fee_usd numeric,fillable numeric,capped boolean,quote_basis text,locked boolean,price_risk boolean,assumptions jsonb NOT NULL DEFAULT '[]',methodology_version text NOT NULL,PRIMARY KEY(market_id,observed_at,side,notional_usd,horizon_key));
SELECT create_hypertable('execution_depth_snapshots',by_range('observed_at'),if_not_exists=>TRUE);
CREATE TABLE IF NOT EXISTS basis_snapshots(asset_id text NOT NULL REFERENCES assets(id),observed_at timestamptz NOT NULL,horizon_days integer NOT NULL,notional_usd numeric NOT NULL,fixed_market_id text NOT NULL REFERENCES markets(id),floating_market_id text NOT NULL REFERENCES markets(id),fixed_rate double precision NOT NULL,floating_rate double precision NOT NULL,basis_bps double precision NOT NULL,methodology_version text NOT NULL,PRIMARY KEY(asset_id,observed_at,horizon_days,notional_usd,fixed_market_id,floating_market_id));
SELECT create_hypertable('basis_snapshots',by_range('observed_at'),if_not_exists=>TRUE);

CREATE INDEX IF NOT EXISTS markets_asset_status_idx ON markets(asset_id,status);
CREATE INDEX IF NOT EXISTS markets_protocol_status_idx ON markets(protocol_id,status);
CREATE INDEX IF NOT EXISTS markets_chain_status_idx ON markets(chain_id,status);
CREATE INDEX IF NOT EXISTS market_snapshots_market_time_idx ON market_snapshots(market_id,observed_at DESC);
CREATE INDEX IF NOT EXISTS execution_depth_lookup_idx ON execution_depth_snapshots(market_id,notional_usd,horizon_days,observed_at DESC);
CREATE INDEX IF NOT EXISTS basis_lookup_idx ON basis_snapshots(asset_id,horizon_days,notional_usd,observed_at DESC);
CREATE INDEX IF NOT EXISTS assets_symbol_search_idx ON assets USING gin (symbol gin_trgm_ops);
CREATE INDEX IF NOT EXISTS assets_name_search_idx ON assets USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS assets_aliases_idx ON assets USING gin (aliases);
CREATE INDEX IF NOT EXISTS protocols_search_idx ON protocols USING gin ((name||' '||slug) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS markets_search_idx ON markets USING gin ((market_name||' '||id||' '||provider_market_id) gin_trgm_ops);

CREATE OR REPLACE FUNCTION set_snapshot_staleness(lending_seconds integer,pendle_seconds integer)RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 UPDATE market_snapshots s SET stale=EXTRACT(EPOCH FROM(now()-COALESCE(s.source_observed_at,s.observed_at)))>CASE m.provider WHEN'1delta'THEN lending_seconds ELSE pendle_seconds END FROM markets m WHERE m.id=s.market_id AND s.observed_at>=now()-interval'1 day';
END$$;

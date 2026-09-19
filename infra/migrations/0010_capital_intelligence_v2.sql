-- Capital Intelligence V2: scenarios, manual portfolios, alert rules and defensible risk history.
CREATE TABLE IF NOT EXISTS scenario_runs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),entity_type text NOT NULL,entity_id text NOT NULL,
 scenario_key text NOT NULL,inputs jsonb NOT NULL,outputs jsonb NOT NULL,methodology_version text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scenario_runs_entity_idx ON scenario_runs(entity_type,entity_id,created_at DESC);
CREATE TABLE IF NOT EXISTS portfolios(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS portfolio_positions(
 portfolio_id uuid NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,market_id text NOT NULL REFERENCES markets(id),
 weight double precision NOT NULL CHECK(weight>=0 AND weight<=1),notional_usd numeric,PRIMARY KEY(portfolio_id,market_id)
);
CREATE TABLE IF NOT EXISTS alert_rules(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),entity_type text NOT NULL,entity_id text NOT NULL,metric_key text NOT NULL,
 operator text NOT NULL CHECK(operator IN('gt','gte','lt','lte')),threshold double precision NOT NULL,enabled boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO methodology_registry(slug,name,version,scope,description,formula,inputs,limitations) VALUES
('scenario-v1','Deterministic Stress Scenarios','scenario-v1','risk','Applies explicit rate, liquidity and utilization shocks to observed market state. Scenarios are not probabilities.','scenario_return = observed_yield + rate_shock - execution_cost','["observed yield","liquidity","utilization","explicit shocks"]','["Not a probability forecast","No credit-loss inference without loss data"]'),
('adjusted-yield-v1','Execution-adjusted Yield','adjusted-yield-v1','relative-value','Subtracts observed execution cost from headline yield when a provider quote exists.','adjusted_yield = headline_yield - annualized_execution_cost','["headline yield","provider execution cost","holding horizon"]','["Unavailable when execution quote or horizon is unavailable","Does not include inferred credit loss"]')
ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name,version=EXCLUDED.version,scope=EXCLUDED.scope,description=EXCLUDED.description,formula=EXCLUDED.formula,inputs=EXCLUDED.inputs,limitations=EXCLUDED.limitations,updated_at=now();

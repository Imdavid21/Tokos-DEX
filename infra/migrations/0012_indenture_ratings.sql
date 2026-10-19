-- Indenture PSL ratings: every run is stored with its inputs hash and seed so any rating can be reproduced.
CREATE TABLE IF NOT EXISTS rating_runs(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK(entity_type IN('market','vault','asset','protocol','curator')),
  entity_id text NOT NULL,
  methodology_version text NOT NULL,
  grade text NOT NULL,
  outlook text NOT NULL CHECK(outlook IN('stable','positive','negative','watch')),
  psl double precision NOT NULL,
  psl_low double precision NOT NULL,
  psl_high double precision NOT NULL,
  lgd double precision NOT NULL,
  expected_loss double precision NOT NULL,
  supply_apy double precision,
  risk_adjusted_apy double precision,
  coverage double precision NOT NULL,
  seed bigint NOT NULL,
  paths integer NOT NULL,
  inputs_hash text NOT NULL,
  inputs jsonb NOT NULL,
  drivers jsonb NOT NULL,
  simulation jsonb NOT NULL,
  limitations jsonb NOT NULL DEFAULT '[]',
  computed_at timestamptz NOT NULL DEFAULT now(),
  duration_ms integer,
  UNIQUE(entity_type,entity_id,methodology_version,computed_at)
);
CREATE INDEX IF NOT EXISTS rating_runs_entity_idx ON rating_runs(entity_type,entity_id,computed_at DESC);
CREATE INDEX IF NOT EXISTS rating_runs_computed_idx ON rating_runs(computed_at DESC);

-- Latest rating per entity, maintained by the worker.
CREATE TABLE IF NOT EXISTS ratings_latest(
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  run_id uuid NOT NULL REFERENCES rating_runs(id) ON DELETE CASCADE,
  methodology_version text NOT NULL,
  grade text NOT NULL,
  outlook text NOT NULL,
  psl double precision NOT NULL,
  psl_low double precision NOT NULL,
  psl_high double precision NOT NULL,
  lgd double precision NOT NULL,
  expected_loss double precision NOT NULL,
  supply_apy double precision,
  risk_adjusted_apy double precision,
  coverage double precision NOT NULL,
  top_driver text,
  computed_at timestamptz NOT NULL,
  PRIMARY KEY(entity_type,entity_id)
);
CREATE INDEX IF NOT EXISTS ratings_latest_grade_idx ON ratings_latest(grade,psl);
CREATE INDEX IF NOT EXISTS ratings_latest_radj_idx ON ratings_latest(risk_adjusted_apy DESC NULLS LAST);

-- Rating actions: initiations, upgrades, downgrades, affirmations and withdrawals, with the reason.
CREATE TABLE IF NOT EXISTS rating_actions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL CHECK(action IN('initiate','upgrade','downgrade','affirm','withdraw','outlook')),
  from_grade text,
  to_grade text NOT NULL,
  from_psl double precision,
  to_psl double precision NOT NULL,
  from_outlook text,
  to_outlook text NOT NULL,
  notches integer NOT NULL DEFAULT 0,
  reason text NOT NULL,
  run_id uuid REFERENCES rating_runs(id) ON DELETE SET NULL,
  methodology_version text NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rating_actions_time_idx ON rating_actions(observed_at DESC);
CREATE INDEX IF NOT EXISTS rating_actions_entity_idx ON rating_actions(entity_type,entity_id,observed_at DESC);

INSERT INTO methodology_registry(slug,name,version,scope,description,formula,inputs,limitations) VALUES
('indenture-psl-v1','Indenture Loss Probability Rating','indenture-psl-v1','credit-risk',
'Annual Probability of Significant Loss (PSL): the chance a supplier loses more than 1% of principal within one year, estimated by Monte Carlo simulation of the collateral-to-loan price ratio through the market liquidation rule, exit liquidity, oracle lag, and independent structural and protocol events. Graded AAA to D on published PSL bands.',
'PSL = share of simulated one-year paths with supplier loss > 1%. Each path: daily jump-diffusion of collateral/loan ratio with stress regimes; borrower buckets liquidate when LTV >= LLTV; recovery = collateral x (1 - sqrt-impact slippage - gas - oracle haircut); bad debt = max(0, debt - recovery) / supply. Independent annual events: collateral structural shock, loan-asset impairment, protocol loss. Expected loss = mean path loss. Risk-adjusted APY = APY - expected loss. Grades: AAA <0.1%, AA <0.4%, A <0.8%, BBB <1.5%, BB <3%, B <6%, CCC <12%, CC <32%, C <99.9%, else D. Coverage < 50% => NR.',
'["collateral and loan archetype","ratio volatility (observed or archetype prior)","liquidation LTV and bonus","utilization and supply","execution price impact at notional","oracle lag","30-day rate volatility","protocol loss probability"]',
'["Volatility priors are used where collateral price history is not yet ingested","Borrower leverage distribution is a published prior pending position-level data","Protocol loss probability is a flat prior pending per-protocol assessment","Smart-contract, legal and governance risk are not separately modeled","Ratings are comparable only within one methodology version"]')
ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name,version=EXCLUDED.version,scope=EXCLUDED.scope,description=EXCLUDED.description,formula=EXCLUDED.formula,inputs=EXCLUDED.inputs,limitations=EXCLUDED.limitations,updated_at=now();

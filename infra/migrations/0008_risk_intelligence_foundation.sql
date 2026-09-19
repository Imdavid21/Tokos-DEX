-- Risk intelligence foundation: transparent, auditable entity relationships and risk observations.
-- No opaque scores. All model outputs must remain attributable to source/methodology.

CREATE TABLE IF NOT EXISTS entity_dependencies(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL CHECK(source_type IN('asset','market','protocol','chain','vault','curator','oracle','issuer','bridge','liquidity_venue')),
  source_id text NOT NULL,
  relationship text NOT NULL,
  target_type text NOT NULL CHECK(target_type IN('asset','market','protocol','chain','vault','curator','oracle','issuer','bridge','liquidity_venue')),
  target_id text NOT NULL,
  exposure_usd numeric,
  weight double precision,
  source text NOT NULL,
  methodology_version text NOT NULL,
  observed_at timestamptz NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  stale boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}',
  UNIQUE(source_type,source_id,relationship,target_type,target_id,observed_at)
);

CREATE INDEX IF NOT EXISTS entity_dependencies_source_idx
  ON entity_dependencies(source_type,source_id,observed_at DESC);
CREATE INDEX IF NOT EXISTS entity_dependencies_target_idx
  ON entity_dependencies(target_type,target_id,observed_at DESC);
CREATE INDEX IF NOT EXISTS entity_dependencies_relationship_idx
  ON entity_dependencies(relationship,observed_at DESC);

CREATE TABLE IF NOT EXISTS risk_observations(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK(entity_type IN('asset','market','protocol','chain','vault','curator')),
  entity_id text NOT NULL,
  dimension text NOT NULL,
  metric_key text NOT NULL,
  value double precision,
  unit text NOT NULL,
  direction text CHECK(direction IN('lower_is_better','higher_is_better','neutral')),
  severity text CHECK(severity IN('low','moderate','elevated','high','critical')),
  confidence double precision CHECK(confidence IS NULL OR (confidence>=0 AND confidence<=1)),
  source text NOT NULL,
  source_observed_at timestamptz,
  observed_at timestamptz NOT NULL,
  methodology_version text NOT NULL,
  assumptions jsonb NOT NULL DEFAULT '[]',
  stale boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}',
  UNIQUE(entity_type,entity_id,dimension,metric_key,observed_at)
);

CREATE INDEX IF NOT EXISTS risk_observations_entity_idx
  ON risk_observations(entity_type,entity_id,observed_at DESC);
CREATE INDEX IF NOT EXISTS risk_observations_metric_idx
  ON risk_observations(metric_key,observed_at DESC);

CREATE TABLE IF NOT EXISTS methodology_registry(
  slug text PRIMARY KEY,
  name text NOT NULL,
  version text NOT NULL,
  scope text NOT NULL,
  description text NOT NULL,
  formula text,
  inputs jsonb NOT NULL DEFAULT '[]',
  limitations jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO methodology_registry(slug,name,version,scope,description,formula,inputs,limitations)
VALUES
('risk-observation-v1','Risk Observation Framework','risk-v1','risk',
 'Transparent storage contract for observable risk dimensions. It does not produce a composite rating or probability of loss.',
 NULL,
 '["source metric","observation timestamp","methodology version","confidence where supported"]',
 '["No composite score","No inferred probability of default","No fabricated values"]'),
('dependency-graph-v1','Entity Dependency Graph','dependency-v1','dependencies',
 'Canonical directed relationships between assets, markets, protocols, chains, and future vault/curator/oracle/issuer entities.',
 NULL,
 '["source entity","relationship","target entity","optional exposure or weight","provenance"]',
 '["Only observed or explicitly modelled relationships may be stored","Missing edges remain missing"]')
ON CONFLICT(slug) DO UPDATE SET
  name=EXCLUDED.name,version=EXCLUDED.version,scope=EXCLUDED.scope,
  description=EXCLUDED.description,formula=EXCLUDED.formula,inputs=EXCLUDED.inputs,
  limitations=EXCLUDED.limitations,updated_at=now();

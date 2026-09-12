CREATE INDEX IF NOT EXISTS provider_observations_sampling_idx
ON provider_observations(provider,endpoint,ingested_at DESC)
WHERE success=true AND payload IS NOT NULL;

CREATE INDEX IF NOT EXISTS provider_observations_ingested_idx
ON provider_observations(ingested_at DESC);

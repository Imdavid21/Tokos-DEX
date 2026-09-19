-- Evidence Rating V1: deterministic ordinal rating derived only from observed market-risk metrics.
-- This is a Tokos evidence rating, not an estimate of default probability or expected loss.
INSERT INTO methodology_registry(slug,name,version,scope,description,formula,inputs,limitations) VALUES
('evidence-rating-v1','Tokos Evidence Rating','evidence-rating-v1','credit-risk',
'Ordinal AAA–CCC rating for market resilience based on observable liquidity, utilization, 30-day rate volatility and execution price impact. Missing dimensions reduce coverage and can force NR.',
'Each observed dimension maps to 100/75/45/15 for low/moderate/elevated/high severity. Weighted score = liquidity 35% + utilization 25% + rate volatility 20% + price impact 20%, renormalized over available dimensions. Coverage < 50% => NR. High-severity dimension caps rating at BB. Elevated-severity dimension caps rating at BBB. Otherwise score: >=90 AAA, >=82 AA, >=72 A, >=62 BBB, >=50 BB, >=35 B, else CCC.',
'["available liquidity USD","utilization","30d rate volatility","latest execution price impact bps","observation freshness"]',
'["Not a probability of default","Not an expected-loss estimate","Does not yet model smart-contract, oracle, bridge, issuer, governance or legal risk unless separately observed","Ordinal ratings are only comparable under this methodology version"]')
ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name,version=EXCLUDED.version,scope=EXCLUDED.scope,description=EXCLUDED.description,formula=EXCLUDED.formula,inputs=EXCLUDED.inputs,limitations=EXCLUDED.limitations,updated_at=now();

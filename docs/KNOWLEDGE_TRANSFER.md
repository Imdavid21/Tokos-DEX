# Tokos Data Knowledge Transfer

Updated: 2026-09-12
Repository: `Imdavid21/Tokos-DEX`
Public route: `https://tokos.fun/data`

This repository is Tokos Data. The repository name is historical because it used to host an older DEX that is now decommissioned.

Read this file together with:
- `AGENTS.md`
- `README.md`
- `docs/TOKOS_DATA_MASTER_SPEC.md`
- `docs/BUILD_STATUS.md`
- `docs/DEX_ARCHIVE.md`
- the cross-project handoff in `Imdavid21/tokos/docs/FULL_KNOWLEDGE_TRANSFER_2026-09-12.md`

## 1. Product boundary

Tokos Data is separate from Tokos V2.

- V2 repo: `Imdavid21/tokos`
- Data repo: `Imdavid21/Tokos-DEX`
- Public Data route: `https://tokos.fun/data`
- Main V2 site reverse-proxies `/data` and `/data/*` through `TOKOS_DATA_ORIGIN`.

Do not modify V2 wallet, trading, execution, session, or portfolio behavior from this repository.

1delta may be used here as a market-data provider. It is not currently part of the V2 execution product.

## 2. Product goal

Tokos Data is an onchain yield/rates intelligence product.

The product should answer:

> What is this yield worth at a given size, duration, maturity, liquidity profile, and alternative opportunity set?

It should feel like a premium analytical research terminal, not a marketing dashboard.

Competitive references:
- Token Terminal for hierarchy, density, and entity pages;
- Dune for analytical flexibility and chart density;
- DefiLlama for breadth, filters, and history;
- Portals Explorer for discovery, rankings, momentum, and sparklines;
- Flowscan-style data products and specialized yield/basis dashboards for interactive research patterns.

These are references for information architecture and interaction quality, not for copying brand systems.

## 3. Non-negotiable data rules

- Never fabricate market data.
- Never ship mock/demo production values.
- Preserve APR/APY meaning.
- Preserve observation timestamps.
- Preserve source/provenance.
- Preserve staleness state.
- Financial calculations must be deterministic and versionable.
- Derive deltas/volatility/percentiles only where history supports them.
- Never infer capital flows from TVL changes unless the data genuinely identifies flows.
- Missing observations should render unavailable/stale/insufficient-history states.
- Representative fallback data must be clearly labelled representative.

## 4. Architecture

High-level flow:

```text
Pendle / 1delta / future providers
-> provider adapters
-> raw observations
-> ingestion / workers
-> deterministic normalization and financial math
-> PostgreSQL / Timescale
-> read models
-> Fastify API
-> Next.js research UI
```

Redis/BullMQ are used where configured.

Repository structure:

```text
apps/web       Next.js research UI
apps/api       Fastify API
apps/worker    ingestion/background jobs
packages/*     analytics, contracts, config, DB, providers, shared packages
infra/*        infrastructure assets
docs/*         master spec, methods, archive, status, handoff
scripts/*      operational/dev scripts
```

Local infrastructure in `docker-compose.yml` includes Timescale/PostgreSQL and Redis.

## 5. Runtime

Canonical runtime:
- Node 24.21+
- pnpm 12.3.4

Validation commands:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Do not mark a change complete if the relevant CI/build is red.

## 6. Railway project split

Tokos Data is being moved out of the shared V2 Railway project.

Dedicated Railway project:
- name: `tokos-data`
- project ID: `23ecd480-6fbb-403d-823e-9cb4c3599737`
- production environment ID: `9b545e9f-9ffa-45a0-a4f7-7beffdc153e9`
- web service: `tokos-data`
- service ID: `a660dc80-e1f2-4c2a-b038-b169be9790b6`
- generated domain: `https://tokos-data-production.up.railway.app`

Old Data service in the V2 Railway project:
- project: `tokos`
- old service: `tokos-dex`
- old service ID: `e21b53cd-e9a3-4955-af98-80da63cb75b7`

After the new service is healthy and `tokos.fun/data` is verified through the new origin, the old Data service should be removed so the old `tokos` Railway project is V2-only.

## 7. Railway web-service configuration

The Data web service should use:

```text
NEXT_PUBLIC_BASE_PATH=/data
SERVICE=web
PORT=3000
NODE_ENV=production
APP_ENV=production
PENDLE_API_BASE_URL=https://api-v2.pendle.finance/core
ONEDELTA_API_BASE_URL=https://portal.1delta.io/v1
```

Web build:

```bash
pnpm --filter @tokos-data/web build
```

Web start:

```bash
pnpm --filter @tokos-data/web exec next start -p 3000
```

Health path:

```text
/data
```

Important Dockerfile behavior:

```text
CMD pnpm --filter @tokos-data/${SERVICE:-api} start
```

Therefore `SERVICE=web` is required when the Dockerfile CMD is used directly for the web service. Without it, Railway can start the API process and fail on missing database configuration.

Do not commit Railway secret values into this repository.

## 8. Public routing

`tokos.fun/data` is not hosted directly by the V2 codebase.

`tokos-web` in the main repository reverse-proxies `/data` and descendants to `TOKOS_DATA_ORIGIN`.

Cutover procedure:
1. verify the new Data service directly;
2. set `TOKOS_DATA_ORIGIN` on `tokos-web` to the new Railway origin;
3. verify `https://tokos.fun/data` and child routes;
4. confirm assets, navigation, and API paths preserve `/data` base path;
5. only then remove the old Data service.

## 9. Live fallback behavior

The web layer has a server-side live fallback for public research pages when the normalized API/read model is unavailable.

Current fallback:
- fetches the active Pendle market catalogue;
- reads current implied APY;
- reads underlying/base APY where present;
- reads TVL, liquidity, maturity, chain, and market metadata;
- fetches real Pendle v3 historical data;
- samples the 8 most liquid active markets for representative historical fallback;
- aggregates median and TVL-weighted fixed yield history;
- derives a floating reference from underlying/base APY;
- computes real 24H/7D rate movements in basis points;
- provides real sparklines/trends for sampled markets.

This fallback is a resilience mechanism, not a replacement for the full database/API/worker architecture.

Do not silently present the representative sample as full-universe historical coverage.

## 10. Recent data-correctness work

Recent 2026-09-12 changes include:
- current Pendle payload normalization;
- live market rendering verification;
- real Pendle historical-data integration;
- Rate Movers from actual historical changes;
- history fallback for Overview;
- hiding unavailable metrics instead of inventing them;
- representative-history labelling;
- CI validation of history and movers;
- multi-series chart colors;
- categorical analytical palette fixes.

Always inspect latest `main` before editing because several agents may work concurrently.

## 11. Design system

Target feel:
- institutional;
- analytical;
- premium;
- calm;
- dense;
- exact.

Avoid:
- giant cards;
- giant headings;
- huge whitespace;
- card spam;
- neon/cyberpunk styling;
- gradient-heavy styling;
- glassmorphism;
- bloated explanation text;
- eyebrow headings;
- random font sizes;
- inconsistent spacing;
- unreadable muted grey;
- duplicated tooltip data.

Use:
- one sans family;
- tabular numerals;
- compact page titles;
- small analytical section titles;
- 8px spacing grid;
- dense tables;
- aligned grids;
- first-class light/dark modes;
- responsive simplification;
- clear empty/stale/loading states.

## 12. Analytical color system

Tokos green is the brand/health/positive anchor, not the only chart color.

Light mode:
- green `#3F7D3A`
- blue `#4568F2`
- coral `#F16D5B`
- violet `#8267D9`
- teal `#2AA889`
- amber `#D99A32`
- rose `#D85E8E`
- cyan `#4AA8C7`

Dark mode uses brighter equivalents.

Heatmaps use a blue-low -> teal-mid -> amber-high progression.

Semantic guidance:
- blue: primary analytical series;
- coral/violet: comparison categories;
- teal/green: liquidity/positive/health;
- amber: basis/impact/warnings;
- coral/red: negative/error;
- rose/cyan: additional categories.

## 13. Navigation target

Research:
- Overview
- Markets
- Rates
- Yield Curve
- Basis
- Liquidity / Execution
- Correlations

Entities:
- Assets
- Protocols
- Chains
- Compare

Data:
- Datasets
- Metrics

Utilities:
- search
- export
- theme
- source health

## 14. P0 visual foundation status

Approximate completion: 95-100%.

Implemented:
- compact shell/navigation;
- typography system;
- spacing/grid system;
- light/dark mode;
- metric strip;
- reusable chart system;
- sparklines;
- dense sticky tables;
- compact filters;
- loading/error/stale states;
- hover/crosshair/zoom/fullscreen/CSV behaviors.

## 15. P1 core product status

Approximate completion: 90-95%.

Implemented surfaces:
- Overview;
- Markets;
- Market Detail;
- Rates;
- Yield Curve;
- Basis;
- Liquidity/Execution analytics.

Continue to improve correctness and edge states, but do not rebuild these from scratch without a specific reason.

## 16. P2 entity intelligence status

Approximate completion: 30-35%.

This is the biggest obvious gap.

### Asset page target

Metrics:
- markets;
- protocols;
- chains;
- deposits;
- liquidity;
- median yield;
- best yield.

Visuals:
- yield history;
- yield curve;
- fixed vs floating;
- protocol breakdown;
- chain breakdown;
- distribution;
- yield landscape;
- markets table.

### Protocol page target

Metrics:
- markets;
- assets;
- chains;
- deposits;
- debt;
- liquidity;
- median supply rate;
- utilization where supported.

Visuals:
- deposits/TVL history;
- rate history;
- liquidity history;
- utilization history;
- asset composition;
- chain composition;
- distribution;
- markets table.

### Chain page target

Metrics:
- markets;
- protocols;
- assets;
- deposits;
- liquidity;
- median yield.

Visuals:
- rate history;
- deposits/TVL history;
- protocol share;
- asset share;
- distribution;
- market table.

### Compare target

Support 2-6 markets.

Comparison fields:
- current rate;
- 24H/7D/30D change;
- liquidity;
- TVL/deposits/debt;
- utilization;
- maturity/tenor;
- volatility;
- percentile;
- effective rate;
- price impact.

Charts:
- Rate History;
- Liquidity History;
- Utilization;
- optional normalized/indexed performance;
- configurable scatter with selectable X/Y/bubble dimensions.

Preserve URL-shareable selection state.

## 17. P3 advanced visual analytics status

Approximate completion: 45-50%.

Already available in some form:
- heatmaps;
- distributions/histograms;
- yield landscape;
- maturity ladder.

Remaining/incomplete:
- treemap;
- correlation matrix;
- overlap/sample sufficiency rules for correlations;
- broader reusable heatmap combinations;
- relationship map;
- reusable analytical diagrams.

Required diagrams:
- Yield Flow;
- Fixed Yield Anatomy;
- Floating Yield Anatomy;
- Basis;
- Execution;
- Market Relationship Map.

## 18. P4 data-product status

Approximate completion: 35-40%.

Remaining:
- richer Dataset pages;
- consistent source/frequency/latest observation fields;
- methodology/version visibility;
- CSV polish;
- Metrics Directory;
- richer export flows;
- broader shareable analytical URL state.

## 19. Dataset target

Core datasets:
- markets;
- market_snapshots;
- rate_snapshots;
- execution_depth;
- basis;
- assets;
- protocols;
- chains.

Every dataset page should expose:
- name;
- concise description;
- source;
- row count;
- update frequency;
- latest observation;
- schema;
- sample;
- methodology;
- CSV.

## 20. Metrics Directory target

Metrics include:
- Supply APR;
- Borrow APR;
- Fixed APY;
- Implied APY;
- Underlying APY;
- Reward APR/APY where relevant;
- Effective APY;
- liquidity;
- TVL;
- deposits;
- debt;
- utilization;
- basis;
- price impact;
- volatility;
- percentile.

Each metric needs:
- definition;
- unit;
- source;
- formula;
- frequency;
- methodology;
- historical availability.

## 21. Chart library target

Reusable visual types:
- line;
- area;
- stacked area;
- bar;
- horizontal bar;
- scatter;
- bubble;
- histogram;
- heatmap;
- treemap;
- correlation matrix;
- maturity ladder;
- yield curve;
- basis surface;
- sparkline.

Interactions:
- hover;
- crosshair;
- unified tooltip;
- zoom;
- pan where useful;
- series toggle;
- timeframe selector;
- fullscreen;
- CSV;
- shareable URL state.

## 22. Performance expectations

Pay attention to:
- initial render latency;
- chart render cost;
- table virtualization when datasets grow;
- caching;
- server-side aggregation;
- lazy loading secondary visualizations;
- deterministic loading states;
- avoiding repeated provider fetches when one server request can be reused.

## 23. Responsive behavior

Desktop is primary, but mobile must remain functional.

On smaller screens:
- simplify layouts;
- stack analytical grids;
- preserve key controls;
- allow table horizontal scroll where necessary;
- do not hide critical data states;
- keep selectors and navigation usable.

## 24. Current production behavior verified 2026-09-12

Public fallback was verified to show:
- non-empty Market History;
- no generic “History is accumulating” state when Pendle history is available;
- 8 Rate Mover rows;
- real positive and negative basis-point changes;
- representative-history labelling;
- successful CI for lint, typecheck, tests, and build on the validated history/color implementation.

Re-check production before assuming these remain current.

## 25. Concurrency rules

Multiple agents may write concurrently.

Before every change:
1. fetch latest `main`;
2. inspect recent commits;
3. inspect open PRs if relevant;
4. verify whether another agent touched the same area;
5. do not revert unrelated work;
6. make the smallest coherent change;
7. run tests/build;
8. inspect the exact Railway deployment;
9. smoke-test affected public routes.

Do not use an old chat as deployment truth.

## 26. Security and integrity rules

- Never commit secrets.
- Never commit provider keys or routing credentials.
- Never commit database passwords.
- Do not leak Railway variable values.
- Railway project/service IDs are operational identifiers and may be documented.
- Do not fabricate rates or history.
- Do not silently substitute representative data as exact data.
- Do not revive the old standalone DEX runtime.
- Do not couple Data deployment to V2 persistence without an explicit decision.

## 27. What a new Data agent should do first

1. Read `AGENTS.md`.
2. Read this document.
3. Read `docs/TOKOS_DATA_MASTER_SPEC.md`.
4. Read `docs/BUILD_STATUS.md`.
5. Inspect latest `main` commits.
6. Inspect the dedicated Railway `tokos-data` project.
7. Verify `tokos.fun/data` routing.
8. Continue P2 -> P3 -> P4 unless the user specifies a different task.
9. Preserve real-data/provenance/no-fabrication rules.

## 28. Immediate next priorities

1. Finish the dedicated Railway cutover.
2. Switch `TOKOS_DATA_ORIGIN` to the new Data project once healthy.
3. Verify `/data` and all important child routes.
4. Remove the old Data service from the V2 Railway project only after cutover verification.
5. Complete P2 entity pages and Compare.
6. Complete P3 advanced analytics/diagrams.
7. Complete P4 Datasets/Metrics/export/shareable-state work.
8. Restore the full database/API/worker pipeline so live fallback is resilience rather than the primary data source.

## 29. Core principle

Build Tokos Data as a trustworthy analytical terminal. Prefer correct, attributable, interactive data over decorative completeness.

# Tokos Data build status

Updated: 2026-09-12

## Current summary

Tokos Data is live as a standalone product at `https://tokos.fun/data` and is being moved from the shared V2 Railway project into its own `tokos-data` Railway project.

Approximate finished-spec status:
- P0 visual foundation: 95-100%
- P1 core product: 90-95%
- P2 entity intelligence: 30-35%
- P3 advanced visual analytics: 45-50%
- P4 data-product surfaces: 35-40%

Overall finished-product quality is roughly low-60s percent even though a larger share of route/checklist scaffolding exists.

## Implemented platform foundation

- standalone pnpm monorepo with web, API, and worker apps;
- canonical PostgreSQL/Timescale schema and migrations;
- raw provider observations and provider health;
- 1delta discovery/latest/depth/comparables adapters;
- Pendle catalogue/history/v3 adapters;
- normalization and deterministic financial math;
- BullMQ workers/job scheduling;
- Fastify API;
- Next.js research UI;
- URL state, search, stale states, charts, and CSV export;
- dataset registry including canonical rate snapshots;
- unit/provider/API smoke tests;
- Playwright smoke coverage;
- GitHub CI;
- Docker/Docker Compose infrastructure.

## P0 visual foundation

Largely complete:
- compact analytical shell/navigation;
- 8px spacing/grid system;
- consistent typography/tabular numerals;
- light/dark themes;
- metric strips;
- reusable ECharts system;
- sparklines;
- dense sticky tables;
- compact filters;
- loading/error/stale states;
- crosshair, zoom, fullscreen, CSV interactions;
- hover/readability polish.

## P1 core product

Largely complete:
- Overview;
- Markets screener;
- Market Detail;
- Rates;
- Yield Curve;
- Basis;
- Liquidity/Execution analytics.

Recent P1 correctness work includes real Pendle history and real Rate Movers when the normalized backend is unavailable.

## Live fallback currently in production

The server-side fallback can:
- fetch active Pendle markets;
- use current implied APY, underlying/base APY, TVL, liquidity, maturity, chain, and market metadata;
- fetch real Pendle v3 daily history;
- use the 8 most liquid active markets as a clearly labelled representative historical fallback;
- aggregate median/TVL-weighted fixed history;
- derive a floating reference from underlying/base APY;
- compute actual 24H/7D rate movement in basis points;
- provide real sparklines for sampled markets.

This is a resilience layer, not the final full-universe historical architecture.

## Analytical color system

The UI no longer uses green for every chart.

Light-mode analytical palette:
- Tokos green `#3F7D3A`
- primary blue `#4568F2`
- coral `#F16D5B`
- violet `#8267D9`
- teal `#2AA889`
- amber `#D99A32`
- rose `#D85E8E`
- cyan `#4AA8C7`

Dark mode uses higher-luminance equivalents. Heatmaps use blue-low -> teal-mid -> amber-high.

## P2 entity intelligence: biggest current gap

Assets, Protocols, Chains, and Compare exist, but several surfaces are still much shallower than the master spec.

Next required work:
- Asset: yield history/curve, fixed-vs-floating, protocol/chain breakdown, distribution, yield landscape, richer markets table;
- Protocol: TVL/deposit/rate/liquidity/utilization histories where supported, asset/chain composition, distribution, markets table;
- Chain: rate/TVL histories, protocol/asset share, distribution, markets table;
- Compare: 24H/7D/30D changes, TVL/deposits/debt/utilization, maturity/tenor, volatility/percentile/effective/impact, utilization history, normalized performance, configurable scatter.

## P3 advanced analytics

Implemented in some form:
- heatmaps;
- distributions/histograms;
- yield landscape;
- maturity ladder.

Still incomplete/missing:
- treemap;
- correlation matrix with sample/overlap sufficiency rules;
- broader reusable heatmaps;
- relationship maps;
- reusable analytical diagrams for Yield Flow, Fixed Yield Anatomy, Floating Yield Anatomy, Basis, Execution, and Market Relationship Map.

## P4 data product

Still incomplete:
- richer Dataset details;
- consistent source/frequency/latest observation/methodology visibility;
- Metrics Directory;
- richer CSV/export flows;
- broader shareable analytical URL state.

## Repository decision

- Tokos Data is hosted in `Imdavid21/Tokos-DEX`.
- The old standalone DEX is decommissioned and remains only in git history/archive documentation.
- No historical DEX runtime should be revived unless explicitly requested.
- Tokos V2 remains in `Imdavid21/tokos` and is operationally isolated.

## Railway deployment split

Dedicated project created on 2026-09-12:
- project: `tokos-data`
- project ID: `23ecd480-6fbb-403d-823e-9cb4c3599737`
- production environment ID: `9b545e9f-9ffa-45a0-a4f7-7beffdc153e9`
- web service: `tokos-data`
- service ID: `a660dc80-e1f2-4c2a-b038-b169be9790b6`
- generated domain: `https://tokos-data-production.up.railway.app`

The web service must run with `SERVICE=web` when using the repository Dockerfile because the Dockerfile default is `${SERVICE:-api}`.

Public `tokos.fun/data` remains reverse-proxied by the main `tokos-web` service through `TOKOS_DATA_ORIGIN`.

The old `tokos-dex` service in the V2 Railway project should be removed only after the new service is healthy and the public proxy cutover is verified.

## Validation status

Verified on 2026-09-12 for the history/color implementation:
- lint passed;
- typecheck passed;
- tests passed;
- production build passed;
- public `/data` returned non-empty representative history;
- public Rate Movers returned 8 real rows with positive and negative basis-point changes;
- representative fallback was visibly labelled.

Always re-check current CI and Railway deployment status before assuming this snapshot is still current.

## Next execution order

Unless the user sets a different priority:
1. complete dedicated Railway cutover and proxy switch;
2. finish P2 entity intelligence;
3. finish P3 advanced visual analytics;
4. finish P4 data-product surfaces;
5. restore the full DB/API/worker pipeline so the live fallback is resilience rather than the primary public data source.

See `docs/KNOWLEDGE_TRANSFER.md` and `docs/TOKOS_DATA_MASTER_SPEC.md` for the full context and acceptance criteria.

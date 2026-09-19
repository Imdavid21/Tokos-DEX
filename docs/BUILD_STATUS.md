# Tokos Data build status

Updated: 2026-09-13

## Current summary

Tokos Data is live at `https://tokos.fun/data` and now runs entirely inside its dedicated Railway project. Tokos V2 remains operationally isolated in `Imdavid21/tokos`.

Approximate finished-spec status:
- P0 visual foundation: 95-100%
- P1 core product: 90-95%
- P2 entity intelligence: 30-35%
- P3 advanced visual analytics: 45-50%
- P4 data-product surfaces: 35-40%

Overall finished-product quality is still roughly low-60s percent because P2-P4 remain materially shallower than the master spec, even though the production platform foundation is now complete.

## Production architecture

```text
Pendle + 1delta
-> direct ingestion scheduler
-> PostgreSQL/Timescale normalized observations
-> Fastify API/read models on :4000
-> Next.js research UI on :3000
-> tokos.fun/data reverse proxy
```

The live Pendle fallback remains only as a resilience path when the persisted API/database is unavailable.

## Dedicated Railway deployment

Project:
- project: `tokos-data`
- project ID: `23ecd480-6fbb-403d-823e-9cb4c3599737`
- production environment: `9b545e9f-9ffa-45a0-a4f7-7beffdc153e9`

Application service:
- service: `tokos-data`
- service ID: `a660dc80-e1f2-4c2a-b038-b169be9790b6`
- generated domain: `https://tokos-data-production.up.railway.app`
- runs web + Fastify API + direct ingestion worker in one container through `pnpm start:railway:full`

Database service:
- service: `TimescaleDB`
- service ID: `d2720500-2ed6-4502-b716-1c6d9f1e714e`
- image: `timescale/timescaledb-ha:pg18.6-ts2.30.0-all`
- database: `tokos_data`
- persistent volume mounted at `/home/postgres/pgdata`
- private networking only

The application connects to TimescaleDB over Railway private networking with SSL disabled for the private connection.

## Full-stack cutover verification

Verified on 2026-09-13:
- Docker image builds all workspace packages and apps;
- all five DB migrations apply successfully;
- Fastify listens on port 4000;
- Next.js listens on port 3000;
- the direct scheduler starts successfully;
- Pendle bootstrap completed with 790 markets in about 8 seconds;
- stale monitoring is executing every minute;
- a public one-shot smoke test reached the persisted Fastify API through the deployed Next.js rewrite;
- that smoke test returned a real Fastify request ID, 807 active markets, 342 assets, 94 protocols, and non-empty persisted market rows;
- persisted market rows included 1delta data while broader 1delta bootstrap was still progressing;
- no V2 runtime, V2 database, or V2 preview service was modified.

Current resource use remains within the existing service envelope. During cutover, the combined application used roughly 0.50 GB memory at peak/current sampling and the TimescaleDB service used roughly 0.21 GB memory with about 0.16 GB disk consumed.

## Legacy DEX cleanup

- The standalone DEX runtime is absent from the current repository tree.
- Legacy DEX code remains only in git history.
- The obsolete archive marker file was removed.
- The old Railway `tokos-dex` service in the V2 project was deleted after the dedicated Data deployment was healthy.
- Do not reintroduce historical DEX runtime, Uniswap UI code, or compatibility routes.

## Implemented platform foundation

- standalone pnpm monorepo with web, API, and worker apps;
- canonical PostgreSQL/Timescale schema and migrations;
- raw provider observations and provider health;
- 1delta discovery/latest/depth/comparables adapters;
- Pendle catalogue/history/v3 adapters;
- deterministic normalization and financial math;
- Fastify API and read models;
- direct production scheduler, with BullMQ support still available where configured;
- Next.js research UI;
- URL state, search, stale states, charts, and CSV export;
- dataset registry including canonical rate snapshots;
- unit/provider/API smoke tests;
- Playwright browser coverage;
- GitHub CI;
- Docker/Docker Compose infrastructure.

## P0 visual foundation

Largely complete:
- compact analytical shell/navigation;
- 8px spacing/grid system;
- consistent typography and tabular numerals;
- light/dark themes;
- metric strips;
- reusable ECharts system;
- sparklines;
- dense sticky tables;
- compact filters;
- loading/error/stale states;
- crosshair, zoom, fullscreen, and CSV interactions;
- chart-axis and legend readability improvements;
- outlier-safe Yield Landscape scaling;
- responsive overflow fixes.

A 2026-09-13 visual QA pass covered Overview, Markets, Rates, Yield Curve, Basis, Execution, Correlations, Assets, Protocols, Chains, Compare, Datasets, and Metrics at 1440, 1280, 1024, 430, and 390 px in both light and dark themes. The matrix passed after fixing the mobile overview overflow and hidden-mobile-rail test issue.

## P1 core product

Largely complete:
- Overview;
- Markets screener;
- Market Detail;
- Rates;
- Yield Curve;
- Basis;
- Liquidity/Execution analytics.

The Overview now labels the raw extreme metric as `Max observed yield`, and Yield Landscape switches to log-y only when genuine source yields span an extreme range instead of hiding or clipping real observations.

## Live fallback

The server-side Pendle fallback can still:
- fetch active Pendle markets;
- use current implied APY, underlying/base APY, TVL, liquidity, maturity, chain, and market metadata;
- fetch real Pendle v3 daily history;
- use the 8 most liquid active markets as a clearly labelled representative historical fallback;
- aggregate median/TVL-weighted fixed history;
- derive a floating reference from underlying/base APY;
- compute actual 24H/7D rate movement in basis points;
- provide real sparklines for sampled markets.

It is now a resilience layer rather than the primary public data architecture.

## P2 entity intelligence: biggest product gap

Assets, Protocols, Chains, and Compare exist, but several surfaces remain shallower than the master spec.

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
- Metrics Directory depth;
- richer CSV/export flows;
- broader shareable analytical URL state.

## Repository boundary

- Data repo: `Imdavid21/Tokos-DEX`
- V2 repo: `Imdavid21/tokos`
- Tokos Data must not import or modify V2 execution logic.
- Public `/data` remains reverse-proxied by `tokos-web` through `TOKOS_DATA_ORIGIN`.

## Next execution order

Unless the user sets a different priority:
1. finish P2 Assets -> Protocols -> Chains -> Compare;
2. finish P3 treemaps/correlations/diagrams/advanced heatmaps;
3. finish P4 Datasets/Metrics Directory/export/shareable-state polish;
4. expand and tune provider coverage/history once the analytical product surfaces are complete;
5. keep the live provider fallback as resilience only.

See `docs/KNOWLEDGE_TRANSFER.md` and `docs/TOKOS_DATA_MASTER_SPEC.md` for the full context and acceptance criteria.


---

## 2026-09-19 Risk intelligence upgrade

Implemented on the risk-intelligence branch:

- canonical entity dependency graph storage
- transparent risk observation storage with provenance, confidence, severity, assumptions, staleness, and methodology version
- methodology registry and public methodology API/UI
- deterministic hourly Risk V1 materialization from existing normalized data
  - available liquidity
  - utilization
  - 30-day rate volatility
  - latest observed price impact
  - market concentration HHI for asset/protocol/chain entities
- automatic market -> asset/protocol/chain dependency edges
- market risk screener
- market and entity risk/dependency panels
- explicit empty states when risk/dependency data is unavailable

The implementation intentionally does not manufacture composite ratings, probability of default, probability of loss, or expected loss. Those require additional source coverage and a separately versioned methodology.

### Next data expansion

Future risk dimensions should be added only when verifiable source data is available:

- issuer and backing dependencies
- oracle dependencies
- bridge/wrapper dependencies
- vault allocation and curator relationships
- liquidation and bad-debt history
- governance/admin-key controls
- audit and exploit history
- redemption/liquidity stress data

Risk-adjusted yield remains blocked until an expected-loss methodology is empirically defensible.

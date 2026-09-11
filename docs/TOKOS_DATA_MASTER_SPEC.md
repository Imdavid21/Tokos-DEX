# Tokos Data
## Canonical V0 implementation contract

Status: canonical build contract derived from the exhaustive Tokos Data Master Spec v1.0 dated 11 September 2026.

Tokos Data is a standalone onchain rates intelligence product hosted from `Imdavid21/Tokos-DEX` after the former standalone DEX was decommissioned. The old DEX implementation remains only in git history. Tokos V2 is a separate product and must not be imported, queried, modified, or made a runtime dependency.

## Non-negotiable rules

1. Never fabricate market data. Missing data is a visible unavailable state.
2. Frontend pages read normalized Tokos data only. They never call 1delta or Pendle directly.
3. Raw provider observations and normalized data remain separate and auditable.
4. Every derived financial calculation is deterministic and methodology-versioned. LLMs do not calculate rates.
5. APR and APY are not interchangeable. Fixed APY uses compound holding-period return; floating APR uses an explicitly labeled flat-forward assumption unless a provider supplies a stronger model.
6. Staleness is visible. Provider failures must not erase the last known normalized state.
7. No wallet, transaction execution, SQL editor, AI assistant, portfolio, paid plan, or opaque score in V0.
8. Research requires no authentication in V0.
9. Search starts with PostgreSQL trigram/full-text primitives, not a separate search engine.
10. Production deploys only after migrations, CI, live provider ingestion, and staging health checks pass.

## V0 routes

`/`, `/markets`, `/market/:id`, `/asset/:slug`, `/protocol/:slug`, `/chain/:slug`, `/rates`, `/compare`, `/datasets`, `/datasets/:slug`.

Required capabilities are 1delta ingestion, Pendle ingestion, historical snapshots, universal search, URL-shareable parameters, current overview, professional market screener, entity pages, fixed/floating rates terminal, comparison, CSV export, provenance/freshness, and light/dark modes.

## Providers

1delta is the external lending normalization layer. Use documented public v1 data endpoints, preserve `marketUid`, normalize percentage APR values such as `5.82` to decimal `0.0582`, batch latest-market lender requests to at most 20 lender keys, and use provider amount/horizon comparables rather than silently reconstructing utilization curves.

Pendle is the PT/YT and fixed-yield source. Use documented `/core` endpoints, store market/history observations, and use the current v3 Hosted SDK Convert flow for research quotes. Quote flows never submit transactions or request user signatures.

Provider errors are retained in ingestion health. HTTP 429 and provider 5xx responses are retryable with bounded exponential backoff. Schema validation errors do not retry indefinitely.

## Canonical financial units

APR, APY, utilization, and basis rates are stored as decimal fractions. USD values are numeric USD. Chain IDs are decimal strings. Timestamps and maturities are UTC timestamps.

Fixed holding-period return for APY `y` over `d` days: `(1 + y)^(d / 365) - 1`.

Floating flat-forward holding-period return for APR `r` over `d` days: `r * d / 365`.

Basis requires compatible asset group, notional, horizon, and assumptions. Basis bps is `round((fixedComparableRate - floatingComparableRate) * 10000)`. Unsupported or incompatible comparisons return null rather than a manufactured number.

Default notional research grid: $10K, $50K, $100K, $250K, $500K, $1M, $2.5M, $5M, $10M. No production extrapolation beyond reliable provider points.

## Data model

Canonical entities: assets, chains, protocols, markets. Time series: market snapshots, execution-depth snapshots, basis snapshots. Raw provider payloads live in `provider_observations`. Provider liveness and failures live in `ingestion_health`.

Required read models include latest markets, asset/protocol/chain summaries, rate movers, and Timescale hourly/daily rollups. Canonical rate snapshots expose the source rate field and rate convention.

Every financial response exposes enough information to recover source, observation time, ingest time, staleness, and methodology where derived.

## API

Public V0 base contract is `/v1`. Core endpoints include overview, markets, market detail/history, assets, protocols, chains, rates, compare, search, datasets, dataset detail, and CSV export. Large lists use bounded pagination. Inputs are validated. SQL is parameterized. Provider secrets never enter public browser environment variables.

## Interface

The aesthetic is institutional, analytical, calm, exact, modern, and data-first. Use the soft-green Tokos family, flat shared boundaries, dense readable tables, compact typography, and precise charts. Avoid marketing heroes, cyberpunk/neon styling, decorative gradients, glassmorphism, giant pills, decorative 3D, and card spam.

Desktop shell uses a 56px header and 216px navigation rail. Tables are first-class. Light and dark modes are equally supported. Mobile simplifies the terminal rather than reproducing a full desktop table.

All meaningful research state serializes to URL parameters. Search is keyboard-accessible. Empty states distinguish no market, filtered-empty, stale/unavailable provider state, and unsupported parameter combinations.

## Runtime

Monorepo: `apps/web`, `apps/api`, `apps/worker`, plus contracts, DB, providers, analytics, config, migrations, methodology docs, and CI.

Canonical runtime line: Node 24.21+, pnpm 12.3.4, Next.js 16.3.3, React 19.3, Fastify 5.12.3, PostgreSQL 18 + TimescaleDB, Redis/BullMQ, TypeScript 7.

Web, API, worker, database, Redis, secrets, monitoring, migrations, and release state remain operationally isolated from Tokos V2. The former DEX has no active runtime service in this repository.

## Definition of done

Data is done when both providers ingest live active markets, history accumulates, Pendle supported history is backfilled, source timestamps are preserved, stale flags work, provider failures preserve prior state, and canonical IDs are stable.

Product is done when every V0 route works, search and URL state work, Markets is a serious screener, entity drilldowns work, Rates combines fixed/floating data without hiding assumptions, Compare supports 2-6 markets, datasets are documented, and CSV exports match the filtered canonical data.

Engineering is done when CI is green, migrations reproduce the database, workers recover from restart, critical jobs are idempotent, financial tests pass, provider fixtures/contract tests exist, observability is live, and staging validates live provider counts without fake data.

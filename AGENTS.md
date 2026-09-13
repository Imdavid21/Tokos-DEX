# AGENTS.md

Read this before changing Tokos Data.

This repository is `Imdavid21/Tokos-DEX`, but the old standalone DEX is decommissioned. The current repository hosts Tokos Data.

Read these first:
- `docs/KNOWLEDGE_TRANSFER.md`
- `docs/RAILWAY_CUTOVER_2026-09-12.md`
- `docs/TOKOS_DATA_MASTER_SPEC.md`
- `docs/BUILD_STATUS.md`
- `README.md`

Canonical cross-project handoff:
- `Imdavid21/tokos/docs/FULL_KNOWLEDGE_TRANSFER_2026-09-12.md`

## Product boundary

Tokos Data is separate from Tokos V2.

- Main site/V2 repo: `Imdavid21/tokos`
- Data repo: `Imdavid21/Tokos-DEX`
- Public route: `https://tokos.fun/data`
- Dedicated Railway project: `tokos-data` (`23ecd480-6fbb-403d-823e-9cb4c3599737`)
- Data application service: `tokos-data` (`a660dc80-e1f2-4c2a-b038-b169be9790b6`)
- Data database service: `TimescaleDB` (`d2720500-2ed6-4502-b716-1c6d9f1e714e`)
- `tokos-web` reverse-proxies `/data` and `/data/*` through `TOKOS_DATA_ORIGIN`.

Do not import or modify V2 execution logic from this repository.

## Data-product direction

Tokos Data is an interactive onchain rates/yield intelligence product, not a generic dashboard.

Core principles:
- trustworthy normalized observations;
- explicit provenance and methodology;
- never fabricate missing market data;
- show unavailable/stale/representative states honestly;
- strong analytical charts and diagrams;
- dense but clean research UI;
- consistent spacing and typography;
- useful hover/select/drilldown behavior;
- light and dark readability;
- no eyebrow headings;
- avoid bloated explanatory copy.

Competitive references include Token Terminal, Dune, DeFiLlama, Portals Explorer, Flowscan-style products, and specialized yield/basis dashboards.

## Production architecture

```text
Pendle + 1delta
-> direct ingestion scheduler
-> raw + normalized PostgreSQL/Timescale observations
-> Fastify API/read models on :4000
-> Next.js web on :3000
-> tokos.fun/data
```

The combined production runtime is started with `pnpm start:railway:full`. It runs migrations, Fastify, the direct ingestion scheduler, and Next.js in one application service. Redis/BullMQ remain available for future queue separation but are not required by the current low-resource production layout.

Provider work includes Pendle and 1delta. 1delta belongs here for broader data aggregation; it is not currently part of Tokos V2 execution.

The web retains an explicitly labelled live Pendle fallback only for resilience if the persisted API/database is unavailable.

## Current work to preserve

Recent work includes:
- current Pendle payload normalization;
- real Pendle history;
- actual 24H/7D Rate Movers;
- representative 8-market fallback history when persistence is unavailable;
- hiding unavailable metrics rather than inventing values;
- analytical multi-series chart colors;
- categorical palette typing/validation;
- global spacing/typography/readability normalization;
- chart-axis and legend readability improvements;
- outlier-safe Yield Landscape scaling;
- automated desktop/tablet/mobile/light/dark visual QA;
- dedicated Timescale persistence and full combined Railway runtime.

Always inspect latest `main` because multiple agents may be working concurrently.

## Legacy DEX cleanup

The standalone DEX runtime is not present in the current tree. Legacy runtime code exists only in git history. The old archive marker file has been removed. The old `tokos-dex` Railway service in the V2 project has also been deleted after the dedicated Data cutover was validated.

Do not reintroduce DEX runtime files, Uniswap UI code, or compatibility routes into this repository.

## Deployment boundary

The Data cutover to the dedicated Railway project is complete and externally smoke-tested.

Dedicated project:
- project: `tokos-data`
- project ID: `23ecd480-6fbb-403d-823e-9cb4c3599737`
- production env: `9b545e9f-9ffa-45a0-a4f7-7beffdc153e9`
- application service: `tokos-data`
- application service ID: `a660dc80-e1f2-4c2a-b038-b169be9790b6`
- database service: `TimescaleDB`
- database service ID: `d2720500-2ed6-4502-b716-1c6d9f1e714e`
- generated application domain: `https://tokos-data-production.up.railway.app`

The Timescale database uses persistent storage on Railway private networking. The application `DATABASE_URL` explicitly disables SSL for that private database connection because the internal Timescale endpoint does not support SSL.

The application deployment must continue to use the repository Dockerfile and `pnpm start:railway:full`. Do not revert it to the monorepo auto-import commands that build/start only `@tokos-data/web`.

Validated 2026-09-13 production facts:
- all five migrations applied;
- Fastify listens on port 4000;
- Next.js listens on port 3000;
- direct scheduler starts and stale monitoring runs every minute;
- Pendle bootstrap persisted 790 markets;
- an external persisted-API smoke test returned a Fastify request ID, 807 active markets, 342 assets, 94 protocols, and non-empty 1delta market rows;
- the live fallback is no longer the primary architecture.

Do not touch `tokos-web`, `tokos-preview`, V2 `Postgres`, or the V2 Postgres volume unless the task explicitly requires changes in the main V2 project.

## Current roadmap

Approximate finished-spec status:
- P0 visual foundation: 95-100%
- P1 core product: 90-95%
- P2 entity intelligence: 30-35%
- P3 advanced visual analytics: 45-50%
- P4 data product: 35-40%

Default continuation order unless the user says otherwise:
1. P2 Assets -> Protocols -> Chains -> Compare;
2. P3 treemaps/correlations/diagrams/advanced heatmaps;
3. P4 Datasets/Metrics Directory/export/shareable-state polish;
4. expand/tune provider coverage and historical depth;
5. keep live provider fallback as resilience rather than the primary source.

## Before every change

1. Fetch latest `main` and recent commits.
2. Read `docs/KNOWLEDGE_TRANSFER.md`, cutover status, master spec, and build status.
3. Verify whether another agent is touching the same area.
4. Make the smallest coherent change.
5. Preserve real-data/no-fabrication guarantees.
6. Run relevant tests/build/CI.
7. Check the Railway deployment for the exact commit when runtime code changes.
8. Smoke-test `tokos.fun/data` and affected child routes when deployment-facing behavior changes.
9. Do not modify the main V2 repo as a side effect unless the task is explicitly the `/data` proxy/routing layer.

## Runtime expectations

Node 24.21+ and pnpm 12.3.4.

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Production combined runtime:

```bash
pnpm start:railway:full
```

## Safety rules

- Never commit secrets or provider credentials.
- Never fabricate rates, APYs, TVL, volume, history, or other observations.
- Never silently substitute representative/fallback data as exact full-universe data.
- Never revive historical standalone DEX runtime code unless explicitly requested.
- Never couple Tokos Data deployment to V2 execution state without an explicit architecture decision.

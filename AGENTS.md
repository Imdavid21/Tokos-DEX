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
- Data web service: `tokos-data` (`a660dc80-e1f2-4c2a-b038-b169be9790b6`)
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

## Architecture

```text
providers
-> ingestion/workers
-> raw observations
-> normalized observations + deterministic financial math
-> PostgreSQL/Timescale
-> Fastify API/read models
-> Next.js web
```

Redis/BullMQ are used where configured.

Provider work includes Pendle and 1delta. 1delta belongs here for broader data aggregation; it is not currently part of Tokos V2 execution.

## Current work to preserve

Recent 2026-09-12 work includes:
- current Pendle payload normalization;
- live markets rendering verification;
- real Pendle history;
- representative 8-market fallback history;
- actual 24H/7D Rate Movers;
- hiding unavailable metrics rather than inventing values;
- representative fallback labelling;
- analytical multi-series chart colors;
- categorical palette typing/validation.

Always inspect latest `main` because multiple agents may be working concurrently.

## Legacy DEX cleanup

The standalone DEX runtime is not present in the current tree. Legacy runtime code exists only in git history. The old archive marker file has been removed. Do not reintroduce DEX runtime files, Uniswap UI code, or compatibility routes into this repository.

## Deployment boundary

The Data cutover to the dedicated Railway project is complete and externally smoke-tested.

Dedicated project:
- project: `tokos-data`
- project ID: `23ecd480-6fbb-403d-823e-9cb4c3599737`
- production env: `9b545e9f-9ffa-45a0-a4f7-7beffdc153e9`
- service: `tokos-data`
- service ID: `a660dc80-e1f2-4c2a-b038-b169be9790b6`
- generated domain: `https://tokos-data-production.up.railway.app`

`tokos-web` now points `TOKOS_DATA_ORIGIN` at the new Railway origin. A one-shot external CI smoke test verified both the direct service and `https://tokos.fun/data`, including the representative history label and Rate Movers.

The old `tokos-dex` service (`e21b53cd-e9a3-4955-af98-80da63cb75b7`) still exists in the V2 Railway project but is no longer the public `/data` origin. It should be deleted so the old project is V2-only. The connected Railway API currently does not expose service deletion and the Railway AI agent is usage-limited, so that infrastructure cleanup is manual unless tool access changes.

Do not touch `tokos-web`, `tokos-preview`, V2 `Postgres`, or the V2 Postgres volume while doing that cleanup.

The Dockerfile defaults to `${SERVICE:-api}`. For the web service, keep `SERVICE=web` or an explicit web start command.

## Full-stack Railway status

The repository supports the full web + API + worker + PostgreSQL/Timescale + Redis architecture. The dedicated Railway project currently runs only the web service because this Railway account has hit its workspace resource-provision limit. Creating the first additional Postgres service currently fails with `Free plan resource provision limit exceeded`.

Once one Railway resource is freed, provision in this order:
1. PostgreSQL/Timescale with a persistent volume;
2. API service from this repo with `SERVICE=api` and `DATABASE_URL`/`REDIS_URL`;
3. worker service with `SERVICE=worker` and the same persistence references;
4. Redis if BullMQ queueing is desired, otherwise use the worker's direct mode temporarily;
5. run migrations, validate providers, then set web `API_URL` / `NEXT_PUBLIC_API_URL` to the new API.

Do not move V2 persistence into this project.

## Current roadmap

Approximate finished-spec status:
- P0 visual foundation: 95-100%
- P1 core product: 90-95%
- P2 entity intelligence: 30-35%
- P3 advanced visual analytics: 45-50%
- P4 data product: 35-40%

Default continuation order unless the user says otherwise:
1. free one Railway resource and complete the dedicated Data DB/API/worker stack;
2. P2 Assets -> Protocols -> Chains -> Compare;
3. P3 treemaps/correlations/diagrams/advanced heatmaps;
4. P4 Datasets/Metrics Directory/export/shareable-state polish;
5. keep live provider fallback as resilience rather than the primary source.

## Before every change

1. Fetch latest `main` and recent commits.
2. Read `docs/KNOWLEDGE_TRANSFER.md`, cutover status, master spec, and build status.
3. Verify whether another agent is touching the same area.
4. Make the smallest coherent change.
5. Preserve real-data/no-fabrication guarantees.
6. Run relevant tests/build/CI.
7. Check the Railway deployment for the exact commit.
8. Smoke-test `tokos.fun/data` and affected child routes.
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

## Safety rules

- Never commit secrets or provider credentials.
- Never fabricate rates, APYs, TVL, volume, history, or other observations.
- Never silently substitute representative/fallback data as exact full-universe data.
- Never revive historical standalone DEX runtime code unless explicitly requested.
- Never couple Tokos Data deployment to V2 execution state without an explicit architecture decision.

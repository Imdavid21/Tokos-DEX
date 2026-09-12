# AGENTS.md

Read this before changing Tokos Data.

This repository is `Imdavid21/Tokos-DEX`, but the old standalone DEX is decommissioned. The current repository hosts Tokos Data.

Canonical cross-project handoff lives in the main Tokos repository:

`Imdavid21/tokos/docs/PROJECT_HANDOFF_2026-09-12.md`

Also read locally:
- `README.md`
- `docs/TOKOS_DATA_MASTER_SPEC.md`
- `docs/BUILD_STATUS.md`
- `docs/DEX_ARCHIVE.md`

## Product boundary

Tokos Data is separate from Tokos V2.

- Main site/V2 repo: `Imdavid21/tokos`
- Data repo: `Imdavid21/Tokos-DEX`
- Public route: `https://tokos.fun/data`
- Railway data service: `tokos-dex`
- `tokos-web` reverse-proxies `/data` and `/data/*` to this service through `TOKOS_DATA_ORIGIN`.

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
- good hover/select/drilldown behavior;
- light and dark readability;
- no eyebrow headings;
- avoid bloated explanatory copy.

Competitive design/research references include Token Terminal, Dune, DeFiLlama, Portals Explorer, Flowscan-style products, and specialized yield/basis dashboards.

## Architecture

High-level flow:

```text
providers
-> ingestion/workers
-> normalized observations + deterministic financial math
-> PostgreSQL/Timescale
-> Fastify API
-> Next.js web
```

Redis/BullMQ are used where configured.

Provider work includes Pendle and 1delta. 1delta belongs here for broader data aggregation; it is not currently part of Tokos V2 product execution.

## Current work to preserve

Recent 2026-09-12 commits focused on:
- current Pendle payload normalization;
- live markets rendering verification;
- real Pendle history;
- rate-mover/history fallback behavior;
- hiding unavailable metrics rather than inventing values;
- labelling representative fallback history;
- analytical multi-series chart colors;
- categorical palette typing/validation.

Always inspect the latest commits before editing because multiple agents may be working concurrently.

## Deployment boundary

This repo deploys to the Railway `tokos-dex` service in the shared `tokos` Railway project.

A failure in this service does not automatically mean Tokos V2 failed. Likewise a V2/Postgres failure does not automatically mean the data service failed.

The main V2 PostgreSQL service experienced a full-volume crash on 2026-09-12. Do not make changes here to compensate for that incident unless this repository is actually dependent on the affected resource and you have verified it.

## Before every change

1. Fetch latest `main` and recent commits.
2. Read the master spec and build status.
3. Verify whether another agent is touching the same area.
4. Make the smallest coherent change.
5. Preserve real-data/no-fabrication guarantees.
6. Run relevant tests/build/CI.
7. Check the Railway deployment for the exact commit.
8. Smoke-test `tokos.fun/data` and the affected data routes.
9. Do not modify the main V2 repo as a side effect.

## Runtime expectations

Repository documentation currently targets Node 24.21+ and pnpm 12.3.4. Follow `README.md` for local setup and the master spec for architecture/contracts.

## Safety rules

- Never commit secrets or provider credentials.
- Never fabricate rates, APYs, TVL, volume, history, or other market observations.
- Never silently substitute representative/fallback data as if it were exact live data.
- Never revive historical standalone DEX runtime code unless explicitly requested.
- Never couple Tokos Data deployment to V2 execution state without an explicit architecture decision.

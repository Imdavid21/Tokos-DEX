# Build status

Updated: 2026-09-11

Implemented in this tree:
- standalone pnpm monorepo with web, API, and worker apps;
- canonical PostgreSQL/Timescale schema and migrations;
- raw provider observations and provider health;
- current 1delta discovery/latest/depth/comparables adapters;
- Pendle catalogue/history/v3 Convert adapter;
- normalization and deterministic financial math;
- BullMQ workers and job scheduling;
- Fastify V0 API;
- Next.js V0 research routes, URL state, search, stale states, charts, and CSV export;
- dataset registry including canonical rate snapshots;
- unit/provider/API smoke tests, Playwright smoke spec, CI, and Docker Compose.

Repository decision:
- Tokos Data is hosted in `Imdavid21/Tokos-DEX`, which had already been decommissioned and contained only a deprecation README on `main`.
- Former DEX source remains in git history only. No DEX runtime code is imported into Tokos Data.
- Tokos V2 remains untouched and operationally isolated.

Validation in this execution environment:
- core deterministic financial smoke tests pass;
- current dependency versions were re-checked against public package/framework sources;
- local framework installation/build is not available because the container has Node 22 and package-registry access is unavailable, while the canonical runtime is Node 24.21+.

Production gate remains closed until GitHub CI completes on Node 24, migrations pass against Timescale/Postgres, live provider ingestion is validated, and staging deployment health is green.

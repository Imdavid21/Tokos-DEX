# Tokos Data

`Imdavid21/Tokos-DEX` is now the Tokos Data repository. The former standalone DEX runtime is not present in the current tree; legacy code exists only in git history.

Agents must read [`AGENTS.md`](AGENTS.md) first, then `docs/KNOWLEDGE_TRANSFER.md` and `docs/TOKOS_DATA_MASTER_SPEC.md`. The canonical cross-project handoff is maintained in `Imdavid21/tokos/docs/FULL_KNOWLEDGE_TRANSFER_2026-09-12.md`.

Tokos Data is a standalone onchain rates and yield intelligence platform. Tokos V2 is not imported or modified.

Core routes include `/`, `/markets`, `/market/:id`, `/assets`, `/asset/:slug`, `/protocols`, `/protocol/:slug`, `/chains`, `/chain/:slug`, `/rates`, `/yield-curve`, `/basis`, `/execution`, `/correlations`, `/compare`, `/datasets`, and `/metrics`.

Architecture:

```text
providers
-> ingestion/workers
-> PostgreSQL/Timescale normalized observations
-> Fastify API/read models
-> Next.js web
```

Redis/BullMQ are used where configured. Production analytics should prefer normalized persisted observations. The web contains an explicitly labelled live Pendle fallback for resilience when the Data API/database is unavailable; it does not fabricate missing observations.

Public production is exposed at `https://tokos.fun/data` through the main `tokos-web` reverse proxy. The Data web runtime deploys independently in the dedicated Railway project `tokos-data`, currently at `https://tokos-data-production.up.railway.app`.

## Local

Requires Node 24.21+, pnpm 12.3.4, Docker.

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:migrate
pnpm ingest:once
pnpm dev
```

Current 1delta pagination is respected: `/data/lending/latest` always sends both `chains` and 1-20 `lenders`, discovered live. Pendle catalogue uses `/core/v2/markets/all`; history uses v3. Quote/convert provider work remains isolated in the provider package.

See `docs/BUILD_STATUS.md`, `docs/KNOWLEDGE_TRANSFER.md`, and `docs/TOKOS_DATA_MASTER_SPEC.md`.

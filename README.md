# Indenture

Open loss probability ratings for onchain credit. Indenture computes a daily, reproducible Probability of Significant Loss (PSL) for every rated onchain lending market, grades it from AAA to D, and shows yield net of expected loss, with every input public.

Live: https://indenture-one.vercel.app
Source: https://github.com/Imdavid21/Tokos-DEX (the repository keeps its original name; the product was formerly called Tokos)

The live site runs on a precomputed demonstration universe. The ratings engine is the real one, but the market set is illustrative and labelled as demo data on every page. Connecting the API and ingestion workers below switches it to live observations.

## What is in it

- Overview with the rated universe by grade, yield against risk, highest PSL markets and recent rating actions.
- Screener at `/ratings` and a detail page per market with grade, drivers, inputs, what-if and history.
- Rating actions, risk adjusted yield frontier, the grade scale and the published methodology (`/methodology/indenture-psl-v1`).
- Dependency map, stress testing, rate comparison, yield curve and basis views.

## Architecture

```text
providers (1delta, Pendle)
-> ingestion workers
-> PostgreSQL / Timescale observations
-> Fastify API and ratings engine
-> Next.js web (apps/web)
```

Packages: `apps/web` (Next.js), `apps/api` (Fastify), `apps/worker` (ingestion), `packages/*` (shared engine and types). Details are in `docs/KNOWLEDGE_TRANSFER.md` and `docs/TOKOS_DATA_MASTER_SPEC.md`.

## Local

Requires Node 24.21+, pnpm 12.3.4, Docker.

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:migrate
pnpm ingest:once
pnpm --filter @tokos-data/worker ratings:once
pnpm dev
```

Current 1delta pagination is respected: `/data/lending/latest` always sends both `chains` and 1-20 `lenders`, discovered live. Pendle catalogue uses `/core/v2/markets/all`; history uses v3. Quote/convert provider work remains isolated in the provider package.

See `docs/BUILD_STATUS.md`, `docs/KNOWLEDGE_TRANSFER.md`, and `docs/TOKOS_DATA_MASTER_SPEC.md`.

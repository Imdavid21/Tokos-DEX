# Tokos Data

> Repository note: `Imdavid21/Tokos-DEX` was repurposed after the standalone DEX was decommissioned. The old DEX source remains only in git history. Tokos Data is isolated from Tokos V2 and from the historical DEX implementation.

Agents must read [`AGENTS.md`](AGENTS.md) first. The canonical cross-project handoff is maintained in `Imdavid21/tokos/docs/PROJECT_HANDOFF_2026-09-12.md`.

Tokos Data is a standalone onchain rates intelligence platform implemented from
`docs/TOKOS_DATA_MASTER_SPEC.md`. Tokos V2 is not imported or modified.

V0 routes: `/`, `/markets`, `/market/:id`, `/asset/:slug`, `/protocol/:slug`,
`/chain/:slug`, `/rates`, `/compare`, `/datasets`, `/datasets/:slug`.

Architecture: providers -> workers -> PostgreSQL/Timescale -> Fastify API -> Next.js web,
with Redis/BullMQ jobs. Production values come only from normalized persisted observations.
The web never calls 1delta or Pendle directly and never substitutes fabricated rates.

Public production is exposed at `https://tokos.fun/data` through the main `tokos-web` reverse proxy. The data runtime itself deploys separately to Railway service `tokos-dex`.

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

Current 1delta pagination is respected: `/data/lending/latest` always sends both `chains`
and 1-20 `lenders`, discovered live. Pendle catalogue uses `/core/v2/markets/all`;
history uses v3. New quote work is isolated behind the provider package for v3 POST Convert.

See `docs/BUILD_STATUS.md` and `docs/TOKOS_DATA_MASTER_SPEC.md`.

# Tokos Data Railway cutover

Updated: 2026-09-12

## Result

Tokos Data has been moved to a dedicated Railway project and the public `/data` proxy has been cut over successfully.

Dedicated Railway project:
- project: `tokos-data`
- project ID: `23ecd480-6fbb-403d-823e-9cb4c3599737`
- production environment: `9b545e9f-9ffa-45a0-a4f7-7beffdc153e9`
- service: `tokos-data`
- service ID: `a660dc80-e1f2-4c2a-b038-b169be9790b6`
- generated origin: `https://tokos-data-production.up.railway.app`

The web service is healthy with:
- `SERVICE=web`
- `NEXT_PUBLIC_BASE_PATH=/data`
- port `3000`
- health path `/data`
- web build/start configuration matching the prior working Data service.

## Public proxy

The main Railway `tokos-web` service now has:

```text
TOKOS_DATA_ORIGIN=https://tokos-data-production.up.railway.app
```

The resulting public route remains:

```text
https://tokos.fun/data
```

A one-shot external GitHub Actions smoke test verified both:
- direct new Railway origin `/data`;
- public `tokos.fun/data` reverse proxy.

Both returned full page HTML, contained `Rate Movers`, and contained the representative-history label `Representative · 8 most liquid active markets`.

The one-shot verification workflow was deleted after the successful check.

## Old shared-project service

The old Data service still exists in the V2 Railway project at the handoff snapshot:
- project: `tokos`
- old service: `tokos-dex`
- service ID: `e21b53cd-e9a3-4955-af98-80da63cb75b7`

It is no longer the public `/data` origin.

It should now be deleted so the old `tokos` Railway project is V2-only. The connected Railway AI-agent deletion action could not be completed because that agent's usage limit was reached. No other V2 service was modified or removed.

Do not delete or modify:
- `tokos-web`;
- `tokos-preview`;
- V2 `Postgres`;
- the V2 Postgres volume.

## Important Dockerfile detail

The repository Dockerfile defaults to:

```text
pnpm --filter @tokos-data/${SERVICE:-api} start
```

A new web deployment without `SERVICE=web` can start the API process and fail on missing `DATABASE_URL`. Keep `SERVICE=web` for the standalone web service unless the deployment topology is intentionally changed.

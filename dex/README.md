# Tokos DEX

Tokos DEX is the standalone production runtime served from `dex/`.

## Runtime

- Node.js 22+
- No runtime package dependencies
- Same-origin routing BFF
- Ethereum mainnet beta
- Non-custodial wallet execution
- Optional direct-market benchmark through a server-side API key

## Required environment

- `ROUTING_API_BASE_URL`
- `ROUTING_API_KEY` (optional if the routing endpoint does not require one)

## Optional environment

- `UNISWAP_API_KEY` enables a direct-market quote benchmark.
- `TOKOS_FEE_BPS` defaults to `0` and is informational only until an atomic fee path is enabled.
- `TOKOS_FEE_RECIPIENT` is reserved for a future atomic fee path.

## Start

```bash
cd dex
npm start
```

Health check: `GET /health`

The production UI never exposes routing-provider credentials or implementation names.

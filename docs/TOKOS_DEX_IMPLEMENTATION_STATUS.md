# Tokos DEX implementation status

## Implemented
- Fork isolated on `tokos/1delta-integration`.
- 1delta spot-swap request/response types.
- Direct 1delta HTTP client for server/tests.
- Transport-independent `OneDeltaSwapProvider`.
- Browser-only `TokosOneDeltaBffClient` that calls Tokos backend routes.
- Server-side Hono BFF routes at `/api/tokos/quote` and `/api/tokos/swap/build`.
- Server-only optional `ONEDELTA_API_KEY` and `ONEDELTA_API_URL` bindings.
- Input validation for chain, tokens, amount, slippage, and execution account.
- Quote mode strips account.
- Build mode requires account.
- 1delta success-envelope validation.
- Permission/setup/alternative execution planning with one-alternative-only safety.
- Initial unit tests and integration documentation.

## In progress
- Adapt 1delta `data.quotes` into the existing swap trade model consumed by `SwapFlow`.
- Replace Uniswap quote retrieval in `useTrade` / `useDerivedSwapInfo` with the Tokos provider.
- Replace regular-swap execution service with 1delta-built wallet transactions while retaining wrap/unwrap behavior.

## Before mainnet release
- Obtain and configure production 1delta API key.
- Add rate limiting to public Tokos BFF routes.
- Add transaction simulation and destination validation that does not mutate 1delta calldata.
- Run full typecheck, unit tests, and E2E tests.
- Test WETH/USDC and ERC20/ERC20 on a fork before live-value tests.
- Remove or disable UniswapX and unused Uniswap routing paths.
- Rebrand to Tokos only after execution is verified.

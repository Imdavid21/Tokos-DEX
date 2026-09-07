# Tokos 1delta integration

This module is the transport and execution boundary for Tokos swaps.

Browser flow:

`Swap UI -> TokosOneDeltaBffClient -> /api/tokos/* -> 1delta`

Rules:
- Browser code must not receive or use `ONEDELTA_API_KEY`.
- Quote requests omit `account`.
- Build requests require `account`.
- `amount` is an integer in token base units.
- `slippage` is basis points. `50` means 0.5%.
- Execute returned permissions first.
- Preserve ordered setup transactions.
- If alternatives are returned, execute exactly one selected alternative.
- Pass `to`, `data`, and `value` through without re-encoding calldata.

The remaining migration task is to adapt 1delta quote data into the trade model consumed by the existing Uniswap-derived `SwapFlow`, then replace the current Uniswap trade query and execution service at that dependency seam.

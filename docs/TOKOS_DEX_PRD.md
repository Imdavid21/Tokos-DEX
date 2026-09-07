# Tokos DEX PRD

## Product
Tokos DEX is a non-custodial trading interface built from the Uniswap interface codebase, with 1delta as the primary routing and transaction-construction backend.

## Goal
Ship a production-grade Ethereum spot DEX first, then expand the same execution abstraction into cross-chain swaps, lending, borrowing, looping, refinancing, and unified DeFi positions.

## Core architecture

User -> Tokos web app -> Tokos server API -> 1delta API -> underlying aggregators/protocols -> transaction calldata -> user wallet -> EVM chain

Tokos owns UX, wallet interaction, quote presentation, execution state, analytics, safety checks, and product logic. 1delta owns route discovery and transaction construction. The wallet remains the user's signing authority.

## V1 scope
- Ethereum mainnet
- Spot swaps only
- Curated token universe initially
- Wallet connect and network switching
- Token balances
- Quote, minimum received, price impact, gas, route details
- ERC-20 approval flow
- Swap execution
- Pending/success/failure transaction states
- Activity history
- Basic portfolio balances

## Initial token universe
ETH, WETH, USDC, USDT, DAI, WBTC, cbBTC, wstETH, weETH, USDe, sUSDe.

## Frontend strategy
Keep useful Uniswap infrastructure such as wallet connectivity, token selectors, responsive swap UI, transaction modals, settings, accessibility, testing, and component primitives.

Remove or bypass Uniswap-specific execution dependencies including Uniswap routing, UniswapX execution, protocol-specific swap construction, and backend assumptions that are not required for Tokos.

Do not begin with visual rebranding. First prove Tokos can quote and execute a live 1delta-backed transaction end-to-end.

## Internal execution abstraction
React components must not call 1delta directly.

```ts
interface SwapProvider {
  getQuote(input: QuoteInput): Promise<Quote>
  buildSwap(input: BuildSwapInput): Promise<SwapActions>
}
```

V1 implementation:

```ts
class OneDeltaSwapProvider implements SwapProvider
```

This preserves the option to add other providers later without rebuilding the UI.

## Server API
Expose normalized Tokos endpoints rather than exposing 1delta response formats directly.

### GET /api/quote
Input:
- chainId
- tokenIn
- tokenOut
- amount
- slippageBps

Output:
```json
{
  "tokenIn": {},
  "tokenOut": {},
  "amountIn": "",
  "amountOut": "",
  "amountOutMin": "",
  "priceImpact": "",
  "gasEstimate": "",
  "route": {},
  "alternatives": [],
  "expiresAt": ""
}
```

Quote-only requests should not include an account unless required by 1delta for the requested action.

### POST /api/swap/build
Input:
```json
{
  "chainId": 1,
  "account": "0x...",
  "tokenIn": "0x...",
  "tokenOut": "0x...",
  "amount": "...",
  "slippageBps": 50
}
```

The backend calls 1delta and normalizes required permissions and execution transactions.

## Execution flow
1. User enters trade.
2. Tokos fetches quote.
3. User clicks Swap.
4. Tokos rebuilds an execution-ready request with the connected account.
5. If permissions are required, execute them first.
6. Wait for required approval confirmation.
7. Execute exactly one swap route.
8. Track receipt.
9. Refresh balances and activity.

Do not execute multiple alternatives.
Do not reconstruct 1delta calldata.
Do not alter `to`, `data`, or `value` fields returned for the selected transaction except where required for type conversion before wallet submission.

## Slippage
Presets: Auto, 0.1%, 0.5%, 1.0%, Custom.
Internally standardize on basis points.
Warn on unusually high values.

## Transaction state machine
- IDLE
- QUOTING
- QUOTE_READY
- APPROVAL_REQUIRED
- APPROVING
- APPROVAL_PENDING
- READY_TO_SWAP
- AWAITING_SIGNATURE
- SWAP_PENDING
- SUCCESS
- FAILED
- QUOTE_EXPIRED

## Errors
Normalize user-facing errors into:
- Quote unavailable
- Unsupported token
- Unsupported network
- Insufficient balance
- Insufficient native token for gas
- Approval failed
- User rejected transaction
- Quote expired
- Price changed
- Slippage exceeded
- RPC failure
- 1delta unavailable
- Rate limited
- Transaction reverted
- Unknown error

Raw errors should remain available to telemetry.

## Security requirements
- Never store user private keys.
- Never sign user transactions server-side.
- Keep 1delta credentials server-side only.
- Validate chain IDs, token addresses, decimals, and wallet addresses.
- Rate-limit public server endpoints.
- Sanitize token metadata and remote asset URLs.
- Maintain token and address blocklists.
- Simulate transactions where practical before prompting users.
- Require explicit wallet confirmation for every write.
- Never silently execute route alternatives.

## Analytics
Track quote request/success/failure, wallet connection, approval start/success/failure, swap start/sign/confirm/fail, token pair, chain, route, volume, latency, price impact, and execution success rate.

Primary KPI: successful swap volume.
Supporting KPIs: quote-to-swap conversion, transaction success rate, unique traders, returning traders, latency, failure rate, volume per trader.

## Phase 2
Cross-chain swaps with source/destination network selection, route, expected output, estimated duration, fees, and cross-chain status tracking.

## Phase 3
Earn/supply/withdraw through 1delta-supported lending markets.

## Phase 4
Borrow/repay with collateral, borrow capacity, and health factor.

## Phase 5
Leverage and looping with projected leverage, net rates, health factor, and liquidation risk.

## Phase 6
Unified portfolio for spot assets, supplied assets, debt, leveraged positions, and direct position actions.

## MVP acceptance criteria
- App loads reliably.
- Wallet connects.
- Ethereum mainnet works.
- Supported balances display.
- Pair selection works.
- Quote is supplied by 1delta through Tokos' server abstraction.
- Quote refresh and slippage work.
- Approval requirements are handled correctly.
- Swap transaction is built by 1delta.
- Wallet signs and broadcasts it.
- Receipt is tracked.
- Success updates balances/activity.
- Failures produce understandable states.
- No private key touches Tokos infrastructure.
- No 1delta secret is exposed to the browser.
- Uniswap routing is no longer required for swap execution.

# Tokos DEX Production Requirements

## Product
Tokos DEX is a non-custodial Ethereum trading interface that compares available execution routes and prepares transactions for the user's wallet to sign.

## V1
- Ethereum mainnet
- Curated liquid assets
- Quote discovery
- Optional direct-market quote benchmark
- ERC-20 approval handling
- Wallet-signed execution
- Transaction receipt tracking
- Slippage presets
- Balance checks
- Mobile-first responsive UI
- Provider-neutral user-facing copy

## Architecture
User -> Tokos DEX -> Tokos routing BFF -> execution venues -> wallet -> Ethereum.

Secrets stay server-side. The browser receives only normalized quote data and transaction objects required for user-authorized execution.

## Security
- No private keys on Tokos infrastructure.
- No server-side signing for users.
- Validate chain IDs, token addresses, amounts, slippage, and wallet addresses.
- Execute permissions before the swap.
- Execute exactly one selected route.
- Never reconstruct or silently alter returned calldata.
- Rate-limit public API endpoints.
- Use restrictive browser security headers.
- Require explicit wallet confirmation for every write.

## Fees
V1 beta fee is 0%. A Tokos fee must not be enabled until it can be charged atomically with successful execution. Do not collect a separate fee transaction before the swap. Future configuration reserves `TOKOS_FEE_BPS` and `TOKOS_FEE_RECIPIENT` for an audited atomic fee path.

## Deployment
- Railway service root: `/dex`
- Start command: `npm start`
- Health check: `/health`
- Test domain first, then `dex.tokos.fun`

## Acceptance criteria
- Health endpoint is green.
- Wallet connects.
- Wrong-network state switches to Ethereum.
- Quotes load for supported pairs.
- Optional direct benchmark never blocks execution.
- Required permissions are signed and confirmed first.
- Exactly one swap route is executed.
- Success links to an Ethereum transaction receipt.
- Failure and rejection states are understandable.
- Provider names and credentials are absent from the production UI.

# Indenture Loss Probability Rating (indenture-psl-v1)

Indenture publishes, for every rated lending market, the annual Probability of Significant Loss (PSL): the probability that a supplier loses more than 1% of principal within one year. Grades are bands on PSL. Every run is reproducible from its stored inputs and seed.

## Layers

1. Assets are classified into archetypes (stable-fiat, stable-synthetic, major, lst, lrt, wrapped-btc, principal-token, alt) and families (stable, eth, btc, alt, pt). Each archetype carries published priors: volatility versus its family anchor, jump structure, stress intensity, structural loss probability and shock size.
2. The collateral-to-loan price ratio is simulated daily for one year with jump diffusion and stress regimes. In a stress regime volatility doubles, jumps triple and exit liquidity thins by 3x. Observed volatility replaces the prior where price history exists.
3. Borrower buckets (published prior: 35% at 0.6 LLTV, 35% at 0.8, 20% at 0.9, 10% at 0.96) liquidate when LTV reaches LLTV. On diffusion days the fill happens at the threshold; on jump or structural days it happens at the post-gap price. Recovery is reduced by square-root market impact from the observed depth point, gas, and an oracle plus execution lag haircut. Realized slippage feeds back into the ratio for remaining positions.
4. Independent annual events are added: collateral structural shock, loan asset impairment, protocol-level loss.
5. PSL is the share of paths with loss over 1%. LGD is mean loss given a significant loss. Expected loss is the mean path loss. Net yield is APY minus expected loss.

## Scale

| Grade | Annual PSL |
|---|---|
| AAA | under 0.1% |
| AA | 0.1 to 0.4% |
| A | 0.4 to 0.8% |
| BBB | 0.8 to 1.5% |
| BB | 1.5 to 3% |
| B | 3 to 6% |
| CCC | 6 to 12% |
| CC | 12 to 32% |
| C | 32 to 99.9% |
| D | 99.9% or more |
| NR | coverage under 50% |

## Coverage and limitations

Coverage weights: LLTV 20%, volatility 20%, depth 20%, utilization 15%, supply 15%, protocol PD 10%. A grade is withheld under 50%. Current limitations: collateral price history and liquidation parameters are not yet ingested, so volatility and LLTV use priors; the borrower distribution is a prior; protocol loss probability is a flat 0.2% prior; smart-contract, legal and governance risk are not separately modeled. Pooled reserves use a representative collateral family until position data is ingested.

## Reproducibility

`rating_runs` stores inputs, inputs hash, seed, paths, drivers, histogram and limitations. `rateMarket(facts, {seed, paths})` from `@tokos-data/ratings` returns the same numbers. `GET /v1/ratings/market/:id/rerun` recomputes with overrides and never persists.

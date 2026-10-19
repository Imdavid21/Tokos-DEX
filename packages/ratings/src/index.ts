export * from "./scale.js";
export * from "./archetypes.js";
export * from "./simulate.js";
export * from "./rate.js";
export { Rng, fnv1a, stableStringify } from "./rng.js";

/** Human-readable methodology record used to seed the methodology registry. */
export const METHODOLOGY_RECORD = {
  slug: "indenture-psl-v1",
  name: "Indenture Loss Probability Rating",
  version: "indenture-psl-v1",
  scope: "credit-risk",
  description:
    "Annual Probability of Significant Loss (PSL): the chance a supplier loses more than 1% of principal within one year, estimated by Monte Carlo simulation of the collateral-to-loan price ratio through the market's liquidation rule, exit liquidity, oracle lag, and independent structural and protocol events. Graded AAA to D on published PSL bands.",
  formula:
    "PSL = share of simulated one-year paths with supplier loss > 1%. Each path: daily jump-diffusion of collateral/loan ratio with stress regimes; borrower buckets liquidate when LTV >= LLTV; recovery = collateral x (1 - sqrt-impact slippage - gas - oracle haircut); bad debt = max(0, debt - recovery) / supply. Independent annual events: collateral structural shock, loan-asset impairment, protocol loss. Expected loss = mean path loss. Risk-adjusted APY = APY - expected loss. Grades: AAA <0.1%, AA <0.4%, A <0.8%, BBB <1.5%, BB <3%, B <6%, CCC <12%, CC <32%, C <99.9%, else D. Coverage < 50% => NR. Stability rule: a published grade changes only when the new PSL clears the previous band by 15% of its width and the 95% interval no longer overlaps that band; otherwise the grade holds and the outlook flags the direction.",
  inputs: [
    "collateral and loan archetype",
    "ratio volatility (observed or archetype prior)",
    "liquidation LTV and bonus",
    "utilization and supply",
    "execution price impact at notional",
    "oracle lag",
    "30-day rate volatility",
    "protocol loss probability",
  ],
  limitations: [
    "Volatility priors are used where collateral price history is not yet ingested",
    "Borrower leverage distribution is a published prior pending position-level data",
    "Protocol loss probability is a flat prior pending per-protocol assessment",
    "Smart-contract, legal and governance risk are not separately modeled",
    "Ratings are comparable only within one methodology version",
  ],
} as const;

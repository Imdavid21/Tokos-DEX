import { Rng } from "./rng.js";
import { HORIZON_DAYS, LOSS_THRESHOLD } from "./scale.js";

/**
 * Inputs to the market loss simulation. Every field is either observed (from normalized data)
 * or a published prior; `MarketInputs.sources` records which, so coverage is auditable.
 */
export interface ProcessParams {
  /** Annualized diffusion volatility of the collateral-to-loan price ratio. */
  vol: number;
  /** Adverse jump events per year on the ratio. */
  jumpIntensity: number;
  /** Mean log-jump (negative is adverse). */
  jumpMean: number;
  /** Std dev of log-jump. */
  jumpSd: number;
  /** Stress-regime arrivals per year. Each stress lasts STRESS_DAYS, doubles vol and triples jumps. */
  stressIntensity: number;
}

export interface MarketInputs {
  process: ProcessParams;
  /** Liquidation loan-to-value (protocol liquidation threshold), 0..1. */
  lltv: number;
  /** Liquidation bonus or penalty paid to liquidators, as a fraction of repaid debt. */
  liquidationBonus: number;
  /** Debt divided by supply at t0, 0..1. */
  utilization: number;
  /** Total supplied principal in USD. */
  supplyUsd: number;
  /** Observed execution price impact (fraction, e.g. 0.004 = 40 bps) when selling `depthNotionalUsd` of collateral. */
  priceImpact: number;
  depthNotionalUsd: number;
  /** Oracle lag in days between a true price move and the liquidation-eligible price. */
  oracleLagDays: number;
  /** Annual probability of a structural collateral loss (depeg, bridge, issuer). */
  collateralStructuralPd: number;
  /** Log price drop applied to collateral in a structural event. */
  collateralStructuralShock: number;
  /** Annual probability the loan asset itself impairs supplier principal (depeg of the lent asset). */
  loanStructuralPd: number;
  /** Fractional principal loss in a loan-asset structural event. */
  loanStructuralLgd: number;
  /** Annual probability of a protocol-level loss (exploit, misconfiguration). */
  protocolPd: number;
  /** Fractional supplier loss in a protocol-level event. */
  protocolLgd: number;
  /** Borrower LTV distribution as fractions of LLTV, with the share of debt at each. */
  borrowerBuckets: ReadonlyArray<{ ltvOfLltv: number; debtShare: number }>;
}

export interface SimulationOptions {
  paths: number;
  seed: number;
  /** Override horizon for tests. */
  horizonDays?: number;
}

export interface SimulationResult {
  paths: number;
  seed: number;
  /** Probability of losing more than LOSS_THRESHOLD of principal over the horizon. */
  psl: number;
  /** Mean loss conditional on a significant-loss event. */
  lgd: number;
  /** Unconditional mean fractional loss. */
  expectedLoss: number;
  /** 95% Wilson interval on psl. */
  pslLow: number;
  pslHigh: number;
  /** Loss distribution quantiles (fraction of principal). */
  quantiles: { p50: number; p90: number; p95: number; p99: number; max: number };
  /** Histogram of path losses, 20 log-spaced buckets from 0.1% to 100%, plus a zero bucket. */
  histogram: Array<{ from: number; to: number; count: number }>;
  /** Share of significant-loss paths attributable to each channel (first cause on the path). */
  channels: { market: number; collateralStructural: number; loanStructural: number; protocol: number };
  /** A fixed sample of paths for visualization: collateral/loan ratio and cumulative loss at 13 monthly checkpoints. */
  samplePaths: Array<{ ratio: number[]; loss: number[]; significant: boolean }>;
}

export const SAMPLE_PATHS = 48;
export const SAMPLE_CHECKPOINTS = 13;

export const STRESS_DAYS = 30;
export const GAS_HAIRCUT = 0.002;
/** Exit liquidity thins in stress: observed impact is multiplied by this factor while a stress regime is active. */
export const STRESS_IMPACT_MULTIPLIER = 3;
/** Days between a liquidation becoming eligible and execution (block time, gas auctions), added to oracle lag. */
export const EXECUTION_DELAY_DAYS = 0.1;
/** Share of realized liquidation slippage that feeds back into the ratio for remaining positions (cascade). */
export const CASCADE_FEEDBACK = 0.5;
export const DEFAULT_BUCKETS: ReadonlyArray<{ ltvOfLltv: number; debtShare: number }> = [
  { ltvOfLltv: 0.6, debtShare: 0.35 },
  { ltvOfLltv: 0.8, debtShare: 0.35 },
  { ltvOfLltv: 0.9, debtShare: 0.2 },
  { ltvOfLltv: 0.96, debtShare: 0.1 },
];

/** Square-root market impact scaling from the observed depth point. */
export function slippageFor(sizeUsd: number, priceImpact: number, depthNotionalUsd: number): number {
  if (sizeUsd <= 0) return 0;
  if (!(depthNotionalUsd > 0) || !(priceImpact >= 0)) return 0.95;
  const s = priceImpact * Math.sqrt(sizeUsd / depthNotionalUsd);
  return Math.min(0.95, Math.max(0, s));
}

export function wilson(successes: number, n: number, z = 1.96): { low: number; high: number } {
  if (n <= 0) return { low: 0, high: 1 };
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const half = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { low: Math.max(0, (centre - half) / denom), high: Math.min(1, (centre + half) / denom) };
}

const HIST_EDGES = (() => {
  const edges = [0, 0.001];
  for (let i = 1; i <= 20; i++) edges.push(0.001 * Math.pow(1000, i / 20));
  return edges;
})();

export function simulate(m: MarketInputs, o: SimulationOptions): SimulationResult {
  const horizon = o.horizonDays ?? HORIZON_DAYS;
  const rng = new Rng(o.seed);
  const dt = 1 / 365;
  const sqrtDt = Math.sqrt(dt);
  const buckets = m.borrowerBuckets.length ? m.borrowerBuckets : DEFAULT_BUCKETS;
  const nb = buckets.length;
  const debtTotal = Math.max(0, Math.min(1, m.utilization)) * m.supplyUsd;
  const debt = new Float64Array(nb);
  const collateral0 = new Float64Array(nb);
  for (let b = 0; b < nb; b++) {
    const ltv = Math.max(0.01, Math.min(0.999, buckets[b]!.ltvOfLltv * m.lltv));
    debt[b] = debtTotal * buckets[b]!.debtShare;
    collateral0[b] = debt[b]! / ltv;
  }
  const losses = new Float64Array(o.paths);
  const samplePaths: SimulationResult["samplePaths"] = [];
  const sampleEvery = Math.max(1, Math.floor(o.paths / SAMPLE_PATHS));
  const checkpointEvery = Math.max(1, Math.round(horizon / (SAMPLE_CHECKPOINTS - 1)));
  const channelCount = { market: 0, collateralStructural: 0, loanStructural: 0, protocol: 0 };
  const vol = m.process.vol;
  const dailyVol = vol * sqrtDt;
  const oracleHaircut = Math.min(0.5, vol * Math.sqrt((Math.max(0, m.oracleLagDays) + EXECUTION_DELAY_DAYS) / 365));
  const pCollStruct = 1 - Math.exp(-m.collateralStructuralPd * horizon / 365);
  const pLoanStruct = 1 - Math.exp(-m.loanStructuralPd * horizon / 365);
  const pProtocol = 1 - Math.exp(-m.protocolPd * horizon / 365);

  for (let p = 0; p < o.paths; p++) {
    let ratio = 1;
    let stressLeft = 0;
    let loss = 0;
    let firstChannel: keyof typeof channelCount | null = null;
    const alive = new Uint8Array(nb).fill(1);
    const collStructDay = rng.next() < pCollStruct ? Math.floor(rng.next() * horizon) : -1;
    const loanStructDay = rng.next() < pLoanStruct ? Math.floor(rng.next() * horizon) : -1;
    const protocolDay = rng.next() < pProtocol ? Math.floor(rng.next() * horizon) : -1;
    const sampled = p % sampleEvery === 0 && samplePaths.length < SAMPLE_PATHS;
    const ratioTrack: number[] = sampled ? [1] : [];
    const lossTrack: number[] = sampled ? [0] : [];

    for (let d = 0; d < horizon; d++) {
      const stressed = stressLeft > 0;
      if (stressed) stressLeft--;
      else if (rng.next() < m.process.stressIntensity * dt) stressLeft = STRESS_DAYS;
      const v = stressed ? dailyVol * 2 : dailyVol;
      let logMove = -0.5 * v * v + v * rng.normal();
      const jumps = rng.poisson(m.process.jumpIntensity * dt * (stressed ? 3 : 1));
      for (let j = 0; j < jumps; j++) logMove += m.process.jumpMean + m.process.jumpSd * rng.normal();
      let structuralToday = false;
      if (d === collStructDay) {
        logMove -= m.collateralStructuralShock;
        structuralToday = true;
      }
      const gapped = jumps > 0 || structuralToday;
      ratio *= Math.exp(logMove);

      // Liquidation pass: any bucket whose LTV crosses LLTV is liquidated at today's ratio with oracle lag haircut.
      for (let b = 0; b < nb; b++) {
        if (!alive[b]) continue;
        const collateralValue = collateral0[b]! * ratio;
        const ltvNow = debt[b]! / collateralValue;
        if (ltvNow < m.lltv) continue;
        alive[b] = 0;
        // Continuous liquidation: on a diffusion-only day the position is seized at the threshold crossing,
        // so only oracle and execution lag separate trigger from fill. A jump or structural gap fills at the post-gap price.
        const triggerValue = gapped ? collateralValue : Math.max(collateralValue, debt[b]! / m.lltv);
        const sizeUsd = triggerValue;
        const slip = slippageFor(sizeUsd, m.priceImpact * (stressed ? STRESS_IMPACT_MULTIPLIER : 1), m.depthNotionalUsd);
        const recovery = triggerValue * (1 - slip - GAS_HAIRCUT - oracleHaircut * (stressed ? 2 : 1));
        ratio *= 1 - slip * CASCADE_FEEDBACK;
        // Liquidators only act while profitable; beyond that the position sits until recovery < debt.
        const badDebt = Math.max(0, debt[b]! - Math.max(0, recovery));
        if (badDebt > 0) {
          loss += badDebt / m.supplyUsd;
          if (!firstChannel) firstChannel = structuralToday ? "collateralStructural" : "market";
        }
      }
      if (d === loanStructDay) {
        loss += m.loanStructuralLgd;
        if (!firstChannel) firstChannel = "loanStructural";
      }
      if (d === protocolDay) {
        loss += m.protocolLgd;
        if (!firstChannel) firstChannel = "protocol";
      }
      if (sampled && (d + 1) % checkpointEvery === 0 && ratioTrack.length < SAMPLE_CHECKPOINTS) {
        ratioTrack.push(ratio);
        lossTrack.push(Math.min(1, loss));
      }
      if (loss >= 1) break;
    }
    const capped = Math.min(1, loss);
    if (sampled) {
      while (ratioTrack.length < SAMPLE_CHECKPOINTS) {
        ratioTrack.push(ratio);
        lossTrack.push(capped);
      }
      samplePaths.push({ ratio: ratioTrack.map((x) => Math.round(x * 1e4) / 1e4), loss: lossTrack.map((x) => Math.round(x * 1e5) / 1e5), significant: capped > LOSS_THRESHOLD });
    }
    losses[p] = capped;
    if (capped > LOSS_THRESHOLD && firstChannel) channelCount[firstChannel]++;
  }

  let significant = 0;
  let sumLoss = 0;
  let sumSigLoss = 0;
  for (let p = 0; p < o.paths; p++) {
    const l = losses[p]!;
    sumLoss += l;
    if (l > LOSS_THRESHOLD) {
      significant++;
      sumSigLoss += l;
    }
  }
  const sorted = Float64Array.from(losses).sort();
  const q = (f: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(f * sorted.length)))]!;
  const psl = significant / o.paths;
  const ci = wilson(significant, o.paths);
  const histogram: SimulationResult["histogram"] = [];
  for (let i = 0; i < HIST_EDGES.length - 1; i++) histogram.push({ from: HIST_EDGES[i]!, to: HIST_EDGES[i + 1]!, count: 0 });
  histogram.push({ from: HIST_EDGES.at(-1)!, to: 1, count: 0 });
  for (let p = 0; p < o.paths; p++) {
    const l = losses[p]!;
    let idx = histogram.length - 1;
    for (let i = 0; i < histogram.length; i++) if (l < histogram[i]!.to) { idx = i; break; }
    histogram[idx]!.count++;
  }
  const totalChannel = Math.max(1, significant);
  return {
    paths: o.paths,
    seed: o.seed,
    psl,
    lgd: significant ? sumSigLoss / significant : 0,
    expectedLoss: sumLoss / o.paths,
    pslLow: ci.low,
    pslHigh: ci.high,
    quantiles: { p50: q(0.5), p90: q(0.9), p95: q(0.95), p99: q(0.99), max: sorted[sorted.length - 1]! },
    histogram,
    samplePaths,
    channels: {
      market: channelCount.market / totalChannel,
      collateralStructural: channelCount.collateralStructural / totalChannel,
      loanStructural: channelCount.loanStructural / totalChannel,
      protocol: channelCount.protocol / totalChannel,
    },
  };
}

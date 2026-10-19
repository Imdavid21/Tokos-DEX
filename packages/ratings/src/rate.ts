import { ARCHETYPES, classifyAsset, familyPairJumps, familyPairVol, type Archetype } from "./archetypes.js";
import { fnv1a, stableStringify } from "./rng.js";
import { bandFor, gradeForPsl, notchDelta, type Grade, type Outlook, METHODOLOGY_VERSION } from "./scale.js";
import { DEFAULT_BUCKETS, simulate, type MarketInputs, type SimulationResult } from "./simulate.js";

/** Observed facts about a lending market. Null means not observed; the engine substitutes a published prior. */
export interface MarketFacts {
  marketId: string;
  marketName?: string | null;
  provider?: string | null;
  protocolSlug?: string | null;
  loanSymbol: string | null;
  loanAssetGroup?: string | null;
  collateralSymbol: string | null;
  collateralAssetGroup?: string | null;
  marketType?: string | null;
  supplyUsd: number | null;
  utilization: number | null;
  /** Liquidation LTV / threshold, if the protocol exposes it. */
  lltv: number | null;
  liquidationBonus: number | null;
  /** Observed annualized volatility of the collateral/loan ratio, if price history exists. */
  observedVol: number | null;
  /** Observed execution price impact (fraction) at `depthNotionalUsd`. */
  priceImpact: number | null;
  depthNotionalUsd: number | null;
  /** Available liquidity in the market, used only as a proxy when no depth point exists. */
  liquidityUsd: number | null;
  /** 30-day rate volatility (ratio), used to scale stress intensity. */
  rateVolatility30d: number | null;
  oracleLagDays: number | null;
  /** Annual protocol-level loss probability if a published assessment exists. */
  protocolPd: number | null;
  supplyApy: number | null;
}

export interface RatingOptions {
  paths?: number;
  driverPaths?: number;
  seed?: number;
  previous?: { grade: Grade; psl: number } | null;
}

export interface Driver {
  key: "market" | "liquidity" | "oracle" | "collateralStructural" | "loanStructural" | "protocol" | "leverage";
  label: string;
  /** PSL reduction if this channel were benign, in absolute probability. */
  pslContribution: number;
  share: number;
  detail: string;
}

export interface InputRecord {
  key: string;
  value: number | string;
  unit: string;
  source: "observed" | "prior" | "derived";
  note?: string;
}

export interface RatingOutput {
  methodologyVersion: string;
  marketId: string;
  grade: Grade;
  outlook: Outlook;
  psl: number;
  pslLow: number;
  pslHigh: number;
  lgd: number;
  expectedLoss: number;
  riskAdjustedApy: number | null;
  coverage: number;
  band: ReturnType<typeof bandFor>;
  drivers: Driver[];
  inputs: InputRecord[];
  inputsHash: string;
  seed: number;
  paths: number;
  simulation: SimulationResult;
  archetypes: { collateral: Archetype; loan: Archetype };
  limitations: string[];
}

const COVERAGE_WEIGHTS = { lltv: 0.2, utilization: 0.15, supply: 0.15, depth: 0.2, volatility: 0.2, protocolPd: 0.1 } as const;
export const COVERAGE_FLOOR = 0.5;
export const DEFAULT_PATHS = 20000;
export const DEFAULT_DRIVER_PATHS = 4000;
export const PRIORS = {
  lltv: 0.8,
  liquidationBonus: 0.05,
  utilization: 0.75,
  supplyUsd: 1_000_000,
  oracleLagDays: 0.25,
  protocolPd: 0.002,
  protocolLgd: 0.5,
  loanStructuralLgd: 0.3,
  /** Fallback depth: assume impact of 1% when selling 2% of market liquidity, which is deliberately conservative. */
  fallbackImpact: 0.01,
  fallbackDepthShare: 0.02,
} as const;

export function buildInputs(f: MarketFacts): { inputs: MarketInputs; records: InputRecord[]; coverage: number; archetypes: { collateral: Archetype; loan: Archetype }; limitations: string[] } {
  const collateral = classifyAsset(f.collateralSymbol, { assetGroup: f.collateralAssetGroup ?? null, marketType: f.marketType ?? null, provider: f.provider ?? null });
  const loan = classifyAsset(f.loanSymbol, { assetGroup: f.loanAssetGroup ?? null, marketType: null, provider: null });
  const ca = ARCHETYPES[collateral];
  const la = ARCHETYPES[loan];
  const records: InputRecord[] = [];
  const limitations: string[] = [];
  let coverage = 0;
  const rec = (key: string, value: number | string, unit: string, source: InputRecord["source"], note?: string) => {
    records.push(note ? { key, value, unit, source, note } : { key, value, unit, source });
  };

  rec("collateral_archetype", collateral, "class", "derived", ca.label);
  rec("loan_archetype", loan, "class", "derived", la.label);

  // Ratio volatility = volatility of each leg versus its family anchor, plus the anchors' own relative volatility.
  const anchorVol = familyPairVol(ca.family, la.family);
  const fj = familyPairJumps(ca.family, la.family);
  const jumpIntensity = ca.jumpIntensity + la.jumpIntensity + fj.jumpIntensity;
  const jumpMean = Math.min(ca.jumpMean, la.jumpMean, fj.jumpMean);
  const jumpSd = Math.max(ca.jumpSd, la.jumpSd, fj.jumpSd);
  const stressBase = ca.stressRegimeIntensity + la.stressRegimeIntensity + fj.stressIntensity;
  const combinedPriorVol = Math.sqrt(ca.volPrior ** 2 + la.volPrior ** 2 + anchorVol ** 2);
  const combinedFloor = Math.sqrt(ca.volFloor ** 2 + la.volFloor ** 2 + anchorVol ** 2);
  let vol: number;
  if (f.observedVol != null && Number.isFinite(f.observedVol) && f.observedVol > 0) {
    vol = Math.max(combinedFloor, f.observedVol);
    coverage += COVERAGE_WEIGHTS.volatility;
    rec("ratio_volatility", vol, "annualized", "observed", vol > f.observedVol ? "raised to archetype floor" : undefined);
  } else {
    vol = combinedPriorVol;
    rec("ratio_volatility", vol, "annualized", "prior", "no collateral/loan price history; archetype prior");
    limitations.push("Collateral price volatility uses the archetype prior, not observed history.");
  }
  const rateVol = f.rateVolatility30d != null && Number.isFinite(f.rateVolatility30d) ? Math.max(0, f.rateVolatility30d) : null;
  const stressScale = rateVol == null ? 1 : Math.min(2, 1 + rateVol / 0.1);
  if (rateVol != null) rec("rate_volatility_30d", rateVol, "ratio", "observed", `stress intensity scaled x${stressScale.toFixed(2)}`);

  const lltv = f.lltv != null && f.lltv > 0 && f.lltv < 1 ? f.lltv : PRIORS.lltv;
  if (f.lltv != null && f.lltv > 0 && f.lltv < 1) coverage += COVERAGE_WEIGHTS.lltv;
  else limitations.push("Liquidation LTV is a published prior; the protocol value was not observed.");
  rec("liquidation_ltv", lltv, "ratio", f.lltv != null ? "observed" : "prior");

  const bonus = f.liquidationBonus != null && f.liquidationBonus >= 0 ? f.liquidationBonus : PRIORS.liquidationBonus;
  rec("liquidation_bonus", bonus, "ratio", f.liquidationBonus != null ? "observed" : "prior");

  const utilization = f.utilization != null && Number.isFinite(f.utilization) ? Math.max(0, Math.min(1, f.utilization)) : PRIORS.utilization;
  if (f.utilization != null && Number.isFinite(f.utilization)) coverage += COVERAGE_WEIGHTS.utilization;
  rec("utilization", utilization, "ratio", f.utilization != null ? "observed" : "prior");

  const supplyUsd = f.supplyUsd != null && f.supplyUsd > 0 ? f.supplyUsd : PRIORS.supplyUsd;
  if (f.supplyUsd != null && f.supplyUsd > 0) coverage += COVERAGE_WEIGHTS.supply;
  rec("supply_usd", supplyUsd, "USD", f.supplyUsd != null && f.supplyUsd > 0 ? "observed" : "prior");

  let priceImpact: number;
  let depthNotional: number;
  if (f.priceImpact != null && f.depthNotionalUsd != null && f.depthNotionalUsd > 0 && f.priceImpact >= 0) {
    priceImpact = f.priceImpact;
    depthNotional = f.depthNotionalUsd;
    coverage += COVERAGE_WEIGHTS.depth;
    rec("price_impact", priceImpact, "fraction", "observed", `at $${Math.round(depthNotional).toLocaleString()}`);
  } else if (f.liquidityUsd != null && f.liquidityUsd > 0) {
    priceImpact = PRIORS.fallbackImpact;
    depthNotional = f.liquidityUsd * PRIORS.fallbackDepthShare;
    coverage += COVERAGE_WEIGHTS.depth * 0.5;
    rec("price_impact", priceImpact, "fraction", "derived", `proxy: ${PRIORS.fallbackImpact * 100}% impact at ${PRIORS.fallbackDepthShare * 100}% of available liquidity`);
    limitations.push("Collateral exit liquidity is proxied from market liquidity, not an observed depth curve.");
  } else {
    priceImpact = PRIORS.fallbackImpact;
    depthNotional = PRIORS.supplyUsd * PRIORS.fallbackDepthShare;
    rec("price_impact", priceImpact, "fraction", "prior", "no depth or liquidity observation");
    limitations.push("No liquidity observation; exit slippage uses a conservative prior.");
  }

  const oracleLag = f.oracleLagDays != null && f.oracleLagDays >= 0 ? f.oracleLagDays : PRIORS.oracleLagDays;
  rec("oracle_lag_days", oracleLag, "days", f.oracleLagDays != null ? "observed" : "prior");

  const protocolPd = f.protocolPd != null && f.protocolPd >= 0 ? f.protocolPd : PRIORS.protocolPd;
  if (f.protocolPd != null && f.protocolPd >= 0) coverage += COVERAGE_WEIGHTS.protocolPd;
  else limitations.push("Protocol-level loss probability is a flat published prior; smart-contract and governance risk are not yet assessed per protocol.");
  rec("protocol_pd", protocolPd, "annual", f.protocolPd != null ? "observed" : "prior");
  rec("protocol_lgd", PRIORS.protocolLgd, "fraction", "prior");
  rec("collateral_structural_pd", ca.structuralPd, "annual", "prior", ca.label);
  rec("collateral_structural_shock", ca.structuralShock, "log drop", "prior");
  rec("family_pair_vol", anchorVol, "annualized", "prior", `${ca.family} vs ${la.family}`);
  rec("loan_structural_pd", la.structuralPd, "annual", "prior", la.label);
  rec("jump_intensity", jumpIntensity, "per year", "prior");
  rec("stress_intensity", stressBase * stressScale, "per year", "derived");

  const inputs: MarketInputs = {
    process: {
      vol,
      jumpIntensity,
      jumpMean,
      jumpSd,
      stressIntensity: stressBase * stressScale,
    },
    lltv,
    liquidationBonus: bonus,
    utilization,
    supplyUsd,
    priceImpact,
    depthNotionalUsd: depthNotional,
    oracleLagDays: oracleLag,
    collateralStructuralPd: ca.structuralPd,
    collateralStructuralShock: ca.structuralShock,
    loanStructuralPd: la.structuralPd,
    loanStructuralLgd: PRIORS.loanStructuralLgd,
    protocolPd,
    protocolLgd: PRIORS.protocolLgd,
    borrowerBuckets: DEFAULT_BUCKETS,
  };
  limitations.push("Borrower leverage distribution is a published prior; position-level data is not yet ingested.");
  return { inputs, records, coverage: Math.round(coverage * 100) / 100, archetypes: { collateral, loan }, limitations };
}

export function deriveSeed(marketId: string, inputsHash: string, override?: number): number {
  if (override != null) return override >>> 0;
  return fnv1a(`${marketId}:${inputsHash}`);
}

function benign(inputs: MarketInputs, key: Driver["key"]): MarketInputs {
  switch (key) {
    case "market":
      return { ...inputs, process: { ...inputs.process, vol: 0.005, jumpIntensity: 0, stressIntensity: 0 } };
    case "liquidity":
      return { ...inputs, priceImpact: 0 };
    case "oracle":
      return { ...inputs, oracleLagDays: 0 };
    case "collateralStructural":
      return { ...inputs, collateralStructuralPd: 0 };
    case "loanStructural":
      return { ...inputs, loanStructuralPd: 0 };
    case "protocol":
      return { ...inputs, protocolPd: 0 };
    case "leverage":
      return { ...inputs, borrowerBuckets: [{ ltvOfLltv: 0.6, debtShare: 1 }] };
  }
}

const DRIVER_LABELS: Record<Driver["key"], string> = {
  market: "Collateral price risk",
  liquidity: "Exit liquidity and slippage",
  oracle: "Oracle lag",
  collateralStructural: "Collateral structural event",
  loanStructural: "Loan asset impairment",
  protocol: "Protocol-level loss",
  leverage: "Borrower leverage",
};

export function rateMarket(facts: MarketFacts, options: RatingOptions = {}): RatingOutput {
  const built = buildInputs(facts);
  const inputsHash = fnv1a(stableStringify(built.inputs)).toString(16).padStart(8, "0");
  const seed = deriveSeed(facts.marketId, inputsHash, options.seed);
  const paths = options.paths ?? DEFAULT_PATHS;
  const driverPaths = options.driverPaths ?? DEFAULT_DRIVER_PATHS;
  const sim = simulate(built.inputs, { paths, seed });

  const base = simulate(built.inputs, { paths: driverPaths, seed });
  const drivers: Driver[] = (Object.keys(DRIVER_LABELS) as Driver["key"][]).map((key) => {
    const alt = simulate(benign(built.inputs, key), { paths: driverPaths, seed });
    const contribution = Math.max(0, base.psl - alt.psl);
    return { key, label: DRIVER_LABELS[key], pslContribution: contribution, share: 0, detail: "" };
  });
  const total = drivers.reduce((a, d) => a + d.pslContribution, 0) || 1;
  for (const d of drivers) d.share = d.pslContribution / total;
  drivers.sort((a, b) => b.pslContribution - a.pslContribution);
  for (const d of drivers) d.detail = `${(d.pslContribution * 100).toFixed(2)} pp of PSL if this channel were benign`;

  const coverageOk = built.coverage >= COVERAGE_FLOOR;
  const grade: Grade = coverageOk ? gradeForPsl(sim.psl) : "NR";
  let outlook: Outlook = "stable";
  if (grade !== "NR") {
    const previous = options.previous ?? null;
    const topDriver = drivers[0];
    if (previous && previous.grade !== "NR") {
      const notches = notchDelta(previous.grade, grade);
      if (notches < 0) outlook = "negative";
      else if (notches > 0) outlook = "positive";
      else if (sim.psl > previous.psl * 1.25 && sim.psl - previous.psl > 0.001) outlook = "negative";
      else if (sim.psl < previous.psl * 0.75 && previous.psl - sim.psl > 0.001) outlook = "positive";
    }
    const band = bandFor(grade);
    if (band && outlook === "stable" && sim.pslHigh >= band.upperPsl && topDriver && topDriver.key !== "protocol") outlook = "watch";
  }
  const riskAdjustedApy = facts.supplyApy != null && Number.isFinite(facts.supplyApy) && grade !== "NR" ? facts.supplyApy - sim.expectedLoss : null;

  return {
    methodologyVersion: METHODOLOGY_VERSION,
    marketId: facts.marketId,
    grade,
    outlook,
    psl: sim.psl,
    pslLow: sim.pslLow,
    pslHigh: sim.pslHigh,
    lgd: sim.lgd,
    expectedLoss: sim.expectedLoss,
    riskAdjustedApy,
    coverage: built.coverage,
    band: bandFor(grade),
    drivers,
    inputs: built.records,
    inputsHash,
    seed,
    paths,
    simulation: sim,
    archetypes: built.archetypes,
    limitations: built.limitations,
  };
}

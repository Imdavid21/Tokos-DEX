import { describe, expect, it } from "vitest";
import { ARCHETYPES, bandFor, buildInputs, classifyAsset, gradeForPsl, notchDelta, rateMarket, simulate, slippageFor, wilson, type MarketFacts, type MarketInputs } from "../src/index.js";

const base: MarketInputs = {
  process: { vol: 0.65, jumpIntensity: 1.2, jumpMean: -0.08, jumpSd: 0.06, stressIntensity: 0.4 },
  lltv: 0.8,
  liquidationBonus: 0.05,
  utilization: 0.8,
  supplyUsd: 10_000_000,
  priceImpact: 0.003,
  depthNotionalUsd: 1_000_000,
  oracleLagDays: 0.25,
  collateralStructuralPd: 0.0002,
  collateralStructuralShock: 0.5,
  loanStructuralPd: 0.0005,
  loanStructuralLgd: 0.3,
  protocolPd: 0.002,
  protocolLgd: 0.5,
  borrowerBuckets: [],
};

const facts = (over: Partial<MarketFacts> = {}): MarketFacts => ({
  marketId: "m1",
  loanSymbol: "USDC",
  collateralSymbol: "WETH",
  supplyUsd: 20_000_000,
  utilization: 0.8,
  lltv: 0.83,
  liquidationBonus: 0.05,
  observedVol: null,
  priceImpact: 0.002,
  depthNotionalUsd: 500_000,
  liquidityUsd: 4_000_000,
  rateVolatility30d: 0.02,
  oracleLagDays: null,
  protocolPd: null,
  supplyApy: 0.05,
  ...over,
});

describe("scale", () => {
  it("maps PSL to published bands", () => {
    expect(gradeForPsl(0)).toBe("AAA");
    expect(gradeForPsl(0.0009)).toBe("AAA");
    expect(gradeForPsl(0.001)).toBe("AA");
    expect(gradeForPsl(0.0079)).toBe("A");
    expect(gradeForPsl(0.015)).toBe("BB");
    expect(gradeForPsl(0.5)).toBe("C");
    expect(gradeForPsl(0.9995)).toBe("D");
    expect(gradeForPsl(NaN)).toBe("NR");
  });
  it("exposes band edges", () => {
    expect(bandFor("BBB")).toEqual({ grade: "BBB", lowerPsl: 0.008, upperPsl: 0.015, label: "Adequate" });
    expect(notchDelta("A", "BBB")).toBe(-1);
    expect(notchDelta("B", "AA")).toBe(4);
  });
});

describe("archetypes", () => {
  it("classifies common symbols", () => {
    expect(classifyAsset("USDC")).toBe("stable-fiat");
    expect(classifyAsset("sUSDe")).toBe("stable-synthetic");
    expect(classifyAsset("wstETH")).toBe("lst");
    expect(classifyAsset("weETH")).toBe("lrt");
    expect(classifyAsset("cbBTC")).toBe("wrapped-btc");
    expect(classifyAsset("WETH")).toBe("major");
    expect(classifyAsset("PEPE")).toBe("alt");
    expect(classifyAsset("PT-sUSDe-27MAR2026", { provider: "pendle" })).toBe("principal-token");
    expect(classifyAsset(null)).toBe("unknown");
  });
  it("orders structural priors by fragility", () => {
    expect(ARCHETYPES["stable-fiat"].structuralPd).toBeLessThan(ARCHETYPES["stable-synthetic"].structuralPd);
    expect(ARCHETYPES.lst.volPrior).toBeLessThan(ARCHETYPES.lrt.volPrior);
  });
});

describe("simulation primitives", () => {
  it("square-root impact scaling", () => {
    expect(slippageFor(1_000_000, 0.003, 1_000_000)).toBeCloseTo(0.003);
    expect(slippageFor(4_000_000, 0.003, 1_000_000)).toBeCloseTo(0.006);
    expect(slippageFor(1, 0.003, 0)).toBe(0.95);
  });
  it("wilson interval contains the point estimate and tightens with n", () => {
    const a = wilson(10, 1000);
    const b = wilson(100, 10000);
    expect(a.low).toBeLessThan(0.01);
    expect(a.high).toBeGreaterThan(0.01);
    expect(b.high - b.low).toBeLessThan(a.high - a.low);
  });
  it("is deterministic for a given seed", () => {
    const x = simulate(base, { paths: 2000, seed: 42 });
    const y = simulate(base, { paths: 2000, seed: 42 });
    expect(x.psl).toBe(y.psl);
    expect(x.expectedLoss).toBe(y.expectedLoss);
    expect(simulate(base, { paths: 2000, seed: 43 }).psl).not.toBe(x.psl);
  });
  it("psl rises with volatility, LLTV, utilization and slippage", () => {
    const o = { paths: 4000, seed: 7 };
    const calm = simulate({ ...base, process: { ...base.process, vol: 0.2 } }, o).psl;
    const wild = simulate({ ...base, process: { ...base.process, vol: 1.6 } }, o).psl;
    expect(wild).toBeGreaterThan(calm);
    const safeLltv = simulate({ ...base, lltv: 0.5 }, o).psl;
    const riskyLltv = simulate({ ...base, lltv: 0.95 }, o).psl;
    expect(riskyLltv).toBeGreaterThan(safeLltv);
    const thin = simulate({ ...base, priceImpact: 0.05 }, o).psl;
    expect(thin).toBeGreaterThanOrEqual(simulate(base, o).psl);
    const idle = simulate({ ...base, utilization: 0.05 }, o).psl;
    const full = simulate({ ...base, utilization: 0.98 }, o).psl;
    expect(full).toBeGreaterThanOrEqual(idle);
  });
  it("structural events show up as channels", () => {
    const r = simulate({ ...base, process: { ...base.process, vol: 0.01, jumpIntensity: 0, stressIntensity: 0 }, protocolPd: 0.5 }, { paths: 2000, seed: 1 });
    expect(r.psl).toBeGreaterThan(0.3);
    expect(r.channels.protocol).toBeGreaterThan(0.9);
    expect(r.histogram.reduce((a, b) => a + b.count, 0)).toBe(2000);
    expect(r.quantiles.max).toBeLessThanOrEqual(1);
  });
  it("captures a fixed sample of paths at monthly checkpoints", () => {
    const r = simulate(base, { paths: 2000, seed: 3 });
    expect(r.samplePaths.length).toBe(48);
    for (const p of r.samplePaths) {
      expect(p.ratio.length).toBe(13);
      expect(p.loss.length).toBe(13);
      expect(p.ratio[0]).toBe(1);
      expect(p.loss[0]).toBe(0);
    }
  });
});

describe("rateMarket", () => {
  it("rates a stable-collateral stable-loan market as investment grade", () => {
    const r = rateMarket(facts({ collateralSymbol: "USDT", loanSymbol: "USDC" }), { paths: 4000, driverPaths: 1000 });
    expect(["AAA", "AA", "A"]).toContain(r.grade);
    expect(r.coverage).toBeGreaterThanOrEqual(0.5);
    expect(r.riskAdjustedApy).not.toBeNull();
    expect(r.riskAdjustedApy!).toBeLessThanOrEqual(0.05);
    expect(r.inputs.find((x) => x.key === "liquidation_ltv")?.source).toBe("observed");
  });
  it("rates a long-tail collateral market below a major one", () => {
    const major = rateMarket(facts(), { paths: 4000, driverPaths: 1000 });
    const alt = rateMarket(facts({ collateralSymbol: "PEPE", lltv: 0.7 }), { paths: 4000, driverPaths: 1000 });
    expect(alt.psl).toBeGreaterThan(major.psl);
    expect(alt.drivers[0]!.share).toBeGreaterThan(0);
    expect(alt.drivers.reduce((a, d) => a + d.share, 0)).toBeCloseTo(1, 5);
  });
  it("returns NR when coverage is below the floor", () => {
    const r = rateMarket(facts({ lltv: null, utilization: null, supplyUsd: null, priceImpact: null, depthNotionalUsd: null, liquidityUsd: null }), { paths: 1000, driverPaths: 500 });
    expect(r.coverage).toBeLessThan(0.5);
    expect(r.grade).toBe("NR");
    expect(r.riskAdjustedApy).toBeNull();
  });
  it("derives a stable seed from inputs and records sources", () => {
    const a = rateMarket(facts(), { paths: 500, driverPaths: 200 });
    const b = rateMarket(facts(), { paths: 500, driverPaths: 200 });
    expect(a.seed).toBe(b.seed);
    expect(a.inputsHash).toBe(b.inputsHash);
    expect(a.psl).toBe(b.psl);
    const built = buildInputs(facts({ observedVol: 0.9 }));
    expect(built.records.find((x) => x.key === "ratio_volatility")?.source).toBe("observed");
  });
  it("holds the previous grade on small moves near a band edge", () => {
    const f = facts({ collateralSymbol: "WETH", lltv: 0.86 });
    const a = rateMarket(f, { paths: 3000, driverPaths: 300 });
    const nudged = rateMarket(facts({ collateralSymbol: "WETH", lltv: 0.862 }), { paths: 3000, driverPaths: 300, previous: { grade: a.grade, psl: a.psl } });
    expect(nudged.grade).toBe(a.grade);
  });
  it("sets outlook from the previous rating", () => {
    const prev = rateMarket(facts(), { paths: 2000, driverPaths: 500 });
    const worse = rateMarket(facts({ collateralSymbol: "PEPE" }), { paths: 2000, driverPaths: 500, previous: { grade: prev.grade, psl: prev.psl } });
    expect(worse.outlook).toBe("negative");
  });
});

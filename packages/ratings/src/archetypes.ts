/**
 * Collateral archetypes: published prior parameters for the collateral-to-loan price ratio process.
 * All values are annualized and are the calibration surface for this methodology version.
 * Observed data overrides priors where it exists; the archetype supplies the jump structure and a
 * floor on volatility so that thin histories do not produce overconfident ratings.
 */
export type Archetype =
  | "stable-fiat"
  | "stable-synthetic"
  | "major"
  | "lst"
  | "lrt"
  | "wrapped-btc"
  | "principal-token"
  | "alt"
  | "unknown";

export type Family = "stable" | "eth" | "btc" | "alt" | "pt";

export interface ArchetypeParams {
  /** Price family the asset tracks. Assets in the same family are modeled relative to that family's anchor. */
  family: Family;
  /** Floor on annualized volatility of the asset versus its family anchor. */
  volFloor: number;
  /** Prior annualized volatility versus the family anchor when no history is observed. */
  volPrior: number;
  /** Log price drop applied in a structural event (depeg, slashing, bridge failure). */
  structuralShock: number;
  /** Expected number of jump events per year. */
  jumpIntensity: number;
  /** Mean log-jump (negative = adverse). */
  jumpMean: number;
  /** Std dev of log-jump. */
  jumpSd: number;
  /** Probability per year of entering a stressed regime where vol doubles and jumps triple. */
  stressRegimeIntensity: number;
  /** Annual base probability of a non-market loss (depeg, issuer, bridge) applied as an independent event. */
  structuralPd: number;
  label: string;
}

export const ARCHETYPES: Record<Archetype, ArchetypeParams> = {
  "stable-fiat": { family: "stable", structuralShock: 0.3, volFloor: 0.01, volPrior: 0.015, jumpIntensity: 0.15, jumpMean: -0.03, jumpSd: 0.03, stressRegimeIntensity: 0.1, structuralPd: 0.0005, label: "Fiat-backed stablecoin" },
  "stable-synthetic": { family: "stable", structuralShock: 0.4, volFloor: 0.03, volPrior: 0.05, jumpIntensity: 0.35, jumpMean: -0.06, jumpSd: 0.06, stressRegimeIntensity: 0.25, structuralPd: 0.004, label: "Synthetic or yield-bearing stablecoin" },
  major: { family: "eth", structuralShock: 0.5, volFloor: 0.005, volPrior: 0.01, jumpIntensity: 0.05, jumpMean: -0.02, jumpSd: 0.02, stressRegimeIntensity: 0.05, structuralPd: 0.0002, label: "Major (ETH, BTC)" },
  lst: { family: "eth", structuralShock: 0.25, volFloor: 0.03, volPrior: 0.05, jumpIntensity: 0.6, jumpMean: -0.04, jumpSd: 0.04, stressRegimeIntensity: 0.3, structuralPd: 0.002, label: "Liquid staking token vs underlying" },
  lrt: { family: "eth", structuralShock: 0.35, volFloor: 0.05, volPrior: 0.08, jumpIntensity: 0.9, jumpMean: -0.06, jumpSd: 0.06, stressRegimeIntensity: 0.35, structuralPd: 0.006, label: "Liquid restaking token vs underlying" },
  "wrapped-btc": { family: "btc", structuralShock: 0.4, volFloor: 0.02, volPrior: 0.03, jumpIntensity: 0.4, jumpMean: -0.04, jumpSd: 0.05, stressRegimeIntensity: 0.25, structuralPd: 0.003, label: "Wrapped BTC vs BTC" },
  "principal-token": { family: "pt", structuralShock: 0.3, volFloor: 0.04, volPrior: 0.07, jumpIntensity: 0.8, jumpMean: -0.05, jumpSd: 0.05, stressRegimeIntensity: 0.3, structuralPd: 0.003, label: "Pendle principal token vs underlying" },
  alt: { family: "alt", structuralShock: 0.9, volFloor: 0.5, volPrior: 0.8, jumpIntensity: 1.5, jumpMean: -0.12, jumpSd: 0.1, stressRegimeIntensity: 0.3, structuralPd: 0.01, label: "Long-tail asset" },
  unknown: { family: "alt", structuralShock: 1.0, volFloor: 0.6, volPrior: 0.9, jumpIntensity: 1.5, jumpMean: -0.12, jumpSd: 0.1, stressRegimeIntensity: 0.3, structuralPd: 0.02, label: "Unclassified asset" },
};

const STABLE_FIAT = /^(usdc|usdt|usds|dai|pyusd|usdg|rlusd|fdusd|gho|usdp|tusd|eurc|eurcv|eure|lusd|usd0|usdx|usdb|usd1|usdl|usdy|usdm|ausd|ausdc|ausdt|usda|usdd|busd)$/i;
const STABLE_SYNTH = /^(usde|susde|sdai|susds|crvusd|frax|frxusd|usr|usrs|deusd|sdeusd|susdx|syrupusdc|syrupusdt|usd3|ezusd|rusd|mkusd|dola|ebusd|susd|wusdm|mhyper|hyusd|sfrxusd|lvlusd|slvlusd|usdtb|wstusr|thusd|usual|usd\+|csusdl|susda|avusd|savusd|scrvusd|cusdo|usdo|usdai|fxusd|reusd|usdh|feusd|usd\*|ousd)$/i;
const MAJOR = /^(eth|weth|btc|hype|whype|sol|bnb|wbnb)$/i;
const BTC_MAJOR = /^btc$/i;
const LST = /^(steth|wsteth|reth|cbeth|meth|oseth|sfrxeth|frxeth|ankreth|sweth|lseth|ethx|stbnb|slisbnb|jitosol|msol|bsol|sthype|wsthype|khype|mhype|hbhype|lhype|kinhype|rsweth|stone|yneth)$/i;
const LRT = /^(ezeth|weeth|eeth|rseth|pufeth|pzeth|uniethh?|ynetx|agETH|ageth|rswETH|bedrock|lbtc|solvbtc|ebtc|unibtc|pumpbtc|ynbtc|enzobtc|xsolvbtc|swbtc)$/i;
const WBTC = /^(wbtc|cbbtc|tbtc|fbtc|btcb|ubtc|kbtc|sbtc)$/i;

/** Classify a collateral symbol into an archetype. Case-insensitive, conservative by default. */
export function classifyAsset(symbol: string | null | undefined, hints?: { assetGroup?: string | null; marketType?: string | null; provider?: string | null }): Archetype {
  const s = (symbol ?? "").trim();
  const group = (hints?.assetGroup ?? "").toLowerCase();
  if (hints?.provider === "pendle" || /^pt[-_ ]/i.test(s) || /principal/i.test(hints?.marketType ?? "")) return "principal-token";
  if (!s) return group.startsWith("usd") ? "stable-fiat" : "unknown";
  if (STABLE_FIAT.test(s)) return "stable-fiat";
  if (STABLE_SYNTH.test(s)) return "stable-synthetic";
  if (WBTC.test(s)) return "wrapped-btc";
  if (LRT.test(s)) return "lrt";
  if (LST.test(s)) return "lst";
  if (BTC_MAJOR.test(s)) return "wrapped-btc";
  if (MAJOR.test(s)) return "major";
  if (/usd|eur|gbp/i.test(s) || group.startsWith("usd") || group.startsWith("eur")) return "stable-synthetic";
  return "alt";
}

/** Annualized volatility between family anchors (USD-denominated stable anchor has zero own vol). */
export const FAMILY_ANCHOR_VOL: Record<Family, number> = { stable: 0, eth: 0.65, btc: 0.55, alt: 0.6, pt: 0 };
/** Cross-family ratio volatility when both legs move: correlated majors move less against each other than against USD. */
export function familyPairVol(a: Family, b: Family): number {
  if (a === b) return 0;
  const set = new Set([a, b]);
  if (set.has("eth") && set.has("btc")) return 0.45;
  if (set.has("stable") || set.has("pt")) return Math.max(FAMILY_ANCHOR_VOL[a], FAMILY_ANCHOR_VOL[b]);
  return Math.sqrt(FAMILY_ANCHOR_VOL[a] ** 2 + FAMILY_ANCHOR_VOL[b] ** 2);
}

export interface FamilyJumps { jumpIntensity: number; jumpMean: number; jumpSd: number; stressIntensity: number }
/** Jump and stress structure of each family anchor versus USD. Applied only when the two legs are in different families. */
export const FAMILY_JUMPS: Record<Family, FamilyJumps> = {
  stable: { jumpIntensity: 0, jumpMean: 0, jumpSd: 0, stressIntensity: 0 },
  pt: { jumpIntensity: 0, jumpMean: 0, jumpSd: 0, stressIntensity: 0 },
  eth: { jumpIntensity: 1.2, jumpMean: -0.08, jumpSd: 0.06, stressIntensity: 0.4 },
  btc: { jumpIntensity: 1.0, jumpMean: -0.07, jumpSd: 0.06, stressIntensity: 0.35 },
  alt: { jumpIntensity: 2.0, jumpMean: -0.15, jumpSd: 0.12, stressIntensity: 0.6 },
};
export function familyPairJumps(a: Family, b: Family): FamilyJumps {
  if (a === b) return FAMILY_JUMPS.stable;
  const x = FAMILY_JUMPS[a], y = FAMILY_JUMPS[b];
  return { jumpIntensity: Math.max(x.jumpIntensity, y.jumpIntensity), jumpMean: Math.min(x.jumpMean, y.jumpMean), jumpSd: Math.max(x.jumpSd, y.jumpSd), stressIntensity: Math.max(x.stressIntensity, y.stressIntensity) };
}

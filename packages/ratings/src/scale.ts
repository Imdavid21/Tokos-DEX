/**
 * Indenture rating scale. Grades are bands on the annual Probability of Significant Loss (PSL),
 * the probability that a supplier loses more than LOSS_THRESHOLD of principal within one year.
 * Band edges are published and versioned; a change in edges is a methodology version change.
 */
export const METHODOLOGY_VERSION = "indenture-psl-v1";
export const LOSS_THRESHOLD = 0.01;
export const HORIZON_DAYS = 365;

export type Grade = "AAA" | "AA" | "A" | "BBB" | "BB" | "B" | "CCC" | "CC" | "C" | "D" | "NR";
export type Outlook = "stable" | "positive" | "negative" | "watch";

export const GRADES: readonly Grade[] = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "CC", "C", "D"];

/** Upper PSL bound (exclusive) for each grade, in order. D is everything above the C band. */
export const BANDS: ReadonlyArray<{ grade: Grade; maxPsl: number; label: string }> = [
  { grade: "AAA", maxPsl: 0.001, label: "Cash-like" },
  { grade: "AA", maxPsl: 0.004, label: "Prime" },
  { grade: "A", maxPsl: 0.008, label: "Strong" },
  { grade: "BBB", maxPsl: 0.015, label: "Adequate" },
  { grade: "BB", maxPsl: 0.03, label: "Elevated" },
  { grade: "B", maxPsl: 0.06, label: "Speculative" },
  { grade: "CCC", maxPsl: 0.12, label: "High" },
  { grade: "CC", maxPsl: 0.32, label: "Very high" },
  { grade: "C", maxPsl: 0.999, label: "Distressed" },
  { grade: "D", maxPsl: Infinity, label: "Impaired" },
];

export const INVESTMENT_GRADE: readonly Grade[] = ["AAA", "AA", "A", "BBB"];

export function gradeForPsl(psl: number): Grade {
  if (!Number.isFinite(psl) || psl < 0) return "NR";
  for (const band of BANDS) if (psl < band.maxPsl) return band.grade;
  return "D";
}

export function gradeRank(grade: Grade): number {
  const i = GRADES.indexOf(grade);
  return i < 0 ? GRADES.length : i;
}

/** Positive numbers mean the second grade is stronger (fewer notches of risk). */
export function notchDelta(from: Grade, to: Grade): number {
  if (from === "NR" || to === "NR") return 0;
  return gradeRank(from) - gradeRank(to);
}

export function bandFor(grade: Grade) {
  const i = BANDS.findIndex((b) => b.grade === grade);
  if (i < 0) return null;
  const lower = i === 0 ? 0 : BANDS[i - 1]!.maxPsl;
  return { grade, lowerPsl: lower, upperPsl: BANDS[i]!.maxPsl, label: BANDS[i]!.label };
}

import type { Company, Dataset, PillarId, Weights } from "../types";

export const DEFAULT_WEIGHTS: Weights = {
  environmental: 25,
  social: 25,
  economic: 25,
  governance: 25,
};

export const PILLAR_ORDER: PillarId[] = [
  "environmental",
  "social",
  "economic",
  "governance",
];

export function normalizeWeights(weights: Weights): Weights {
  const total = PILLAR_ORDER.reduce((sum, id) => sum + Math.max(0, weights[id]), 0);
  if (total <= 0) return { ...DEFAULT_WEIGHTS };
  return {
    environmental: (Math.max(0, weights.environmental) / total) * 100,
    social: (Math.max(0, weights.social) / total) * 100,
    economic: (Math.max(0, weights.economic) / total) * 100,
    governance: (Math.max(0, weights.governance) / total) * 100,
  };
}

export function setWeight(weights: Weights, key: PillarId, value: number): Weights {
  const next = { ...weights, [key]: Math.max(0, Math.min(100, value)) };
  const others = PILLAR_ORDER.filter((id) => id !== key);
  const remaining = 100 - next[key];
  const otherSum = others.reduce((sum, id) => sum + weights[id], 0);
  if (otherSum <= 0) {
    const share = remaining / others.length;
    others.forEach((id) => {
      next[id] = share;
    });
  } else {
    others.forEach((id) => {
      next[id] = (weights[id] / otherSum) * remaining;
    });
  }
  return next;
}

export function weightedScore(company: Company, weights: Weights): number {
  const w = normalizeWeights(weights);
  const total =
    (company.pillars.environmental.score * w.environmental +
      company.pillars.social.score * w.social +
      company.pillars.economic.score * w.economic +
      company.pillars.governance.score * w.governance) /
    100;
  return Math.round(total);
}

export function withScores(dataset: Dataset, weights: Weights): Company[] {
  return dataset.companies
    .map((company) => ({
      ...company,
      equalWeightScore: weightedScore(company, weights),
    }))
    .sort((a, b) => b.equalWeightScore - a.equalWeightScore || a.name.localeCompare(b.name))
    .map((company, index) => ({ ...company, rank: index + 1 }));
}

export function gradeFromScore(score: number): string {
  if (score >= 80) return "Leading";
  if (score >= 65) return "Strong";
  if (score >= 50) return "Typical";
  if (score >= 35) return "Behind";
  return "At risk";
}

export function vsTypical(score: number): string {
  const delta = score - 50;
  if (Math.abs(delta) < 4) return "About even with a typical peer";
  if (delta > 0) return `${delta} points ahead of a typical peer`;
  return `${Math.abs(delta)} points behind a typical peer`;
}

export function gapTone(gap: number): "good" | "mid" | "warn" {
  if (gap <= -0.4) return "good";
  if (gap >= 0.75) return "warn";
  return "mid";
}

export const HIGH_CARBON_SECTORS = new Set([
  "Energy",
  "Materials",
  "Utilities",
  "Industrials",
]);

export const ENABLER_INDUSTRY = /semiconductor|electrical|renewable|battery|industrial machinery|electronic|construction|building products|utilities/i;

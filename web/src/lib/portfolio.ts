import type { Company, Dataset } from "../types";
import { ENABLER_INDUSTRY, HIGH_CARBON_SECTORS } from "./scoring";

export const MONEY = 1_000_000_000;

export type Holding = {
  ticker: string;
  name: string;
  sector: string;
  amount: number;
  weight: number;
  sleeve: string;
  why: string;
};

export type Goal = "proof" | "jobs" | "stability" | "cleanEnergy";
export type Heavy = "transitioners" | "exclude" | "large";
export type Care = "saydo" | "social" | "diversify";

export type PortfolioPrefs = {
  focus: string;
  industry: string;
  goal: Goal;
  heavy: Heavy;
  nameCap: number;
  care: Care;
};

export const DEFAULT_PREFS: PortfolioPrefs = {
  focus: "all",
  industry: "all",
  goal: "proof",
  heavy: "transitioners",
  nameCap: 0.035,
  care: "saydo",
};

export const GOAL_LABELS: Record<Goal, string> = {
  proof: "cut faster than they talk",
  jobs: "keep people in decent work",
  stability: "stay sturdy enough to pay for the switch",
  cleanEnergy: "lead on clean power",
};

export const HEAVY_LABELS: Record<Heavy, string> = {
  transitioners: "only get money if they are already doing the work",
  exclude: "mostly sit this one out",
  large: "get a large slice of the billion",
};

export const CARE_LABELS: Record<Care, string> = {
  saydo: "punish empty pledges",
  social: "look after workers",
  diversify: "stay spread across many sectors",
};

export const NAME_CAP_OPTIONS = [
  { value: 0.02, label: "2% ($20 million)" },
  { value: 0.035, label: "3.5% ($35 million)" },
  { value: 0.05, label: "5% ($50 million)" },
];

function fitScore(company: Company, prefs: PortfolioPrefs): number {
  let score = company.netZeroFitness;
  if (prefs.goal === "proof") score += company.doScore * 0.45 - Math.max(0, company.sayDoGap) * 10;
  if (prefs.goal === "jobs") {
    score += company.pillars.social.score * 0.45 + (company.factors.jobWageImpact?.score ?? 50) * 0.25;
  }
  if (prefs.goal === "stability") score += company.pillars.economic.score * 0.5;
  if (prefs.goal === "cleanEnergy") score += (company.factors.cleanEnergy?.score ?? 50) * 0.55;
  if (prefs.care === "saydo") score -= Math.max(0, company.sayDoGap) * 12;
  if (prefs.care === "social") score += company.pillars.social.score * 0.3;
  return score;
}

function inFocus(company: Company, prefs: PortfolioPrefs): boolean {
  if (prefs.focus !== "all" && company.sector !== prefs.focus) return false;
  if (prefs.industry !== "all" && company.industry !== prefs.industry) return false;
  return true;
}

export function allocateNetZero(dataset: Dataset, prefs: PortfolioPrefs = DEFAULT_PREFS): Holding[] {
  const eligible = dataset.companies.filter((c) => c.passages > 0 && c.completeness >= 0.3);
  const ranked = [...eligible].sort((a, b) => fitScore(b, prefs) - fitScore(a, prefs));

  const focusPool = ranked.filter((c) => inFocus(c, prefs));
  const leaders = ranked.filter((c) => c.sayDoGap < 1.05).slice(0, 36);
  const transition = ranked
    .filter((c) => HIGH_CARBON_SECTORS.has(c.sector) && c.doScore >= 48 && c.sayDoGap < 1)
    .slice(0, 28);
  const enablers = ranked
    .filter((c) => ENABLER_INDUSTRY.test(c.industry) || (c.factors.cleanEnergy?.score ?? 0) >= 68)
    .slice(0, 22);
  const resilience = [...eligible]
    .sort(
      (a, b) =>
        b.pillars.economic.score + b.pillars.governance.score - (a.pillars.economic.score + a.pillars.governance.score),
    )
    .slice(0, 16);

  const hasFocus = prefs.focus !== "all" || prefs.industry !== "all";
  let shares = {
    focus: hasFocus ? 0.34 : 0,
    leaders: hasFocus ? 0.26 : 0.4,
    transition: prefs.heavy === "large" ? 0.32 : prefs.heavy === "exclude" ? 0.06 : 0.22,
    enablers: 0.18,
    resilience: 0.1,
  };
  if (prefs.heavy === "exclude") shares.leaders += 0.08;
  if (prefs.care === "social") {
    shares.resilience += 0.04;
    shares.enablers -= 0.04;
  }
  const shareTotal = Object.values(shares).reduce((s, n) => s + n, 0);
  (Object.keys(shares) as (keyof typeof shares)[]).forEach((k) => {
    shares[k] = shares[k] / shareTotal;
  });

  const sectorCap = prefs.care === "diversify" ? 0.14 : hasFocus ? 0.42 : 0.18;
  const focusCap = hasFocus ? 0.45 : sectorCap;

  const sleeves: { name: string; share: number; pool: Company[]; why: (c: Company) => string }[] = [
    {
      name: hasFocus ? `${prefs.industry !== "all" ? prefs.industry : prefs.focus}` : "Your focus",
      share: shares.focus,
      pool: focusPool,
      why: (c: Company) =>
        `You asked for this corner of the market. Fit ${Math.round(fitScore(c, prefs))} — ${c.sayDoLabel.toLowerCase()}.`,
    },
    {
      name: "Climate leaders",
      share: shares.leaders,
      pool: leaders,
      why: (c: Company) => `Already strong on follow-through (net-zero fit ${c.netZeroFitness}).`,
    },
    {
      name: "Transition doers",
      share: shares.transition,
      pool: transition,
      why: (c: Company) => `Heavy industry that shows more proof than most peers (do score ${c.doScore}).`,
    },
    {
      name: "Enablers",
      share: shares.enablers,
      pool: enablers,
      why: (c: Company) => `Helps everyone else switch — ${c.industry.toLowerCase()}.`,
    },
    {
      name: "Resilience buffer",
      share: shares.resilience,
      pool: resilience,
      why: (c: Company) => `Sturdy enough to keep funding the work (money ${c.pillars.economic.score}, trust ${c.pillars.governance.score}).`,
    },
  ].filter((s) => s.share >= 0.04 && s.pool.length);

  const picked = new Map<string, Holding>();
  const sectorUsed: Record<string, number> = {};

  const tryAdd = (company: Company, sleeve: string, budget: number, why: string) => {
    if (picked.has(company.ticker)) return 0;
    const used = sectorUsed[company.sector] ?? 0;
    const thisCap = inFocus(company, prefs) && hasFocus ? focusCap : sectorCap;
    const room = Math.min(prefs.nameCap * MONEY, thisCap * MONEY - used, budget);
    if (room < MONEY * 0.008) return 0;
    const amount = Math.round(room / 1_000_000) * 1_000_000;
    if (amount <= 0) return 0;
    picked.set(company.ticker, {
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      amount,
      weight: amount / MONEY,
      sleeve,
      why,
    });
    sectorUsed[company.sector] = used + amount;
    return amount;
  };

  for (const sleeve of sleeves) {
    let budget = sleeve.share * MONEY;
    for (const company of sleeve.pool) {
      if (budget < MONEY * 0.008) break;
      budget -= tryAdd(company, sleeve.name, budget, sleeve.why(company));
    }
  }

  const holdings = [...picked.values()].sort((a, b) => b.amount - a.amount);
  let leftover = MONEY - holdings.reduce((sum, h) => sum + h.amount, 0);
  for (let i = 0; i < holdings.length && leftover > 0; i++) {
    const room = Math.round((prefs.nameCap * MONEY - holdings[i].amount) / 1_000_000) * 1_000_000;
    const add = Math.min(leftover, Math.max(0, room));
    if (!add) continue;
    holdings[i] = { ...holdings[i], amount: holdings[i].amount + add };
    leftover -= add;
  }
  if (leftover > 0 && holdings.length) {
    holdings[0] = { ...holdings[0], amount: holdings[0].amount + leftover };
  }
  return holdings.map((h) => ({ ...h, weight: h.amount / MONEY }));
}

export function sleeveTotals(holdings: Holding[]): { name: string; amount: number }[] {
  const map: Record<string, number> = {};
  for (const h of holdings) map[h.sleeve] = (map[h.sleeve] ?? 0) + h.amount;
  return Object.entries(map)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function sectorTotals(holdings: Holding[]): { name: string; amount: number }[] {
  const map: Record<string, number> = {};
  for (const h of holdings) map[h.sector] = (map[h.sector] ?? 0) + h.amount;
  return Object.entries(map)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function dollars(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  return `$${Math.round(n / 1_000_000)}M`;
}

export function focusLabel(prefs: PortfolioPrefs): string {
  if (prefs.industry !== "all") return prefs.industry;
  if (prefs.focus !== "all") return prefs.focus;
  return "the whole S&P 500";
}

export function recommendLines(prefs: PortfolioPrefs, holdings: Holding[]): string[] {
  const sleeves = sleeveTotals(holdings);
  const top = sleeves[0];
  const capPct = Number((prefs.nameCap * 100).toFixed(1)).toString().replace(/\.0$/, "");
  return [
    `You asked ${focusLabel(prefs)} to ${GOAL_LABELS[prefs.goal]}.`,
    `Heavy industry should ${HEAVY_LABELS[prefs.heavy]}.`,
    `The fund should ${CARE_LABELS[prefs.care]}, and no single company may take more than ${capPct}% of the billion.`,
    top
      ? `That lands ${holdings.length} names. The largest slice is ${top.name} (${dollars(top.amount)}). This is arithmetic on the Green Liquid scores — not a stock pick.`
      : "No companies cleared the filters. Loosen a dropdown and try again.",
  ];
}

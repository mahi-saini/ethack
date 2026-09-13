import type { Company, Dataset } from "../types";
import { allocateNetZero, dollars, MONEY, type Holding } from "./portfolio";

export type { Holding };

export type AgentReply = {
  title: string;
  body: string;
  holdings?: Holding[];
  companies?: Company[];
};

function findCompanies(dataset: Dataset, text: string): Company[] {
  const low = text.toLowerCase();
  const hits: Company[] = [];
  for (const company of dataset.companies) {
    const ticker = company.ticker.toLowerCase();
    const name = company.name.toLowerCase();
    const token = new RegExp(`\\b${ticker.replace("-", "[-.]")}\\b`, "i");
    if (token.test(low) || low.includes(name)) hits.push(company);
  }
  const unique = new Map(hits.map((c) => [c.ticker, c]));
  return [...unique.values()].slice(0, 6);
}

function describePortfolio(holdings: Holding[]): string {
  const bySleeve: Record<string, number> = {};
  const bySector: Record<string, number> = {};
  for (const h of holdings) {
    bySleeve[h.sleeve] = (bySleeve[h.sleeve] ?? 0) + h.amount;
    bySector[h.sector] = (bySector[h.sector] ?? 0) + h.amount;
  }
  const sleeveLines = Object.entries(bySleeve)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amt]) => `• ${name}: ${dollars(amt)}`)
    .join("\n");
  const sectorLines = Object.entries(bySector)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, amt]) => `• ${name}: ${dollars(amt)} (${Math.round((amt / MONEY) * 100)}%)`)
    .join("\n");
  return [
    "If the world commits to net-zero tomorrow, this is arithmetic on the Green Liquid scores — not a stock pick, not a forecast.",
    "We would pay for proof, for companies that can afford the work, and for the businesses that help everyone else switch.",
    "",
    `A $1 billion fund, ${holdings.length} companies, no single name above 3.5%, no sector above 18%.`,
    "",
    "How the billion is split:",
    sleeveLines,
    "",
    "Largest sector weights:",
    sectorLines,
    "",
    "We keep a slice in heavier industries on purpose. A just transition still needs steel, power, and freight — but only from the names whose filings show they are already doing the work, not just promising it.",
    "",
    "To change the split, open the Net-zero page and finish the sentences with the dropdowns.",
  ].join("\n");
}

function strategyFor(company: Company, dataset: Dataset): string {
  const peers = dataset.companies
    .filter((c) => c.sector === company.sector && c.ticker !== company.ticker)
    .sort((a, b) => b.equalWeightScore - a.equalWeightScore);
  const leader = peers[0];
  const weakest = Object.entries(company.factors)
    .sort((a, b) => a[1].score - b[1].score)
    .slice(0, 3);
  const gapAdvice =
    company.sayDoGap >= 0.75
      ? "The clearest red flag is the say-do gap: the filing promises more than it proves. Publish last year's cuts in plain numbers before announcing a new 2050 target."
      : company.sayDoGap <= -0.5
        ? "They already show more proof than talk. The next move is to lock that proof into pay, so leadership cannot quietly reverse it."
        : "Promises and proof are roughly in balance. The work now is to close the distance to the sector's ideal company.";

  const missing = Object.entries(company.factors)
    .filter(([, v]) => v.missing)
    .map(([k]) => k);

  return [
    `${company.name} sits ${company.distanceToIdeal} points away from the ideal ${company.sector.toLowerCase()} company.`,
    gapAdvice,
    leader
      ? `In the same industry, ${leader.name} currently sets a higher bar (${leader.equalWeightScore} vs ${company.equalWeightScore}).`
      : "",
    "Three weakest spots to fix first:",
    ...weakest.map(
      ([id, pack], i) =>
        `${i + 1}. ${id.replace(/[A-Z]/g, (m) => " " + m).replace(/^./, (m) => m.toUpperCase())} — score ${pack.score}${pack.missing ? " (they were silent, so we treated that as a risk)" : ""}.`,
    ),
    missing.length
      ? `They are silent on: ${missing.slice(0, 5).join(", ")}. In Green Liquid, silence pulls a score down. Starting there is often the cheapest real improvement.`
      : "Disclosure is relatively complete, so the next gains have to come from real-world change, not better wording.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function answer(dataset: Dataset, input: string): AgentReply {
  const text = input.trim();
  const lower = text.toLowerCase();
  const named = findCompanies(dataset, text);

  const wantsPortfolio =
    /net[- ]zero|1 billion|billion|allocate|portfolio|fund|invest/i.test(lower);
  const wantsCompare = /compar|versus| vs |against/i.test(lower) && named.length >= 2;
  const wantsStrategy = /should|change|improve|fix|advice|strategy|recommend/i.test(lower);

  if (wantsPortfolio || /bonus|tomorrow the world/i.test(lower)) {
    const holdings = allocateNetZero(dataset);
    return {
      title: "A $1 billion net-zero portfolio",
      body: describePortfolio(holdings),
      holdings,
    };
  }

  if (wantsCompare && named.length >= 2) {
    const [a, b] = named;
    const body = [
      `${a.name} scores ${a.equalWeightScore}. ${b.name} scores ${b.equalWeightScore}.`,
      `Planet: ${a.pillars.environmental.score} vs ${b.pillars.environmental.score}. People: ${a.pillars.social.score} vs ${b.pillars.social.score}.`,
      `Money: ${a.pillars.economic.score} vs ${b.pillars.economic.score}. Trust: ${a.pillars.governance.score} vs ${b.pillars.governance.score}.`,
      `${a.ticker} ${a.sayDoLabel.toLowerCase()}. ${b.ticker} ${b.sayDoLabel.toLowerCase()}.`,
      a.equalWeightScore === b.equalWeightScore
        ? "They are close overall — look at the say-do gap to see who is more believable."
        : `${(a.equalWeightScore > b.equalWeightScore ? a : b).name} is ahead on the balanced Green Liquid score, but weights can change that if you care more about one pillar.`,
    ].join("\n");
    return { title: `${a.ticker} and ${b.ticker}`, body, companies: named.slice(0, 3) };
  }

  if (named.length === 1 && (wantsStrategy || named.length === 1 && text.length < 40)) {
    const company = named[0];
    if (wantsStrategy || /what about|tell me|how is/i.test(lower) || named.length === 1) {
      return {
        title: company.name,
        body: strategyFor(company, dataset),
        companies: [company],
      };
    }
  }

  if (named.length === 1) {
    return {
      title: named[0].name,
      body: strategyFor(named[0], dataset),
      companies: named,
    };
  }

  const sectorHit = dataset.sectors.find((s) => lower.includes(s.sector.toLowerCase()));
  if (sectorHit) {
    const members = dataset.companies
      .filter((c) => c.sector === sectorHit.sector)
      .sort((a, b) => b.equalWeightScore - a.equalWeightScore);
    const walkers = [...members].sort((a, b) => a.sayDoGap - b.sayDoGap).slice(0, 3);
    return {
      title: `${sectorHit.sector} at a glance`,
      body: [
        `${sectorHit.count} S&P 500 companies. Typical Green Liquid score: ${sectorHit.avgScore}.`,
        `Leader right now: ${members[0].name} (${members[0].equalWeightScore}).`,
        "Names that walk closest to their talk:",
        ...walkers.map((c) => `• ${c.name} — ${c.sayDoLabel.toLowerCase()} (score ${c.equalWeightScore})`),
      ].join("\n"),
      companies: members.slice(0, 5),
    };
  }

  return {
    title: "I only calculate what is already here",
    body: [
      "This is a calculator. I will not invent a company, a number, or next year’s price.",
      "Ask in everyday language. I only read the Green Liquid scores.",
      "Try:",
      "• Compare Apple and Microsoft.",
      "• Compare Apple and Microsoft.",
      "• What should Exxon change first?",
      "• Who in Energy is actually walking the talk?",
    ].join("\n"),
  };
}

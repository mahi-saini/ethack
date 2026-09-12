export type PillarId = "environmental" | "social" | "economic" | "governance";

export type FactorScore = {
  raw: number | null;
  hits: number;
  missing: boolean;
  zOverall: number | null;
  zSector: number | null;
  z: number;
  score: number;
};

export type Excerpt = {
  kind: "promise" | "proof" | "risk";
  text: string;
  url: string;
};

export type Company = {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  hq: string;
  cik: string;
  filingDate: string;
  sourceUrl: string;
  passages: number;
  categoryCounts: Record<string, number>;
  sayRaw: number;
  doRaw: number;
  sayShare: number | null;
  sayZ: number;
  doZ: number;
  sayDoGap: number;
  sayScore: number;
  doScore: number;
  sayDoLabel: string;
  completeness: number;
  distanceToIdeal: number;
  equalWeightScore: number;
  netZeroFitness: number;
  rank: number;
  factors: Record<string, FactorScore>;
  pillars: Record<
    PillarId,
    { score: number; z: number; missing: number; factors: number }
  >;
  ideal: Record<string, number>;
  excerpts: Excerpt[];
  overrideFactors: string[];
};

export type FactorMeta = {
  id: string;
  pillar: PillarId;
  label: string;
  plain: string;
  higherIsBetter: boolean;
};

export type Dataset = {
  generatedAt: string;
  universe: string;
  companyCount: number;
  source: {
    disclosures: string;
    constituents: string;
    overrides: boolean;
    note: string;
  };
  pillars: { id: PillarId; label: string; question: string }[];
  factors: FactorMeta[];
  scoring: {
    missingZ: number;
    display: string;
    defaultWeights: Record<PillarId, number>;
    ideal: string;
  };
  sectors: {
    sector: string;
    count: number;
    avgScore: number;
    avgGap: number;
    leader: string;
    ideal: Record<string, number>;
  }[];
  companies: Company[];
};

export type Weights = Record<PillarId, number>;

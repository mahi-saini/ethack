/** Confirmation set — wires plus a few national desks. Used to count agreement, never to score tone. */
export const CONFIRMATION_SOURCES = [
  { id: "ap", label: "AP", match: /associated press|\bap news\b|apnews/i, wire: true },
  { id: "reuters", label: "Reuters", match: /reuters/i, wire: true },
  { id: "pr", label: "PR Newswire", match: /pr newswire|prnewswire/i, wire: true },
  { id: "bw", label: "Business Wire", match: /business wire|businesswire/i, wire: true },
  { id: "bloomberg", label: "Bloomberg", match: /bloomberg/i, wire: false },
  { id: "wsj", label: "WSJ", match: /wall street journal|\bwsj\b/i, wire: false },
  { id: "nyt", label: "NYT", match: /new york times|nytimes/i, wire: false },
  { id: "wapo", label: "WaPo", match: /washington post|washingtonpost/i, wire: false },
  { id: "npr", label: "NPR", match: /\bnpr\b|national public radio/i, wire: false },
  { id: "ft", label: "FT", match: /financial times|\bft\b/i, wire: false },
] as const;

export type NewsItem = {
  title: string;
  url: string;
  date: string;
  sourceLabel: string;
  sourceId: string;
  wire: boolean;
};

export type NewsCluster = {
  title: string;
  url: string;
  date: string;
  kind: string;
  sources: string[];
  confirmed: boolean;
  count: number;
};

const STOP = new Set([
  "about",
  "after",
  "company",
  "could",
  "emissions",
  "from",
  "have",
  "into",
  "says",
  "that",
  "their",
  "this",
  "will",
  "with",
]);

function matchSource(name: string): (typeof CONFIRMATION_SOURCES)[number] | null {
  return CONFIRMATION_SOURCES.find((s) => s.match.test(name)) ?? null;
}

function cleanTitle(title: string): string {
  return title.replace(/\s+-\s+[^-]+$/, "").trim();
}

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP.has(w)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let hit = 0;
  for (const w of a) if (b.has(w)) hit += 1;
  return hit / (a.size + b.size - hit);
}

function kindFromTitle(title: string): string {
  const t = title.toLowerCase();
  if (/fine|penalty|lawsuit|settlement|epa |osha |violation/.test(t)) return "enforcement";
  if (/net[- ]zero|pledge|commit|target|goal/.test(t)) return "pledge";
  if (/strike|union|labor|worker/.test(t)) return "people";
  if (/emissions|carbon|renewable|climate/.test(t)) return "climate";
  return "update";
}

export function searchQuery(name: string, ticker: string): string {
  const short = name
    .replace(/\s*\(.*\)\s*/g, " ")
    .replace(/,?\s+(Inc\.?|Incorporated|Corporation|Corp\.?|Company|Co\.|plc|Ltd\.?|N\.V\.)$/i, "")
    .trim();
  return `(${ticker} OR "${name}" OR "${short} Inc") (sustainability OR climate OR emissions OR "net zero" OR EPA OR OSHA OR "human rights")`;
}

export function parseRss(xml: string): NewsItem[] {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const items = [...doc.querySelectorAll("item")];
  const out: NewsItem[] = [];
  for (const item of items) {
    const rawTitle = item.querySelector("title")?.textContent?.trim() ?? "";
    const sourceName =
      item.querySelector("source")?.textContent?.trim() || rawTitle.split(" - ").slice(-1)[0] || "";
    const matched = matchSource(sourceName);
    if (!matched || !rawTitle) continue;
    out.push({
      title: cleanTitle(rawTitle),
      url: item.querySelector("link")?.textContent?.trim() ?? "",
      date: item.querySelector("pubDate")?.textContent?.trim() ?? "",
      sourceLabel: matched.label,
      sourceId: matched.id,
      wire: matched.wire,
    });
  }
  return out;
}

export function clusterNews(items: NewsItem[]): NewsCluster[] {
  const clusters: { titles: string[]; urls: string[]; dates: string[]; sources: Set<string>; wire: boolean }[] = [];
  for (const item of items) {
    const bag = tokens(item.title);
    const hit = clusters.find((c) => jaccard(bag, tokens(c.titles[0])) >= 0.5);
    if (hit) {
      hit.titles.push(item.title);
      hit.urls.push(item.url);
      hit.dates.push(item.date);
      hit.sources.add(item.sourceLabel);
      hit.wire = hit.wire || item.wire;
    } else {
      clusters.push({
        titles: [item.title],
        urls: [item.url],
        dates: [item.date],
        sources: new Set([item.sourceLabel]),
        wire: item.wire,
      });
    }
  }
  return clusters
    .map((c) => {
      const sources = [...c.sources];
      return {
        title: c.titles[0],
        url: c.urls[0],
        date: c.dates[0],
        kind: kindFromTitle(c.titles[0]),
        sources,
        confirmed: sources.length >= 2 || c.wire,
        count: sources.length,
      };
    })
    .sort((a, b) => Number(b.confirmed) - Number(a.confirmed) || b.count - a.count)
    .slice(0, 8);
}

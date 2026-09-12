import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDataset } from "../dataset";
import { PillarBars, ScoreMark } from "../components/Widgets";
import { gapTone, gradeFromScore, withScores } from "../lib/scoring";
import { sizeRank } from "../lib/sp500Size";

export default function Explore() {
  const { dataset, weights } = useDataset();
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("All");
  const [gapOnly, setGapOnly] = useState(false);
  const [sort, setSort] = useState<"size" | "score">("size");
  const ranked = useMemo(() => withScores(dataset, weights), [dataset, weights]);

  const visible = ranked
    .filter((c) => {
      const query = q.trim().toLowerCase();
      const matchesQuery = !query || c.name.toLowerCase().includes(query) || c.ticker.toLowerCase().includes(query);
      const matchesSector = sector === "All" || c.sector === sector;
      const matchesGap = !gapOnly || c.sayDoGap >= 0.75;
      return matchesQuery && matchesSector && matchesGap;
    })
    .sort((a, b) => {
      if (sort === "score") return a.rank - b.rank;
      return sizeRank(a.ticker) - sizeRank(b.ticker) || a.name.localeCompare(b.name);
    });

  return (
    <div className="page">
      <p className="kicker">🔍 Explore</p>
      <h1>Find a company</h1>
      <p className="lede">
        Biggest S&amp;P names first — Apple, Nvidia, Microsoft — so you land somewhere familiar. Flip to{" "}
        <strong>Green Liquid score</strong> when you want the ranking.
      </p>
      <div className="toolbar">
        <input
          className="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or ticker"
          aria-label="Search companies"
        />
        <select value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Filter by sector">
          <option>All</option>
          {dataset.sectors.map((s) => (
            <option key={s.sector}>{s.sector}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as "size" | "score")} aria-label="Sort companies">
          <option value="size">Biggest in the S&amp;P first</option>
          <option value="score">Green Liquid score</option>
        </select>
        <button className={`chip ${gapOnly ? "on" : ""}`} onClick={() => setGapOnly((v) => !v)}>
          Only the say-do gap
        </button>
      </div>
      <p className="tiny">{visible.length} companies</p>
      <div className="company-grid">
        {visible.slice(0, 60).map((c) => {
          const size = sizeRank(c.ticker);
          return (
          <Link className="card company-card" key={c.ticker} to={`/company/${c.ticker}`}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
              <div>
                <strong>{c.name}</strong>
                <div className="tiny">
                  {c.ticker} · {c.sector}
                  {sort === "size" ? ` · S&P #${size < 999 ? size : "—"}` : ` · score rank ${c.rank}`}
                </div>
              </div>
              <ScoreMark score={c.equalWeightScore} label={gradeFromScore(c.equalWeightScore)} />
            </div>
            <PillarBars company={c} />
            <span className={`pill ${gapTone(c.sayDoGap)}`}>{c.sayDoLabel}</span>
          </Link>
          );
        })}
      </div>
    </div>
  );
}

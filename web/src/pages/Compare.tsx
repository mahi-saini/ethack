import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useDataset } from "../dataset";
import { PILLAR_ORDER, withScores } from "../lib/scoring";

export default function Compare() {
  const { dataset, weights } = useDataset();
  const ranked = useMemo(() => withScores(dataset, weights), [dataset, weights]);
  const [params, setParams] = useSearchParams();
  const initial = [params.get("a"), params.get("b"), params.get("c")].filter(Boolean) as string[];
  const [picks, setPicks] = useState<string[]>(initial.length ? initial : ["AAPL", "XOM", "NEE"]);

  const setPick = (index: number, ticker: string) => {
    const next = [...picks];
    next[index] = ticker;
    setPicks(next);
    const sp = new URLSearchParams();
    next.forEach((t, i) => sp.set(["a", "b", "c"][i], t));
    setParams(sp);
  };

  const chosen = picks.map((t) => ranked.find((c) => c.ticker === t)).filter(Boolean);
  const chart = PILLAR_ORDER.map((id) => {
    const row: Record<string, string | number> = {
      name: id === "environmental" ? "Planet" : id === "social" ? "People" : id === "economic" ? "Money" : "Trust",
    };
    chosen.forEach((c) => {
      if (c) row[c.ticker] = c.pillars[id].score;
    });
    return row;
  });
  const colors = ["#2d4f2b", "#508e57", "#d1a980"];

  return (
    <div className="page">
      <p className="kicker">Compare</p>
      <h1>Put companies next to each other</h1>
      <div className="compare-pick">
        {picks.map((pick, i) => (
          <select key={i} value={pick} onChange={(e) => setPick(i, e.target.value)} aria-label={`Company ${i + 1}`}>
            {ranked.map((c) => (
              <option key={c.ticker} value={c.ticker}>
                {c.name}
              </option>
            ))}
          </select>
        ))}
      </div>
      <div className="card chart-wrap" style={{ marginTop: 16, height: 380 }}>
        <ResponsiveContainer>
          <BarChart data={chart}>
            <CartesianGrid stroke="#d8d1c6" vertical={false} />
            <XAxis dataKey="name" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            {chosen.map((c, i) => (c ? <Bar key={c.ticker} dataKey={c.ticker} fill={colors[i]} radius={[8, 8, 0, 0]} /> : null))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid-3" style={{ marginTop: 16 }}>
        {chosen.map(
          (c) =>
            c && (
              <article className="card" key={c.ticker}>
                <h3>{c.name}</h3>
                <div className="score-lg">{c.equalWeightScore}</div>
                <p>{c.sayDoLabel}</p>
                <p className="tiny">{c.distanceToIdeal} points from the sector ideal</p>
              </article>
            ),
        )}
      </div>
    </div>
  );
}

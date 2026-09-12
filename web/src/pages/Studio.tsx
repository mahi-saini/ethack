import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { useDataset } from "../dataset";
import { withScores } from "../lib/scoring";
import type { Company } from "../types";

const BASE_METRICS: { id: string; label: string; value: (c: Company) => number }[] = [
  { id: "score", label: "Green Liquid score", value: (c) => c.equalWeightScore },
  { id: "planet", label: "Planet", value: (c) => c.pillars.environmental.score },
  { id: "people", label: "People", value: (c) => c.pillars.social.score },
  { id: "money", label: "Money", value: (c) => c.pillars.economic.score },
  { id: "trust", label: "Trust", value: (c) => c.pillars.governance.score },
  { id: "say", label: "They say", value: (c) => c.sayScore },
  { id: "do", label: "They do", value: (c) => c.doScore },
  { id: "gap", label: "Say-do gap", value: (c) => Math.round((c.sayDoGap + 3) * 15) },
  { id: "fit", label: "Net-zero fitness", value: (c) => c.netZeroFitness },
  { id: "ideal", label: "Distance to ideal", value: (c) => c.distanceToIdeal },
];

export default function Studio() {
  const { dataset, weights } = useDataset();
  const ranked = useMemo(() => withScores(dataset, weights), [dataset, weights]);
  const metrics = [
    ...BASE_METRICS,
    ...dataset.factors.map((f) => ({
      id: f.id,
      label: f.label,
      value: (c: Company) => c.factors[f.id].score,
    })),
  ];
  const [x, setX] = useState("say");
  const [y, setY] = useState("do");
  const [sector, setSector] = useState("All");
  const xM = metrics.find((m) => m.id === x) ?? metrics[0];
  const yM = metrics.find((m) => m.id === y) ?? metrics[1];
  const points = ranked
    .filter((c) => sector === "All" || c.sector === sector)
    .map((c) => ({
      x: xM.value(c),
      y: yM.value(c),
      z: Math.max(40, c.completeness * 120),
      name: c.name,
      ticker: c.ticker,
    }));

  return (
    <div className="page">
      <p className="kicker">Chart studio</p>
      <h1>Make the picture yourself</h1>
      <p className="lede">Pick two things to compare. The default view is the say-do gap: talk on one side, proof on the other.</p>
      <div className="toolbar">
        <label>
          Across
          <select className="field" value={x} onChange={(e) => setX(e.target.value)}>
            {metrics.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Up
          <select className="field" value={y} onChange={(e) => setY(e.target.value)}>
            {metrics.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <select value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Sector">
          <option>All</option>
          {dataset.sectors.map((s) => (
            <option key={s.sector}>{s.sector}</option>
          ))}
        </select>
      </div>
      <div className="card chart-wrap" style={{ height: 460 }}>
        <ResponsiveContainer>
          <ScatterChart>
            <CartesianGrid stroke="#d8d1c6" />
            <XAxis type="number" dataKey="x" name={xM.label} />
            <YAxis type="number" dataKey="y" name={yM.label} />
            <ZAxis dataKey="z" range={[40, 160]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ payload }) => {
                const row = payload?.[0]?.payload as { name?: string; ticker?: string; x?: number; y?: number } | undefined;
                if (!row?.name) return null;
                return (
                  <div className="card" style={{ padding: 10 }}>
                    <strong>{row.name}</strong>
                    <div className="tiny">{row.ticker}</div>
                    <div className="tiny">
                      {xM.label}: {row.x} · {yM.label}: {row.y}
                    </div>
                  </div>
                );
              }}
            />
            <Scatter data={points} fill="#508e57" fillOpacity={0.7} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      {x === "say" && y === "do" ? (
        <p className="tiny" style={{ marginTop: 10 }}>
          Upper-left: they do more than they promise. Lower-right: they promise more than they prove.
        </p>
      ) : null}
    </div>
  );
}

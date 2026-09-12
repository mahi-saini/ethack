import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDataset } from "../dataset";
import { WeightMixer } from "../components/Widgets";
import { gradeFromScore, withScores } from "../lib/scoring";

export default function Rankings() {
  const { dataset, weights, setWeights } = useDataset();
  const [sector, setSector] = useState("All");
  const navigate = useNavigate();
  const ranked = useMemo(() => withScores(dataset, weights), [dataset, weights]);
  const rows = ranked.filter((c) => sector === "All" || c.sector === sector);

  return (
    <div className="page">
      <p className="kicker">Rankings</p>
      <h1>Turn the dials. Watch the list move.</h1>
      <p className="lede">A pension fund, a climate campaigner, and a worker may not value the same things. The ranking should be allowed to change with them.</p>
      <WeightMixer weights={weights} onChange={setWeights} />
      <div className="toolbar">
        <select value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Sector">
          <option>All</option>
          {dataset.sectors.map((s) => (
            <option key={s.sector}>{s.sector}</option>
          ))}
        </select>
      </div>
      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Company</th>
              <th>Sector</th>
              <th>Score</th>
              <th>Planet</th>
              <th>People</th>
              <th>Money</th>
              <th>Trust</th>
              <th>Say-do</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 80).map((c, i) => (
              <tr className="clickable" key={c.ticker} onClick={() => navigate(`/company/${c.ticker}`)}>
                <td>{i + 1}</td>
                <td>
                  {c.name}
                  <div className="tiny">{c.ticker}</div>
                </td>
                <td>{c.sector}</td>
                <td>
                  <strong>{c.equalWeightScore}</strong>
                  <div className="tiny">{gradeFromScore(c.equalWeightScore)}</div>
                </td>
                <td>{c.pillars.environmental.score}</td>
                <td>{c.pillars.social.score}</td>
                <td>{c.pillars.economic.score}</td>
                <td>{c.pillars.governance.score}</td>
                <td>{c.sayDoLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

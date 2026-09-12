import { Link, useParams } from "react-router-dom";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { useDataset } from "../dataset";
import { PillarBars, ScoreMark } from "../components/Widgets";
import RecentSignals from "../components/RecentSignals";
import { gapTone, gradeFromScore, vsTypical, withScores } from "../lib/scoring";

export default function CompanyPage() {
  const { ticker } = useParams();
  const { dataset, weights } = useDataset();
  const ranked = withScores(dataset, weights);
  const company = ranked.find((c) => c.ticker === ticker);
  if (!company) {
    return (
      <div className="page">
        <h1>We could not find that company.</h1>
        <Link to="/explore">Back to explore</Link>
      </div>
    );
  }
  const factorMeta = dataset.factors;
  const radar = dataset.pillars.map((p) => {
    const fids = dataset.factors.filter((f) => f.pillar === p.id).map((f) => f.id);
    const ideal = Math.round(fids.reduce((sum, id) => sum + company.ideal[id], 0) / fids.length);
    return {
      name: p.id === "environmental" ? "Planet" : p.id === "social" ? "People" : p.id === "economic" ? "Money" : "Trust",
      company: company.pillars[p.id].score,
      ideal,
    };
  });
  const peers = ranked.filter((c) => c.sector === company.sector).slice(0, 5);

  return (
    <div className="page">
      <p className="kicker">
        {company.ticker} · {company.sector} · {company.industry}
      </p>
      <div className="hero">
        <div>
          <h1>{company.name}</h1>
          <p className="lede">{vsTypical(company.equalWeightScore)}. Compared with the ideal company in {company.sector.toLowerCase()}, they sit {company.distanceToIdeal.toFixed(1)} points away.</p>
          <div className="btn-row">
            <Link className="btn ghost" to={`/compare?a=${company.ticker}`}>
              Compare
            </Link>
            <Link className="btn ghost" to={`/advisor?q=${encodeURIComponent("What should " + company.name + " change first?")}`}>
              Ask the calculator
            </Link>
          </div>
        </div>
        <div className="card">
          <ScoreMark score={company.equalWeightScore} label={gradeFromScore(company.equalWeightScore)} />
          <p className="tiny">Your mix of planet / people / money / trust</p>
          <span className={`pill ${gapTone(company.sayDoGap)}`}>{company.sayDoLabel}</span>
          <div style={{ marginTop: 14 }}>
            <PillarBars company={company} />
          </div>
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <h3>Against the sector's ideal</h3>
          <p className="tiny">The dotted company is not real. It is the 90th-percentile score on each factor in {company.sector}.</p>
          <div className="radar-wrap">
            <ResponsiveContainer>
              <RadarChart data={radar}>
                <PolarGrid stroke="#c8c2b6" />
                <PolarAngleAxis dataKey="name" tick={{ fontSize: 13, fill: "#2d4f2b" }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="ideal" stroke="#d1a980" fill="#d1a980" fillOpacity={0.18} name="Ideal" />
                <Radar dataKey="company" stroke="#2d4f2b" fill="#508e57" fillOpacity={0.35} name={company.ticker} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card">
          <h3>Promise versus proof</h3>
          <p>
            Say score {company.sayScore}. Do score {company.doScore}. Gap {company.sayDoGap > 0 ? "+" : ""}
            {company.sayDoGap.toFixed(2)}.
          </p>
          <div className="bars" style={{ marginTop: 16 }}>
            <div className="bar-row">
              <span>They say</span>
              <div className="track">
                <div className="fill" style={{ width: `${company.sayScore}%`, background: "#d1a980" }} />
              </div>
              <span>{company.sayScore}</span>
            </div>
            <div className="bar-row">
              <span>They do</span>
              <div className="track">
                <div className="fill" style={{ width: `${company.doScore}%` }} />
              </div>
              <span>{company.doScore}</span>
            </div>
          </div>
          <p className="tiny" style={{ marginTop: 12 }}>
            Data completeness {Math.round(company.completeness * 100)}%. Missing answers are scored as a risk.
          </p>
        </section>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <h3>Every factor, in plain words</h3>
        <table>
          <thead>
            <tr>
              <th>Factor</th>
              <th>What it means</th>
              <th>Score</th>
              <th>Vs ideal</th>
            </tr>
          </thead>
          <tbody>
            {factorMeta.map((f) => {
              const pack = company.factors[f.id];
              return (
                <tr key={f.id}>
                  <td>
                    {f.label}
                    {pack.missing ? <div className="tiny">Silent in the filing</div> : null}
                  </td>
                  <td>{f.plain}</td>
                  <td>{pack.score}</td>
                  <td>{pack.score - company.ideal[f.id]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {company.excerpts.length ? (
        <section style={{ marginTop: 16 }}>
          <h3>In their own words</h3>
          <div className="grid-3" style={{ marginTop: 12 }}>
            {company.excerpts.map((ex) => (
              <article className="card" key={ex.kind}>
                <p className="kicker">{ex.kind}</p>
                <p>{ex.text}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <RecentSignals name={company.name} ticker={company.ticker} />

      <section style={{ marginTop: 22 }}>
        <h3>Others in {company.sector}</h3>
        <div className="company-grid" style={{ marginTop: 12 }}>
          {peers.map((p) => (
            <Link className="card company-card" key={p.ticker} to={`/company/${p.ticker}`}>
              <strong>{p.name}</strong>
              <div className="score-lg">{p.equalWeightScore}</div>
              <span className="tiny">{p.sayDoLabel}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

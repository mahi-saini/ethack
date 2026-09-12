import { Link } from "react-router-dom";
import { useDataset } from "../dataset";
import { WeightMixer } from "../components/Widgets";
import { withScores } from "../lib/scoring";

export default function Home() {
  const { dataset, weights, setWeights } = useDataset();
  const ranked = withScores(dataset, weights);
  const bySector = new Map<string, (typeof ranked)[number]>();
  for (const company of ranked) {
    if (!bySector.has(company.sector)) bySector.set(company.sector, company);
  }
  return (
    <div className="page">
      <section className="hero">
        <div>
          <p className="kicker">A score anyone can read</p>
          <h1>How carefully does a company take care of the world it lives in?</h1>
          <p className="lede">
            Green Liquid looks at every company in the S&P 500 through four everyday questions — planet, people, money,
            and trust. No jargon wall. No black box.
          </p>
          <div className="btn-row">
            <Link className="btn" to="/explore">
              Explore companies
            </Link>
            <Link className="btn ghost" to="/advisor">
              Ask the advisor
            </Link>
          </div>
        </div>
        <div className="card">
          <img className="method-mark" src="/green_liquid_logo.png" alt="" style={{ width: 72, height: 72, marginBottom: 8 }} />
          <p className="kicker">Right now</p>
          <div className="score-lg">{dataset.companyCount}</div>
          <p>companies scored from public filings. 50 is a typical company in its own industry. Higher means ahead of peers.</p>
        </div>
      </section>

      <div className="grid-4">
        {dataset.pillars.map((pillar) => (
          <article className="card" key={pillar.id}>
            <p className="kicker">{pillar.label}</p>
            <h3>{pillar.question}</h3>
          </article>
        ))}
      </div>

      <div className="grid-2" style={{ marginTop: 22 }}>
        <article className="card">
          <h3>We watch the gap between saying and doing</h3>
          <p>
            A net-zero pledge in a filing is not the same as cutting emissions. Green Liquid reads both the promise and
            the proof, then flags companies that talk a lot louder than they act.
          </p>
        </article>
        <article className="card">
          <h3>Silence counts against you</h3>
          <p>
            If a company does not disclose something that peers do, we do not give them the benefit of the doubt. Missing
            data pulls the score down. Transparency is part of the job.
          </p>
        </article>
      </div>

      <div style={{ marginTop: 22 }}>
        <WeightMixer weights={weights} onChange={setWeights} />
      </div>

      <section style={{ marginTop: 28 }}>
        <p className="kicker">By sector</p>
        <h2>Each industry has its own ideal company</h2>
        <p className="tiny">Turn the dials above, then look at who leads each industry. A steel mill is not scored as if it were a software firm.</p>
        <div className="company-grid" style={{ marginTop: 14 }}>
          {dataset.sectors.map((s) => {
            const leader = bySector.get(s.sector);
            return (
              <Link className="card company-card" key={s.sector} to={leader ? `/company/${leader.ticker}` : "/explore"}>
                <p className="kicker">{s.sector}</p>
                <strong>{leader?.name ?? s.sector}</strong>
                <div className="tiny">
                  {s.count} companies
                </div>
                <div className="score-lg">{leader?.equalWeightScore ?? "—"}</div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

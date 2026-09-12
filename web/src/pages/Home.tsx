import { Link } from "react-router-dom";
import { useDataset } from "../dataset";
import { WeightMixer } from "../components/Widgets";
import { withScores } from "../lib/scoring";

const PILLAR_CARDS = [
  { id: "environmental", emoji: "🌍", label: "Planet", punch: "How carefully do they treat the Earth?", note: "Carbon, clean energy, the mess they leave behind." },
  { id: "social", emoji: "🤝", label: "People", punch: "How do they treat humans?", note: "Pay, safety, who gets a seat at the table." },
  { id: "economic", emoji: "💰", label: "Money", punch: "Can they afford to keep the promise?", note: "A broke company cannot fund a transition." },
  { id: "governance", emoji: "🏛️", label: "Trust", punch: "Who’s in charge — and can we believe them?", note: "Boards, ethics, whether ordinary owners have a voice." },
] as const;

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
          <p className="kicker">🍋 A score anyone can read</p>
          <h1>How carefully does a company take care of the world it lives in?</h1>
          <p className="lede">
            Green Liquid looks at the S&amp;P 500 through four everyday questions — <strong>planet, people, money, and
            trust</strong>. No jargon wall. <em>No black box.</em>
          </p>
          <div className="btn-row">
            <Link className="btn" to="/explore">
              🔍 Explore companies
            </Link>
            <Link className="btn ghost" to="/advisor">
              🧮 Open the calculator
            </Link>
          </div>
        </div>
        <div className="card">
          <img className="method-mark" src="/green_liquid_logo.png" alt="" style={{ width: 72, height: 72, marginBottom: 8 }} />
          <p className="kicker">Right now</p>
          <div className="score-lg">{dataset.companyCount}</div>
          <p>
            companies, scored from public filings. <strong>50</strong> is typical for the industry.{" "}
            <em>Higher means ahead of peers.</em>
          </p>
        </div>
      </section>

      <div className="grid-4">
        {PILLAR_CARDS.map((pillar) => (
          <article className="fun-card" key={pillar.id} style={{ minHeight: 0 }}>
            <div className="emoji" aria-hidden="true">
              {pillar.emoji}
            </div>
            <p className="kicker">{pillar.label}</p>
            <h3>{pillar.punch}</h3>
            <p className="tiny">{pillar.note}</p>
          </article>
        ))}
      </div>

      <div className="grid-2" style={{ marginTop: 22 }}>
        <article className="fun-card" style={{ minHeight: 0 }}>
          <div className="emoji" aria-hidden="true">
            🙊
          </div>
          <h3>Say vs do</h3>
          <ul>
            <li>A net-zero pledge is not a cut in emissions.</li>
            <li>We read the <strong>promise</strong> and the <strong>proof</strong>.</li>
            <li>Talking louder than acting? That’s a 🚩 — <em>not a moral verdict</em>.</li>
          </ul>
        </article>
        <article className="fun-card" style={{ minHeight: 0 }}>
          <div className="emoji" aria-hidden="true">
            🤫
          </div>
          <h3>Silence counts</h3>
          <ul>
            <li>If they don’t disclose it, we <strong>don’t</strong> give them a pass.</li>
            <li>Missing data pulls the score down.</li>
            <li>Transparency is part of the job. ✅</li>
          </ul>
        </article>
      </div>

      <div style={{ marginTop: 22 }}>
        <WeightMixer weights={weights} onChange={setWeights} />
      </div>

      <section style={{ marginTop: 28 }}>
        <p className="kicker">⭐ By sector</p>
        <h2>Each industry has its own ideal company</h2>
        <p className="tiny">
          Turn the dials above, then look at who leads. A steel mill is <em>not</em> scored as if it were a software firm.
        </p>
        <div className="company-grid" style={{ marginTop: 14 }}>
          {dataset.sectors.map((s) => {
            const leader = bySector.get(s.sector);
            return (
              <Link className="card company-card" key={s.sector} to={leader ? `/company/${leader.ticker}` : "/explore"}>
                <p className="kicker">{s.sector}</p>
                <strong>{leader?.name ?? s.sector}</strong>
                <div className="tiny">{s.count} companies</div>
                <div className="score-lg">{leader?.equalWeightScore ?? "—"}</div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

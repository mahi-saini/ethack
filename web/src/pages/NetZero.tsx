import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useDataset } from "../dataset";
import {
  allocateNetZero,
  CARE_LABELS,
  DEFAULT_PREFS,
  dollars,
  GOAL_LABELS,
  HEAVY_LABELS,
  NAME_CAP_OPTIONS,
  recommendLines,
  sleeveTotals,
  type Care,
  type Goal,
  type Heavy,
  type PortfolioPrefs,
} from "../lib/portfolio";

const SLEEVE_COLORS = ["#2d4f2b", "#508e57", "#d1a980", "#708a58", "#326035", "#6b8c4a", "#67aa72"];

function MadSelect({
  label,
  value,
  onChange,
  options,
  end = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  end?: string;
}) {
  return (
    <span className="madlib-choice">
      <select className="madlib-select" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {end}
    </span>
  );
}

export default function NetZero() {
  const { dataset } = useDataset();
  const [prefs, setPrefs] = useState<PortfolioPrefs>(DEFAULT_PREFS);

  const industries = useMemo(() => {
    if (prefs.focus === "all") return [];
    return [...new Set(dataset.companies.filter((c) => c.sector === prefs.focus).map((c) => c.industry))].sort();
  }, [dataset, prefs.focus]);

  const holdings = useMemo(() => allocateNetZero(dataset, prefs), [dataset, prefs]);
  const sleeves = useMemo(() => sleeveTotals(holdings), [holdings]);
  const recs = useMemo(() => recommendLines(prefs, holdings), [prefs, holdings]);

  const setFocus = (focus: string) => setPrefs((p) => ({ ...p, focus, industry: "all" }));

  return (
    <div className="page">
      <section className="hero netzero-hero">
        <div>
          <p className="kicker">💸 Net-zero portfolio</p>
          <h1>Finish the sentences. Watch the billion move.</h1>
          <p className="lede">
            If the world commits to net-zero tomorrow, this is a <strong>$1 billion</strong> split from the Green Liquid
            scores — <em>arithmetic, not a forecast</em>. Change a dropdown and the circle updates.
          </p>
        </div>
      </section>

      <div className="netzero-layout">
        <article className="card madlib">
          <p>
            I want{" "}
            <MadSelect
              label="Sector or whole market"
              value={prefs.focus}
              onChange={setFocus}
              options={[
                { value: "all", label: "the whole S&P 500" },
                ...dataset.sectors.map((s) => ({ value: s.sector, label: s.sector })),
              ]}
            />{" "}
            to{" "}
            <MadSelect
              label="What they should do"
              value={prefs.goal}
              onChange={(goal) => setPrefs((p) => ({ ...p, goal: goal as Goal }))}
              options={(Object.keys(GOAL_LABELS) as Goal[]).map((value) => ({
                value,
                label: GOAL_LABELS[value],
              }))}
              end="."
            />
          </p>
          {prefs.focus !== "all" ? (
            <p>
              Especially{" "}
              <MadSelect
                label="Industry inside that sector"
                value={prefs.industry}
                onChange={(industry) => setPrefs((p) => ({ ...p, industry }))}
                options={[
                  { value: "all", label: "the whole sector" },
                  ...industries.map((industry) => ({ value: industry, label: industry })),
                ]}
                end="."
              />
            </p>
          ) : null}
          <p>
            Heavy industry should{" "}
            <MadSelect
              label="How to treat heavy industry"
              value={prefs.heavy}
              onChange={(heavy) => setPrefs((p) => ({ ...p, heavy: heavy as Heavy }))}
              options={(Object.keys(HEAVY_LABELS) as Heavy[]).map((value) => ({
                value,
                label: HEAVY_LABELS[value],
              }))}
              end="."
            />
          </p>
          <p>
            No single company may take more than{" "}
            <MadSelect
              label="Largest share one company may take"
              value={String(prefs.nameCap)}
              onChange={(nameCap) => setPrefs((p) => ({ ...p, nameCap: Number(nameCap) }))}
              options={NAME_CAP_OPTIONS.map((option) => ({
                value: String(option.value),
                label: option.label,
              }))}
              end="."
            />
          </p>
          <p>
            The fund should{" "}
            <MadSelect
              label="What the fund should care about"
              value={prefs.care}
              onChange={(care) => setPrefs((p) => ({ ...p, care: care as Care }))}
              options={(Object.keys(CARE_LABELS) as Care[]).map((value) => ({
                value,
                label: CARE_LABELS[value],
              }))}
              end="."
            />
          </p>
          <button className="chip" type="button" onClick={() => setPrefs(DEFAULT_PREFS)}>
            Reset the sentences
          </button>
        </article>

        <article className="card donut-card">
          <p className="kicker">The billion</p>
          <div className="donut-wrap">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={sleeves}
                  dataKey="amount"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={78}
                  outerRadius={110}
                  paddingAngle={3}
                  stroke="#f4f0e8"
                  strokeWidth={3}
                  isAnimationActive={false}
                >
                  {sleeves.map((sleeve, i) => (
                    <Cell key={sleeve.name} fill={SLEEVE_COLORS[i % SLEEVE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => dollars(Number(value ?? 0))}
                  contentStyle={{
                    background: "#f4f0e8",
                    border: "1px solid rgba(45, 79, 43, 0.18)",
                    borderRadius: 12,
                    fontFamily: "inherit",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center" aria-hidden="true">
              <strong>$1B</strong>
              <span>{holdings.length} names</span>
            </div>
          </div>
          <ul className="donut-legend">
            {sleeves.map((sleeve, i) => (
              <li key={sleeve.name}>
                <span className="swatch" style={{ background: SLEEVE_COLORS[i % SLEEVE_COLORS.length] }} />
                <span>
                  {sleeve.name}
                  <em>{dollars(sleeve.amount)}</em>
                </span>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <section className="card recs" style={{ marginTop: 18 }}>
        <p className="kicker">What that means</p>
        <h2>The split we would suggest from your sentences</h2>
        {recs.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </section>

      <section style={{ marginTop: 22 }}>
        <p className="kicker">Holdings</p>
        <h2>Where the money would go</h2>
        <p className="tiny">
          Not investment advice. Names come from the same scores as the rest of the site — 10-Ks plus the climate
          ledgers. Silence still counts as a risk.
        </p>
        <div className="card" style={{ marginTop: 14, padding: 0, overflow: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Sleeve</th>
                <th>Sector</th>
                <th>Amount</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => (
                <tr key={h.ticker}>
                  <td>
                    <Link to={`/company/${h.ticker}`}>{h.name}</Link>
                    <div className="tiny">{h.ticker}</div>
                  </td>
                  <td>{h.sleeve}</td>
                  <td>{h.sector}</td>
                  <td>{dollars(h.amount)}</td>
                  <td className="tiny">{h.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

import type { Company, PillarId, Weights } from "../types";
import { PILLAR_ORDER, setWeight } from "../lib/scoring";

const LABELS: Record<PillarId, string> = {
  environmental: "Planet",
  social: "People",
  economic: "Money",
  governance: "Trust",
};

export function WeightMixer({
  weights,
  onChange,
}: {
  weights: Weights;
  onChange: (next: Weights) => void;
}) {
  return (
    <div className="card">
      <h3>What matters to you?</h3>
      <p className="tiny">
        Everyone starts even: 25 / 25 / 25 / 25. Turn up the parts you care about. The others shrink so the mix still
        adds to 100.
      </p>
      <div className="mixer" style={{ marginTop: 14 }}>
        {PILLAR_ORDER.map((id) => (
          <label key={id}>
            {LABELS[id]}
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(weights[id])}
              aria-valuetext={`${Math.round(weights[id])} percent on ${LABELS[id]}`}
              onChange={(e) => onChange(setWeight(weights, id, Number(e.target.value)))}
            />
            <strong>{Math.round(weights[id])}%</strong>
          </label>
        ))}
      </div>
    </div>
  );
}

export function PillarBars({ company }: { company: Company }) {
  return (
    <div className="bars">
      {PILLAR_ORDER.map((id) => (
        <div className="bar-row" key={id}>
          <span>{LABELS[id]}</span>
          <div className="track">
            <div className="fill" style={{ width: `${company.pillars[id].score}%` }} />
          </div>
          <span>{company.pillars[id].score}</span>
        </div>
      ))}
    </div>
  );
}

export function ScoreMark({ score, label }: { score: number; label?: string }) {
  return (
    <div>
      <div className="score-lg">{score}</div>
      {label ? <div className="tiny">{label}</div> : null}
    </div>
  );
}

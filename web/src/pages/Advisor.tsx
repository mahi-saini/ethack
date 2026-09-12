import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useDataset } from "../dataset";
import { answer } from "../lib/agent";

const PROMPTS = [
  "The world just committed to net-zero. Allocate my $1 billion.",
  "Who in Energy is actually walking the talk?",
  "Compare Apple and Exxon.",
  "What should 3M change first?",
];

export default function Advisor() {
  const { dataset } = useDataset();
  const [params] = useSearchParams();
  const preset = params.get("q") ?? "";
  const [input, setInput] = useState(preset);
  const [messages, setMessages] = useState<{ role: "me" | "bot"; text: string; title?: string; extra?: ReturnType<typeof answer> }[]>([]);

  const ask = (text: string) => {
    const cleaned = text.trim();
    if (!cleaned) return;
    const reply = answer(dataset, cleaned);
    setMessages((m) => [
      ...m,
      { role: "me", text: cleaned },
      { role: "bot", text: reply.body, title: reply.title, extra: reply },
    ]);
    setInput("");
  };

  const asked = useRef(false);

  useEffect(() => {
    if (preset && !asked.current) {
      asked.current = true;
      ask(preset);
    }
  }, [preset]); // ask is stable enough for a one-time preset question

  return (
    <div className="page">
      <p className="kicker">Advisor</p>
      <h1>Ask in your own words</h1>
      <p className="lede">
        This guide has read the Green Liquid scores. It can allocate a billion-dollar net-zero fund, compare peers, or
        suggest what a company should change.
      </p>
      <div className="prompts">
        {PROMPTS.map((p) => (
          <button key={p} className="chip" onClick={() => ask(p)}>
            {p}
          </button>
        ))}
      </div>
      <div className="chat" style={{ marginTop: 18 }}>
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role === "me" ? "me" : ""}`}>
            {m.title ? <strong>{m.title}</strong> : null}
            <div>{m.text}</div>
            {m.extra?.holdings ? (
              <table style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Sleeve</th>
                    <th>Amount</th>
                    <th>Why</th>
                  </tr>
                </thead>
                <tbody>
                  {m.extra.holdings.slice(0, 18).map((h) => (
                    <tr key={h.ticker}>
                      <td>
                        <Link to={`/company/${h.ticker}`}>{h.name}</Link>
                      </td>
                      <td>{h.sleeve}</td>
                      <td>${Math.round(h.amount / 1_000_000)}M</td>
                      <td className="tiny">{h.why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        ))}
      </div>
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          className="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything — companies, sectors, or the $1B fund"
          aria-label="Ask the advisor"
        />
        <button className="btn" type="submit">
          Ask
        </button>
      </form>
    </div>
  );
}

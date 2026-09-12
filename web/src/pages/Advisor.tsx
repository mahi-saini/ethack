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
  }, [preset]);

  return (
    <div className="page">
      <p className="kicker">🧮 Calculator</p>
      <h1>Ask in your own words. The numbers stay honest.</h1>
      <p className="lede">
        This is a <strong>calculator</strong>, not a chatbot. It only reads Green Liquid scores — so a $1 billion split
        is arithmetic, <em>not a guess</em>. No model is inventing companies in the background.
      </p>
      <div className="card" style={{ marginBottom: 16 }}>
        <strong>What it will do:</strong> look up a name, compare two companies, rank a sector, or allocate $1B from the
        scores. <em>What it will not do:</em> hallucinate a number, or pretend to know next year’s stock price.
      </div>
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
          placeholder="Ask a company, a sector, or the $1B fund"
          aria-label="Ask the calculator"
        />
        <button className="btn" type="submit">
          Calculate
        </button>
      </form>
    </div>
  );
}

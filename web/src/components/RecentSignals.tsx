import { useEffect, useState } from "react";
import { clusterNews, parseRss, searchQuery, type NewsCluster } from "../lib/news";

const KIND_ICON: Record<string, string> = {
  enforcement: "⚖️",
  pledge: "📣",
  people: "🤝",
  climate: "🌍",
  update: "🗞️",
};

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function RecentSignals({ name, ticker }: { name: string; ticker: string }) {
  const [clusters, setClusters] = useState<NewsCluster[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setClusters(null);
    setError(null);
    const q = searchQuery(name, ticker);
    fetch(`/api/news?q=${encodeURIComponent(q)}`)
      .then((res) => {
        if (!res.ok) throw new Error("feed");
        return res.text();
      })
      .then((xml) => {
        if (cancelled) return;
        setClusters(clusterNews(parseRss(xml)));
      })
      .catch(() => {
        if (!cancelled) setError("The confirmation feed is quiet right now.");
      });
    return () => {
      cancelled = true;
    };
  }, [name, ticker]);

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <p className="kicker">🗞️ Recent signals</p>
      <h3>Headlines as a flashlight — not a grade</h3>
      <p className="tiny">
        We only look at a <strong>confirmation set</strong> of US wires and national desks. Same story from two desks =
        one event. <em>This does not change the Green Liquid score.</em>
      </p>
      {error ? <p className="tiny">{error}</p> : null}
      {!clusters && !error ? <p className="tiny">Checking the confirmation set…</p> : null}
      {clusters && clusters.length === 0 ? (
        <p className="tiny">Nothing in the confirmation set lately. Silence here is not a good score — it is just quiet coverage.</p>
      ) : null}
      {clusters && clusters.length ? (
        <ul className="news-list">
          {clusters.map((c) => (
            <li key={c.title}>
              <span aria-hidden="true">{KIND_ICON[c.kind] ?? "🗞️"}</span>
              <div>
                <a href={c.url} target="_blank" rel="noreferrer">
                  {c.title}
                </a>
                <div className="tiny">
                  {formatDate(c.date)}
                  {" · "}
                  {c.confirmed ? (
                    <strong>{c.count} desks agree</strong>
                  ) : (
                    <em>one desk — a lead, not a fact</em>
                  )}
                  {" · "}
                  {c.sources.join(", ")}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

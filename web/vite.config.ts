import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig } from "vite";

function newsProxy() {
  return {
    name: "green-liquid-news-proxy",
    configureServer(server: {
      middlewares: { use: (path: string, fn: (req: IncomingMessage, res: ServerResponse) => void) => void };
    }) {
      server.middlewares.use("/api/news", (req, res) => {
        void (async () => {
          try {
            const url = new URL(req.url ?? "", "http://localhost");
            const q = url.searchParams.get("q") ?? "";
            if (!q.trim()) {
              res.statusCode = 400;
              res.end("missing q");
              return;
            }
            const upstream = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
            const r = await fetch(upstream, {
              headers: {
                "User-Agent": "GreenLiquid/1.0 (hackathon research; headlines only)",
              },
            });
            const text = await r.text();
            res.statusCode = r.status;
            res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
            res.end(text);
          } catch {
            res.statusCode = 502;
            res.end("news feed unavailable");
          }
        })();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), newsProxy()],
})

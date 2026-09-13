# HyperGreen

A sustainability research workspace with company evidence, personal portfolio simulations, human review, and an AI research assistant.

## Gathered research

The Research library loads immutable compressed source partitions on demand. React loads a compact catalogue and the latest 503-security ETF working snapshot. The historical issuer search index preserves 743 input companies. Different share classes and historical issuers are not silently collapsed.

The archive includes all staged SEC financial vintages, filing/document indexes, full gathered SPY/IVV source observations, monthly price/return candidates, French FF5 and Momentum, CDU, CA100, Climate TRACE, Net Zero Tracker, BOCC, and the server ownership/EPA pilot. Source tables and alternative views overlap: the displayed record count is not a unique-fact count.

`public/research-data/manifest.json` describes the exact release. Collection indexes retain company/entity keys and compressed-shard checksums, verified by the server before decompression. `scripts/pack-research.py STAGING_DIRECTORY` builds the assets without changing sources. `--only-new` appends collections; `--refresh-prefix PREFIX` refreshes a selected group. Build and publish after changing assets.

The API and MCP provide company/entity filters, bounded pagination, period ranges, exact record lookup and conservative as-of filtering. Unknown availability remains unknown. Financial date anomalies are excluded from as-of queries. Candidate associations are not confirmed issuer or ownership joins. Full SEC and Net Zero Tracker document text remains in the original archives; metadata and source links are searchable here.

The complete EPA panel and a supplier-customer dataset are not available. Current Net Zero Tracker data is CC BY-NC 4.0; legacy data is CC BY 4.0. BOCC public download availability does not establish a formal reuse license. Source terms remain visible in the library.

## Scores and simulations

The working universe has null sustainability scores until a reviewed scoring transformation is implemented. Missing is not zero. CA100 assessments are categorical; Net Zero Tracker describes targets; Climate TRACE describes bounded linked-owner estimates; BOCC describes nominal USD financing commitments; the EPA pilot has incomplete facilities/stakes. No prediction, score history or complete corporate footprint is fabricated.

Saved portfolios preserve capital, position limits, allocations and scoring weights per user. The monthly fixed-basket replay loads selected candidate symbol histories plus SPY, applies costs and fits FF5 + Momentum when sufficient data exists. It is not a historical constituent-aware, delisting-complete or survivorship-free strategy. No TradingView or predictive ML integration is included in this release.

## Accounts and review

Sites provides ChatGPT sign-up/sign-in identity. First sign-in creates a profile. D1 stores private simulations, reports and review history. Optimistic versions prevent stale overwrites. The server secret `HYPERGREEN_REVIEWER_EMAILS` bootstraps designated reviewers onto stable Site user IDs. Regular users cannot assign roles or read another user's imports, portfolios or reports.

Reviewers can inspect submitted source snapshots and change status with a note. Large snapshots use R2. Resolving a report does not automatically change facts or scores. Private 10 MB version-1 bundle imports remain separate from the shared archive. Saved configurations retain their dataset identity; older configurations can be exported or deleted. Site audience remains private unless explicitly changed through Sites access settings.

## AI and voice

MiniMax runs server-side using `MINIMAX_API_KEY` and optional `MINIMAX_MODEL` (default MiniMax-M2.7). Bounded read-only tools access private imports and the shared archive. The assistant treats source content as untrusted evidence. Provider secrets never go to the browser.

Inworld native WebRTC uses server-created sessions and `INWORLD_API_KEY`, delegating research to the same MiniMax tool layer. Browser microphone permissions and network availability still apply. Previously verified provider configuration is preserved.

`/api/mcp` uses the official SDK and stateless Streamable HTTP with eight read-only tools and a dataset resource. External-client OAuth registration is not configured. Never distribute browser cookies or provider keys as connector credentials. See `public/mcp-guide.md`.

## Validation

TypeScript, the Sites build, source integrity validation and meaningful Worker integration checks cover account isolation, portfolio conflicts, review authorization/history, shared evidence lookups, conservative dates, snapshots, MCP queries and selected price histories. D1 migrations are schema-only; published migrations are immutable.

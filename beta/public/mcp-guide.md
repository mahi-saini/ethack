# HyperGreen research MCP server

HyperGreen includes a read-only Streamable HTTP MCP endpoint at `/api/mcp` on this site. It uses the official Model Context Protocol TypeScript SDK, supports initialization, tool discovery/calls, and a dataset-summary resource.

## Available tools

- `dataset_overview`: dataset identity, collection counts and limitations.
- `search_companies`: company profiles, scores, CIKs and provenance.
- `query_records`: dated observations, monthly returns, factors, constituent snapshots, facilities, ownership, scenarios and document references. Results are paginated; maximum 40 records per call.
- `search_sources`: source catalogue, documentation and data limitations.
- `explain_methodology`: pillars, scoring rules and historical research limitations.

Resource: `hypergreen://dataset/summary`.

The MCP tools use the same saved dataset as your website assistant. Each request is scoped to the authenticated user's private workspace. Remote queries use the standard 30/30/20/20 scoring weights; browser-local custom weights and portfolio allocations are not shared with this connection. The website agent can inspect the currently open portfolio.

## Connection status

The endpoint is implemented and protected by the site's ChatGPT sign-in boundary. External MCP client OAuth registration/discovery is not configured in this release. A browser sign-in cookie is not an MCP credential; do not copy cookies or provider API keys into an MCP client. The website assistant works directly with the shared data tools and does not depend on external MCP client setup.

A future connector deployment must enable the hosting platform's supported MCP/OAuth integration or run behind a properly configured OAuth 2.1 resource server. Keep the existing site private. The server expects trusted identity from Sites dispatch; never expose the Worker directly or accept user-supplied identity headers on a public origin.

## Data and evidence

Import a normalized research bundle through Data sources. Demo measurements are synthetic. Imported records retain period, available date, source, unit, and reported/estimated/target/scenario distinctions. Document entries are links and metadata; full document contents are not ingested. Catalogue presence does not establish an active data connection.

Queries with `asOf` only include records with a known availability/publication date before that cutoff; undated records are excluded. Monthly returns and factor records do not have a publication date in contract v1.0, so `asOf` excludes them. Use period filters for descriptive return analysis; do not infer point-in-time availability.

## Gathered source archive

Use `research_library` to list collections or find an issuer. `research_records` queries a bounded page using a collection ID, company/native entity ID and optional dates. `research_record_detail` opens a returned collection/part/index location. Keep source units, boundaries, mapping status and date limitations. Follow the returned cursor: an empty scanned page does not prove no coverage. The shared source archive is separate from each user's private import.

The library includes source tables and overlapping normalized/audit views. Its total is not a unique-fact count. Full filing/NZT document text remains archive-only. Candidate symbol returns do not establish a permanent historical security identity.

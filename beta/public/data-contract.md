# HyperGreen data contract — v1.0

HyperGreen is a platform-first research prototype. All built-in company scores, target classifications and market returns are synthetic demonstrations. The 82 source descriptions are the research catalogue supplied by the workspace owner. No provider is automatically connected.

## Import

Choose Data sources → Import data, or the Data workspace tab. Import a UTF-8 JSON file up to 10 MB. Bundles are validated in the browser and again on the server, then saved privately in platform storage with per-user ownership. Import replaces the previous saved bundle. The assistant and MCP tools read the same saved data; no future upload requires a model retrain. Refreshing restores the saved bundle. Portfolio changes remain session-only; export them before closing. Scoring weights are device-local preferences and persist in browser storage.

Required top-level fields: `schemaVersion: "1.0"`, `label: string` and at least one nonempty record collection. Optional collections default to empty arrays. A bundle with only returns or observations has no company profiles; it does not mix imported facts with demo companies.

## Record collections

### companies — current company research profiles (maximum 2,000)

- ticker: security ticker, unique within the bundle
- name, sector: nonempty strings
- cik: ten-digit issuer CIK string, preserving leading zeros
- scores: four values from 0–100 or null, ordered footprint, transition, financial resilience, people/governance
- intensity: nonnegative Scope 1 + 2 tCO2e per USD million revenue, or null; use consistent currency and reporting boundaries
- reduction: year-over-year percent change in emissions, or null; negative means a reduction
- coverage: input-field evidence coverage percent, 0–100, calculated upstream
- target: Validated, Committed, None disclosed, or Unknown
- year: reporting year
- availableDate: valid YYYY-MM-DD date
- source: evidence description or source identifier

These are normalized research profiles. The platform aggregates supplied pillars; it does not infer a comparable sustainability score directly from arbitrary raw provider files. Source-specific normalization, metric direction, materiality, raw units, boundaries, and coverage denominators must be documented when mapping each source. Current profiles must not be backcast as historical signals.

### observations — dated financial and sustainability facts (maximum 50,000)

entityId, metric, value (finite number or null), unit, periodEnd (YYYY-MM-DD), availableDate, sourceId, basis (reported / estimated / target / scenario), optional boundary.

Use issuer CIK for entityId where appropriate. This table supports SEC financials, emissions, targets, social measures, and evidence derived from source documents. Keep source-specific metric names, taxonomy, Scope 2 basis and observation boundaries explicit. The app validates, saves and exposes these facts through read-only AI and MCP queries; it does not automatically turn raw observations into the four company pillar scores.

### monthlyReturns — stock total returns (maximum 100,000)

ticker, month (YYYY-MM), totalReturn (decimal, e.g. 0.02 = 2%, minimum -1), sourceId. Ticker/month must be unique. Include benchmark ticker SPY. Raw daily prices must be adjusted for splits and distributions and converted to consecutive monthly returns upstream; no gap filling.

### factors — French monthly factors (maximum 2,000)

month (unique YYYY-MM), mktRf, smb, hml, rmw, cma, mom, rf, sourceId. All numeric fields are decimal returns, not percentages. mktRf already excludes the risk-free rate. The app subtracts rf from the portfolio total return before regression. At least 24 complete months and a full-rank design matrix are required for the six-factor fit.

### holdings — historical membership/benchmark snapshots (maximum 100,000)

ticker, snapshotDate, availableDate, weight (fraction 0–1), sourceId. Ticker/snapshotDate must be unique. ETF positions are a proxy for index membership. Publication date is distinct from holdings date. The current fixed-basket replay inventories these records but does not implement a historical constituent selection strategy.

### facilities — physical assets (maximum 20,000)

assetId, name, latitude (-90..90), longitude (-180..180), sourceId.

### ownership — dated asset/entity relationships (maximum 20,000)

assetId, entityId, validFrom, validTo (date or null), share (fraction 0–1), sourceId. Ownership evidence must be reviewed for overlapping paths and reporting boundaries. A CIK is an issuer identity, not a permanent security identifier or proof of historical ownership.

### scenarios — modeled scenario series (maximum 20,000)

scenario, region, variable, year, value, unit, sourceId. Preserve model/version and scenario names in sourceId or the associated source catalogue. Modeled projections are not observed company outcomes.

### documents — evidence references (maximum 5,000)

entityId, title, url (HTTPS), publishedDate, sourceId. Keep source documents local until a document integration workflow is defined. The platform stores references in the imported bundle only; it does not scrape or interpret arbitrary linked documents.

## Source coverage and access

All 82 supplied sources are represented in the catalogue with category, purpose, fields, join identifiers, formats, history, access notes, and limitations. Source IDs are source-1 through source-82 in the same order as the supplied list. The catalogue export contains the exact mapping. A listed provider is not a tested connector. Raw CSV, XLSX, Parquet, JSON/API, geospatial, and document sources need source-specific adapters into the above records. Paid, registered, or restricted sources remain optional; no subscriptions, tokens, or paid accounts are needed for the demo.

## Scoring

Weighted mean of available pillars, with weights normalized to 100%. Require at least 70% of total pillar weight to be observed. Missing values remain unknown. Evidence coverage is separate from the composite. Scores are sector-relative only if upstream normalization actually used a comparable sector/year reference set. A relative score is not proof of an absolute sustainable operating level.

## Portfolio replay

The initial replay uses the current fixed basket, monthly rebalancing, SPY benchmark, and one-way transaction costs. It requires complete return coverage in each requested month and does not renormalize around missing companies. Initial purchases incur costs on 100% of capital; later trades use absolute changes from drifted weights. Returns, growth of 100, annualized return, sample volatility, monthly drawdown, and descriptive FF5 + Momentum coefficients are calculated in the browser.

This is not yet a historical sustainability selection backtest. That stage needs dated eligibility, point-in-time scores, permanent security mappings, delistings and terminal returns, corporate actions, publication lags, portfolio selection rules, turnover constraints and performance review. No displayed portfolio is an optimized investment recommendation.

## AI and voice access

Questions and bounded relevant record excerpts are sent to MiniMax when you use the assistant. API credentials stay in server-side secrets. No raw provider files are uploaded automatically. Text conversations remain in the current assistant view and are cleared when you leave or start a new chat.

Voice is an optional Inworld Realtime WebRTC connection: audio input, turn detection and speech output run through Inworld; its voice model delegates research questions to the MiniMax agent. Inworld receives microphone audio and research answers. HyperGreen does not persist audio or voice transcripts. Provider retention policies still apply. Microphone capture begins only after Start voice chat and browser permission, and ends on End voice, navigation away or a connection failure. Sessions have a five-minute UI limit.

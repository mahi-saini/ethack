#!/usr/bin/env python3
"""Build the Green Liquid company-level ESEG dataset from 10-K disclosures.

The current source is SEC 10-K sustainability passages plus the S&P 500
constituent list (name, sector, industry). Factor columns can later be
overridden by dropping a CSV at data/eseg_overrides.csv with columns:
    ticker,factor_id,value,source
"""

from __future__ import annotations

import csv
import json
import math
import re
import statistics
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DISCLOSURE_CSV = ROOT / "sp500_sustainability_disclosures.csv"
CONSTITUENTS_CSV = ROOT / "data" / "sp500_constituents.csv"
OVERRIDES_CSV = ROOT / "data" / "eseg_overrides.csv"
OUT_JSON = ROOT / "data" / "eseg_master.json"
OUT_CSV = ROOT / "data" / "eseg_master.csv"

MISSING_Z = -0.75
SCORE_SCALE = 12.0  # score = 50 + 12z, clipped to 0-100

FACTORS = [
    {
        "id": "carbonFootprint",
        "pillar": "environmental",
        "label": "Carbon Footprint",
        "plain": "How clearly they measure and talk about greenhouse gases.",
        "higher_is_better": True,
        "positive": [
            r"scope\s*[123]",
            r"\bghg\b",
            r"greenhouse gas",
            r"carbon footprint",
            r"carbon emissions",
            r"emissions inventory",
            r"ghg protocol",
            r"metric tons of co2",
            r"tco2e",
            r"emissions intensity",
        ],
        "negative": [r"emissions increased", r"higher emissions", r"failed to reduce"],
    },
    {
        "id": "climatePromise",
        "pillar": "environmental",
        "label": "Climate Promise Score",
        "plain": "The strength of their climate targets and net-zero pledges.",
        "higher_is_better": True,
        "positive": [
            r"net[- ]zero",
            r"carbon neutral",
            r"science[- ]based target",
            r"\bsbti\b",
            r"decarboni[sz]ation",
            r"1\.5\s*°?\s*c",
            r"paris agreement",
            r"climate commitment",
            r"emissions reduction target",
            r"carbon negative",
        ],
        "negative": [],
    },
    {
        "id": "cleanEnergy",
        "pillar": "environmental",
        "label": "Clean Energy Shift",
        "plain": "How far they have moved toward renewable and clean power.",
        "higher_is_better": True,
        "positive": [
            r"renewable energy",
            r"clean energy",
            r"solar",
            r"wind power",
            r"wind energy",
            r"\bre100\b",
            r"power purchase agreement",
            r"\bppas?\b",
            r"electric fleet",
            r"electrification",
            r"green hydrogen",
            r"battery storage",
        ],
        "negative": [r"coal[- ]fired", r"new oil", r"new gas plant"],
    },
    {
        "id": "resourceEfficiency",
        "pillar": "environmental",
        "label": "Resource Efficiency",
        "plain": "How carefully they use water, materials, and waste.",
        "higher_is_better": True,
        "positive": [
            r"water (?:use|efficiency|stewardship|positive|recycling)",
            r"waste (?:reduction|zero|management|divert)",
            r"recycl(?:e|ing|ed)",
            r"circular economy",
            r"energy efficiency",
            r"closed[- ]loop",
            r"zero waste",
            r"water stress",
            r"biodiversity",
        ],
        "negative": [r"water scarcity", r"hazardous waste"],
    },
    {
        "id": "envTrackRecord",
        "pillar": "environmental",
        "label": "Environmental Track Record",
        "plain": "Whether their history shows care — or cleanup after harm.",
        "higher_is_better": True,
        "positive": [
            r"restored",
            r"remediation complete",
            r"environmental award",
            r"reduced pollution",
        ],
        "negative": [
            r"environmental (?:liabilit|litigation|enforcement|violation|fine|penalty)",
            r"superfund",
            r"\bcercla\b",
            r"contamination",
            r"hazardous substance",
            r"oil spill",
            r"pfas",
            r"clean[- ]up costs",
            r"consent decree",
        ],
        "negative_weight": 1.4,
    },
    {
        "id": "leadershipDiversity",
        "pillar": "social",
        "label": "Leadership Diversity",
        "plain": "Whether leadership reflects a wider mix of people.",
        "higher_is_better": True,
        "positive": [
            r"board diversity",
            r"women (?:on|in) (?:the )?board",
            r"gender diversity",
            r"racial and ethnic diversity",
            r"underrepresented",
            r"diverse slate",
            r"inclusion",
            r"dei\b",
            r"diversity.{0,40}leadership",
        ],
        "negative": [],
    },
    {
        "id": "workerWellbeing",
        "pillar": "social",
        "label": "Worker Wellbeing",
        "plain": "How they look after health, safety, and day-to-day care.",
        "higher_is_better": True,
        "positive": [
            r"occupational health",
            r"employee safety",
            r"workplace safety",
            r"well[- ]being",
            r"wellbeing",
            r"mental health",
            r"employee assistance",
            r"safety training",
            r"lost[- ]time",
            r"total recordable",
            r"\btrir\b",
        ],
        "negative": [r"workplace fatality", r"serious injury", r"osha citation"],
    },
    {
        "id": "payFairness",
        "pillar": "social",
        "label": "Pay Fairness",
        "plain": "Whether pay looks fair across roles and genders.",
        "higher_is_better": True,
        "positive": [
            r"pay equity",
            r"equal pay",
            r"living wage",
            r"fair (?:and equitable )?pay",
            r"gender pay",
            r"compensation equity",
            r"minimum wage.{0,30}above",
            r"pay transparency",
        ],
        "negative": [r"wage theft", r"pay discrimination"],
    },
    {
        "id": "customerTrust",
        "pillar": "social",
        "label": "Customer Trust",
        "plain": "Signals that customers and the public can rely on them.",
        "higher_is_better": True,
        "positive": [
            r"data privacy",
            r"customer privacy",
            r"product safety",
            r"cybersecurity",
            r"information security",
            r"consumer protection",
            r"trust and safety",
            r"quality management",
        ],
        "negative": [
            r"product recall",
            r"data breach",
            r"privacy violation",
            r"ftc (?:action|complaint)",
        ],
    },
    {
        "id": "fairLabor",
        "pillar": "social",
        "label": "Fair Labor Practices",
        "plain": "Respect for people in their own operations and supply chain.",
        "higher_is_better": True,
        "positive": [
            r"human rights",
            r"responsible sourcing",
            r"supplier code",
            r"living wage",
            r"collective bargaining",
            r"freedom of association",
            r"fair labor",
            r"modern slavery (?:act|statement)",
        ],
        "negative": [
            r"forced labor",
            r"child labor",
            r"modern slavery",
            r"human trafficking",
            r"labor violation",
        ],
        "negative_weight": 1.25,
    },
    {
        "id": "peopleScore",
        "pillar": "social",
        "label": "People Score",
        "plain": "A wide-angle view of how they talk about their workforce.",
        "higher_is_better": True,
        "positive": [
            r"employees",
            r"workforce",
            r"talent development",
            r"training and development",
            r"employee engagement",
            r"retention",
            r"community (?:investment|engagement|impact)",
            r"volunteer",
        ],
        "negative": [r"mass layoff", r"workforce reduction", r"severance"],
    },
    {
        "id": "financialStability",
        "pillar": "economic",
        "label": "Financial Stability",
        "plain": "Whether the business looks sturdy enough to keep its promises.",
        "higher_is_better": True,
        "positive": [
            r"strong balance sheet",
            r"investment grade",
            r"liquidity",
            r"cash flow from operations",
            r"net cash",
            r"fortress balance",
            r"capital adequacy",
        ],
        "negative": [
            r"going concern",
            r"substantial doubt",
            r"covenant breach",
            r"liquidity risk",
            r"credit rating downgrade",
            r"impairment",
        ],
    },
    {
        "id": "growthInnovation",
        "pillar": "economic",
        "label": "Growth & Innovation",
        "plain": "Investment in new ideas, products, and better ways of working.",
        "higher_is_better": True,
        "positive": [
            r"research and development",
            r"\br&d\b",
            r"innovation",
            r"patent",
            r"new product",
            r"digital transformation",
            r"climate tech",
            r"clean tech",
        ],
        "negative": [],
    },
    {
        "id": "profitability",
        "pillar": "economic",
        "label": "Profitability",
        "plain": "Whether they earn enough to fund the transition, not just talk about it.",
        "higher_is_better": True,
        "positive": [
            r"operating margin",
            r"net income",
            r"profitable",
            r"earnings growth",
            r"return on invested capital",
            r"\broic\b",
            r"free cash flow",
        ],
        "negative": [r"operating loss", r"net loss", r"unprofitable", r"goodwill impairment"],
    },
    {
        "id": "futureInvestment",
        "pillar": "economic",
        "label": "Investment in the Future",
        "plain": "Money going into long-term capacity, climate, and people.",
        "higher_is_better": True,
        "positive": [
            r"capital expend",
            r"\bcapex\b",
            r"sustainability invest",
            r"climate invest",
            r"transition invest",
            r"long-term invest",
            r"infrastructure invest",
            r"reinvest",
        ],
        "negative": [r"deferred maintenance", r"underinvest"],
    },
    {
        "id": "jobWageImpact",
        "pillar": "economic",
        "label": "Job & Wage Impact",
        "plain": "Whether they create decent work and share value with workers.",
        "higher_is_better": True,
        "positive": [
            r"created .{0,20}jobs",
            r"hiring",
            r"wage increase",
            r"raise wages",
            r"employee stock",
            r"profit sharing",
            r"apprentice",
            r"workforce expansion",
        ],
        "negative": [r"job cuts", r"layoffs", r"reduction in force", r"outsourcing"],
    },
    {
        "id": "boardIndependence",
        "pillar": "governance",
        "label": "Board Independence",
        "plain": "How independent the people who oversee management are.",
        "higher_is_better": True,
        "positive": [
            r"independent director",
            r"board independence",
            r"independent chair",
            r"lead independent",
            r"non-executive",
            r"independent board",
        ],
        "negative": [r"related[- ]party", r"executive chair.{0,20}combined"],
    },
    {
        "id": "execAccountability",
        "pillar": "governance",
        "label": "Executive Accountability",
        "plain": "Whether leaders' pay and job security are tied to real outcomes.",
        "higher_is_better": True,
        "positive": [
            r"clawback",
            r"pay for performance",
            r"esg.{0,20}compensation",
            r"sustainability.{0,20}compensation",
            r"incentive.{0,30}(emissions|safety|diversity)",
            r"ceo pay ratio",
            r"say[- ]on[- ]pay",
        ],
        "negative": [r"golden parachute", r"pay without performance"],
    },
    {
        "id": "ethicsRecord",
        "pillar": "governance",
        "label": "Ethics Record",
        "plain": "Integrity — and the absence of serious ethics trouble.",
        "higher_is_better": True,
        "positive": [
            r"code of (?:conduct|ethics)",
            r"ethics hotline",
            r"anti[- ]bribery",
            r"anti[- ]corruption",
            r"compliance program",
            r"whistleblower",
        ],
        "negative": [
            r"fcpa",
            r"bribery",
            r"corruption investigation",
            r"securities fraud",
            r"doj investigation",
            r"enforcement action",
            r"monitorship",
        ],
        "negative_weight": 1.3,
    },
    {
        "id": "transparency",
        "pillar": "governance",
        "label": "Transparency",
        "plain": "How openly they report, using shared climate and ESG standards.",
        "higher_is_better": True,
        "positive": [
            r"sustainability report",
            r"\btcfd\b",
            r"\bsasb\b",
            r"\bissb\b",
            r"\bcsrd\b",
            r"ghg protocol",
            r"esg (?:report|disclosure)",
            r"climate disclosure",
            r"materiality assessment",
        ],
        "negative": [r"limited disclosure", r"did not disclose"],
    },
    {
        "id": "ownershipFairness",
        "pillar": "governance",
        "label": "Ownership Fairness",
        "plain": "Whether ordinary shareholders have a real voice.",
        "higher_is_better": True,
        "positive": [
            r"one share.{0,12}one vote",
            r"shareholder rights",
            r"majority voting",
            r"proxy access",
            r"annual director election",
            r"special meeting",
        ],
        "negative": [
            r"dual[- ]class",
            r"supervoting",
            r"unequal voting",
            r"controlling stockholder",
            r"poison pill",
        ],
    },
]

SAY_PATTERNS = [
    r"\bwe (?:will|plan to|intend to|aim to|expect to|are committed to)\b",
    r"\bcommitted to\b",
    r"\btarget(?:s|ed|ing)?\b",
    r"\bpledge(?:d|s)?\b",
    r"\bgoal(?:s)? to\b",
    r"\bby 20(?:30|35|40|45|50)\b",
    r"\bnet[- ]zero by\b",
    r"\bambition\b",
    r"\broadmap\b",
]

DO_PATTERNS = [
    r"\b(?:have|has) (?:reduced|cut|achieved|reached|installed|procured|eliminated)\b",
    r"\breduced (?:our )?(?:emissions|ghg|carbon|waste|water)\b",
    r"\bachieved\b",
    r"\bdecreased by\b",
    r"\bcompared (?:with|to) 20\d{2}\b",
    r"\brenewable energy (?:now|accounted|supplied|purchased)\b",
    r"\bscope [12] emissions (?:were|declined|fell)\b",
    r"\bcompleted\b.{0,40}\b(?:solar|wind|efficiency)\b",
]

PILLARS = {
    "environmental": {
        "id": "environmental",
        "label": "Environmental",
        "question": "How carefully do they treat the planet?",
    },
    "social": {
        "id": "social",
        "label": "Social",
        "question": "How do they treat people?",
    },
    "economic": {
        "id": "economic",
        "label": "Economic",
        "question": "Can they keep doing good work without falling apart?",
    },
    "governance": {
        "id": "governance",
        "label": "Governance",
        "question": "Who is in charge, and can we trust them?",
    },
}


def compile_list(patterns: list[str]) -> list[re.Pattern[str]]:
    return [re.compile(p, re.IGNORECASE) for p in patterns]


for factor in FACTORS:
    factor["pos_re"] = compile_list(factor["positive"])
    factor["neg_re"] = compile_list(factor["negative"])
    factor.setdefault("negative_weight", 1.0)

SAY_RE = compile_list(SAY_PATTERNS)
DO_RE = compile_list(DO_PATTERNS)


def normalize_ticker(value: str) -> str:
    return value.strip().upper().replace(".", "-")


def count_hits(patterns: list[re.Pattern[str]], text: str) -> int:
    return sum(len(p.findall(text)) for p in patterns)


def zscore(values: list[float]) -> list[float]:
    if len(values) < 2:
        return [0.0 for _ in values]
    mean = statistics.fmean(values)
    stdev = statistics.pstdev(values)
    if stdev < 1e-9:
        return [0.0 for _ in values]
    return [(v - mean) / stdev for v in values]


def to_score(z: float) -> int:
    return int(max(0, min(100, round(50 + SCORE_SCALE * z))))


def percentile(sorted_vals: list[float], p: float) -> float:
    if not sorted_vals:
        return 0.0
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    k = (len(sorted_vals) - 1) * p
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_vals[int(k)]
    return sorted_vals[f] * (c - k) + sorted_vals[c] * (k - f)


def load_constituents() -> dict[str, dict]:
    out: dict[str, dict] = {}
    with CONSTITUENTS_CSV.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            ticker = normalize_ticker(row["Symbol"])
            out[ticker] = {
                "ticker": ticker,
                "name": row["Security"].strip(),
                "sector": row["GICS Sector"].strip(),
                "industry": row["GICS Sub-Industry"].strip(),
                "hq": row.get("Headquarters Location", "").strip(),
                "cik": str(row.get("CIK", "")).zfill(10),
            }
    return out


def load_overrides() -> dict[str, dict[str, float]]:
    if not OVERRIDES_CSV.exists():
        return {}
    out: dict[str, dict[str, float]] = defaultdict(dict)
    with OVERRIDES_CSV.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            ticker = normalize_ticker(row["ticker"])
            factor_id = row["factor_id"].strip()
            try:
                out[ticker][factor_id] = float(row["value"])
            except (TypeError, ValueError):
                continue
    return out


def score_text(text: str) -> tuple[dict[str, dict], int, int]:
    tallies: dict[str, dict] = {}
    for factor in FACTORS:
        pos = count_hits(factor["pos_re"], text)
        neg = count_hits(factor["neg_re"], text)
        raw = pos - factor["negative_weight"] * neg
        tallies[factor["id"]] = {"raw": raw, "hits": pos + neg, "pos": pos, "neg": neg}
    say = count_hits(SAY_RE, text)
    do = count_hits(DO_RE, text)
    return tallies, say, do


def pick_excerpt(passages: list[dict], kind: str) -> dict | None:
    ranked = []
    for item in passages:
        text = item["text"]
        low = text.lower()
        if kind == "promise":
            weight = count_hits(SAY_RE, low) + 2 * count_hits(
                [re.compile(r"net[- ]zero|committed to|target", re.I)], low
            )
        elif kind == "proof":
            weight = count_hits(DO_RE, low) + 2 * count_hits(
                [re.compile(r"reduced|achieved|renewable energy", re.I)], low
            )
        else:
            weight = count_hits(
                [re.compile(r"risk|liability|litigation|violation", re.I)], low
            )
        if weight:
            ranked.append((weight, len(text), text, item.get("source_url", "")))
    if not ranked:
        return None
    ranked.sort(key=lambda x: (-x[0], x[1]))
    _, _, text, url = ranked[0]
    clipped = text.strip()
    if len(clipped) > 320:
        clipped = clipped[:317].rsplit(" ", 1)[0] + "…"
    return {"kind": kind, "text": clipped, "url": url}


def main() -> None:
    constituents = load_constituents()
    overrides = load_overrides()

    by_ticker: dict[str, dict] = defaultdict(
        lambda: {
            "passages": 0,
            "climate": 0,
            "environment": 0,
            "social": 0,
            "governance": 0,
            "chars": 0,
            "say": 0,
            "do": 0,
            "factors": {f["id"]: {"raw": 0.0, "hits": 0, "pos": 0, "neg": 0} for f in FACTORS},
            "texts": [],
            "cik": "",
            "filingDate": "",
            "sourceUrl": "",
        }
    )

    with DISCLOSURE_CSV.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            ticker = normalize_ticker(row["ticker"])
            rec = by_ticker[ticker]
            rec["passages"] += 1
            rec["chars"] += int(row.get("length") or 0)
            rec["cik"] = rec["cik"] or row.get("cik", "")
            rec["filingDate"] = rec["filingDate"] or row.get("filing_date", "")
            rec["sourceUrl"] = rec["sourceUrl"] or row.get("source_url", "")
            for cat in [c.strip() for c in row["categories"].split(";") if c.strip()]:
                if cat in rec:
                    rec[cat] += 1
            text = row.get("text", "")
            tallies, say, do = score_text(text)
            rec["say"] += say
            rec["do"] += do
            for fid, vals in tallies.items():
                rec["factors"][fid]["raw"] += vals["raw"]
                rec["factors"][fid]["hits"] += vals["hits"]
                rec["factors"][fid]["pos"] += vals["pos"]
                rec["factors"][fid]["neg"] += vals["neg"]
            if len(rec["texts"]) < 40:
                rec["texts"].append({"text": text, "source_url": row.get("source_url", "")})

    # Include every S&P 500 name, even if the 10-K extract is missing.
    all_tickers = sorted(set(constituents) | set(by_ticker))
    companies: list[dict] = []

    for ticker in all_tickers:
        meta = constituents.get(ticker, {})
        rec = by_ticker.get(ticker)
        company = {
            "ticker": ticker,
            "name": meta.get("name") or ticker,
            "sector": meta.get("sector") or "Unknown",
            "industry": meta.get("industry") or "Unknown",
            "hq": meta.get("hq") or "",
            "cik": (rec or {}).get("cik") or meta.get("cik") or "",
            "filingDate": (rec or {}).get("filingDate") or "",
            "sourceUrl": (rec or {}).get("sourceUrl") or "",
            "passages": (rec or {}).get("passages", 0),
            "categoryCounts": {
                "climate": (rec or {}).get("climate", 0),
                "environment": (rec or {}).get("environment", 0),
                "social": (rec or {}).get("social", 0),
                "governance": (rec or {}).get("governance", 0),
            },
            "sayRaw": float((rec or {}).get("say", 0)),
            "doRaw": float((rec or {}).get("do", 0)),
            "factors": {},
            "excerpts": [],
            "overrideFactors": [],
        }

        for factor in FACTORS:
            fid = factor["id"]
            raw_pack = (rec or {}).get("factors", {}).get(fid, {"raw": 0.0, "hits": 0})
            raw = float(raw_pack["raw"])
            hits = int(raw_pack["hits"])
            missing = hits == 0 and rec is not None
            if rec is None:
                missing = True
                raw = None
            if ticker in overrides and fid in overrides[ticker]:
                raw = float(overrides[ticker][fid])
                missing = False
                hits = max(hits, 1)
                company["overrideFactors"].append(fid)
            company["factors"][fid] = {
                "raw": raw,
                "hits": hits,
                "missing": missing,
            }

        if rec:
            for kind in ("promise", "proof", "risk"):
                excerpt = pick_excerpt(rec["texts"], kind)
                if excerpt:
                    company["excerpts"].append(excerpt)

        companies.append(company)

    # Direction-adjust raw values (higher is always better after this).
    adjusted: dict[str, list[float | None]] = {f["id"]: [] for f in FACTORS}
    for company in companies:
        for factor in FACTORS:
            fid = factor["id"]
            pack = company["factors"][fid]
            raw = pack["raw"]
            if pack["missing"] or raw is None:
                pack["adjusted"] = None
            else:
                pack["adjusted"] = float(raw) if factor["higher_is_better"] else -float(raw)
            adjusted[fid].append(pack["adjusted"])

    overall_z = {}
    for fid, series in adjusted.items():
        present_idx = [i for i, v in enumerate(series) if v is not None]
        present_vals = [series[i] for i in present_idx]
        zs = zscore(present_vals) if present_vals else []
        mapping = {present_idx[i]: zs[i] for i in range(len(present_idx))}
        overall_z[fid] = [mapping.get(i) for i in range(len(series))]

    by_sector: dict[str, list[int]] = defaultdict(list)
    for i, company in enumerate(companies):
        by_sector[company["sector"]].append(i)

    sector_z: dict[str, dict[str, list[float | None]]] = {}
    for sector, idxs in by_sector.items():
        sector_z[sector] = {}
        for factor in FACTORS:
            fid = factor["id"]
            present_idx = [
                i for i in idxs if companies[i]["factors"][fid]["adjusted"] is not None
            ]
            present_vals = [companies[i]["factors"][fid]["adjusted"] for i in present_idx]
            zs = zscore(present_vals) if present_vals else []
            mapping = {present_idx[i]: zs[i] for i in range(len(present_idx))}
            sector_z[sector][fid] = {i: mapping.get(i) for i in idxs}

    for i, company in enumerate(companies):
        missing_n = 0
        for factor in FACTORS:
            fid = factor["id"]
            pack = company["factors"][fid]
            z_over = overall_z[fid][i]
            z_sec = sector_z[company["sector"]][fid].get(i)
            if pack["missing"]:
                missing_n += 1
                z_used = MISSING_Z
            else:
                z_used = z_sec if z_sec is not None else (z_over if z_over is not None else 0.0)
            pack["zOverall"] = None if z_over is None else round(z_over, 4)
            pack["zSector"] = None if z_sec is None else round(z_sec, 4)
            pack["z"] = round(float(z_used), 4)
            pack["score"] = to_score(pack["z"])
        company["completeness"] = round(1 - missing_n / len(FACTORS), 3)

        say = company["sayRaw"]
        do = company["doRaw"]
        company["sayShare"] = round(say / (say + do), 3) if (say + do) else None

    def percent_ranks(values: list[float]) -> list[int]:
        n = len(values)
        order = sorted(range(n), key=lambda i: (values[i], i))
        out = [50] * n
        i = 0
        while i < n:
            j = i
            while j + 1 < n and values[order[j + 1]] == values[order[i]]:
                j += 1
            pct = ((i + j) / 2 + 0.5) / n * 100
            for k in range(i, j + 1):
                out[order[k]] = int(max(1, min(99, round(pct))))
            i = j + 1
        return out

    # Show z-scores as "where you sit in your industry" so 50 is typical and
    # leaders can reach the high 80s/90s instead of clustering around 50.
    for idxs in by_sector.values():
        for factor in FACTORS:
            fid = factor["id"]
            ranks = percent_ranks([companies[i]["factors"][fid]["z"] for i in idxs])
            for local, i in enumerate(idxs):
                companies[i]["factors"][fid]["score"] = ranks[local]

    # Say / do z-scores within sector.
    for sector, idxs in by_sector.items():
        say_vals = [companies[i]["sayRaw"] for i in idxs]
        do_vals = [companies[i]["doRaw"] for i in idxs]
        say_z = zscore(say_vals)
        do_z = zscore(do_vals)
        for local, i in enumerate(idxs):
            company = companies[i]
            company["sayZ"] = round(say_z[local], 4)
            company["doZ"] = round(do_z[local], 4)
            gap = say_z[local] - do_z[local]
            company["sayDoGap"] = round(gap, 4)
            company["sayScore"] = 0
            company["doScore"] = 0
            if company["sayRaw"] + company["doRaw"] == 0:
                company["sayDoLabel"] = "Not enough to tell"
            elif gap >= 0.75:
                company["sayDoLabel"] = "Says more than it does"
            elif gap <= -0.75:
                company["sayDoLabel"] = "Does more than it promises"
            else:
                company["sayDoLabel"] = "Walks about even with the talk"

        say_ranks = percent_ranks(say_z)
        do_ranks = percent_ranks(do_z)
        for local, i in enumerate(idxs):
            companies[i]["sayScore"] = say_ranks[local]
            companies[i]["doScore"] = do_ranks[local]

        # Sector north-star / ideal company: 90th percentile of observed factor scores.
        ideal_factors = {}
        for factor in FACTORS:
            fid = factor["id"]
            observed = sorted(
                companies[i]["factors"][fid]["score"]
                for i in idxs
                if not companies[i]["factors"][fid]["missing"]
            )
            ideal_score = int(round(percentile(observed, 0.9))) if observed else 50
            ideal_factors[fid] = ideal_score
        for i in idxs:
            companies[i]["ideal"] = ideal_factors
            distances = []
            for factor in FACTORS:
                fid = factor["id"]
                distances.append(ideal_factors[fid] - companies[i]["factors"][fid]["score"])
            companies[i]["distanceToIdeal"] = round(sum(distances) / len(distances), 2)

    def pillar_score(company: dict, pillar: str) -> dict:
        fids = [f["id"] for f in FACTORS if f["pillar"] == pillar]
        scores = [company["factors"][fid]["score"] for fid in fids]
        zs = [company["factors"][fid]["z"] for fid in fids]
        missing = sum(1 for fid in fids if company["factors"][fid]["missing"])
        avg_score = int(round(sum(scores) / len(scores)))
        avg_z = sum(zs) / len(zs)
        return {
            "score": avg_score,
            "z": round(avg_z, 4),
            "missing": missing,
            "factors": len(fids),
        }

    for company in companies:
        company["pillars"] = {
            pillar: pillar_score(company, pillar) for pillar in PILLARS
        }
        equal = sum(company["pillars"][p]["score"] for p in PILLARS) / 4
        company["equalWeightScore"] = int(round(equal))
        gap_penalty = max(0, company["sayDoGap"]) * 4
        company["netZeroFitness"] = int(
            max(
                0,
                min(
                    100,
                    round(
                        0.40 * company["pillars"]["environmental"]["score"]
                        + 0.15 * company["pillars"]["economic"]["score"]
                        + 0.15 * company["pillars"]["governance"]["score"]
                        + 0.10 * company["pillars"]["social"]["score"]
                        + 0.20 * (100 - min(100, 50 + 12 * company["sayDoGap"]))
                        - gap_penalty
                    ),
                ),
            )
        )

    companies.sort(key=lambda c: (-c["equalWeightScore"], c["name"]))
    for rank, company in enumerate(companies, start=1):
        company["rank"] = rank

    by_sector_tickers: dict[str, list[dict]] = defaultdict(list)
    for company in companies:
        by_sector_tickers[company["sector"]].append(company)

    sector_summaries = []
    for sector, members in sorted(by_sector_tickers.items()):
        ideal = members[0]["ideal"]
        sector_summaries.append(
            {
                "sector": sector,
                "count": len(members),
                "avgScore": int(round(sum(m["equalWeightScore"] for m in members) / len(members))),
                "avgGap": round(sum(m["sayDoGap"] for m in members) / len(members), 3),
                "leader": max(members, key=lambda m: m["equalWeightScore"])["ticker"],
                "ideal": ideal,
            }
        )

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "universe": "S&P 500",
        "companyCount": len(companies),
        "source": {
            "disclosures": str(DISCLOSURE_CSV.name),
            "constituents": str(CONSTITUENTS_CSV.name),
            "overrides": OVERRIDES_CSV.exists(),
            "note": (
                "Factor scores are built from latest 10-K sustainability passages. "
                "Silence is treated as a risk: missing factors receive a negative z-score. "
                "Add measured values in data/eseg_overrides.csv to replace a proxy."
            ),
        },
        "pillars": list(PILLARS.values()),
        "factors": [
            {
                "id": f["id"],
                "pillar": f["pillar"],
                "label": f["label"],
                "plain": f["plain"],
                "higherIsBetter": f["higher_is_better"],
            }
            for f in FACTORS
        ],
        "scoring": {
            "missingZ": MISSING_Z,
            "display": "z-score versus sector peers, shown as a 1-99 industry percentile (50 = typical)",
            "defaultWeights": {
                "environmental": 25,
                "social": 25,
                "economic": 25,
                "governance": 25,
            },
            "ideal": "90th percentile company in the same sector, factor by factor",
        },
        "sectors": sector_summaries,
        "companies": companies,
    }

    # Drop bulky raw passage copies from output.
    for company in payload["companies"]:
        for pack in company["factors"].values():
            pack.pop("adjusted", None)

    OUT_JSON.write_text(json.dumps(payload), encoding="utf-8")
    public_copy = ROOT / "web" / "public" / "data" / "eseg_master.json"
    public_copy.parent.mkdir(parents=True, exist_ok=True)
    public_copy.write_text(json.dumps(payload), encoding="utf-8")

    fieldnames = [
        "ticker",
        "name",
        "sector",
        "industry",
        "rank",
        "equalWeightScore",
        "netZeroFitness",
        "sayDoGap",
        "sayDoLabel",
        "completeness",
        "distanceToIdeal",
        "passages",
        "environmental",
        "social",
        "economic",
        "governance",
    ] + [f["id"] for f in FACTORS]
    with OUT_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for company in companies:
            row = {
                "ticker": company["ticker"],
                "name": company["name"],
                "sector": company["sector"],
                "industry": company["industry"],
                "rank": company["rank"],
                "equalWeightScore": company["equalWeightScore"],
                "netZeroFitness": company["netZeroFitness"],
                "sayDoGap": company["sayDoGap"],
                "sayDoLabel": company["sayDoLabel"],
                "completeness": company["completeness"],
                "distanceToIdeal": company["distanceToIdeal"],
                "passages": company["passages"],
                "environmental": company["pillars"]["environmental"]["score"],
                "social": company["pillars"]["social"]["score"],
                "economic": company["pillars"]["economic"]["score"],
                "governance": company["pillars"]["governance"]["score"],
            }
            for factor in FACTORS:
                row[factor["id"]] = company["factors"][factor["id"]]["score"]
            writer.writerow(row)

    print(f"Wrote {len(companies)} companies -> {OUT_JSON}")
    print(f"Wrote spreadsheet -> {OUT_CSV}")
    print("Top 8:", [(c["ticker"], c["equalWeightScore"]) for c in companies[:8]])
    print("Bottom 5:", [(c["ticker"], c["equalWeightScore"]) for c in companies[-5:]])


if __name__ == "__main__":
    main()

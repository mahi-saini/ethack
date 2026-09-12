import csv
import json
import logging
import re
import time
from io import StringIO
from pathlib import Path
from typing import Any, Dict, List, Optional
from bs4 import BeautifulSoup
import pandas as pd
import requests

# Set logging for pipeline traceability
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
)

# SEC requires specific User-Agent format: Organization Name contact@domain.com
HEADERS = {
    "User-Agent": "SustainabilityAnalyticsLab research@quantecofund.org",
    "Accept-Encoding": "gzip, deflate",
}

# Sustainability terms are grouped so the output can distinguish climate,
# environmental, social, and governance disclosures.
SUSTAINABILITY_PATTERNS = {
    "climate": re.compile(
        r"\b(scope\s*[123]|ghg|greenhouse gas(?:es)?|carbon(?:\s+(?:footprint|negative|neutral))?|"
        r"net[- ]zero|decarboni[sz]ation|climate(?: change|[- ]related)?|tcfd|methane|"
        r"carbon capture|carbon offset)\b",
        re.IGNORECASE,
    ),
    "environment": re.compile(
        r"\b(sustainab(?:ility|le)|environment(?:al)?|energy use|renewable energy|clean energy|"
        r"water(?: use| stress| positive)?|waste(?: management| reduction| zero)?|recycl(?:e|ing)|"
        r"biodiversity|ecosystem|pollution|emissions?|air quality|circular economy|"
        r"natural resources?|environmental justice)\b",
        re.IGNORECASE,
    ),
    "social": re.compile(
        r"\b(human rights?|modern slavery|forced labor|child labor|labor practices?|"
        r"employee safety|occupational health|diversity|inclusion|equal employment|"
        r"community engagement|social impact|responsible sourcing|supply chain)\b",
        re.IGNORECASE,
    ),
    "governance": re.compile(
        r"\b(esg|environmental,? social,? and governance|materiality|sustainability report|"
        r"sustainability accounting|sasb|issb|ghg protocol|governance framework|"
        r"disclosure requirement|climate risk)\b",
        re.IGNORECASE,
    ),
}

STRONG_SUSTAINABILITY_PATTERN = re.compile(
    r"\b(scope\s*[123]|ghg|greenhouse gas(?:es)?|net[- ]zero|carbon emissions?|"
    r"carbon footprint|decarboni[sz]ation|renewable energy|clean energy|"
    r"water (?:use|consumption|stress|positive)|waste (?:management|reduction|zero)|"
    r"biodiversity|ecosystem|pollution|human rights?|modern slavery|forced labor|"
    r"child labor|responsible sourcing|social impact|esg|materiality|sasb|issb|"
    r"ghg protocol|sustainability report|climate risk)\b",
    re.IGNORECASE,
)

WEAK_SUSTAINABILITY_PATTERN = re.compile(
    r"\b(environment(?:al)?|energy|water|waste|recycl(?:e|ing)|emissions?|"
    r"air quality|natural resources?|supply chain|labor practices?|employee safety|"
    r"occupational health|diversity|inclusion|equal employment|community engagement|"
    r"sustainab(?:ility|le)|climate(?: change|[- ]related)?)\b",
    re.IGNORECASE,
)

EXCLUDED_CONTEXTS = re.compile(
    r"\b(work environment|operating environment|business environment|water suppliers?|"
    r"supply chain interruptions?|sustainable employment|sustainable growth)\b",
    re.IGNORECASE,
)

LEGACY_TICKER_CIK = {
    "XOM": "0000034088",
}


class SEC10KBatchExtractor:

    def __init__(
        self,
        request_delay: float = 0.12,
        ticker_cache: str = "sec_company_tickers.json",
        max_retries: int = 4,
    ):
        self.request_delay = request_delay
        self.max_retries = max_retries
        self.ticker_cache = Path(ticker_cache)
        self.cik_ticker_map: Dict[str, str] = {}
        self.sp500_cik_map: Dict[str, str] = {}
        self._load_ticker_cik_map()

    def _rate_limited_get(self, url: str) -> requests.Response:
        """GET a URL with SEC-friendly pacing and bounded transient retries."""
        transient_statuses = {403, 408, 425, 429, 500, 502, 503, 504}

        for attempt in range(self.max_retries + 1):
            if attempt:
                delay = min(30.0, 2**attempt)
                logging.warning(
                    "Retrying %s in %.1f seconds (attempt %d/%d)...",
                    url,
                    delay,
                    attempt,
                    self.max_retries,
                )
                time.sleep(delay)
            else:
                time.sleep(self.request_delay)

            try:
                response = requests.get(url, headers=HEADERS, timeout=30)
            except requests.RequestException:
                if attempt == self.max_retries:
                    raise
                continue

            if response.status_code not in transient_statuses:
                response.raise_for_status()
                return response

            if attempt == self.max_retries:
                response.raise_for_status()

        raise RuntimeError(f"Unable to retrieve {url}")

    def _load_ticker_cik_map(self):
        """Loads mapping of tickers to SEC zero-padded CIK numbers."""
        if self.ticker_cache.exists():
            logging.info("Loading SEC company ticker registry from %s", self.ticker_cache)
            data = json.loads(self.ticker_cache.read_text(encoding="utf-8"))
        else:
            logging.info("Retrieving SEC company ticker registry...")
            url = "https://www.sec.gov/files/company_tickers.json"
            data = self._rate_limited_get(url).json()
            self.ticker_cache.write_text(
                json.dumps(data, indent=2), encoding="utf-8"
            )

        for item in data.values():
            ticker = item["ticker"].upper()
            cik_padded = str(item["cik_str"]).zfill(10)
            self.cik_ticker_map[ticker] = cik_padded

    def get_sp500_tickers(
        self,
        source_url: str = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies",
    ) -> List[str]:
        """Loads and normalizes the current S&P 500 constituent symbols."""
        response = requests.get(source_url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        tables = pd.read_html(StringIO(response.text))
        constituents = next(
            table for table in tables if {"Symbol", "Security"}.issubset(table.columns)
        )
        if "CIK" in constituents.columns:
            for _, row in constituents.iterrows():
                cik = str(row["CIK"]).strip()
                if cik and cik.lower() != "nan":
                    self.sp500_cik_map[str(row["Symbol"]).upper().replace(".", "-")] = cik.zfill(10)
        tickers = (
            constituents["Symbol"]
            .astype(str)
            .str.upper()
            .str.replace(".", "-", regex=False)
            .drop_duplicates()
            .tolist()
        )
        if len(tickers) < 490:
            raise ValueError(f"Expected about 500 S&P 500 constituents, found {len(tickers)}")
        return tickers

    def get_latest_10k_meta(self, ticker: str) -> Optional[Dict[str, str]]:
        """Retrieves accession number and document name for latest 10-K filing."""
        normalized_ticker = ticker.upper()
        cik = LEGACY_TICKER_CIK.get(normalized_ticker) or self.sp500_cik_map.get(
            normalized_ticker
        ) or self.cik_ticker_map.get(normalized_ticker)
        if not cik:
            logging.warning(f"Ticker {ticker} not found in SEC CIK registry.")
            return None

        url = f"https://data.sec.gov/submissions/CIK{cik}.json"
        try:
            payload = self._rate_limited_get(url).json()
            filings = payload.get("filings", {}).get("recent", {})
            forms = filings.get("form", [])

            for idx, form in enumerate(forms):
                if form == "10-K":
                    return {
                        "ticker": normalized_ticker,
                        "cik": cik,
                        "accession": filings["accessionNumber"][idx],
                        "filing_date": filings["filingDate"][idx],
                        "report_date": filings["reportDate"][idx],
                        "primary_doc": filings["primaryDocument"][idx],
                    }
            logging.warning(
                "No 10-K found for %s (CIK %s); available recent forms: %s",
                normalized_ticker,
                cik,
                ", ".join(dict.fromkeys(forms[:10])),
            )
        except Exception as e:
            logging.error(f"Error fetching metadata for {ticker}: {e}")
        return None

    def extract_climate_text(
        self, cik: str, accession: str, primary_doc: str
    ) -> List[Dict[str, Any]]:
        """Downloads primary 10-K and parses narrative passages."""
        acc_clean = accession.replace("-", "")
        cik_unpadded = str(int(cik))
        url = f"https://www.sec.gov/Archives/edgar/data/{cik_unpadded}/{acc_clean}/{primary_doc}"

        try:
            resp = self._rate_limited_get(url)
            soup = BeautifulSoup(resp.content, "html.parser")
            records = []
            seen_text = set()

            # Prefer paragraph/list leaves. Some SEC filings use divs as
            # paragraphs, so include only divs that do not contain another
            # narrative block; this prevents parent/child duplicates.
            elements = soup.find_all(["p", "li"])
            elements.extend(
                elem
                for elem in soup.find_all("div")
                if not elem.find(["p", "li", "div"])
            )

            for elem in elements:
                text = elem.get_text(separator=" ", strip=True)
                normalized_text = re.sub(r"\s+", " ", text).strip()
                text_key = normalized_text.casefold()
                # Keep substantive narrative passages; exclude table headers,
                # short tags, and repeated blocks in malformed filings.
                if 80 < len(normalized_text) < 2500 and text_key not in seen_text:
                    matched_terms = []
                    matched_categories = []
                    for category, pattern in SUSTAINABILITY_PATTERNS.items():
                        category_matches = [
                            match.group(0).lower()
                            for match in pattern.finditer(normalized_text)
                        ]
                        if category_matches:
                            matched_categories.append(category)
                            matched_terms.extend(category_matches)

                    if matched_categories:
                        strong_matches = [
                            match.group(0).lower()
                            for match in STRONG_SUSTAINABILITY_PATTERN.finditer(
                                normalized_text
                            )
                        ]
                        weak_matches = [
                            match.group(0).lower()
                            for match in WEAK_SUSTAINABILITY_PATTERN.finditer(
                                normalized_text
                            )
                        ]
                        excluded_matches = EXCLUDED_CONTEXTS.findall(normalized_text)
                        relevance_score = (3 * len(set(strong_matches))) + len(
                            set(weak_matches)
                        ) - len(set(excluded_matches))
                        is_relevant = bool(strong_matches) or (
                            not excluded_matches and len(set(weak_matches)) >= 2
                        )

                        seen_text.add(text_key)
                        records.append(
                            {
                                "categories": "; ".join(matched_categories),
                                "terms": "; ".join(sorted(set(matched_terms))),
                                "char_len": len(normalized_text),
                                "relevance_score": relevance_score,
                                "is_relevant": is_relevant,
                                "disclosure_text": normalized_text,
                            }
                        )
            return records
        except Exception as e:
            logging.error(f"Error extracting HTML for CIK {cik}: {e}")
            return []

    def run(
        self,
        tickers: Optional[List[str]] = None,
        output_csv: str = "sp500_sustainability_relevant_disclosures.csv",
    ):
        """Batch iterates constituents and saves rows to CSV."""
        if tickers is None:
            tickers = self.get_sp500_tickers()
        logging.info(f"Starting extraction across {len(tickers)} companies...")
        total_passages = 0

        with open(output_csv, mode="w", newline="", encoding="utf-8") as f:
            failures_csv = Path(output_csv).with_name(
                f"{Path(output_csv).stem}_failures.csv"
            )
            failures_file = open(failures_csv, mode="w", newline="", encoding="utf-8")
            writer = csv.writer(f)
            failure_writer = csv.writer(failures_file)
            writer.writerow(
                [
                    "ticker",
                    "cik",
                    "filing_date",
                    "accession_number",
                    "categories",
                    "matched_terms",
                    "length",
                    "relevance_score",
                    "source_url",
                    "text",
                ]
            )
            failure_writer.writerow(["ticker", "stage", "reason"])

            try:
                for idx, ticker in enumerate(tickers, start=1):
                    logging.info(
                        f"[{idx}/{len(tickers)}] Processing ticker: {ticker}"
                    )
                    meta = self.get_latest_10k_meta(ticker)
                    if not meta:
                        failure_writer.writerow([ticker, "metadata", "latest 10-K not found"])
                        failures_file.flush()
                        continue

                    disclosures = self.extract_climate_text(
                        meta["cik"], meta["accession"], meta["primary_doc"]
                    )
                    source_url = (
                        f"https://www.sec.gov/Archives/edgar/data/"
                        f"{int(meta['cik'])}/{meta['accession'].replace('-', '')}/"
                        f"{meta['primary_doc']}"
                    )

                    for item in disclosures:
                        if not item["is_relevant"]:
                            continue
                        writer.writerow(
                            [
                                ticker,
                                meta["cik"],
                                meta["filing_date"],
                                meta["accession"],
                                item["categories"],
                                item["terms"],
                                item["char_len"],
                                item["relevance_score"],
                                source_url,
                                item["disclosure_text"],
                            ]
                        )

                    total_passages += len(disclosures)
                    f.flush()
                    logging.info(
                        f"  -> Extracted {len(disclosures)} passages for {ticker}"
                    )
            finally:
                failures_file.close()

        logging.info(
            f"Extraction complete. Total records saved: {total_passages} -> {output_csv}"
        )


if __name__ == "__main__":
    extractor = SEC10KBatchExtractor(request_delay=0.15)
    extractor.run()
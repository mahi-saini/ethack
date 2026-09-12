# Green Liquid

A public, human-centered score for how S&P 500 companies take care of the planet, people, money, and trust.

## Why this data

Every S&P 500 company already files a 10-K. Those documents are public, yearly, and legally serious — so they are a fair starting point for comparing companies, not a private ESG vendor score. `extract.py` pulls sustainability passages from the latest 10-K. `scripts/build_eseg_dataset.py` turns those passages plus the official constituent list into 21 everyday ESEG factors.

When you have measured values (carbon, pay gap, board independence), put them in `data/eseg_overrides.csv` and rebuild. The app does not need to change.

## Score in one sentence

We ask: is this company better or worse than the usual company in its own industry? Silence counts against you. You can turn the four pillars up or down; they start even at 25% each.

## Run it

```bash
python3 scripts/build_eseg_dataset.py
cd web
npm install
npm run dev
```

Open the local URL, then demo: Explore → a company → Rankings (move the sliders) → Charts (say vs do) → Advisor (“The world just committed to net-zero. Allocate my $1 billion.”).

# Top Gainers Content Factory

Python automation for daily stock-gainer Facebook assets.

## Install

```bash
python3 -m venv .venv-top-gainers
source .venv-top-gainers/bin/activate
pip install -r requirements-top-gainers.txt
```

## Credentials

The script reads credentials from `.env` first, then falls back to
`public/app_data/api_profiles.json`.

Supported `.env` keys:

```bash
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=google/gemini-2.5-flash
NEWS_API_KEY=...
DROPBOX_ACCESS_TOKEN=...
DROPBOX_REFRESH_TOKEN=...
DROPBOX_APP_KEY=...
DROPBOX_APP_SECRET=...
```

## P2 Rules

The master spreadsheet is always read from cell `P2`.

Examples:

```text
symbols: NVDA, AMD, TSLA
watchlist: PLTR, SOUN, IONQ
sector: Technology
```

If `P2` contains symbols/watchlist, only those tickers are processed. If it
contains a sector, Yahoo day gainers are filtered by that sector.

## Run

```bash
python3 scripts/top_gainers_content_factory.py \
  --spreadsheet "/path/to/master.xlsx" \
  --limit 5 \
  --dropbox-folder "/Stock_Gainers_Content"
```

Outputs are written to:

```text
temp/YYYY-MM-DD/
temp/YYYY-MM-DD/content_factory_post.csv
```

The CSV columns are `Date`, `Symbol`, `Caption`, `Image_URL`, and `Config_Ref`.
Dropbox links are converted from `?dl=0` to `?raw=1`.

For a local-only test:

```bash
python3 scripts/top_gainers_content_factory.py --spreadsheet "/path/to/master.csv" --limit 1 --skip-dropbox
```

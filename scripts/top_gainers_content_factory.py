#!/usr/bin/env python3
"""
Automated Top Gainers Content Factory (Dropbox & CSV Edition).

Reads the master spreadsheet config strictly from cell P2, fetches top gainers,
creates 1080x1350 finance images, uploads them to Dropbox, and writes
content_factory_post.csv for batch posting.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
FONT_DIR = ROOT / "public" / "Font_stock"
DEFAULT_DROPBOX_ROOT = "/Stock_Gainers_Content"
DEFAULT_OUTPUT_ROOT = ROOT / "temp"
CANVAS_SIZE = (1080, 1350)
BG = "#0d1117"
BULL = "#3fb950"
BEAR = "#f85149"
MUTED = "#8b949e"
TEXT = "#f0f6fc"


@dataclass
class DropboxCreds:
    access_token: str = ""
    refresh_token: str = ""
    app_key: str = ""
    app_secret: str = ""


@dataclass
class AppCreds:
    openrouter_key: str = ""
    openai_key: str = ""
    news_api_key: str = ""
    dropbox: DropboxCreds = field(default_factory=DropboxCreds)


@dataclass
class StockItem:
    symbol: str
    company_name: str = ""
    price: float = 0.0
    pct_change: float = 0.0
    volume: int = 0
    sector: str = ""
    website: str = ""
    domain: str = ""
    ohlc: Any = None
    news: list[str] = field(default_factory=list)
    headline: str = ""
    caption: str = ""
    image_path: Path | None = None
    dropbox_url: str = ""
    pe_ratio: float = 0.0


def load_dotenv_if_available() -> None:
    try:
        from dotenv import load_dotenv

        load_dotenv(ROOT / ".env")
        load_dotenv()
    except Exception:
        pass


def read_profiles() -> list[dict[str, Any]]:
    path = ROOT / "public" / "app_data" / "api_profiles.json"
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text("utf-8"))
        return data if isinstance(data, list) else []
    except Exception:
        return []


def load_credentials(profile_name: str = "") -> AppCreds:
    load_dotenv_if_available()
    profiles = read_profiles()
    profile = None
    if profile_name:
        profile = next((p for p in profiles if p.get("name") == profile_name or p.get("id") == profile_name), None)
    if profile is None:
        profile = next((p for p in profiles if p.get("active")), None) or (profiles[0] if profiles else {})

    return AppCreds(
        openrouter_key=os.getenv("OPENROUTER_API_KEY") or profile.get("openRouterKey", ""),
        openai_key=os.getenv("OPENAI_API_KEY", ""),
        news_api_key=os.getenv("NEWS_API_KEY", ""),
        dropbox=DropboxCreds(
            access_token=os.getenv("DROPBOX_ACCESS_TOKEN") or profile.get("dropboxKey", ""),
            refresh_token=os.getenv("DROPBOX_REFRESH_TOKEN") or profile.get("dropboxRefreshToken", ""),
            app_key=os.getenv("DROPBOX_APP_KEY") or profile.get("dropboxAppKey", ""),
            app_secret=os.getenv("DROPBOX_APP_SECRET") or profile.get("dropboxAppSecret", ""),
        ),
    )


def read_p2(spreadsheet_path: Path, sheet_name: str = "") -> str:
    suffix = spreadsheet_path.suffix.lower()
    if suffix in {".xlsx", ".xlsm", ".xltx", ".xltm"}:
        from openpyxl import load_workbook

        wb = load_workbook(spreadsheet_path, data_only=True, read_only=True)
        ws = wb[sheet_name] if sheet_name else wb.active
        value = ws["P2"].value
        return "" if value is None else str(value).strip()

    if suffix == ".csv":
        with spreadsheet_path.open("r", encoding="utf-8-sig", newline="") as f:
            rows = list(csv.reader(f))
        if len(rows) < 2 or len(rows[1]) < 16:
            return ""
        return str(rows[1][15]).strip()

    raise ValueError(f"Unsupported spreadsheet type: {spreadsheet_path.suffix}. Use .xlsx, .xlsm, or .csv.")


def parse_p2_config(raw: str) -> dict[str, Any]:
    clean = raw.strip()
    lowered = clean.lower()
    symbols: list[str] = []
    sector = ""

    sector_match = re.search(r"(?:sector|target sector)\s*[:=]\s*([^;\n]+)", clean, re.I)
    if sector_match:
        sector = sector_match.group(1).strip()

    symbol_match = re.search(r"(?:symbols?|tickers?|watchlist|override symbols?)\s*[:=]\s*([^;\n]+)", clean, re.I)
    if symbol_match:
        symbols = extract_symbol_tokens(symbol_match.group(1), allow_lowercase=True)
    elif not sector_match:
        symbols = extract_symbol_tokens(clean, allow_lowercase=False)

    if not sector and lowered.startswith("sector:"):
        sector = clean.split(":", 1)[1].strip()

    # If the whole P2 looks like prose rather than tickers, treat it as a sector/filter hint.
    if not symbols and not sector and clean:
        sector = clean

    return {"raw": raw, "symbols": list(dict.fromkeys(symbols)), "sector": sector}


def extract_symbol_tokens(value: str, allow_lowercase: bool) -> list[str]:
    symbols: list[str] = []
    for raw_token in re.split(r"[,;\s]+", value):
        raw_token = raw_token.strip()
        token = raw_token.upper()
        if token in {"SECTOR", "WATCHLIST", "SYMBOL", "SYMBOLS", "TICKER", "TICKERS"}:
            continue
        if not re.fullmatch(r"[A-Z][A-Z0-9.\-]{0,8}", token):
            continue
        if not allow_lowercase and raw_token != token:
            continue
        symbols.append(token)
    return symbols


def requests_session():
    import requests

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": "BulkVideoCreatorApp/TopGainersContentFactory",
            "Accept": "application/json,text/html;q=0.8,*/*;q=0.5",
        }
    )
    return session


def fetch_yahoo_screener(scr_id: str, count: int) -> list[dict[str, Any]]:
    session = requests_session()
    url = "https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved"
    # Yahoo Finance predefined screeners have a maximum limit of 250 items.
    params = {"scrIds": scr_id, "count": min(max(count, 25), 250)}
    res = session.get(url, params=params, timeout=20)
    res.raise_for_status()
    payload = res.json()
    quotes = payload.get("finance", {}).get("result", [{}])[0].get("quotes", [])
    return quotes if isinstance(quotes, list) else []


def fetch_yahoo_day_gainers(count: int) -> list[dict[str, Any]]:
    return fetch_yahoo_screener("day_gainers", count)


def fetch_history_and_info(symbol: str) -> StockItem:
    import yfinance as yf

    ticker = yf.Ticker(symbol)
    hist = ticker.history(period="30d", interval="1d", auto_adjust=False)
    if hist is None or hist.empty:
        raise ValueError(f"No 30-day OHLC data returned for {symbol}")

    info: dict[str, Any] = {}
    try:
        info = ticker.get_info() or {}
    except Exception:
        try:
            info = ticker.info or {}
        except Exception:
            info = {}

    latest = hist.iloc[-1]
    prev_close = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else float(latest["Open"])
    price = float(info.get("regularMarketPrice") or latest["Close"])
    pct_change = info.get("regularMarketChangePercent")
    if pct_change is None and prev_close:
        pct_change = ((price - prev_close) / prev_close) * 100

    website = str(info.get("website") or "")
    domain = domain_from_url(website)
    pe_raw = info.get("trailingPE") or info.get("forwardPE")
    pe_ratio = float(pe_raw) if pe_raw is not None else 0.0
    return StockItem(
        symbol=symbol.upper(),
        company_name=str(info.get("shortName") or info.get("longName") or symbol.upper()),
        price=price,
        pct_change=float(pct_change or 0),
        volume=int(info.get("regularMarketVolume") or latest.get("Volume") or 0),
        sector=str(info.get("sector") or ""),
        website=website,
        domain=domain,
        ohlc=hist,
        pe_ratio=pe_ratio,
    )


def get_stock_universe(config: dict[str, Any], limit: int, scan_count: int) -> list[StockItem]:
    symbols = config["symbols"]
    if not symbols:
        quotes = fetch_yahoo_day_gainers(max(scan_count, limit * 20))
        sector_filter = str(config.get("sector") or "").strip().lower()
        symbols = [str(q.get("symbol", "")).upper() for q in quotes if q.get("symbol")]
        if not symbols:
            raise RuntimeError("Yahoo screener did not return any day gainers.")

        print(f"[INFO] Yahoo day gainers scanned: {len(symbols)} candidates")
        if sector_filter:
            print(f"[INFO] Sector filter from P2: {config.get('sector')}")

        items: list[StockItem] = []
        for symbol in symbols:
            try:
                item = fetch_history_and_info(symbol)
                if sector_filter and sector_filter not in item.sector.lower():
                    continue
                items.append(item)
                if len(items) >= limit:
                    break
            except Exception as exc:
                print(f"[WARN] Skip {symbol}: {exc}", file=sys.stderr)
        if sector_filter and len(items) < limit:
            print(
                f"[WARN] Found only {len(items)} matching {config.get('sector')} gainers "
                f"after scanning {len(symbols)} Yahoo candidates.",
                file=sys.stderr,
            )
        return sorted(items, key=lambda i: i.pct_change, reverse=True)[:limit]

    items = []
    for symbol in symbols[:limit]:
        try:
            items.append(fetch_history_and_info(symbol))
        except Exception as exc:
            print(f"[WARN] Skip {symbol}: {exc}", file=sys.stderr)
    return sorted(items, key=lambda i: i.pct_change, reverse=True)[:limit]


def _screen_stocks_from_quotes(quotes: list[dict[str, Any]], limit: int,
                               sector_filter: str = "", sort_key=None, reverse: bool = True) -> list[StockItem]:
    symbols = [str(q.get("symbol", "")).upper() for q in quotes if q.get("symbol")]
    items: list[StockItem] = []
    for symbol in symbols:
        try:
            item = fetch_history_and_info(symbol)
            if sector_filter and sector_filter not in item.sector.lower():
                continue
            items.append(item)
            if len(items) >= limit:
                break
        except Exception as exc:
            print(f"[WARN] Skip {symbol}: {exc}", file=sys.stderr)
    if sort_key:
        items = sorted(items, key=sort_key, reverse=reverse)
    return items[:limit]


def _screen_low_pe(limit: int, scan_count: int, pe_threshold: float = 20.0) -> list[StockItem]:
    # Try the undervalued screener first; fall back to most_actives
    quotes = fetch_yahoo_screener("undervalued_large_caps", max(scan_count, limit * 20))
    if not quotes:
        quotes = fetch_yahoo_screener("most_actives", max(scan_count, limit * 20))
    if not quotes:
        raise RuntimeError("Yahoo screener returned no candidates for low P/E screening.")

    symbols = [str(q.get("symbol", "")).upper() for q in quotes if q.get("symbol")]
    print(f"[INFO] Low P/E screening: {len(symbols)} candidates, PE threshold < {pe_threshold}")
    items: list[StockItem] = []
    all_pe_items: list[StockItem] = []
    for symbol in symbols:
        try:
            item = fetch_history_and_info(symbol)
            if item.pe_ratio > 0:
                all_pe_items.append(item)
            if item.pe_ratio > 0 and item.pe_ratio < pe_threshold:
                items.append(item)
                if len(items) >= limit:
                    break
        except Exception as exc:
            print(f"[WARN] Skip {symbol}: {exc}", file=sys.stderr)

    # If threshold too strict, relax and use lowest available PE
    if not items and all_pe_items:
        print(f"[WARN] No stocks with PE < {pe_threshold}; using {len(all_pe_items)} lowest-PE available", file=sys.stderr)
        items = sorted(all_pe_items, key=lambda i: i.pe_ratio)[:limit]

    return items[:limit]


def get_stock_universe_by_mode(config: dict[str, Any], limit: int, scan_count: int, mode: str) -> list[StockItem]:
    """Route to the correct screener based on mode."""
    if mode == "losers":
        quotes = fetch_yahoo_screener("day_losers", max(scan_count, limit * 20))
        if not quotes:
            raise RuntimeError("Yahoo day_losers screener returned no results.")
        print(f"[INFO] Day losers scanned: {len(quotes)} candidates")
        return _screen_stocks_from_quotes(quotes, limit,
                                          sort_key=lambda i: i.pct_change, reverse=False)

    if mode == "low_pe":
        return _screen_low_pe(limit, scan_count)

    if mode == "trending":
        quotes = fetch_yahoo_screener("most_actives", max(scan_count, limit * 20))
        if not quotes:
            raise RuntimeError("Yahoo most_actives screener returned no results.")
        print(f"[INFO] Most actives scanned: {len(quotes)} candidates")
        return _screen_stocks_from_quotes(quotes, limit,
                                          sort_key=lambda i: i.volume, reverse=True)

    # Default: gainers (existing behavior, respects sector/symbol P2 config)
    return get_stock_universe(config, limit, scan_count)


def domain_from_url(url: str) -> str:
    if not url:
        return ""
    parsed = urlparse(url if "://" in url else f"https://{url}")
    return parsed.netloc.replace("www.", "").strip("/")


def fetch_news(item: StockItem, creds: AppCreds) -> list[str]:
    headlines: list[str] = []
    session = requests_session()
    query = f"{item.symbol} OR \"{item.company_name}\""
    if creds.news_api_key:
        try:
            res = session.get(
                "https://newsapi.org/v2/everything",
                params={
                    "q": query,
                    "language": "en",
                    "sortBy": "publishedAt",
                    "pageSize": 3,
                    "apiKey": creds.news_api_key,
                },
                timeout=15,
            )
            res.raise_for_status()
            articles = res.json().get("articles", [])
            headlines = [str(a.get("title") or "").strip() for a in articles if a.get("title")]
        except Exception as exc:
            print(f"[WARN] NewsAPI failed for {item.symbol}: {exc}", file=sys.stderr)

    if len(headlines) < 3:
        try:
            import yfinance as yf

            ticker_news = getattr(yf.Ticker(item.symbol), "news", []) or []
            for entry in ticker_news:
                title = entry.get("title") or entry.get("content", {}).get("title")
                if title:
                    headlines.append(str(title).strip())
                if len(headlines) >= 3:
                    break
        except Exception:
            pass

    return list(dict.fromkeys([h for h in headlines if h]))[:3]


def summarize_ohlc(item: StockItem) -> str:
    rows = []
    hist = item.ohlc.tail(30)
    for idx, row in hist.iterrows():
        day = idx.strftime("%Y-%m-%d") if hasattr(idx, "strftime") else str(idx)
        rows.append(
            f"{day}: O={float(row['Open']):.2f}, H={float(row['High']):.2f}, "
            f"L={float(row['Low']):.2f}, C={float(row['Close']):.2f}, V={int(row['Volume'])}"
        )
    return "\n".join(rows)


def generate_caption(item: StockItem, creds: AppCreds, model: str, mode: str = "gainers") -> str:
    news_block = "\n".join(f"- {h}" for h in item.news) or "- No major headline found"
    mode_instruction = {
        "gainers": "วิเคราะห์ว่าทำไมหุ้นตัวนี้ราคาพุ่งขึ้นสูงวันนี้ เน้นโมเมนตัมและแรงซื้อ",
        "losers":  "วิเคราะห์ว่าทำไมหุ้นตัวนี้ราคาร่วงลงมา บอกว่าผู้ลงทุนควรระวังหรือน่าซื้อที่จุดนี้หรือไม่",
        "low_pe":  f"เน้นวิเคราะห์ว่าหุ้นตัวนี้มี P/E ต่ำ ({item.pe_ratio:.1f}x) และน่าสนใจในเชิง Value Investing อย่างไร",
        "trending": "วิเคราะห์ว่าทำไมหุ้นตัวนี้ถึงมีปริมาณซื้อขายสูงมาก และมีข่าวอะไรน่าจับตาวันนี้",
    }.get(mode, "วิเคราะห์ว่าทำไมหุ้นตัวนี้ถึงน่าสนใจวันนี้")

    pe_line = f"P/E Ratio: {item.pe_ratio:.2f}x\n" if item.pe_ratio > 0 else ""
    prompt = (
        f"Analyze this stock. {mode_instruction}\n"
        "Write a short, engaging 2-3 sentence summary in Thai. Tone: Professional, exciting, "
        "and highly engaging for a financial Facebook page.\n\n"
        f"Symbol: {item.symbol}\nCompany: {item.company_name}\n"
        f"Price: {item.price:.2f}\n% Change: {item.pct_change:.2f}%\nVolume: {item.volume:,}\n"
        f"{pe_line}"
        f"OHLC last 30 trading days:\n{summarize_ohlc(item)}\n\nNews:\n{news_block}\n\n"
        "Return your response EXACTLY in this format:\n\n"
        "IMAGE_TEXT:\n"
        "[Write exactly 3 lines in Thai. Separate each line with a newline character.\n"
        "CRITICAL: Each line must be a COMPLETE phrase — never break a word across lines!\n"
        "Line 1: Short hook or question (8-15 chars). Example: ทำไมหุ้นนี้พุ่ง?\n"
        "Line 2: Key fact with **stock_symbol** highlighted (12-25 chars). Example: **NVDA** ทำสถิติใหม่\n"
        "Line 3: Punchy takeaway (10-20 chars). Example: นักลงทุนต้องจับตา!\n"
        "Use **double asterisks** to wrap ONLY the stock symbol and 1-2 key Thai words you want emphasized.\n"
        "NO EMOJIS. NO special symbols. Keep it readable and impactful.]\n\n"
        "POST_CAPTION:\n"
        "[Write a concise but professional stock analysis article in Thai for a financial Facebook page.\n"
        "Use this structure:\n"
        "1. 🧠 Hook headline — one line summarizing the stock's story today\n"
        "2. Price summary — current price, % change, volume, 1-month trend in 2-3 sentences\n"
        "3. 🔑 Why it matters — 3-4 bullet points explaining what's driving the move (news, sector rotation, earnings, etc.)\n"
        "4. 📍 Key levels — Support and Resistance zones from the chart (2-3 levels each)\n"
        "5. ⚠️ Risks — 2-3 key risks investors should watch\n"
        "6. 🎯 Action plan — Brief recommendation for different investor types\n"
        "7. Disclaimer line\n\n"
        "Keep it concise (300-500 words). Use Thai mixed with English financial terms naturally.\n"
        "Use emojis sparingly for section headers only. Make it feel professional like a real analyst wrote it.]\n\n"
        "DO NOT use any emojis or special symbols in IMAGE_TEXT."
    )

    if creds.openrouter_key:
        try:
            return chat_completion(
                api_key=creds.openrouter_key,
                base_url="https://openrouter.ai/api/v1/chat/completions",
                model=model,
                prompt=prompt,
                headers={"HTTP-Referer": "http://localhost", "X-Title": "BulkVideoCreatorApp"},
            )
        except Exception as exc:
            print(f"[WARN] OpenRouter caption failed for {item.symbol}: {exc}", file=sys.stderr)

    if creds.openai_key:
        try:
            return chat_completion(
                api_key=creds.openai_key,
                base_url="https://api.openai.com/v1/chat/completions",
                model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                prompt=prompt,
                headers={},
            )
        except Exception as exc:
            print(f"[WARN] OpenAI caption failed for {item.symbol}: {exc}", file=sys.stderr)

    headline_str = item.news[0] if item.news else "ตลาดกำลังจับตาหุ้นตัวนี้"
    if mode == "losers":
        return (
            f"IMAGE_TEXT:\nระวัง! หุ้นร่วงหนัก\n**{item.symbol}** ดิ่ง {abs(item.pct_change):.2f}%\nนักลงทุนควรทำอย่างไร?\n\n"
            f"POST_CAPTION:\n{item.symbol} วันนี้ราคาร่วงลง {abs(item.pct_change):.2f}% "
            f"มาอยู่ที่ {item.price:.2f} ดอลลาร์ ด้วยวอลุ่ม {item.volume:,} หุ้น\n\n"
            f"ข่าวสำคัญ: \"{headline_str}\"\n\nอาจเป็นปัจจัยที่ส่งผลกระทบ นักลงทุนควรติดตามสถานการณ์อย่างใกล้ชิด"
        )
    if mode == "low_pe":
        pe_str = f"P/E {item.pe_ratio:.1f}x" if item.pe_ratio > 0 else "P/E ต่ำ"
        return (
            f"IMAGE_TEXT:\nหุ้นคุณค่า น่าสะสม\n**{item.symbol}** ด้วย {pe_str}\nโอกาสทอง?\n\n"
            f"POST_CAPTION:\n{item.symbol} น่าสนใจในเชิง Value Investing ด้วย{pe_str} "
            f"ราคาปัจจุบัน {item.price:.2f} ดอลลาร์ เปลี่ยนแปลง {item.pct_change:+.2f}%\n\nข่าว \"{headline_str}\" เป็นปัจจัยที่ควรติดตาม"
        )
    if mode == "trending":
        return (
            f"IMAGE_TEXT:\nซื้อขายเดือดสุดๆ\n**{item.symbol}** พุ่งติดเทรนด์\nจับตาด่วน!\n\n"
            f"POST_CAPTION:\n{item.symbol} มีปริมาณซื้อขายพุ่งสูงถึง {item.volume:,} หุ้นวันนี้ "
            f"ราคาเปลี่ยนแปลง {item.pct_change:+.2f}% มาอยู่ที่ {item.price:.2f} ดอลลาร์\n\nข่าว \"{headline_str}\" ทำให้เป็นหุ้นที่ต้องจับตาเป็นพิเศษ"
        )
    return (
        f"IMAGE_TEXT:\nพุ่งแรง น่าจับตา!\n**{item.symbol}** บวก {item.pct_change:.2f}%\nโอกาสทองมาแล้ว?\n\n"
        f"POST_CAPTION:\n{item.symbol} วันนี้โดดเด่นด้วยแรงซื้อหนุนให้ราคาปรับขึ้น {item.pct_change:.2f}% "
        f"มาปิดใกล้ {item.price:.2f} ดอลลาร์ พร้อมวอลุ่ม {item.volume:,} หุ้น\n\nข่าวล่าสุดอย่าง \"{headline_str}\" ทำให้หุ้นตัวนี้น่าจับตาสำหรับเพจการเงินวันนี้"
    )


def chat_completion(api_key: str, base_url: str, model: str, prompt: str, headers: dict[str, str]) -> str:
    session = requests_session()
    res = session.post(
        base_url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            **headers,
        },
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": "You write concise, accurate Thai financial social captions."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.75,
            "max_tokens": 280,
        },
        timeout=45,
    )
    res.raise_for_status()
    data = res.json()
    return data["choices"][0]["message"]["content"].strip()


def fetch_logo(item: StockItem) -> bytes | None:
    if not item.domain:
        return None
    session = requests_session()
    url = f"https://logo.clearbit.com/{item.domain}"
    try:
        res = session.get(url, timeout=15)
        if res.status_code == 200 and res.content:
            return res.content
    except Exception as exc:
        print(f"[WARN] Clearbit logo failed for {item.symbol}: {exc}", file=sys.stderr)
    return None


def remove_logo_background(image_bytes: bytes) -> bytes:
    try:
        from rembg import remove

        return remove(image_bytes)
    except Exception:
        return image_bytes


def generate_chart(item: StockItem, output_path: Path) -> Path:
    import mplfinance as mpf

    hist = item.ohlc.copy()
    if "Adj Close" in hist.columns:
        hist = hist.drop(columns=["Adj Close"])
    market_colors = mpf.make_marketcolors(up=BULL, down=BEAR, edge="inherit", wick="inherit", volume=BULL)
    style = mpf.make_mpf_style(
        base_mpf_style="nightclouds",
        marketcolors=market_colors,
        facecolor=BG,
        figcolor=BG,
        gridcolor=BG,
        gridstyle="",
        rc={"axes.labelcolor": MUTED, "xtick.color": MUTED, "ytick.color": MUTED},
    )
    mpf.plot(
        hist.tail(30),
        type="candle",
        volume=False,
        style=style,
        axisoff=True,
        tight_layout=True,
        figsize=(9.6, 5.8),
        savefig=dict(fname=str(output_path), dpi=160, bbox_inches="tight", pad_inches=0.03, facecolor=BG),
    )
    return output_path


def load_font(name: str, size: int):
    from PIL import ImageFont

    path = FONT_DIR / name
    if path.exists():
        return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def image_from_logo_bytes(image_bytes: bytes | None, symbol: str):
    from PIL import Image, ImageDraw

    if image_bytes:
        try:
            logo = Image.open(io.BytesIO(remove_logo_background(image_bytes))).convert("RGBA")
            logo.thumbnail((120, 120), Image.Resampling.LANCZOS)
            canvas = Image.new("RGBA", (120, 120), (0, 0, 0, 0))
            canvas.alpha_composite(logo, ((120 - logo.width) // 2, (120 - logo.height) // 2))
            return canvas
        except Exception:
            pass

    fallback = Image.new("RGBA", (120, 120), (22, 27, 34, 255))
    draw = ImageDraw.Draw(fallback)
    draw.ellipse((4, 4, 116, 116), fill=(13, 17, 23, 255), outline=(63, 185, 80, 255), width=4)
    font = load_font("Kanit-Bold.ttf", 34)
    text = symbol[:3]
    bbox = draw.textbbox((0, 0), text, font=font)
    draw.text(((120 - (bbox[2] - bbox[0])) / 2, (120 - (bbox[3] - bbox[1])) / 2 - 3), text, font=font, fill=TEXT)
    return fallback


def draw_wrapped_text(draw, text: str, xy: tuple[int, int], font, fill: str, max_width: int, line_gap: int = 8) -> int:
    x, y = xy
    lines: list[str] = []
    for paragraph in text.splitlines():
        paragraph = paragraph.strip()
        if not paragraph:
            lines.append("")
            continue
        words = paragraph.split()
        if len(words) == 1:
            lines.extend(wrap_long_token(draw, paragraph, font, max_width))
            continue
        current = ""
        for word in words:
            candidate = f"{current} {word}".strip()
            if draw.textlength(candidate, font=font) <= max_width:
                current = candidate
            else:
                if current:
                    lines.append(current)
                if draw.textlength(word, font=font) > max_width:
                    split = wrap_long_token(draw, word, font, max_width)
                    lines.extend(split[:-1])
                    current = split[-1]
                else:
                    current = word
        if current:
            lines.append(current)

    for line in lines:
        draw.text((x, y), line, font=font, fill=fill)
        bbox = draw.textbbox((x, y), line or " ", font=font)
        y += bbox[3] - bbox[1] + line_gap
    return y


def wrap_long_token(draw, token: str, font, max_width: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for ch in token:
        candidate = current + ch
        if draw.textlength(candidate, font=font) <= max_width or not current:
            current = candidate
        else:
            lines.append(current)
            current = ch
    if current:
        lines.append(current)
    return lines or [token]


def clean_text_for_font(text: str) -> str:
    # Remove emojis and unrenderable characters for basic Thai/English fonts
    import re
    return re.sub(r'[^\u0E00-\u0E7F\u0020-\u007E\u2013\u2014\u2018\u2019\u201C\u201D\*]', '', text).strip()

def draw_rich_text_wrapped(draw, text: str, xy: tuple[int, int], font, default_color: str, highlight_color: str, max_width: int, line_gap: int = 8) -> int:
    """Render a 3-line headline with per-line auto-scaling and tight highlights.

    Each line from the AI is separated by \\n.  For each line we measure the
    total width at the base font size, and if it exceeds *max_width* the font
    is scaled down so it fits perfectly – no mid-word wrapping.

    Highlighted text (wrapped in **) gets a tight background pill matching
    the reference design.
    """
    import re
    x_start, y = xy
    text = clean_text_for_font(text)

    # ── Split into explicit lines (AI outputs \n between them) ──
    raw_lines = [ln.strip() for ln in text.split('\n') if ln.strip()]
    if not raw_lines:
        return y

    # Base font info
    base_font_name = getattr(font, 'path', None) or "Kanit-Bold.ttf"
    # Try to get the base font path; fall back gracefully
    try:
        base_size = font.size
    except AttributeError:
        base_size = 60

    pad_x, pad_y = 4, 2  # Tight highlight padding like reference image

    for raw_line in raw_lines:
        # Parse **highlights** within this line
        segments: list[tuple[str, bool]] = []
        for part in re.split(r'(\*\*.*?\*\*)', raw_line):
            if not part:
                continue
            if part.startswith('**') and part.endswith('**'):
                segments.append((part[2:-2], True))
            else:
                segments.append((part, False))

        plain_text = ''.join(seg[0] for seg in segments)
        if not plain_text.strip():
            y += line_gap
            continue

        # ── Auto-scale: find the largest font size that fits ──
        cur_size = base_size
        cur_font = load_font(base_font_name, cur_size)
        total_w = draw.textlength(plain_text, font=cur_font)
        while total_w > max_width and cur_size > 24:
            cur_size -= 2
            cur_font = load_font(base_font_name, cur_size)
            total_w = draw.textlength(plain_text, font=cur_font)

        ref_bbox = draw.textbbox((0, 0), "Aygjป์", font=cur_font)
        line_h = ref_bbox[3] - ref_bbox[1]

        # ── 1st pass: draw highlight backgrounds ──
        rx = x_start
        for seg_text, is_hl in segments:
            seg_w = draw.textlength(seg_text, font=cur_font)
            if is_hl and seg_text.strip():
                bg = [rx - pad_x, y + ref_bbox[1] - pad_y,
                      rx + seg_w + pad_x, y + ref_bbox[3] + pad_y]
                draw.rounded_rectangle(bg, radius=6, fill="#FFC107")
            rx += seg_w

        # ── 2nd pass: draw text ──
        rx = x_start
        for seg_text, is_hl in segments:
            color = "#111827" if is_hl else default_color
            draw.text((rx, y), seg_text, font=cur_font, fill=color)
            rx += draw.textlength(seg_text, font=cur_font)

        y += line_h + line_gap + 12

    return y


# ── Canvas helper functions ──────────────────────────────────────────

def _draw_header(draw, canvas, item, logo_bytes, title_font, company_font, metric_font, price_font, bg_fill, outline_color, text_color, muted_color):
    draw.rounded_rectangle((44, 44, 1036, 216), radius=8, fill=bg_fill, outline=outline_color, width=2)
    logo = image_from_logo_bytes(logo_bytes, item.symbol)
    canvas.paste(logo, (74, 70), logo)
    draw.text((218, 68), item.symbol, font=title_font, fill=text_color)
    company = item.company_name[:34] + ("..." if len(item.company_name) > 34 else "")
    draw.text((222, 145), company, font=company_font, fill=muted_color)
    metric = f"+{item.pct_change:.2f}%" if item.pct_change >= 0 else f"{item.pct_change:.2f}%"
    m_bbox = draw.textbbox((0, 0), metric, font=metric_font)
    draw.text((1002 - (m_bbox[2] - m_bbox[0]), 68), metric, font=metric_font, fill=BULL if item.pct_change >= 0 else BEAR)
    price = f"${item.price:,.2f}"
    p_bbox = draw.textbbox((0, 0), price, font=price_font)
    draw.text((1002 - (p_bbox[2] - p_bbox[0]), 145), price, font=price_font, fill=text_color)


def _paste_chart(draw, canvas, chart_path, chart_area, bg_fill, outline_color):
    from PIL import Image
    x1, y1, x2, y2 = chart_area
    draw.rounded_rectangle(chart_area, radius=8, fill=bg_fill, outline=outline_color, width=2)
    chart = Image.open(chart_path).convert("RGB")
    chart.thumbnail((x2 - x1 - 12, y2 - y1 - 12), Image.Resampling.LANCZOS)
    canvas.paste(chart, (x1 + (x2 - x1 - chart.width) // 2, y1 + (y2 - y1 - chart.height) // 2))


# ── Canvas Style 1: Classic Dark ─────────────────────────────────────
def compose_canvas_classic(item, chart_path, logo_bytes, output_path):
    from PIL import Image, ImageDraw
    canvas = Image.new("RGB", CANVAS_SIZE, BG)
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, 1080, 10), fill=BULL)
    _draw_header(draw, canvas, item, logo_bytes,
                 load_font("Kanit-Bold.ttf", 66), load_font("Prompt-Regular.ttf", 30),
                 load_font("Kanit-Bold.ttf", 60), load_font("Prompt-Bold.ttf", 34),
                 "#161b22", "#30363d", TEXT, MUTED)
    _paste_chart(draw, canvas, chart_path, (44, 236, 1036, 948), "#0b0f14", "#30363d")
    hl = getattr(item, 'headline', f"อัปเดตหุ้น **{item.symbol}**")
    draw_rich_text_wrapped(draw, hl, (74, 1000), load_font("Kanit-Bold.ttf", 60), TEXT, "#FFC107", 932, line_gap=16)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path, "PNG", optimize=True)
    return output_path


# ── Canvas Style 2: Neon Glow ────────────────────────────────────────
def compose_canvas_neon(item, chart_path, logo_bytes, output_path):
    from PIL import Image, ImageDraw
    canvas = Image.new("RGB", CANVAS_SIZE, "#0a0a1a")
    draw = ImageDraw.Draw(canvas)
    for yp in range(1350):
        draw.line([(0, yp), (1080, yp)], fill=(int(10 + yp/90), int(10 + yp/270), int(26 + yp/67)))
    accent = "#00d4ff" if item.pct_change >= 0 else "#ff4d6a"
    draw.rectangle((0, 0, 1080, 6), fill=accent)
    draw.rectangle((0, 1344, 1080, 1350), fill=accent)
    _draw_header(draw, canvas, item, logo_bytes,
                 load_font("Kanit-Bold.ttf", 66), load_font("Prompt-Regular.ttf", 30),
                 load_font("Kanit-Bold.ttf", 60), load_font("Prompt-Bold.ttf", 34),
                 "#12122a", "#2a2a5a", "#e0e0ff", "#7a7aaa")
    _paste_chart(draw, canvas, chart_path, (44, 236, 1036, 948), "#08081a", "#1a1a4a")
    hl = getattr(item, 'headline', f"อัปเดตหุ้น **{item.symbol}**")
    draw_rich_text_wrapped(draw, hl, (74, 1000), load_font("Kanit-Bold.ttf", 58), "#e0e0ff", "#FFC107", 932, line_gap=16)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path, "PNG", optimize=True)
    return output_path


# ── Canvas Style 3: Clean White ──────────────────────────────────────
def compose_canvas_clean(item, chart_path, logo_bytes, output_path):
    from PIL import Image, ImageDraw
    canvas = Image.new("RGB", CANVAS_SIZE, "#f5f5f5")
    draw = ImageDraw.Draw(canvas)
    accent = BULL if item.pct_change >= 0 else BEAR
    draw.rectangle((0, 0, 1080, 8), fill=accent)
    tf = load_font("Kanit-Bold.ttf", 66)
    cf = load_font("Prompt-Regular.ttf", 30)
    mf = load_font("Kanit-Bold.ttf", 60)
    pf = load_font("Prompt-Bold.ttf", 34)
    draw.rounded_rectangle((44, 44, 1036, 216), radius=12, fill="#ffffff", outline="#e0e0e0", width=2)
    logo = image_from_logo_bytes(logo_bytes, item.symbol)
    canvas.paste(logo, (74, 70), logo)
    draw.text((218, 68), item.symbol, font=tf, fill="#1a1a2e")
    co = item.company_name[:34] + ("..." if len(item.company_name) > 34 else "")
    draw.text((222, 145), co, font=cf, fill="#666680")
    met = f"+{item.pct_change:.2f}%" if item.pct_change >= 0 else f"{item.pct_change:.2f}%"
    mb = draw.textbbox((0,0), met, font=mf)
    draw.text((1002-(mb[2]-mb[0]), 68), met, font=mf, fill=accent)
    pr = f"${item.price:,.2f}"
    pb = draw.textbbox((0,0), pr, font=pf)
    draw.text((1002-(pb[2]-pb[0]), 145), pr, font=pf, fill="#1a1a2e")
    _paste_chart(draw, canvas, chart_path, (44, 236, 1036, 948), "#ffffff", "#e0e0e0")
    hl = getattr(item, 'headline', f"อัปเดตหุ้น **{item.symbol}**")
    draw_rich_text_wrapped(draw, hl, (74, 1000), load_font("Kanit-Bold.ttf", 56), "#1a1a2e", "#FFC107", 932, line_gap=16)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path, "PNG", optimize=True)
    return output_path


# ── Canvas Style 4: Bold Impact ──────────────────────────────────────
def compose_canvas_bold(item, chart_path, logo_bytes, output_path):
    from PIL import Image, ImageDraw
    canvas = Image.new("RGB", CANVAS_SIZE, "#111111")
    draw = ImageDraw.Draw(canvas)
    accent = BULL if item.pct_change >= 0 else BEAR
    draw.rectangle((0, 0, 12, 1350), fill=accent)
    draw.rectangle((1068, 0, 1080, 1350), fill=accent)
    tf = load_font("Kanit-Bold.ttf", 72)
    cf = load_font("Prompt-Regular.ttf", 28)
    mf = load_font("Kanit-Bold.ttf", 80)
    pf = load_font("Prompt-Bold.ttf", 36)
    met = f"+{item.pct_change:.2f}%" if item.pct_change >= 0 else f"{item.pct_change:.2f}%"
    mb = draw.textbbox((0,0), met, font=mf)
    draw.text(((1080-(mb[2]-mb[0]))//2, 50), met, font=mf, fill=accent)
    sb = draw.textbbox((0,0), item.symbol, font=tf)
    draw.text(((1080-(sb[2]-sb[0]))//2, 155), item.symbol, font=tf, fill="#ffffff")
    co = item.company_name[:40] + ("..." if len(item.company_name) > 40 else "")
    cb = draw.textbbox((0,0), co, font=cf)
    draw.text(((1080-(cb[2]-cb[0]))//2, 240), co, font=cf, fill="#888888")
    pr = f"${item.price:,.2f}"
    pb = draw.textbbox((0,0), pr, font=pf)
    draw.text(((1080-(pb[2]-pb[0]))//2, 285), pr, font=pf, fill="#cccccc")
    _paste_chart(draw, canvas, chart_path, (44, 350, 1036, 880), "#0a0a0a", "#333333")
    hl = getattr(item, 'headline', f"อัปเดตหุ้น **{item.symbol}**")
    draw_rich_text_wrapped(draw, hl, (74, 930), load_font("Kanit-Bold.ttf", 64), "#ffffff", "#FFC107", 932, line_gap=16)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path, "PNG", optimize=True)
    return output_path


CANVAS_STYLES = {
    "classic": compose_canvas_classic,
    "neon": compose_canvas_neon,
    "clean": compose_canvas_clean,
    "bold": compose_canvas_bold,
}


def compose_canvas(item: StockItem, chart_path: Path, logo_bytes: bytes | None, output_path: Path, style: str = "classic") -> Path:
    fn = CANVAS_STYLES.get(style, compose_canvas_classic)
    return fn(item, chart_path, logo_bytes, output_path)




    from PIL import Image, ImageDraw
    canvas = Image.new("RGB", CANVAS_SIZE, BG)
    draw = ImageDraw.Draw(canvas)
    title_font = load_font("Kanit-Bold.ttf", 66)
    company_font = load_font("Prompt-Regular.ttf", 30)
    metric_font = load_font("Kanit-Bold.ttf", 60)
    price_font = load_font("Prompt-Bold.ttf", 34)
    headline_font = load_font("Kanit-Bold.ttf", 60)

    draw.rectangle((0, 0, 1080, 10), fill=BULL)
    _draw_header(draw, canvas, item, logo_bytes, title_font, company_font, metric_font, price_font,
                 "#161b22", "#30363d", TEXT, MUTED)
    _paste_chart(draw, canvas, chart_path, (44, 236, 1036, 948), "#0b0f14", "#30363d")

    headline_text = getattr(item, 'headline', f"อัปเดตหุ้น **{item.symbol}** วันนี้")
    draw_rich_text_wrapped(draw, headline_text, (74, 1000), headline_font, TEXT, "#FFC107", 932, line_gap=16)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path, "PNG", optimize=True)
    return output_path


def compose_canvas_neon(item, chart_path, logo_bytes, output_path):
    """Style 2: Neon glow — deep purple/blue gradient background with cyan/magenta accents."""
    from PIL import Image, ImageDraw
    canvas = Image.new("RGB", CANVAS_SIZE, "#0a0a1a")
    draw = ImageDraw.Draw(canvas)

    # Gradient background effect (top to bottom)
    for y_pos in range(1350):
        r = int(10 + (y_pos / 1350) * 15)
        g = int(10 + (y_pos / 1350) * 5)
        b = int(26 + (y_pos / 1350) * 20)
        draw.line([(0, y_pos), (1080, y_pos)], fill=(r, g, b))

    # Accent bars
    accent = "#00d4ff" if item.pct_change >= 0 else "#ff4d6a"
    draw.rectangle((0, 0, 1080, 6), fill=accent)
    draw.rectangle((0, 1344, 1080, 1350), fill=accent)

    title_font = load_font("Kanit-Bold.ttf", 66)
    company_font = load_font("Prompt-Regular.ttf", 30)
    metric_font = load_font("Kanit-Bold.ttf", 60)
    price_font = load_font("Prompt-Bold.ttf", 34)
    headline_font = load_font("Kanit-Bold.ttf", 58)

    _draw_header(draw, canvas, item, logo_bytes, title_font, company_font, metric_font, price_font,
                 "#12122a", "#2a2a5a", "#e0e0ff", "#7a7aaa")
    _paste_chart(draw, canvas, chart_path, (44, 236, 1036, 948), "#08081a", "#1a1a4a")

    headline_text = getattr(item, 'headline', f"อัปเดตหุ้น **{item.symbol}** วันนี้")
    draw_rich_text_wrapped(draw, headline_text, (74, 1000), headline_font, "#e0e0ff", "#FFC107", 932, line_gap=16)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path, "PNG", optimize=True)
    return output_path


def compose_canvas_clean(item, chart_path, logo_bytes, output_path):
    """Style 3: Clean white — light background, professional minimal look."""
    from PIL import Image, ImageDraw
    canvas = Image.new("RGB", CANVAS_SIZE, "#f5f5f5")
    draw = ImageDraw.Draw(canvas)

    accent = BULL if item.pct_change >= 0 else BEAR
    draw.rectangle((0, 0, 1080, 8), fill=accent)

    title_font = load_font("Kanit-Bold.ttf", 66)
    company_font = load_font("Prompt-Regular.ttf", 30)
    metric_font = load_font("Kanit-Bold.ttf", 60)
    price_font = load_font("Prompt-Bold.ttf", 34)
    headline_font = load_font("Kanit-Bold.ttf", 56)

    draw.rounded_rectangle((44, 44, 1036, 216), radius=12, fill="#ffffff", outline="#e0e0e0", width=2)
    logo = image_from_logo_bytes(logo_bytes, item.symbol)
    canvas.paste(logo, (74, 70), logo)
    draw.text((218, 68), item.symbol, font=title_font, fill="#1a1a2e")
    company = item.company_name[:34] + ("..." if len(item.company_name) > 34 else "")
    draw.text((222, 145), company, font=company_font, fill="#666680")
    metric = f"+{item.pct_change:.2f}%" if item.pct_change >= 0 else f"{item.pct_change:.2f}%"
    metric_bbox = draw.textbbox((0, 0), metric, font=metric_font)
    draw.text((1002 - (metric_bbox[2] - metric_bbox[0]), 68), metric, font=metric_font, fill=accent)
    price = f"${item.price:,.2f}"
    price_bbox = draw.textbbox((0, 0), price, font=price_font)
    draw.text((1002 - (price_bbox[2] - price_bbox[0]), 145), price, font=price_font, fill="#1a1a2e")

    _paste_chart(draw, canvas, chart_path, (44, 236, 1036, 948), "#ffffff", "#e0e0e0")

    headline_text = getattr(item, 'headline', f"อัปเดตหุ้น **{item.symbol}** วันนี้")
    draw_rich_text_wrapped(draw, headline_text, (74, 1000), headline_font, "#1a1a2e", "#FFC107", 932, line_gap=16)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path, "PNG", optimize=True)
    return output_path


def compose_canvas_bold(item, chart_path, logo_bytes, output_path):
    """Style 4: Bold headline — large text on top, smaller chart below. Impact-first design."""
    from PIL import Image, ImageDraw
    canvas = Image.new("RGB", CANVAS_SIZE, "#111111")
    draw = ImageDraw.Draw(canvas)

    accent = BULL if item.pct_change >= 0 else BEAR
    # Bold side accent bar
    draw.rectangle((0, 0, 12, 1350), fill=accent)
    draw.rectangle((1068, 0, 1080, 1350), fill=accent)

    title_font = load_font("Kanit-Bold.ttf", 72)
    company_font = load_font("Prompt-Regular.ttf", 28)
    metric_font = load_font("Kanit-Bold.ttf", 80)
    price_font = load_font("Prompt-Bold.ttf", 36)
    headline_font = load_font("Kanit-Bold.ttf", 64)

    # Large % change at top
    metric = f"+{item.pct_change:.2f}%" if item.pct_change >= 0 else f"{item.pct_change:.2f}%"
    metric_bbox = draw.textbbox((0, 0), metric, font=metric_font)
    metric_w = metric_bbox[2] - metric_bbox[0]
    draw.text(((1080 - metric_w) // 2, 50), metric, font=metric_font, fill=accent)

    # Symbol + company below
    sym_bbox = draw.textbbox((0, 0), item.symbol, font=title_font)
    sym_w = sym_bbox[2] - sym_bbox[0]
    draw.text(((1080 - sym_w) // 2, 155), item.symbol, font=title_font, fill="#ffffff")
    company = item.company_name[:40] + ("..." if len(item.company_name) > 40 else "")
    comp_bbox = draw.textbbox((0, 0), company, font=company_font)
    comp_w = comp_bbox[2] - comp_bbox[0]
    draw.text(((1080 - comp_w) // 2, 240), company, font=company_font, fill="#888888")

    # Price
    price = f"${item.price:,.2f}"
    price_bbox2 = draw.textbbox((0, 0), price, font=price_font)
    price_w = price_bbox2[2] - price_bbox2[0]
    draw.text(((1080 - price_w) // 2, 285), price, font=price_font, fill="#cccccc")

    # Chart (smaller, in middle)
    _paste_chart(draw, canvas, chart_path, (44, 350, 1036, 880), "#0a0a0a", "#333333")

    # Headline at bottom
    headline_text = getattr(item, 'headline', f"อัปเดตหุ้น **{item.symbol}** วันนี้")
    draw_rich_text_wrapped(draw, headline_text, (74, 930), headline_font, "#ffffff", "#FFC107", 932, line_gap=16)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path, "PNG", optimize=True)
    return output_path


CANVAS_STYLES = {
    "classic": compose_canvas_classic,
    "neon": compose_canvas_neon,
    "clean": compose_canvas_clean,
    "bold": compose_canvas_bold,
}




def dropbox_client(creds: DropboxCreds):
    import dropbox

    if creds.refresh_token and creds.app_key and creds.app_secret:
        return dropbox.Dropbox(
            oauth2_refresh_token=creds.refresh_token,
            app_key=creds.app_key,
            app_secret=creds.app_secret,
        )
    if creds.access_token:
        return dropbox.Dropbox(creds.access_token)
    return None


def to_dropbox_raw_url(url: str) -> str:
    if not url:
        return ""
    if "?dl=0" in url:
        return url.replace("?dl=0", "?raw=1")
    if "&dl=0" in url:
        return url.replace("&dl=0", "&raw=1")
    base = url.split("?")[0]
    return f"{base}?raw=1"


def upload_to_dropbox(local_path: Path, dropbox_folder: str, creds: DropboxCreds) -> tuple[str, str]:
    import dropbox
    from dropbox.files import WriteMode
    from dropbox.sharing import RequestedVisibility, SharedLinkSettings

    dbx = dropbox_client(creds)
    if dbx is None:
        return "", ""

    clean_folder = ("/" + dropbox_folder.strip("/")).replace("//", "/")
    dropbox_path = f"{clean_folder}/{local_path.name}"
    with local_path.open("rb") as f:
        dbx.files_upload(f.read(), dropbox_path, mode=WriteMode("overwrite"), mute=True)

    try:
        link = dbx.sharing_create_shared_link_with_settings(
            dropbox_path, settings=SharedLinkSettings(requested_visibility=RequestedVisibility.public)
        ).url
    except dropbox.exceptions.ApiError:
        links = dbx.sharing_list_shared_links(path=dropbox_path, direct_only=True).links
        link = links[0].url if links else ""

    return dropbox_path, to_dropbox_raw_url(link)


def write_csv(items: list[StockItem], config_ref: str, csv_path: Path, run_date: str) -> None:
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["Date", "Symbol", "Caption", "Image_URL", "Config_Ref"])
        writer.writeheader()
        for item in items:
            writer.writerow(
                {
                    "Date": run_date,
                    "Symbol": item.symbol,
                    "Caption": item.caption,
                    "Image_URL": item.dropbox_url,
                    "Config_Ref": config_ref,
                }
            )


def safe_file_part(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", value.strip())[:80] or "stock"


def generate_summary_post(items: list[StockItem], creds: AppCreds, model: str, mode: str, run_date: str) -> str:
    """Generate a summary/overview post that covers all stocks in the batch."""
    mode_label = {
        "gainers": "หุ้นพุ่งแรงวันนี้",
        "losers": "หุ้นร่วงหนักวันนี้",
        "low_pe": "หุ้น Value น่าจับตา",
        "trending": "หุ้นซื้อขายเดือดวันนี้",
    }.get(mode, "หุ้นน่าจับตาวันนี้")

    stock_list = "\n".join(
        f"- {item.symbol} ({item.company_name}): {item.pct_change:+.2f}% ราคา ${item.price:.2f} วอลุ่ม {item.volume:,}"
        for item in items
    )

    prompt = (
        f"You are a professional Thai stock analyst writing a Facebook page post.\n"
        f"Today is {run_date}. Topic: {mode_label}\n\n"
        f"Here are the stocks covered today:\n{stock_list}\n\n"
        f"Write a MAIN SUMMARY POST in Thai that will be the FIRST thing readers see.\n"
        f"This post introduces all {len(items)} stocks as a group.\n\n"
        f"Structure:\n"
        f"1. Eye-catching opening line with emoji (e.g. 🔥📊🚀)\n"
        f"2. Brief overview of today's market theme (2-3 sentences)\n"
        f"3. Quick bullet list of all stocks with 1-line summary each\n"
        f"4. A teaser line like 'ดูรายละเอียดวิเคราะห์แต่ละตัวในคอมเมนต์ด้านล่าง 👇'\n"
        f"5. Relevant hashtags (5-8 tags)\n\n"
        f"Keep it concise (150-250 words). Use Thai mixed with English terms.\n"
        f"Make it feel urgent, professional, and scroll-stopping.\n"
        f"Return ONLY the post text, nothing else."
    )

    if creds.openrouter_key:
        try:
            return chat_completion(
                api_key=creds.openrouter_key,
                base_url="https://openrouter.ai/api/v1/chat/completions",
                model=model,
                prompt=prompt,
                headers={"HTTP-Referer": "http://localhost", "X-Title": "BulkVideoCreatorApp"},
            )
        except Exception as exc:
            print(f"[WARN] Summary post AI failed: {exc}", file=sys.stderr)

    if creds.openai_key:
        try:
            return chat_completion(
                api_key=creds.openai_key,
                base_url="https://api.openai.com/v1/chat/completions",
                model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                prompt=prompt,
                headers={},
            )
        except Exception as exc:
            print(f"[WARN] Summary post OpenAI failed: {exc}", file=sys.stderr)

    # Fallback: generate without AI
    lines = [f"📊 {mode_label} — {run_date}\n"]
    for item in items:
        arrow = "🟢" if item.pct_change >= 0 else "🔴"
        lines.append(f"{arrow} {item.symbol} ({item.company_name}) {item.pct_change:+.2f}% ราคา ${item.price:.2f}")
    lines.append(f"\nดูรายละเอียดวิเคราะห์แต่ละตัวในคอมเมนต์ด้านล่าง 👇")
    lines.append(f"\n#หุ้นวันนี้ #StockAnalysis #TopGainers #การลงทุน #หุ้นอเมริกา")
    return "\n".join(lines)


def run(args: argparse.Namespace) -> int:
    creds = load_credentials(args.profile)
    spreadsheet_path = Path(args.spreadsheet).expanduser().resolve()
    if not spreadsheet_path.exists():
        raise FileNotFoundError(f"Spreadsheet not found: {spreadsheet_path}")

    config_ref = read_p2(spreadsheet_path, args.sheet)
    config = parse_p2_config(config_ref)
    if not config_ref:
        print("[WARN] Cell P2 is empty. Continuing with Yahoo day gainers and blank Config_Ref.", file=sys.stderr)

    run_date = args.date or date.today().isoformat()
    output_dir = Path(args.output_dir).expanduser().resolve() / run_date
    chart_dir = output_dir / "charts"
    output_dir.mkdir(parents=True, exist_ok=True)
    chart_dir.mkdir(parents=True, exist_ok=True)

    print(f"[INFO] P2 Config_Ref: {config_ref or '(empty)'}")
    print(f"[INFO] Mode: {args.mode}")
    print(f"[INFO] Output folder: {output_dir}")

    items = get_stock_universe_by_mode(config, args.limit, args.scan_count, args.mode)
    if not items:
        raise RuntimeError("No stocks to process. Check P2 symbols/sector or the Yahoo screener response.")

    dropbox_folder = f"{args.dropbox_folder.rstrip('/')}/{run_date}"
    processed: list[StockItem] = []
    for index, item in enumerate(items, start=1):
        print(f"[INFO] ({index}/{len(items)}) Processing {item.symbol} {item.company_name}")
        item.news = fetch_news(item, creds)
        raw_caption = generate_caption(item, creds, args.model, args.mode)
        
        import re
        img_match = re.search(r'IMAGE_TEXT:\s*(.*?)\s*(?:POST_CAPTION:|$)', raw_caption, re.DOTALL)
        post_match = re.search(r'POST_CAPTION:\s*(.*)', raw_caption, re.DOTALL)
        
        if img_match:
            item.headline = img_match.group(1).strip()
        else:
            item.headline = f"อัปเดตหุ้น **{item.symbol}** วันนี้"
            
        if post_match:
            item.caption = post_match.group(1).strip()
        else:
            item.caption = raw_caption.strip()
            
        chart_path = generate_chart(item, chart_dir / f"{safe_file_part(item.symbol)}_chart.png")
        logo_bytes = fetch_logo(item)
        image_path = output_dir / f"{run_date}_{safe_file_part(item.symbol)}.png"
        item.image_path = compose_canvas(item, chart_path, logo_bytes, image_path, style=args.canvas_style)

        if not args.skip_dropbox:
            try:
                _, direct_url = upload_to_dropbox(image_path, dropbox_folder, creds.dropbox)
                item.dropbox_url = direct_url
                if direct_url:
                    print(f"[INFO] Dropbox raw URL: {direct_url}")
                elif args.require_dropbox:
                    raise RuntimeError("Dropbox credentials are missing.")
                else:
                    print("[WARN] Dropbox credentials missing; Image_URL will be blank.", file=sys.stderr)
            except Exception as exc:
                if args.require_dropbox:
                    raise
                print(f"[WARN] Dropbox upload failed for {item.symbol}: {exc}", file=sys.stderr)

        processed.append(item)
        if args.pause_seconds > 0 and index < len(items):
            time.sleep(args.pause_seconds)

    # Generate summary post for the entire batch
    summary_post = generate_summary_post(processed, creds, args.model, args.mode, run_date)
    summary_path = output_dir / "summary_post.txt"
    summary_path.write_text(summary_post, encoding="utf-8")
    print(f"[INFO] Summary post saved: {summary_path}")

    csv_path = Path(args.csv_path).expanduser().resolve() if args.csv_path else output_dir / "content_factory_post.csv"
    write_csv(processed, config_ref, csv_path, run_date)
    print(f"[DONE] Wrote {csv_path}")
    return 0


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Generate top-gainers social images, upload to Dropbox, and write CSV.")
    parser.add_argument("--spreadsheet", required=True, help="Master .xlsx/.xlsm/.csv config file. Cell P2 is always used.")
    parser.add_argument("--sheet", default="", help="Worksheet name for Excel files. Defaults to the active sheet.")
    parser.add_argument("--limit", type=int, default=5, help="Number of stocks/images to generate.")
    parser.add_argument("--scan-count", type=int, default=150, help="Yahoo day-gainer candidates to scan for sector filters.")
    parser.add_argument("--date", default="", help="Generation date, YYYY-MM-DD. Defaults to today.")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_ROOT), help="Local output root. Date folder is appended.")
    parser.add_argument("--dropbox-folder", default=DEFAULT_DROPBOX_ROOT, help="Dropbox root folder. Date folder is appended.")
    parser.add_argument("--csv-path", default="", help="Optional explicit CSV output path.")
    parser.add_argument("--profile", default="", help="Optional api_profiles.json profile id/name.")
    parser.add_argument("--model", default=os.getenv("OPENROUTER_MODEL", "google/gemini-2.5-flash"), help="LLM model.")
    parser.add_argument("--skip-dropbox", action="store_true", help="Generate local files and CSV without uploading.")
    parser.add_argument("--require-dropbox", action="store_true", help="Fail if Dropbox upload cannot complete.")
    parser.add_argument("--pause-seconds", type=float, default=0.5, help="Delay between stocks to be gentle with APIs.")
    parser.add_argument("--mode", default="gainers",
                        choices=["gainers", "losers", "low_pe", "trending"],
                        help="Screening mode: gainers=top gainers, losers=top losers, low_pe=low P/E value stocks, trending=most active/news-heavy")
    parser.add_argument("--canvas-style", default="classic",
                        choices=["classic", "neon", "clean", "bold"],
                        help="Visual style for the generated canvas images.")
    return parser


def main() -> int:
    parser = build_arg_parser()
    args = parser.parse_args()
    try:
        return run(args)
    except KeyboardInterrupt:
        print("\n[STOPPED] Interrupted by user.", file=sys.stderr)
        return 130
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

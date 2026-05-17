#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

import requests
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIR = ROOT / "public" / "app_data" / "top_gainers_memes"

QUERIES = [
    "stonks meme",
    "stock market meme",
    "trading reaction meme",
    "money reaction meme",
    "profit reaction meme",
    "stocks going up meme",
    "stocks going down meme",
    "confused investor meme",
    "market crash reaction meme",
    "bull market meme",
    "bear market meme",
    "wall street reaction meme",
    "chart goes up meme",
    "panic buying meme",
    "diamond hands meme",
    "paper hands meme",
    "rich reaction meme",
    "loss reaction meme",
]

STILL_KEYS = [
    "original_still",
    "fixed_height_still",
    "fixed_width_still",
    "downsized_still",
    "480w_still",
]


def read_giphy_key(profile: str = "") -> str:
    env_key = os.getenv("GIPHY_API_KEY", "").strip()
    if env_key:
        return env_key
    path = ROOT / "public" / "app_data" / "api_profiles.json"
    if not path.exists():
        return ""
    try:
        profiles = json.loads(path.read_text("utf-8"))
    except Exception:
        return ""
    if not isinstance(profiles, list):
        return ""
    if profile:
        found = next((p for p in profiles if p.get("id") == profile or p.get("name") == profile), None)
        if found:
            return str(found.get("giphyKey") or "").strip()
    active = next((p for p in profiles if p.get("active") and p.get("giphyKey")), None)
    fallback = active or next((p for p in profiles if p.get("giphyKey")), None)
    return str((fallback or {}).get("giphyKey") or "").strip()


def safe_slug(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9._-]+", "_", value.strip())
    return value.strip("_")[:80] or "meme"


def ext_from_content_type(content_type: str, url: str) -> str:
    lowered = content_type.lower()
    if "png" in lowered:
        return ".png"
    if "webp" in lowered:
        return ".webp"
    if "jpeg" in lowered or "jpg" in lowered:
        return ".jpg"
    suffix = Path(url.split("?", 1)[0]).suffix.lower()
    return suffix if suffix in {".png", ".jpg", ".jpeg", ".webp"} else ".jpg"


def giphy_search(api_key: str, query: str, offset: int, limit: int) -> list[dict[str, Any]]:
    res = requests.get(
        "https://api.giphy.com/v1/gifs/search",
        params={
            "api_key": api_key,
            "q": query,
            "limit": limit,
            "offset": offset,
            "rating": "pg-13",
            "lang": "en",
        },
        timeout=20,
    )
    if res.status_code != 200:
        raise RuntimeError(f"GIPHY search failed HTTP {res.status_code}: {res.text[:180]}")
    data = res.json()
    results = data.get("data") or []
    return results if isinstance(results, list) else []


def still_candidates(item: dict[str, Any]) -> list[str]:
    images = item.get("images") if isinstance(item, dict) else {}
    if not isinstance(images, dict):
        return []
    urls: list[str] = []
    for key in STILL_KEYS:
        url = ((images.get(key) or {}).get("url") or "").strip()
        if url:
            urls.append(url)
    return urls


def is_static_image(data: bytes) -> bool:
    import io

    try:
        with Image.open(io.BytesIO(data)) as img:
            if getattr(img, "is_animated", False):
                return False
            if str(img.format or "").upper() == "GIF":
                return False
            img.verify()
        return True
    except Exception:
        return False


def download_file(url: str) -> tuple[bytes, str]:
    res = requests.get(url, timeout=20)
    if res.status_code != 200:
        raise RuntimeError(f"image HTTP {res.status_code}")
    content_type = res.headers.get("content-type", "")
    if not content_type.startswith("image/"):
        raise RuntimeError(f"not image: {content_type}")
    if "gif" in content_type.lower() or url.split("?", 1)[0].lower().endswith(".gif"):
        raise RuntimeError("animated/gif skipped")
    data = res.content
    if len(data) < 500:
        raise RuntimeError("image too small")
    if not is_static_image(data):
        raise RuntimeError("not a static image")
    return data, ext_from_content_type(content_type, url)


def read_existing_metadata(metadata_path: Path) -> list[dict[str, str]]:
    if not metadata_path.exists():
        return []
    with metadata_path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def current_file_hashes(output_dir: Path) -> set[str]:
    hashes: set[str] = set()
    if not output_dir.exists():
        return hashes
    for path in output_dir.iterdir():
        if not path.is_file() or path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
            continue
        try:
            hashes.add(hashlib.sha1(path.read_bytes()).hexdigest())
        except Exception:
            continue
    return hashes


def collect_existing_sets(rows: list[dict[str, str]], output_dir: Path) -> tuple[set[str], set[str], set[str]]:
    ids = {str(row.get("giphy_id") or "").strip() for row in rows if row.get("giphy_id")}
    urls = {str(row.get("image_url") or "").strip() for row in rows if row.get("image_url")}
    hashes = {str(row.get("sha1") or "").strip() for row in rows if row.get("sha1")}
    hashes |= current_file_hashes(output_dir)
    return ids, urls, hashes


def main() -> int:
    parser = argparse.ArgumentParser(description="Download static GIPHY stock meme images into a local meme folder.")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--count", type=int, default=50)
    parser.add_argument("--profile", default="")
    parser.add_argument("--api-key", default="")
    parser.add_argument("--limit-per-query", type=int, default=25)
    parser.add_argument("--dry-run", action="store_true", help="Only count new static meme images available; do not save files.")
    args = parser.parse_args()

    api_key = args.api_key.strip() or read_giphy_key(args.profile)
    if not api_key:
        print("[ERROR] GIPHY API key not found. Save it in Global Settings first, or pass --api-key / set GIPHY_API_KEY.", file=sys.stderr)
        return 2

    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    metadata_path = output_dir / "metadata.csv"

    rows = read_existing_metadata(metadata_path)
    existing_ids, existing_urls, existing_hashes = collect_existing_sets(rows, output_dir)

    downloaded = 0
    available = 0
    seen_urls: set[str] = set()
    seen_hashes: set[str] = set()
    seen_ids: set[str] = set()

    for round_idx in range(8):
        if downloaded >= args.count or available >= args.count:
            break
        for query in QUERIES:
            if downloaded >= args.count or available >= args.count:
                break
            try:
                results = giphy_search(api_key, query, offset=round_idx * args.limit_per_query, limit=args.limit_per_query)
            except Exception as exc:
                print(f"[WARN] Search failed for {query!r}: {exc}", file=sys.stderr)
                continue
            for item in results:
                if downloaded >= args.count or available >= args.count:
                    break
                giphy_id = str(item.get("id") or "")
                if not giphy_id or giphy_id in existing_ids or giphy_id in seen_ids:
                    continue
                urls = still_candidates(item)
                if not urls:
                    continue
                for url in urls:
                    if url in seen_urls or url in existing_urls:
                        continue
                    seen_urls.add(url)
                    try:
                        data, ext = download_file(url)
                    except Exception:
                        continue
                    digest = hashlib.sha1(data).hexdigest()
                    if digest in existing_hashes or digest in seen_hashes:
                        continue
                    seen_hashes.add(digest)
                    seen_ids.add(giphy_id)
                    available += 1
                    if args.dry_run:
                        print(f"[INFO] Available static meme {available}/{args.count}: {giphy_id} ({query})")
                        break
                    title = str(item.get("title") or query)
                    filename = f"{len(rows) + 1:03d}_{safe_slug(query)}_{digest[:10]}{ext}"
                    path = output_dir / filename
                    path.write_bytes(data)
                    existing_ids.add(giphy_id)
                    existing_urls.add(url)
                    existing_hashes.add(digest)
                    downloaded += 1
                    rows.append(
                        {
                            "filename": filename,
                            "query": query,
                            "giphy_id": giphy_id,
                            "title": title,
                            "source_url": str(item.get("url") or ""),
                            "image_url": url,
                            "sha1": digest,
                            "deleted_keep_out": "yes",
                        }
                    )
                    print(f"[INFO] Saved {downloaded}/{args.count}: {filename}")
                    break

    if args.dry_run:
        print(f"[INFO] Output folder: {output_dir}")
        print(f"[INFO] Available new static memes: {available}")
        print(f"[INFO] Existing/blocked metadata rows: {len(rows)}")
        return 0

    with metadata_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["filename", "query", "giphy_id", "title", "source_url", "image_url", "sha1", "deleted_keep_out"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"[INFO] Output folder: {output_dir}")
    print(f"[INFO] Downloaded this run: {downloaded}")
    print(f"[INFO] Total metadata rows: {len(rows)}")
    return 0 if downloaded else 1


if __name__ == "__main__":
    raise SystemExit(main())

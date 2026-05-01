#!/usr/bin/env python3
"""
Bulk-submit Stay Portland property URLs to Google Indexing API.

Tracks which URLs have been submitted in a local state file so it can
resume across days when hitting the daily quota (~200/day).

Usage:
  python3 scripts/bulk-index-properties.py          # submit remaining
  python3 scripts/bulk-index-properties.py --dry-run # show what would be submitted
  python3 scripts/bulk-index-properties.py --reset   # clear state, start over
"""

import json
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from urllib.request import urlopen

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SA_KEY = "/Users/haydenlaverty/Downloads/Financial/google-sa-key-ace-destination.json"
SITEMAP_URL = "https://www.stayportland.com/sitemap/properties.xml"
SCOPES = ["https://www.googleapis.com/auth/indexing"]
STATE_FILE = Path(__file__).parent / ".index-state.json"


def get_property_urls():
    response = urlopen(SITEMAP_URL)
    tree = ET.parse(response)
    root = tree.getroot()
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    return [loc.text for loc in root.findall(".//s:url/s:loc", ns) if loc.text]


def load_state():
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"submitted": {}}


def save_state(state):
    STATE_FILE.write_text(json.dumps(state, indent=2))


def main():
    dry_run = "--dry-run" in sys.argv
    if "--reset" in sys.argv:
        STATE_FILE.unlink(missing_ok=True)
        print("State reset.")
        return

    urls = get_property_urls()
    state = load_state()
    already = state["submitted"]
    remaining = [u for u in urls if u not in already]

    print(f"Sitemap: {len(urls)} URLs | Already submitted: {len(already)} | Remaining: {len(remaining)}")

    if not remaining:
        print("All URLs submitted! Nothing to do.")
        return

    if dry_run:
        for url in remaining[:10]:
            print(f"  {url}")
        if len(remaining) > 10:
            print(f"  ... and {len(remaining) - 10} more")
        return

    credentials = service_account.Credentials.from_service_account_file(
        SA_KEY, scopes=SCOPES
    )
    service = build("indexing", "v3", credentials=credentials)

    submitted = 0
    today = datetime.now().strftime("%Y-%m-%d")
    for url in remaining:
        try:
            service.urlNotifications().publish(
                body={"url": url, "type": "URL_UPDATED"}
            ).execute()
            already[url] = today
            submitted += 1
            if submitted % 25 == 0:
                print(f"  Submitted {submitted}...")
                save_state(state)
            time.sleep(0.3)
        except HttpError as e:
            if e.resp.status == 429:
                print(f"  Rate limited after {submitted} submissions. Will resume tomorrow.")
                break
            print(f"  ERROR [{e.resp.status}] {url}: {e.reason}")
            time.sleep(1)

    save_state(state)
    new_remaining = len(urls) - len(already)
    print(f"\nToday: {submitted} submitted | Total done: {len(already)}/{len(urls)} | Remaining: {new_remaining}")


if __name__ == "__main__":
    main()

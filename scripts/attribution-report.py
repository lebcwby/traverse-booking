#!/usr/bin/env python3
"""
Stay Portland — First-Touch Attribution Report

Joins visitor_attribution (first-touch cookies persisted at email capture)
with reservations to show what channel actually ORIGINATED each direct booking.

This reveals the Meta halo effect: users who first clicked a Meta ad but later
booked as "Direct" in GA4 because they returned on a different device/browser.

Usage:
    python3 scripts/attribution-report.py
    python3 scripts/attribution-report.py --since 2026-03-01
    python3 scripts/attribution-report.py --verbose
"""

import argparse
import json
import sys
from datetime import datetime, timedelta

import requests

SUPABASE_URL = "https://vbpxjiisorztbbinenpb.supabase.co"
SERVICE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZicHhqaWlzb3J6dGJiaW5lbnBiIiwi"
    "cm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjA2MDk1MiwiZXhwIjoyMDg3"
    "NjM2OTUyfQ.osPJ5F8F___jS2DQslGWY55zUhnG1Wa6KDNb0gTfiIA"
)

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}


def classify(first_touch: dict | None) -> str:
    if not first_touch:
        return "no_attribution"

    fbclid = first_touch.get("fbclid")
    gclid = first_touch.get("gclid")
    msclkid = first_touch.get("msclkid")
    src = (first_touch.get("utm_source") or "").lower()
    med = (first_touch.get("utm_medium") or "").lower()
    camp = (first_touch.get("utm_campaign") or "").lower()

    if fbclid or src in ("fb", "ig", "meta", "facebook", "instagram"):
        return "meta_ads"
    if gclid or (src == "google" and med == "cpc"):
        if "pmax" in camp:
            return "google_pmax"
        return "google_search"
    if msclkid or (src == "bing" and med == "cpc"):
        return "bing_ads"
    if med == "email" or src in ("klaviyo",):
        return "email"
    if med == "organic":
        return "organic"
    if src or med:
        return f"other ({src}/{med})"

    return "direct_unknown"


def get_payout(money: dict | None) -> float:
    if not money:
        return 0
    return float(money.get("host_payout") or money.get("total_paid") or 0)


def main():
    parser = argparse.ArgumentParser(description="Attribution report")
    parser.add_argument("--since", default="2026-01-01", help="Start date (YYYY-MM-DD)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show per-booking detail")
    args = parser.parse_args()

    # Fetch visitor_attribution
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/visitor_attribution?select=email,first_touch,last_touch,created_at&limit=5000",
        headers=HEADERS,
    )
    attributions = r.json()
    attr_by_email = {a["email"].lower().strip(): a for a in attributions}

    # Fetch website reservations
    r2 = requests.get(
        f"{SUPABASE_URL}/rest/v1/reservations"
        f"?select=confirmation_code,guest,money,source,status,confirmed_at,listing"
        f"&source=eq.website&status=eq.confirmed"
        f"&confirmed_at=gte.{args.since}"
        f"&order=confirmed_at.desc&limit=2000",
        headers=HEADERS,
    )
    reservations = r2.json()

    print("=" * 90)
    print(f"  STAY PORTLAND — FIRST-TOUCH ATTRIBUTION REPORT")
    print(f"  Website direct bookings since {args.since}")
    print(f"  Attribution records: {len(attributions)} | Reservations: {len(reservations)}")
    print("=" * 90)

    channels: dict[str, dict] = {}
    matched = 0

    for res in reservations:
        guest = res.get("guest") or {}
        email = (guest.get("email") or "").lower().strip()
        if not email:
            continue
        money = res.get("money") or {}
        payout = get_payout(money)
        conf = res.get("confirmation_code", "?")
        confirmed = (res.get("confirmed_at") or "")[:10]

        attr = attr_by_email.get(email)
        ft = attr.get("first_touch") if attr else None
        channel = classify(ft)

        if attr:
            matched += 1

        if channel not in channels:
            channels[channel] = {"bookings": 0, "revenue": 0, "details": []}
        channels[channel]["bookings"] += 1
        channels[channel]["revenue"] += payout
        channels[channel]["details"].append({
            "conf": conf, "email": email, "payout": payout,
            "confirmed": confirmed, "first_touch": ft,
        })

    # Summary
    total_b = sum(c["bookings"] for c in channels.values())
    total_r = sum(c["revenue"] for c in channels.values())
    match_rate = (matched / total_b * 100) if total_b > 0 else 0

    print(f"\n  Attribution match rate: {matched}/{total_b} ({match_rate:.0f}%)")
    print(f"  (Unmatched bookings had no email capture before checkout —")
    print(f"   their first-touch cookie existed but wasn't persisted to DB yet)\n")

    order = [
        "meta_ads", "google_search", "google_pmax", "bing_ads",
        "email", "organic", "direct_unknown", "no_attribution",
    ]
    # Add any channels not in the predefined order
    for ch in channels:
        if ch not in order:
            order.append(ch)

    print(f"  {'Channel':<28}{'Bookings':>10}{'%':>7}{'Revenue':>12}{'%':>7}{'Avg Payout':>12}")
    print("  " + "-" * 82)

    for ch in order:
        if ch not in channels:
            continue
        c = channels[ch]
        bp = (c["bookings"] / total_b * 100) if total_b > 0 else 0
        rp = (c["revenue"] / total_r * 100) if total_r > 0 else 0
        avg = c["revenue"] / c["bookings"] if c["bookings"] > 0 else 0
        label = ch.replace("_", " ").title()
        print(f"  {label:<28}{c['bookings']:>10}{bp:>6.1f}%  ${c['revenue']:>10.2f}{rp:>6.1f}%  ${avg:>10.2f}")

    print("  " + "-" * 82)
    avg_all = total_r / total_b if total_b > 0 else 0
    print(f"  {'TOTAL':<28}{total_b:>10}{'100%':>7}  ${total_r:>10.2f}{'100%':>7}  ${avg_all:>10.2f}")

    # Meta detail
    if "meta_ads" in channels and channels["meta_ads"]["bookings"] > 0:
        print(f"\n\n  META ADS FIRST-TOUCH BOOKINGS (the halo effect):")
        print("  " + "-" * 82)
        for d in channels["meta_ads"]["details"]:
            ft = d["first_touch"] or {}
            src = ft.get("utm_source", "?")
            camp = ft.get("utm_campaign", "?")[:35]
            print(f"  {d['confirmed']}  {d['conf']:<16}${d['payout']:>8.2f}  {src}/{camp}")

    if args.verbose:
        print(f"\n\n  ALL BOOKINGS WITH ATTRIBUTION DATA:")
        print("  " + "-" * 100)
        for ch in order:
            if ch not in channels or ch == "no_attribution":
                continue
            for d in channels[ch]["details"]:
                ft_str = json.dumps(d["first_touch"]) if d["first_touch"] else "—"
                print(f"  {d['confirmed']}  {d['conf']:<14}{ch:<20}${d['payout']:>8.2f}  {ft_str[:60]}")

    # Coverage note
    print(f"\n\n  NOTE: Attribution data collection started 2026-03-31.")
    print(f"  Only {len(attributions)} emails have been captured so far.")
    print(f"  As more users interact (newsletter, contact, checkout), coverage will grow.")
    print(f"  Re-run this report weekly to track the Meta halo effect.\n")


if __name__ == "__main__":
    main()

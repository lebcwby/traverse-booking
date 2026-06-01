#!/usr/bin/env python3
"""
Stay Portland — Google Ads Enhanced Conversions backfill (Purchase only).

Why this exists:
    From the GTM-nonce-CSP introduction (~late March 2026) until the
    fix on this branch, the inline `gtag('config', AW-..., {allow_enhanced_conversions:true})`
    script was blocked on /book/* by the sensitive-path CSP. As a result,
    every client-side `gtag('set', 'user_data', ...)` call inside
    trackBookingCompleted was silently ignored by gtag.js — EC was
    effectively OFF for client-side fires. The server-side path
    (`uploadGoogleAdsPurchaseConversion`) also did not include hashed
    user_data until this PR. Net result: existing Purchase conversions in
    the Google Ads account are missing the EC enrichment layer.

    Google's `uploadConversionAdjustments` with adjustmentType=ENHANCEMENT
    lets us retroactively attach hashed user_data to existing conversions
    (looked up by orderId = reservationId) within a 90-day window.

What this does:
    1. Pulls confirmed BE-API direct bookings from the shared Supabase DB
       in the last 90 days (excluding internal/test emails).
    2. Builds a one-adjustment-per-reservation payload with hashed
       email / phone / first+last name / country.
    3. By default: prints what WOULD be sent — no live API call.
    4. With --execute: calls Google Ads API in batches of 100 with
       partialFailure=true and prints the per-batch response.

Usage:
    python3 scripts/google-ads-ec-backfill.py                   # dry-run
    python3 scripts/google-ads-ec-backfill.py --since 2026-03-01
    python3 scripts/google-ads-ec-backfill.py --limit 5         # sample
    python3 scripts/google-ads-ec-backfill.py --execute         # LIVE — needs Hayden approval

Live Ad Account Rule applies — never run with --execute without an
explicit go-ahead from Hayden after reviewing the dry-run output.
"""

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request as AuthRequest

REPO_ROOT = Path(__file__).resolve().parent.parent
ENV_LOCAL = REPO_ROOT / ".env.local"

# Google Ads — Stay Portland account constants
SP_CUSTOMER_ID = "4343736848"
MCC_LOGIN_CUSTOMER_ID = "9002457484"
PURCHASE_CONVERSION_ACTION_ID = "7291892540"
DEVELOPER_TOKEN = "ICysCLCCFu941aTW8TpIaw"
SA_KEY_PATH = "/Users/haydenlaverty/Downloads/Financial/google-sa-key-ace-destination.json"
GOOGLE_ADS_API_VERSION = "v23"
ADS_SCOPE = "https://www.googleapis.com/auth/adwords"

# Shared Supabase DB — reservations
SUPABASE_REST_PATH = "/rest/v1/reservations"

EXCLUDED_EMAILS = {
    "test@stayportland.com",
    "testing1@stayportland.com",
    "testing2@stayportland.com",
    "trevor.stout164@gmail.com",
    "trevor@164investments.com",
    "bolton.osaz@gmail.com",
}


def load_env_local() -> dict:
    """Parse .env.local — minimal parser, handles KEY=VALUE and KEY="VALUE"."""
    env = {}
    if not ENV_LOCAL.exists():
        sys.exit(f"Missing {ENV_LOCAL}")
    for line in ENV_LOCAL.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        value = value.strip().strip('"').strip("'")
        env[key.strip()] = value
    return env


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def normalize_email(email: str) -> str | None:
    if not email:
        return None
    email = email.strip().lower()
    return email if "@" in email else None


def normalize_phone_e164(phone: str | None) -> str | None:
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 10:
        return f"+1{digits}"
    if 11 <= len(digits) <= 15:
        return f"+{digits}"
    return None


def build_user_identifiers(guest: dict) -> list[dict]:
    """Mirror src/lib/google-ads-server.ts buildUserIdentifiers exactly."""
    identifiers = []

    email = normalize_email(guest.get("email"))
    if email:
        identifiers.append({"hashedEmail": sha256_hex(email)})

    phone = normalize_phone_e164(guest.get("phone"))
    if phone:
        identifiers.append({"hashedPhoneNumber": sha256_hex(phone)})

    first = (guest.get("firstName") or "").strip().lower()
    last = (guest.get("lastName") or "").strip().lower()
    if first and last:
        identifiers.append(
            {
                "addressInfo": {
                    "hashedFirstName": sha256_hex(first),
                    "hashedLastName": sha256_hex(last),
                    "countryCode": "US",
                }
            }
        )

    return identifiers


def fetch_reservations(env: dict, since_iso: str, limit: int | None) -> list[dict]:
    """Pull confirmed BE-API direct bookings since the given timestamp."""
    base = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
    }
    # orderId sent to Google Ads = String(guesty_id) — see src/lib/checkout-finalizer.ts:254
    # so we must key the EC adjustment on guesty_id, not the Supabase row id.
    params = {
        "select": "id,guesty_id,confirmation_code,confirmed_at,source,status,money,guest",
        "source": "eq.BE-API",
        "status": "in.(confirmed,checked_in,closed)",
        "confirmed_at": f"gte.{since_iso}",
        "order": "confirmed_at.asc",
    }
    if limit:
        params["limit"] = str(limit)

    res = requests.get(base + SUPABASE_REST_PATH, headers=headers, params=params, timeout=30)
    res.raise_for_status()
    rows = res.json()
    print(f"[supabase] pulled {len(rows)} reservations since {since_iso}", file=sys.stderr)
    return rows


def build_adjustment(row: dict) -> tuple[dict | None, str]:
    """Build a single ConversionAdjustment, return (payload, skip_reason)."""
    # orderId sent to Google Ads = String(guesty_id), see checkout-finalizer.ts.
    guesty_id = row.get("guesty_id")
    if not guesty_id:
        return None, "missing guesty_id"
    order_id = str(guesty_id)

    guest = row.get("guest") or {}
    if not isinstance(guest, dict):
        return None, "guest field not an object"

    email = normalize_email(guest.get("email"))
    if not email:
        return None, "missing/invalid email"
    if email in EXCLUDED_EMAILS:
        return None, f"excluded test email ({email})"

    identifiers = build_user_identifiers(guest)
    if not identifiers:
        return None, "no usable identifiers"

    confirmed_at = row.get("confirmed_at")
    if not confirmed_at:
        return None, "missing confirmed_at"
    # Google wants "YYYY-MM-DD HH:MM:SS+00:00"
    dt = datetime.fromisoformat(confirmed_at.replace("Z", "+00:00")).astimezone(timezone.utc)
    adjustment_dt = dt.strftime("%Y-%m-%d %H:%M:%S+00:00")

    return (
        {
            "conversionAction": (
                f"customers/{SP_CUSTOMER_ID}/conversionActions/"
                f"{PURCHASE_CONVERSION_ACTION_ID}"
            ),
            "adjustmentType": "ENHANCEMENT",
            "adjustmentDateTime": adjustment_dt,
            "orderId": order_id,
            "userIdentifiers": identifiers,
        },
        "",
    )


def get_access_token() -> str:
    creds = service_account.Credentials.from_service_account_file(
        SA_KEY_PATH, scopes=[ADS_SCOPE]
    )
    creds.refresh(AuthRequest())
    return creds.token


def upload_batch(adjustments: list[dict]) -> dict:
    token = get_access_token()
    url = (
        f"https://googleads.googleapis.com/{GOOGLE_ADS_API_VERSION}"
        f"/customers/{SP_CUSTOMER_ID}:uploadConversionAdjustments"
    )
    body = {"conversionAdjustments": adjustments, "partialFailure": True}
    headers = {
        "Authorization": f"Bearer {token}",
        "developer-token": DEVELOPER_TOKEN,
        "login-customer-id": MCC_LOGIN_CUSTOMER_ID,
        "Content-Type": "application/json",
    }
    res = requests.post(url, headers=headers, json=body, timeout=60)
    if not res.ok:
        return {"status": res.status_code, "error": res.text}
    return {"status": res.status_code, "body": res.json()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--since", help="ISO date (YYYY-MM-DD), default = 90 days ago")
    parser.add_argument("--limit", type=int, help="Cap rows pulled (for sampling)")
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually call Google Ads API. Without this flag the script is a dry-run.",
    )
    args = parser.parse_args()

    env = load_env_local()
    since_dt = (
        datetime.fromisoformat(args.since)
        if args.since
        else datetime.now(timezone.utc) - timedelta(days=90)
    )
    if since_dt.tzinfo is None:
        since_dt = since_dt.replace(tzinfo=timezone.utc)
    since_iso = since_dt.isoformat()

    rows = fetch_reservations(env, since_iso, args.limit)
    adjustments: list[dict] = []
    skipped: list[tuple[str, str]] = []

    for row in rows:
        adj, reason = build_adjustment(row)
        if adj:
            adjustments.append(adj)
        else:
            res_id = (
                row.get("guesty_id") or row.get("confirmation_code") or row.get("id") or "<unknown>"
            )
            skipped.append((str(res_id), reason))

    print(f"\n=== EC ENHANCEMENT BACKFILL — {datetime.now().isoformat()} ===")
    print(f"window:      {since_iso} → now ({len(rows)} reservations pulled)")
    print(f"queued:      {len(adjustments)} adjustments")
    print(f"skipped:     {len(skipped)}")
    if skipped:
        for res_id, reason in skipped[:10]:
            print(f"  - {res_id}: {reason}")
        if len(skipped) > 10:
            print(f"  ...and {len(skipped) - 10} more")
    if adjustments:
        print("\nfirst adjustment (PII hashed):")
        print(json.dumps(adjustments[0], indent=2))
        if len(adjustments) > 1:
            print(f"\nlast adjustment orderId: {adjustments[-1].get('orderId')}")

    if not args.execute:
        print("\nDRY-RUN — no API call made. Re-run with --execute to upload.")
        return

    # LIVE WRITE — batch in groups of 100
    print("\n=== LIVE WRITE: uploading in batches of 100 ===")
    batch_size = 100
    for i in range(0, len(adjustments), batch_size):
        chunk = adjustments[i : i + batch_size]
        print(f"\nbatch {i // batch_size + 1}: {len(chunk)} adjustments")
        result = upload_batch(chunk)
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

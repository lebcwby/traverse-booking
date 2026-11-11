/**
 * Daily tax-configuration drift check.
 *
 * Reads the `listing_details` cache — no Guesty calls — lines up every active,
 * listed listing's tax configuration against its market, and reports anything
 * that looks like a mistake rather than a jurisdiction.
 *
 * It exists because on 2026-11-11 our accountant found what we had not: a
 * listing publishing the wrong tax rate. Lining the configs up turned out to
 * expose three separate standing problems in seconds. This runs that
 * comparison every night so the next one surfaces the same day.
 *
 * READ-ONLY with respect to Guesty. It never writes a tax rate; which of two
 * differing rates is correct is a filing question for a person.
 *
 * Manual run:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     https://www.booktraverse.com/api/cron/audit-listing-taxes
 *   add ?force=1 to alert even when nothing has changed since the last run.
 */

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendAlert, renderAlertDetails } from "@/lib/alerts";
import {
  auditListingTaxes,
  findingsFingerprint,
  type ListingTaxSnapshot,
  type TaxFinding,
} from "@/lib/listing-tax-audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STATE_KEY = "listing-tax-audit:last";

const KIND_LABEL: Record<TaxFinding["kind"], string> = {
  no_tax_config: "NO TAX CONFIGURED",
  rare_rates: "Rate differs from the market",
  non_percentage: "Non-percentage tax",
  duplicate_type: "Duplicate tax type",
};

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = new URL(request.url).searchParams.get("force") === "1";

  try {
    const supabase = getSupabaseAdmin();

    // Only listings a guest can actually book. A delisted listing with odd
    // taxes is not costing anyone money and would be permanent noise.
    const { data: listings, error: listErr } = await supabase
      .from("listings")
      .select("guesty_id, nickname, address")
      .eq("active", true)
      .eq("is_listed", true);
    if (listErr) throw new Error(`listings read failed: ${listErr.message}`);

    const { data: details, error: detErr } = await supabase
      .from("listing_details")
      .select("listing_id, payload");
    if (detErr)
      throw new Error(`listing_details read failed: ${detErr.message}`);

    const taxesById = new Map<string, ListingTaxSnapshot["taxes"]>();
    for (const row of details ?? []) {
      const payload = (row as { payload?: unknown }).payload as
        | { taxes?: unknown }
        | undefined;
      const taxes = Array.isArray(payload?.taxes)
        ? (payload!.taxes as ListingTaxSnapshot["taxes"])
        : [];
      taxesById.set(String((row as { listing_id: string }).listing_id), taxes);
    }

    // A listing with no cache row yet is skipped rather than reported as
    // having no taxes — absence of a cache entry is not absence of tax, and
    // reporting it as such would be the same class of error as the bug that
    // started all this.
    const snapshots: ListingTaxSnapshot[] = [];
    let uncached = 0;
    for (const l of listings ?? []) {
      const row = l as {
        guesty_id: string;
        nickname: string | null;
        address: { city?: string } | null;
      };
      const taxes = taxesById.get(String(row.guesty_id));
      if (taxes === undefined) {
        uncached++;
        continue;
      }
      snapshots.push({
        listingId: String(row.guesty_id),
        nickname: row.nickname || String(row.guesty_id),
        city: row.address?.city || "(unknown)",
        taxes,
      });
    }

    const findings = auditListingTaxes(snapshots);
    const fingerprint = findingsFingerprint(findings);

    const { data: prev } = await supabase
      .from("kv_store")
      .select("value")
      .eq("key", STATE_KEY)
      .maybeSingle();
    const previousFingerprint =
      (prev?.value as { fingerprint?: string } | null)?.fingerprint ?? null;
    const changed = fingerprint !== previousFingerprint;

    // Alert when the picture CHANGES, not every night. A standing difference
    // somebody has consciously accepted should go quiet; a new one should not.
    if (findings.length > 0 && (changed || force)) {
      await sendAlert(
        `Listing tax config: ${findings.length} listing${findings.length === 1 ? "" : "s"} to review`,
        [
          `<p>Comparing every active listing's Guesty tax configuration against
            its market. These differ from their peers or have none at all.
            <strong>Which rate is correct is a filing question</strong> — this
            check only lines them up.</p>`,
          renderAlertDetails(
            findings.map((f) => [
              `${KIND_LABEL[f.kind]} — ${f.nickname}`,
              [
                f.city,
                `this listing: ${f.rates}`,
                f.peers ? `its market: ${f.peers}` : null,
                f.detail,
              ]
                .filter(Boolean)
                .join(" · "),
            ])
          ),
          `<p><em>Alerts only when this set changes. ${uncached} listing${uncached === 1 ? "" : "s"} had no cached detail yet and ${uncached === 1 ? "was" : "were"} skipped.</em></p>`,
        ].join(""),
        // Date-stamped so a genuinely new problem is never swallowed by the
        // one-hour cooldown on a key we already used today.
        `listing-tax-audit-${new Date().toISOString().slice(0, 10)}`
      );
    }

    await supabase.from("kv_store").upsert(
      {
        key: STATE_KEY,
        value: {
          fingerprint,
          findings: findings.length,
          checkedAt: new Date().toISOString(),
        },
      },
      { onConflict: "key" }
    );

    return NextResponse.json({
      ok: true,
      listingsChecked: snapshots.length,
      uncached,
      findings,
      changed,
      alerted: findings.length > 0 && (changed || force),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown audit error";
    console.error("[Listing Tax Audit] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

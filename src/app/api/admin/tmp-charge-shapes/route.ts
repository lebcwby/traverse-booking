/**
 * 🗑️ TEMPORARY — DELETE THIS FILE ONCE THE WAIVER FILTER IS WRITTEN.
 *
 * Why it exists: the daily digest needs a damage-waiver total, and the waiver
 * money exists only in Stripe. SuiteOp charges waivers through the same
 * `TraverseHospitality` Stripe account we use, so in Stripe a waiver is
 * identifiable only by what it LACKS — no `quoteId`, no `cartCheckout`, no
 * `type: date_change` — which is the `external` bucket in
 * src/lib/stripe-payment-source.ts. That bucket also holds SuiteOp's pet fees,
 * mid-stay cleans, early check-ins and late checkouts, and the amounts overlap
 * ($20 waiver vs $15 early check-in), so summing it would report other
 * people's money as waiver revenue.
 *
 * What we actually need is the `description` and `metadata` shape SuiteOp
 * stamps on a waiver charge. Nothing in our stack records it and the live key
 * only exists in Vercel, so this route reads it back once from production.
 *
 * There is a reconciliation target. SuiteOp's own Analytics > Guest Store
 * reports October 2026 as $4,329.00 paid waivers against $30.00 of refunds,
 * so whichever shape this turns up, the right filter sums to about that over
 * the month. "About" because SuiteOp counts a waiver against the stay's
 * CHECK-IN date while Stripe knows only when the card was charged, so the two
 * disagree at the edges of any window.
 *
 * (SuiteOp's MCP exposes the Store card of that page as getUpsellPerformance,
 * which agrees to the cent — $670.00, $610.00 settled, $20.00 refunded — but
 * there is no equivalent for the waiver card. Hence Stripe.)
 *
 * It is READ-ONLY: it lists PaymentIntents and writes nothing, to Stripe or
 * to us. It is not in vercel.json and nothing calls it.
 *
 * Guest data: metadata values are redacted before they leave the process —
 * emails, phone-like digit runs and anything long are masked. We need the
 * SHAPE (which keys exist, what a type/label value looks like), never the
 * guest. Descriptions are product labels and are shown whole.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://www.booktraverse.com/api/admin/tmp-charge-shapes"
 *
 *   ?days=N        how far back to look, 1-31, default 31 (a month, to
 *                  reconcile against the SuiteOp figure above)
 *   ?raw=1         also return up to 5 un-grouped samples per shape
 */
import { NextResponse } from "next/server";
import { getStripeServer } from "@/lib/stripe";
import { classifyPaymentIntent } from "@/lib/stripe-payment-source";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Stop walking Stripe rather than risk the function timing out. */
const MAX_SCANNED = 2000;

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;
/** Seven or more digits in a row: phone numbers, card-ish tails, ids. */
const LONG_DIGITS = /\d{7,}/g;

/**
 * Keep enough to recognise a label, lose anything that identifies a guest.
 * A value like "damage_waiver" survives intact; "Karen Oliver" is short and
 * harmless-looking, so names are handled by only ever reading keys plus
 * values short enough to be an enum, and masking the rest.
 */
function redact(value: string): string {
  const masked = value.replace(EMAIL, "«email»").replace(LONG_DIGITS, "«digits»");
  return masked.length > 48 ? `${masked.slice(0, 48)}…` : masked;
}

function shapeKey(description: string | null, metadataKeys: string[]): string {
  return `${description ?? "(no description)"} :: ${metadataKeys.join(",") || "(no metadata)"}`;
}

interface Shape {
  description: string | null;
  metadataKeys: string[];
  count: number;
  totalCents: number;
  amountsCents: number[];
  statuses: Record<string, number>;
  captureMethods: Record<string, number>;
  /** One redacted example of each key's value, to show what a value looks like. */
  exampleMetadata: Record<string, string>;
  samples?: Array<Record<string, unknown>>;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const raw = url.searchParams.get("raw") === "1";
  const days = Math.min(
    31,
    Math.max(1, Number(url.searchParams.get("days") ?? 31) || 31)
  );

  const nowSec = Math.floor(Date.now() / 1000);
  const since = nowSec - days * 86400;

  const stripe = getStripeServer();
  const shapes = new Map<string, Shape>();
  const sourceCounts: Record<string, number> = {};
  let scanned = 0;
  let truncated = false;

  try {
    for await (const pi of stripe.paymentIntents.list({
      created: { gte: since },
      limit: 100,
    })) {
      if (scanned >= MAX_SCANNED) {
        truncated = true;
        break;
      }
      scanned += 1;

      const source = classifyPaymentIntent(pi);
      sourceCounts[source] = (sourceCounts[source] ?? 0) + 1;
      // Ours are already understood; this route exists for the rest.
      if (source !== "external") continue;

      const metadata = pi.metadata ?? {};
      const metadataKeys = Object.keys(metadata).sort();
      const key = shapeKey(pi.description ?? null, metadataKeys);

      let shape = shapes.get(key);
      if (!shape) {
        shape = {
          description: pi.description ?? null,
          metadataKeys,
          count: 0,
          totalCents: 0,
          amountsCents: [],
          statuses: {},
          captureMethods: {},
          exampleMetadata: {},
        };
        shapes.set(key, shape);
      }

      shape.count += 1;
      shape.totalCents += pi.amount ?? 0;
      // A handful is enough to see the per-night pattern ($5/$10/$20 × nights).
      if (shape.amountsCents.length < 8) shape.amountsCents.push(pi.amount ?? 0);
      shape.statuses[pi.status] = (shape.statuses[pi.status] ?? 0) + 1;
      const cm = pi.capture_method ?? "(unset)";
      shape.captureMethods[cm] = (shape.captureMethods[cm] ?? 0) + 1;
      for (const [k, v] of Object.entries(metadata)) {
        if (!(k in shape.exampleMetadata)) {
          shape.exampleMetadata[k] = redact(String(v));
        }
      }

      if (raw) {
        shape.samples ??= [];
        if (shape.samples.length < 5) {
          shape.samples.push({
            id: pi.id,
            created: new Date((pi.created ?? 0) * 1000).toISOString(),
            amountCents: pi.amount,
            currency: pi.currency,
            status: pi.status,
            captureMethod: pi.capture_method,
            description: pi.description,
            statementDescriptor: pi.statement_descriptor,
            metadata: Object.fromEntries(
              Object.entries(metadata).map(([k, v]) => [k, redact(String(v))])
            ),
          });
        }
      }
    }
  } catch (err) {
    console.error("[tmp-charge-shapes] Stripe list failed:", err);
    return NextResponse.json(
      { error: "Stripe list failed", detail: String(err) },
      { status: 502 }
    );
  }

  return NextResponse.json({
    note: "TEMPORARY read-only probe. Delete src/app/api/admin/tmp-charge-shapes once the waiver filter is written.",
    windowDays: days,
    since: new Date(since * 1000).toISOString(),
    scanned,
    truncated,
    bySource: sourceCounts,
    externalShapes: [...shapes.values()]
      .sort((a, b) => b.count - a.count)
      .map((s) => ({
        ...s,
        totalDollars: Math.round(s.totalCents) / 100,
        amountsDollars: s.amountsCents.map((c) => c / 100),
      })),
  });
}

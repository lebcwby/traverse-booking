// src/app/api/recs/email/route.ts
// Sends a saved set of Portland recommendations to an email via Resend, and
// captures the lead in sp_plan_leads (source='recs') for marketing follow-up.
//
// Mirrors /api/plan/save's lead-capture pattern. POI rows are re-hydrated
// server-side from sp_pois, so the email always has fresh data even if the
// client cache was stale.

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getPoisByIds } from "@/lib/pois/queries";
import type { Poi } from "@/lib/pois/types";
import {
  enforceRateLimit,
  rejectOversizedRequest,
} from "@/lib/plan/route-guards";

interface FavoriteOverlay {
  id: string;
  orderThis?: string;
  note?: string;
}

interface EmailRequest {
  email?: string;
  chatId?: string | null;
  intro?: string;
  poiIds?: string[];
  favorites?: FavoriteOverlay[];
}

const CATEGORY_LABEL: Record<string, string> = {
  restaurant: "Restaurant",
  coffee: "Coffee",
  bar: "Bar",
  park: "Park",
  shop: "Shop",
  museum: "Museum",
  viewpoint: "Viewpoint",
  activity: "Activity",
  food_cart_pod: "Food carts",
  transit: "Transit",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function prettifyNeighborhood(slug: string): string {
  return slug
    .split(/[_-]/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function sanitizeEmail(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

function buildEmailHtml(opts: {
  intro: string;
  pois: Poi[];
  favoritesById: Map<string, FavoriteOverlay>;
  shareUrl: string | null;
}): string {
  const { intro, pois, favoritesById, shareUrl } = opts;

  const cardsHtml = pois
    .map((p) => {
      const fav = favoritesById.get(p.id);
      const categoryLabel = CATEGORY_LABEL[p.category] ?? p.category;
      const neighborhood = p.neighborhood
        ? prettifyNeighborhood(p.neighborhood)
        : "";
      const price = p.priceLevel ? "$".repeat(p.priceLevel) : "";
      const photoSrc = p.photoUrl
        ? p.photoUrl.startsWith("http")
          ? p.photoUrl
          : `https://www.booktraverse.com${p.photoUrl}`
        : null;
      const mapsHref = p.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${p.address}`)}`
        : null;

      const orderRow = fav?.orderThis
        ? `<tr><td style="padding: 6px 16px 0; font-size: 13px; color: #1c1d1d; background: #fff7e6;"><strong style="color: #2d3e2c;">Order:</strong> ${escapeHtml(fav.orderThis)}</td></tr>`
        : "";

      return `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 18px; border: 1px solid #e6e3dd; border-radius: 12px; overflow: hidden;">
          ${
            photoSrc
              ? `<tr><td style="padding: 0;"><img src="${escapeHtml(photoSrc)}" alt="" width="600" style="display: block; width: 100%; height: 220px; object-fit: cover;" /></td></tr>`
              : ""
          }
          <tr>
            <td style="padding: 14px 16px 4px;">
              <div style="font-size: 16px; font-weight: 700; color: #1c1d1d; line-height: 1.3;">${escapeHtml(p.name)}${price ? ` <span style="font-weight: 600; color: #6f7274;">· ${price}</span>` : ""}</div>
              <div style="margin-top: 4px; font-size: 11px; color: #2d3e2c; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;">
                ${escapeHtml(categoryLabel)}${neighborhood ? ` <span style="color: #6f7274; font-weight: 500; text-transform: none; letter-spacing: 0;">· ${escapeHtml(neighborhood)}</span>` : ""}
              </div>
            </td>
          </tr>
          ${orderRow}
          ${
            p.description
              ? `<tr><td style="padding: 8px 16px 0; font-size: 13.5px; line-height: 1.55; color: #4a4d4f;">${escapeHtml(p.description)}</td></tr>`
              : ""
          }
          ${
            mapsHref
              ? `<tr><td style="padding: 10px 16px 14px;"><a href="${escapeHtml(mapsHref)}" style="color: #2d3e2c; font-size: 12px; font-weight: 600; text-decoration: none;">Open in Maps →</a></td></tr>`
              : `<tr><td style="padding: 0 0 12px;"></td></tr>`
          }
        </table>`;
    })
    .join("");

  const shareCta = shareUrl
    ? `<div style="margin-top: 24px; text-align: center;"><a href="${escapeHtml(shareUrl)}" style="color: #2d3e2c; font-size: 13px; font-weight: 600; text-decoration: underline;">View this list online</a></div>`
    : "";

  return `
    <div style="max-width: 620px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1c1d1d; line-height: 1.55; background: #faf8f5; padding: 16px;">
      <div style="text-align: center; padding: 24px 0 20px;">
        <img src="https://www.booktraverse.com/book-traverse-wordmark-dark.png" alt="Book Traverse" style="height: 28px;" />
      </div>
      <p style="font-size: 14.5px; color: #4a4d4f; margin: 0 0 20px;">${escapeHtml(intro)}</p>
      ${cardsHtml}
      ${shareCta}
      <div style="margin-top: 28px; padding: 22px; background: #2d3e2c; border-radius: 12px; text-align: center;">
        <p style="color: #faf8f5; font-size: 14px; margin: 0 0 14px;">Need a place to stay in Portland?</p>
        <a href="https://www.booktraverse.com/properties" style="display: inline-block; padding: 11px 26px; background: #f2c070; color: #1c1d1d; text-decoration: none; border-radius: 999px; font-weight: 700; font-size: 13px;">Browse 275+ homes →</a>
        <p style="color: #c8d0c7; font-size: 11px; margin: 12px 0 0;">No booking fees · Best price guaranteed</p>
      </div>
      <p style="margin-top: 28px; font-size: 11px; color: #8b8e90; text-align: center;">
        Built with the Book Traverse local recommender — <a href="https://www.booktraverse.com/portland-recommendations" style="color: #8b8e90;">ask another question</a>
      </p>
    </div>
  `;
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  const sizeError = rejectOversizedRequest(req, 16_000);
  if (sizeError) return sizeError;

  const limited = await enforceRateLimit(req, "recs:email", {
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  let body: EmailRequest;
  try {
    body = (await req.json()) as EmailRequest;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const email = body.email ? sanitizeEmail(body.email) : null;
  if (!email) {
    return NextResponse.json(
      { error: "valid email required" },
      { status: 400 }
    );
  }
  const poiIds = (body.poiIds ?? []).filter(
    (id): id is string =>
      typeof id === "string" && id.length > 0 && id.length <= 120
  );
  if (poiIds.length === 0) {
    return NextResponse.json(
      { error: "at least one POI required" },
      { status: 400 }
    );
  }
  if (poiIds.length > 25) {
    return NextResponse.json({ error: "too many picks" }, { status: 400 });
  }

  const intro =
    typeof body.intro === "string" && body.intro.trim().length > 0
      ? body.intro.trim().slice(0, 500)
      : "Local Portland recommendations from Book Traverse.";

  const favoritesById = new Map<string, FavoriteOverlay>();
  for (const f of body.favorites ?? []) {
    if (f && typeof f.id === "string") favoritesById.set(f.id, f);
  }

  // Hydrate POIs server-side. Preserve the order the client supplied so the
  // email matches what the user just saw on screen.
  let pois: Poi[] = [];
  try {
    const fetched = await getPoisByIds(poiIds);
    const byId = new Map(fetched.map((p) => [p.id, p]));
    pois = poiIds.map((id) => byId.get(id)).filter((p): p is Poi => Boolean(p));
  } catch (e) {
    console.error("[recs/email] POI hydration failed:", (e as Error).message);
    return NextResponse.json(
      { error: "Failed to load picks. Try again." },
      { status: 500 }
    );
  }
  if (pois.length === 0) {
    return NextResponse.json(
      { error: "Picks could not be loaded — try again." },
      { status: 500 }
    );
  }

  // Capture lead — mirrors plan/save behavior. Stored under sp_plan_leads
  // with source='recs' so marketing can segment. Don't block the send if
  // capture fails; deliverability matters more than the analytics row.
  try {
    await getSupabaseAdmin()
      .from("sp_plan_leads")
      .insert({
        email,
        name: null,
        // sp_plan_leads.itinerary is jsonb — repurpose for the picks payload.
        itinerary: { kind: "recs", chatId: body.chatId ?? null, poiIds, intro },
        party_size: null,
        check_in: null,
        check_out: null,
        source: "recs",
      });
  } catch (e) {
    console.error("[recs/email] lead capture failed:", (e as Error).message);
  }

  const shareUrl = body.chatId
    ? `https://www.booktraverse.com/portland-recommendations/${body.chatId}`
    : null;

  try {
    const resend = new Resend((process.env.RESEND_API_KEY || "").trim());
    const { error: sendError } = await resend.emails.send({
      from: "Book Traverse Local Picks <noreply@booktraverse.com>",
      to: email,
      subject: `Your Portland picks (${pois.length})`,
      html: buildEmailHtml({ intro, pois, favoritesById, shareUrl }),
    });
    if (sendError) {
      console.error("[recs/email] Resend error:", sendError);
      return NextResponse.json(
        { error: "Failed to send email. Try again." },
        { status: 500 }
      );
    }
  } catch (e) {
    console.error("[recs/email] send error:", (e as Error).message);
    return NextResponse.json(
      { error: "Failed to send email. Try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

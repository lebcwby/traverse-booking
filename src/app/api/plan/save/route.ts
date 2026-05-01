// src/app/api/plan/save/route.ts
// Saves a /plan lead (email + itinerary) to sp_plan_leads and sends a
// formatted itinerary email via Resend. This is the main lead-capture
// point for the trip planner — every "Email me this itinerary" click
// gives us a warm email for marketing follow-up.

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getPoisByIds } from "@/lib/pois/queries";
import type { Poi } from "@/lib/pois/types";
import type { Itinerary } from "@/lib/plan/schema";
import { slotLabel } from "@/lib/plan/slot-label";
import {
  enforceRateLimit,
  rejectOversizedRequest,
} from "@/lib/plan/route-guards";

interface SaveRequest {
  email?: string;
  name?: string;
  itinerary?: Itinerary;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function titleCase(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  try {
    return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}

function sanitizeEmail(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

function buildItineraryHtml(
  it: Itinerary,
  poisById: Map<string, Poi>,
  name?: string
): string {
  const greeting = name ? `Hi ${name},` : "Hi there,";
  const dateRange = it.dates.isTentative
    ? "flexible dates"
    : `${formatDate(it.dates.checkIn)} – ${formatDate(it.dates.checkOut)}`;

  let daysHtml = "";
  for (const day of it.days) {
    let itemsHtml = "";
    for (const item of day.items) {
      const poi = poisById.get(item.poiId);
      const poiName = poi?.name ?? titleCase(item.poiId);
      const neighborhood =
        poi && poi.neighborhood !== "other" && poi.neighborhood !== "unknown"
          ? poi.neighborhood
          : "";
      const label = slotLabel(item.timeSlot, poi?.category);
      itemsHtml += `
        <tr>
          <td style="padding: 10px 0; vertical-align: top; color: #737373; font-size: 12px; font-weight: 600; width: 104px;">${escapeHtml(label)}</td>
          <td style="padding: 10px 0; vertical-align: top;">
            <strong style="color: #171717; font-size: 15px;">${escapeHtml(poiName)}</strong>
            ${neighborhood ? `<span style="color: #a3a3a3; font-size: 12px;"> · ${escapeHtml(neighborhood)}</span>` : ""}
            <br />
            <span style="color: #525252; font-size: 14px; line-height: 1.5;">${escapeHtml(item.reason)}</span>
          </td>
        </tr>`;
    }
    daysHtml += `
      <div style="margin-bottom: 28px;">
        <h3 style="font-size: 16px; font-weight: 600; color: #171717; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 2px solid #e5e5e5;">
          ${escapeHtml(day.label)}
        </h3>
        <table style="width: 100%; border-collapse: collapse;">${itemsHtml}</table>
      </div>`;
  }

  let notesHtml = "";
  if (it.notes && it.notes.length > 0) {
    notesHtml = `
      <div style="margin-top: 24px; padding: 16px; background: #f5f5f5; border-radius: 8px;">
        <h3 style="font-size: 14px; font-weight: 600; color: #171717; margin: 0 0 8px 0;">Practical Notes</h3>
        <ul style="margin: 0; padding-left: 20px; color: #525252; font-size: 14px;">
          ${it.notes.map((n) => `<li style="margin-bottom: 4px;">${n}</li>`).join("")}
        </ul>
      </div>`;
  }

  const partyLabel = `${it.party.adults} adult${it.party.adults === 1 ? "" : "s"}${it.party.kids ? ` + ${it.party.kids} kid${it.party.kids === 1 ? "" : "s"}` : ""}`;

  return `
    <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #171717; line-height: 1.6;">
      <div style="text-align: center; padding: 32px 0 24px;">
        <img src="https://www.booktraverse.com/book-traverse-wordmark-dark.png" alt="Book Traverse" style="height: 28px;" />
      </div>

      <p style="font-size: 15px; color: #525252;">${greeting}</p>
      <p style="font-size: 15px; color: #525252;">Here's your Portland trip itinerary — built from where Portlanders actually eat, drink and hang out.</p>

      <div style="margin: 20px 0; padding: 16px 20px; background: #f5f5f5; border-radius: 12px;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #a3a3a3; margin-bottom: 4px;">Your trip</div>
        <div style="font-size: 18px; font-weight: 700; color: #171717;">${escapeHtml(it.title)}</div>
        <div style="font-size: 14px; color: #525252; margin-top: 4px;">${dateRange} · ${partyLabel} · ${it.party.vibe} pace</div>
      </div>

      <h2 style="font-size: 20px; font-weight: 700; color: #171717; margin: 32px 0 16px;">${it.title}</h2>
      <p style="font-size: 14px; color: #737373; margin: 0 0 24px;">${it.summary}</p>

      ${daysHtml}
      ${notesHtml}

      <div style="margin-top: 32px; padding: 24px; background: #171717; border-radius: 12px; text-align: center;">
        <p style="color: #e5e5e5; font-size: 15px; margin: 0 0 16px;">Ready to book your stay?</p>
        <a href="https://www.booktraverse.com/properties${it.dates.isTentative ? "" : `?checkIn=${it.dates.checkIn}&checkOut=${it.dates.checkOut}&guests=${it.party.adults + (it.party.kids ?? 0)}`}" style="display: inline-block; padding: 12px 32px; background: white; color: #171717; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Browse Vacation Rentals</a>
      </div>

      <p style="margin-top: 32px; font-size: 12px; color: #a3a3a3; text-align: center;">
        Built with Book Traverse's Trip Concierge &mdash; <a href="https://www.booktraverse.com/plan" style="color: #a3a3a3;">plan another trip</a>
      </p>
    </div>
  `;
}

export async function POST(req: Request) {
  const sizeError = rejectOversizedRequest(req, 64_000);
  if (sizeError) return sizeError;

  // Lead capture — tighter limit than plan endpoints since each call writes
  // to sp_plan_leads + sends a Resend email.
  const limited = await enforceRateLimit(req, "plan:save", {
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  let body: SaveRequest;
  try {
    body = (await req.json()) as SaveRequest;
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
  if (!body.itinerary || !body.itinerary.days) {
    return NextResponse.json({ error: "itinerary required" }, { status: 400 });
  }

  const it = body.itinerary;
  const guests = it.party.adults + (it.party.kids ?? 0);

  // 1. Save lead to sp_plan_leads
  try {
    const { error: dbError } = await getSupabaseAdmin()
      .from("sp_plan_leads")
      .insert({
        email,
        name: body.name || null,
        itinerary: it,
        party_size: guests,
        check_in: it.dates.isTentative ? null : it.dates.checkIn,
        check_out: it.dates.isTentative ? null : it.dates.checkOut,
        source: "plan",
      });

    if (dbError) {
      console.error("[plan/save] DB insert failed:", dbError.message);
      // Don't block the email send on DB failure — still try to send
    }
  } catch (e) {
    console.error("[plan/save] DB error:", (e as Error).message);
  }

  // 2. Hydrate POI names for the email template
  const allPoiIds = new Set<string>();
  for (const day of it.days) {
    for (const item of day.items) {
      allPoiIds.add(item.poiId);
    }
  }
  let poisById = new Map<string, Poi>();
  try {
    const pois = await getPoisByIds([...allPoiIds]);
    poisById = new Map(pois.map((p) => [p.id, p]));
  } catch (e) {
    console.warn("[plan/save] POI hydration failed:", (e as Error).message);
    // Continue anyway — the email will use titleCase(poiId) as fallback
  }

  // 3. Send the itinerary email via Resend
  try {
    const resend = new Resend((process.env.RESEND_API_KEY || "").trim());
    const { error: emailError } = await resend.emails.send({
      from: "Book Traverse Trip Concierge <noreply@booktraverse.com>",
      to: email,
      subject: `Your Portland Trip: ${it.title}`,
      html: buildItineraryHtml(it, poisById, body.name || undefined),
    });

    if (emailError) {
      console.error("[plan/save] Resend error:", emailError);
      return NextResponse.json(
        { error: "Failed to send email. Try again." },
        { status: 500 }
      );
    }
  } catch (e) {
    console.error("[plan/save] email send error:", (e as Error).message);
    return NextResponse.json(
      { error: "Failed to send email. Try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

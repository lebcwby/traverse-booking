// src/app/api/plan/print/route.ts
// Generates a real PDF of the itinerary and returns it as a direct download.
// Uses puppeteer-core + @sparticuz/chromium-min to render the HTML template
// into a PDF via headless Chromium. On Vercel, chromium-min provides a
// Lambda-compatible Chromium binary. Locally, uses the system Chrome.

import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium-min";
import { getPoisByIds } from "@/lib/pois/queries";
import type { Poi } from "@/lib/pois/types";
import type { Itinerary, ItineraryItem } from "@/lib/plan/schema";
import { slotLabel } from "@/lib/plan/slot-label";
import {
  enforceRateLimit,
  rejectOversizedRequest,
} from "@/lib/plan/route-guards";

// Must be Node.js runtime for Chromium binary
export const runtime = "nodejs";
export const maxDuration = 30;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso: string): string {
  try {
    return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}

function poiName(item: ItineraryItem, pois: Map<string, Poi>): string {
  const poi = pois.get(item.poiId);
  if (poi) return poi.name;
  return item.poiId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function poiNeighborhood(item: ItineraryItem, pois: Map<string, Poi>): string {
  const poi = pois.get(item.poiId);
  if (!poi) return "";
  if (poi.neighborhood === "other" || poi.neighborhood === "unknown") return "";
  return poi.neighborhood;
}

function buildPrintableHtml(it: Itinerary, pois: Map<string, Poi>): string {
  const dateRange = it.dates.isTentative
    ? "Flexible dates"
    : `${formatDate(it.dates.checkIn)} – ${formatDate(it.dates.checkOut)}`;
  const party = `${it.party.adults} adult${it.party.adults === 1 ? "" : "s"}${
    it.party.kids
      ? ` + ${it.party.kids} kid${it.party.kids === 1 ? "" : "s"}`
      : ""
  }`;

  let daysHtml = "";
  for (const day of it.days) {
    let itemsHtml = "";
    for (const item of day.items) {
      const name = escapeHtml(poiName(item, pois));
      const hood = poiNeighborhood(item, pois);
      const poi = pois.get(item.poiId);
      const photo = poi?.photoUrl;
      itemsHtml += `
        <div class="poi-card">
          ${photo ? `<img src="${escapeHtml(photo)}" alt="${name}" class="poi-photo" />` : ""}
          <div class="poi-info">
            <div class="poi-time">${escapeHtml(slotLabel(item.timeSlot, poi?.category))}</div>
            <div class="poi-name">${name}${hood ? `<span class="poi-hood"> · ${escapeHtml(hood)}</span>` : ""}</div>
            <div class="poi-reason">${escapeHtml(item.reason)}</div>
          </div>
        </div>`;
    }
    daysHtml += `
      <div class="day-card">
        <div class="day-header">
          <span class="day-number">${day.dayNumber}</span>
          <span class="day-label">${escapeHtml(day.label)}</span>
        </div>
        ${itemsHtml}
      </div>`;
  }

  let notesHtml = "";
  if (it.notes && it.notes.length > 0) {
    notesHtml = `
      <div class="notes">
        <h3>Practical Notes</h3>
        <ul>${it.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(it.title)} — Book Traverse Trip Plan</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #171717;
      background: #fafafa;
      line-height: 1.6;
      padding: 40px 24px;
    }
    .container { max-width: 720px; margin: 0 auto; }
    .logo { text-align: center; margin-bottom: 32px; }
    .logo img { height: 24px; }
    h1 { font-size: 28px; font-weight: 700; margin-bottom: 6px; }
    .summary { color: #525252; font-size: 15px; margin-bottom: 8px; }
    .meta { color: #737373; font-size: 13px; margin-bottom: 32px; }
    .meta span { display: inline-block; padding: 3px 10px; border: 1px solid #e5e5e5; border-radius: 999px; margin-right: 6px; margin-bottom: 4px; background: white; }
    .day-card {
      background: white;
      border: 1px solid #e5e5e5;
      border-radius: 12px;
      margin-bottom: 20px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .day-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      border-bottom: 1px solid #e5e5e5;
      font-weight: 600;
      font-size: 15px;
    }
    .day-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #171717;
      color: white;
      font-size: 13px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .poi-card {
      display: flex;
      gap: 14px;
      padding: 14px 20px;
      border-bottom: 1px solid #f5f5f5;
    }
    .poi-card:last-child { border-bottom: none; }
    .poi-photo {
      width: 64px;
      height: 64px;
      border-radius: 8px;
      object-fit: cover;
      flex-shrink: 0;
    }
    .poi-info { flex: 1; min-width: 0; }
    .poi-time {
      font-size: 12px;
      font-weight: 600;
      color: #737373;
      margin-bottom: 2px;
    }
    .poi-name { font-size: 15px; font-weight: 600; }
    .poi-hood { color: #a3a3a3; font-weight: 400; font-size: 13px; }
    .poi-reason { color: #525252; font-size: 14px; margin-top: 4px; }
    .notes {
      background: white;
      border: 1px solid #e5e5e5;
      border-radius: 12px;
      padding: 20px;
      margin-top: 20px;
    }
    .notes h3 { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
    .notes ul { padding-left: 20px; color: #525252; font-size: 14px; }
    .notes li { margin-bottom: 4px; }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e5e5;
    }
    .footer a {
      display: inline-block;
      padding: 12px 32px;
      background: #171717;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
    }
    .footer-sub { color: #a3a3a3; font-size: 12px; margin-top: 16px; }
    .footer-sub a { color: #a3a3a3; background: none; padding: 0; font-weight: 400; text-decoration: underline; }

    @media print {
      body { background: white; padding: 0; }
      .day-card { box-shadow: none; break-inside: avoid; }
      .footer { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <img src="https://www.booktraverse.com/book-traverse-wordmark-dark.png" alt="Book Traverse" />
    </div>

    <h1>${escapeHtml(it.title)}</h1>
    <div class="summary">${escapeHtml(it.summary)}</div>
    <div class="meta">
      <span>${dateRange}</span>
      <span>${party}</span>
      <span>${it.party.vibe} pace</span>
      ${it.anchorNeighborhood ? `<span>${escapeHtml(it.anchorNeighborhood)}</span>` : ""}
    </div>

    ${daysHtml}
    ${notesHtml}

    <div class="footer">
      <div style="color: #525252; font-size: 15px; margin-bottom: 16px;">Ready to book your Colorado stay?</div>
      <a href="https://www.booktraverse.com/properties${
        it.dates.isTentative
          ? ""
          : `?checkIn=${it.dates.checkIn}&checkOut=${it.dates.checkOut}&guests=${it.party.adults + (it.party.kids ?? 0)}`
      }">Browse Vacation Rentals</a>
      <div class="footer-sub">
        Built with <a href="https://www.booktraverse.com/plan">Book Traverse Trip Concierge</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function getBrowser() {
  // Local dev: use system Chrome
  const localChrome =
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const isLocal = process.env.NODE_ENV === "development";

  if (isLocal) {
    return puppeteer.launch({
      executablePath: localChrome,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }

  // Vercel / production: use chromium-min's Lambda-compatible binary
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(
      "https://github.com/nicholasgasior/chromium-builds/releases/download/v131.0.6778.139/chromium-v131.0.6778.139-layer.zip"
    ),
    headless: true,
  });
}

export async function POST(req: Request) {
  const sizeError = rejectOversizedRequest(req, 128_000);
  if (sizeError) return sizeError;

  // Puppeteer spin-up is expensive — limit per IP.
  const limited = await enforceRateLimit(req, "plan:print", {
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  let itinerary: Itinerary;
  try {
    const formData = await req.formData();
    const raw = formData.get("itinerary");
    if (!raw || typeof raw !== "string") {
      return new Response("missing itinerary field", { status: 400 });
    }
    itinerary = JSON.parse(raw) as Itinerary;
  } catch {
    return new Response("invalid itinerary json", { status: 400 });
  }

  if (!itinerary.days || itinerary.days.length === 0) {
    return new Response("itinerary has no days", { status: 400 });
  }

  // Hydrate POI names
  const allIds = new Set<string>();
  for (const day of itinerary.days) {
    for (const item of day.items) {
      allIds.add(item.poiId);
    }
  }
  let poisById = new Map<string, Poi>();
  try {
    const pois = await getPoisByIds([...allIds]);
    poisById = new Map(pois.map((p) => [p.id, p]));
  } catch {
    // Continue without hydration — will use titleCase(poiId) fallback
  }

  const html = buildPrintableHtml(itinerary, poisById);

  // Render HTML → PDF via headless Chromium
  let pdfBuffer: Uint8Array;
  let browser;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    pdfBuffer = await page.pdf({
      format: "letter",
      printBackground: true,
      margin: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" },
    });
  } catch (e) {
    console.error("[plan/print] PDF generation failed:", (e as Error).message);
    return new Response("PDF generation failed", { status: 500 });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  const slug = itinerary.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return new Response(Buffer.from(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="portland-trip-${slug}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

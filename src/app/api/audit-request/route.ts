/**
 * Listing-audit lead intake (audit.booktraverse.com).
 *
 * Owner-acquisition lead magnet: an owner pastes their Airbnb listing URL and
 * we come back with a written audit. This route captures the request and
 * alerts ops — it does NOT generate the audit. A human writes that today.
 *
 * Deliberately self-contained rather than posting at the CRM's /api/leads:
 * that endpoint has a fixed owner-inquiry shape (property address, currently
 * rent, personal use) with no room for a listing URL, and it requires a
 * Turnstile token. Keeping intake here means the page owns its own fields and
 * we can forward wherever leads should live later.
 */
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { sendAlert, renderAlertDetails } from "@/lib/alerts";
import {
  enforceRateLimit,
  rejectOversizedRequest,
} from "@/lib/plan/route-guards";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;

interface Payload {
  airbnbUrl?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  zipcode?: string;
  consent?: boolean;
  /** Honeypot — real users never see or fill this. */
  company?: string;
  page?: string;
  /** HubSpot visitor token, read from the `hubspotutk` cookie by the client. */
  hutk?: string;
}

const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID || "7792991";
const HUBSPOT_AUDIT_FORM_GUID = process.env.HUBSPOT_AUDIT_FORM_GUID || "";

/**
 * Push the lead into HubSpot via the public Forms API.
 *
 * Deliberately the Forms API and not the CRM API: it needs no private token
 * (we have none in this project), it creates/updates the contact for us, and
 * — critically — a form submission is a workflow trigger, which is how the
 * deal gets created in STR Sales and tagged as an audit request. Posting
 * straight at the CRM would create a contact that fires nothing.
 *
 * Passing `hutk` is what ties this submission to the visitor's page-view
 * history, so HubSpot can finally answer "how did this owner find us".
 */
async function pushToHubSpot(fields: {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  zipcode: string;
  listingUrl: string;
  hutk: string;
  pageUri: string;
}): Promise<{ ok: boolean; detail?: string }> {
  if (!HUBSPOT_AUDIT_FORM_GUID) {
    return { ok: false, detail: "HUBSPOT_AUDIT_FORM_GUID not configured" };
  }

  const body = {
    fields: [
      { objectTypeId: "0-1", name: "email", value: fields.email },
      { objectTypeId: "0-1", name: "firstname", value: fields.firstName },
      ...(fields.lastName
        ? [{ objectTypeId: "0-1", name: "lastname", value: fields.lastName }]
        : []),
      ...(fields.phone
        ? [{ objectTypeId: "0-1", name: "phone", value: fields.phone }]
        : []),
      ...(fields.zipcode
        ? [{ objectTypeId: "0-1", name: "zip", value: fields.zipcode }]
        : []),
      { objectTypeId: "0-1", name: "listing_url", value: fields.listingUrl },
    ],
    context: {
      pageUri: fields.pageUri,
      pageName: "Free Colorado Listing Audit",
      ...(fields.hutk ? { hutk: fields.hutk } : {}),
    },
  };

  const res = await fetch(
    `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_AUDIT_FORM_GUID}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    }
  );

  if (res.ok) return { ok: true };
  return { ok: false, detail: `${res.status} ${(await res.text()).slice(0, 300)}` };
}

const str = (v: unknown, max = 300) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isListingUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    // Accept the major OTAs — owners paste whichever listing they have handy,
    // and rejecting a valid Vrbo link would lose a lead for no good reason.
    return /(^|\.)(airbnb\.[a-z.]+|vrbo\.com|homeaway\.[a-z.]+|booking\.com|expedia\.[a-z.]+)$/i.test(
      u.hostname
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const oversized = rejectOversizedRequest(request, MAX_BODY_BYTES);
  if (oversized) return oversized;

  const limited = await enforceRateLimit(request, "audit-request", {
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400 }
    );
  }

  // Honeypot: answer 200 so bots see success and don't retry with variations.
  if (str(body.company)) {
    return NextResponse.json({ ok: true });
  }

  const airbnbUrl = str(body.airbnbUrl, 600);
  const firstName = str(body.firstName, 80);
  const lastName = str(body.lastName, 80);
  const email = str(body.email, 160).toLowerCase();
  const phone = str(body.phone, 40);
  const zipcode = str(body.zipcode, 20);
  const page = str(body.page, 120) || "audit";

  if (!airbnbUrl || !firstName || !email) {
    return NextResponse.json(
      { ok: false, error: "missing_required" },
      { status: 422 }
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: "invalid_email" },
      { status: 422 }
    );
  }
  if (!isListingUrl(airbnbUrl)) {
    return NextResponse.json(
      { ok: false, error: "invalid_listing_url" },
      { status: 422 }
    );
  }
  if (body.consent !== true) {
    return NextResponse.json(
      { ok: false, error: "consent_required" },
      { status: 422 }
    );
  }

  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  // HubSpot first — it's the system of record for owner leads. Never let a
  // failure here lose the lead: we still alert ops and acknowledge the owner,
  // and the alert says plainly that HubSpot didn't take it.
  let hubspot: { ok: boolean; detail?: string };
  try {
    hubspot = await pushToHubSpot({
      email,
      firstName,
      lastName,
      phone,
      zipcode,
      listingUrl: airbnbUrl,
      hutk: str(body.hutk, 120),
      pageUri: `https://audit.booktraverse.com/#${page}`,
    });
  } catch (err) {
    hubspot = {
      ok: false,
      detail: err instanceof Error ? err.message : "unknown error",
    };
  }

  // Ops alert, explicitly to the shared inbox. ALERT_TO_EMAIL is set now, but
  // naming the recipient here means this keeps working even if that variable
  // is ever changed for other alerting.
  await sendAlert(
    `LISTING AUDIT REQUEST — ${fullName}`,
    [
      "<p>A property owner requested a free listing audit.</p>",
      renderAlertDetails([
        ["Name", fullName],
        ["Email", email],
        ["Phone", phone || "(not given)"],
        ["Zip / postal", zipcode || "(not given)"],
        ["Listing", airbnbUrl],
        ["Submitted from", page],
        [
          "HubSpot",
          hubspot.ok
            ? "Created — deal should appear in STR Sales"
            : `NOT CREATED — ${hubspot.detail ?? "unknown"}. Add this lead by hand.`,
        ],
      ]),
      "<p><strong>Next step:</strong> review the listing and send the written audit back.</p>",
    ].join(""),
    // Unique per submission so a second request from the same owner is never
    // swallowed by the alert cooldown.
    `listing-audit-${email}-${Date.now()}`,
    { to: "admin@traversehospitality.com" }
  ).catch(() => {});

  // Acknowledgement to the owner. They ticked consent and asked us to contact
  // them, so this is the transactional reply to their own request.
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (apiKey) {
    try {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: process.env.LISTING_INQUIRY_FROM || "Traverse Hospitality <noreply@booktraverse.com>",
        to: email,
        subject: "We've got your listing — audit on the way",
        html: `
          <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;color:#1e293b;line-height:1.6">
            <p>Hi ${firstName},</p>
            <p>Thanks — we have your listing and we're taking a look:</p>
            <p style="margin:16px 0;padding:12px 14px;background:#f8fafc;border-left:3px solid #3b82f6;font-size:14px;word-break:break-all">${airbnbUrl}</p>
            <p>One of our Colorado team will go through your title, photos, description,
            review themes and trust signals, and send back a written audit with the
            highest-impact fixes first — <strong>within one business day</strong>.</p>
            <p>No cost, no commitment. If you'd like to talk it through afterwards we'll
            include a link, but there's no obligation either way.</p>
            <p style="margin-top:24px">— The Traverse Hospitality team<br>
            <a href="tel:+19705333583" style="color:#3b82f6">(970) 533-3583</a></p>
          </div>
        `,
      });
    } catch (err) {
      // Never fail the submission on the acknowledgement email — we already
      // have the lead, and ops has been alerted.
      console.error(
        "[AuditRequest] ack email failed:",
        err instanceof Error ? err.message : err
      );
    }
  }

  return NextResponse.json({ ok: true });
}

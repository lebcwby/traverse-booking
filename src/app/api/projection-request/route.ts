/**
 * Revenue-projection lead intake (projection.booktraverse.com).
 *
 * Sibling of /api/audit-request, and deliberately a separate route rather than
 * a flag on that one: the audit requires a listing URL and validates it, and
 * this audience has no listing URL at all — a unit inside a resort rental
 * program isn't published anywhere they could link to, which is the whole
 * premise of the page. Folding the two together would mean weakening the
 * audit's URL validation to accommodate leads that never have one.
 *
 * This route captures the request and alerts ops. It does NOT generate the
 * projection — a human pulls the building's actuals and writes it, which is
 * both the honest way to do it and the only defensible one, since the number
 * is an earnings estimate sent to induce a business decision.
 */
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { sendAlert, renderAlertDetails, OPS_ALERT_INBOX } from "@/lib/alerts";
import {
  enforceRateLimit,
  rejectOversizedRequest,
} from "@/lib/plan/route-guards";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;

interface Payload {
  building?: string;
  unitType?: string;
  /**
   * "condo" (default) or "home". Whole-home owners reach the same route from
   * /cb-property-management, and every piece of prose below — the alert
   * subject, the ops next-step, the owner acknowledgement — was written for a
   * condo in a building we already manage units in. Sending a homeowner in
   * Crested Butte South an email about "units of your size in your building"
   * reads as a mail-merge failure, which is an odd first impression from a
   * page whose whole argument is that somebody is paying attention.
   *
   * Absent or anything else behaves exactly as before.
   */
  propertyKind?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  currentManager?: string;
  consent?: boolean;
  /** A2P 10DLC: recorded separately, and neither is required to submit. */
  smsNotifications?: boolean;
  smsMarketing?: boolean;
  /** Honeypot — real users never see or fill this. */
  company?: string;
  page?: string;
  /** HubSpot visitor token, read from the `hubspotutk` cookie by the client. */
  hutk?: string;
}

const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID || "7792991";
/**
 * Falls back to the audit form GUID so leads still reach HubSpot before a
 * dedicated projection form exists. The alert says which one was used, so a
 * deal landing under the audit form is visible rather than silently
 * mis-attributed.
 */
const PROJECTION_FORM_GUID =
  process.env.HUBSPOT_PROJECTION_FORM_GUID ||
  process.env.HUBSPOT_AUDIT_FORM_GUID ||
  "";
const USING_FALLBACK_FORM =
  !process.env.HUBSPOT_PROJECTION_FORM_GUID &&
  !!process.env.HUBSPOT_AUDIT_FORM_GUID;

/**
 * Push the lead into HubSpot via the public Forms API — same reasoning as the
 * audit route: no private token needed, it creates/updates the contact, and a
 * form submission is what triggers the workflow that opens the deal.
 */
async function pushToHubSpot(fields: {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  building: string;
  unitType: string;
  hutk: string;
  pageUri: string;
}): Promise<{ ok: boolean; detail?: string }> {
  if (!PROJECTION_FORM_GUID) {
    return { ok: false, detail: "no HubSpot form GUID configured" };
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
      // Reuses the `listing_url` property the audit form already writes to,
      // carrying a human-readable description instead of a link. These leads
      // have no listing to point at, and inventing a second custom property
      // would need creating in HubSpot first — see the note in the alert.
      {
        objectTypeId: "0-1",
        name: "listing_url",
        value: `${fields.building} — ${fields.unitType} (no public listing)`,
      },
    ],
    context: {
      pageUri: fields.pageUri,
      pageName: "Crested Butte Revenue Projection",
      ...(fields.hutk ? { hutk: fields.hutk } : {}),
    },
  };

  const res = await fetch(
    `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${PROJECTION_FORM_GUID}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    }
  );

  if (res.ok) return { ok: true };
  return {
    ok: false,
    detail: `${res.status} ${(await res.text()).slice(0, 300)}`,
  };
}

const str = (v: unknown, max = 300) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  const oversized = rejectOversizedRequest(request, MAX_BODY_BYTES);
  if (oversized) return oversized;

  const limited = await enforceRateLimit(request, "projection-request", {
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

  const building = str(body.building, 120);
  const unitType = str(body.unitType, 40);
  const firstName = str(body.firstName, 80);
  const lastName = str(body.lastName, 80);
  const email = str(body.email, 160).toLowerCase();
  const phone = str(body.phone, 40);
  const currentManager = str(body.currentManager, 120);
  const smsNotifications = body.smsNotifications === true;
  const smsMarketing = body.smsMarketing === true;
  const page = str(body.page, 120) || "projection";
  const isHome = str(body.propertyKind, 20).toLowerCase() === "home";
  /** What to call the thing, and what to call where it is. */
  const noun = isHome ? "home" : "condo";
  const placeLabel = isHome ? "Area" : "Building";

  if (!firstName || !email || !building) {
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
  if (body.consent !== true) {
    return NextResponse.json(
      { ok: false, error: "consent_required" },
      { status: 422 }
    );
  }

  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  // HubSpot first — system of record for owner leads. Never let a failure here
  // lose the lead: ops is alerted regardless and the alert says plainly that
  // HubSpot didn't take it.
  let hubspot: { ok: boolean; detail?: string };
  try {
    hubspot = await pushToHubSpot({
      email,
      firstName,
      lastName,
      phone,
      building,
      unitType,
      hutk: str(body.hutk, 120),
      pageUri: `https://projection.booktraverse.com/#${page}`,
    });
  } catch (err) {
    hubspot = {
      ok: false,
      detail: err instanceof Error ? err.message : "unknown error",
    };
  }

  await sendAlert(
    `REVENUE PROJECTION REQUEST — ${fullName} (${building})`,
    [
      `<p>A Crested Butte ${noun} owner asked what their ${isHome ? "home" : "unit"} should be earning.</p>`,
      renderAlertDetails([
        ["Name", fullName],
        ["Email", email],
        ["Phone", phone || "(not given)"],
        [placeLabel, building],
        [isHome ? "Home size" : "Unit size", unitType || "(not given)"],
        ["Managed today by", currentManager || "(not given)"],
        ["Submitted from", page],
        [
          "SMS consent",
          phone
            ? `notifications: ${smsNotifications ? "YES" : "no"} · marketing: ${smsMarketing ? "YES" : "no"}`
            : "(no phone given)",
        ],
        [
          "HubSpot",
          hubspot.ok
            ? USING_FALLBACK_FORM
              ? "Created — but via the AUDIT form (set HUBSPOT_PROJECTION_FORM_GUID to separate these)"
              : "Created — deal should appear in STR Sales"
            : `NOT CREATED — ${hubspot.detail ?? "unknown"}. Add this lead by hand.`,
        ],
      ]),
      isHome
        ? "<p><strong>Next step:</strong> we manage one house in Crested Butte, " +
          "so there is no in-building comp to pull here — price this off the " +
          "valley market and our whole-home experience in Leadville and Twin " +
          "Lakes, and say in the write-up which it is. Send a range with the " +
          "assumptions shown, never a single headline number. Cover the care " +
          "side too: what a home of this age and exposure needs over a winter " +
          "that a condo doesn't. If the honest answer is that they're already " +
          "doing well, say so.</p>"
        : "<p><strong>Next step:</strong> pull trailing-12-month actuals for units " +
          "of this size in this building and write the projection. Send a range " +
          "with the comps and assumptions shown — never a single headline " +
          "number. If the honest answer is that they're already doing well, " +
          "say so.</p>",
    ].join(""),
    // Unique per submission so a second request from the same owner is never
    // swallowed by the alert cooldown.
    `revenue-projection-${email}-${Date.now()}`,
    { to: OPS_ALERT_INBOX }
  ).catch(() => {});

  // Acknowledgement to the owner. They ticked consent and asked us to contact
  // them, so this is the transactional reply to their own request.
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (apiKey) {
    try {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from:
          process.env.LISTING_INQUIRY_FROM ||
          "Traverse Hospitality <noreply@booktraverse.com>",
        to: email,
        subject: isHome
          ? "Your Crested Butte home review is being put together"
          : "Your Crested Butte projection is being put together",
        html: `
          <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;color:#1e293b;line-height:1.6">
            <p>Hi ${firstName},</p>
            <p>Thanks — we're pulling the numbers for:</p>
            <p style="margin:16px 0;padding:12px 14px;background:#f8fafc;border-left:3px solid #3b82f6;font-size:14px">
              <strong>${building}</strong>${unitType ? ` &middot; ${unitType}` : ""}
            </p>
            ${
              isHome
                ? `<p>We manage 100+ properties in Crested Butte and 70+ whole homes and
            cabins across Colorado, so we'll price a home of your size in your area
            against what the valley is actually booking — across every channel — and
            send that back <strong>within one business day</strong>.</p>
            <p>You'll get a range rather than a single number, with the assumptions
            written out so you can check the working. It's an estimate, not a
            guarantee — your home's condition, access, hot tub and calendar all move
            the figure.</p>
            <p>We'll also set out what a house your size needs over a Crested Butte
            winter that a condo never does, because that is usually the part nobody
            has been doing.</p>`
                : `<p>We manage 88 condos across the Mt. Crested Butte base area, so we'll
            look at what units of your size <strong>in your building</strong> actually
            took over the last twelve months — across every channel — and send that
            back <strong>within one business day</strong>.</p>
            <p>You'll get a range rather than a single number, with the comparable
            units and the assumptions written out so you can check the working. It's
            an estimate based on similar units, not a guarantee — your condo's
            condition, floor, view and calendar all move the figure.</p>`
            }
            <p>No cost and no commitment. If it turns out you're already doing well,
            we'll tell you that too.</p>
            <p style="margin-top:24px">— The Traverse Hospitality team<br>
            <a href="tel:+19705333583" style="color:#3b82f6">(970) 533-3583</a></p>
          </div>
        `,
      });
    } catch (err) {
      // Never fail the submission on the acknowledgement email — we already
      // have the lead, and ops has been alerted.
      console.error(
        "[ProjectionRequest] ack email failed:",
        err instanceof Error ? err.message : err
      );
    }
  }

  return NextResponse.json({ ok: true });
}

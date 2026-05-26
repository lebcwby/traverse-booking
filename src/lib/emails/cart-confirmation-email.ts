// Single email summarizing all N reservations from a cart checkout. Sent
// once per cart, in addition to whatever per-reservation confirmation
// emails Guesty sends out itself. Mirrors the brand pattern in
// account-creation-email.ts (navy header, Resend, simple line-item cards).

import { Resend } from "resend";

const FROM = "Traverse Hospitality <noreply@booktraverse.com>";
const REPLY_TO = "bookings@traversehospitality.com";
const WORDMARK =
  "https://www.booktraverse.com/book-traverse-wordmark-white.png";
const SITE_URL = "https://www.booktraverse.com";

export interface CartConfirmationLine {
  listingTitle: string;
  listingPicture: string | null;
  city: string | null;
  checkIn: string;
  checkOut: string;
  guests: number;
  status: "reserved" | "refunded" | "failed";
  reservationId?: string;
  confirmationCode?: string;
  hostPayout: number;
  refundAmount?: number;
}

export interface CartConfirmationEmailDetails {
  guestEmail: string;
  guestName: string;
  cartId: string;
  /** "success" / "partial" / "refunded" — drives the headline copy. */
  outcome: "success" | "partial" | "refunded";
  lines: CartConfirmationLine[];
  totalCharged: number;
  totalRefunded?: number;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fmt(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export async function sendCartConfirmationEmail(
  details: CartConfirmationEmailDetails
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      "[CartConfirmationEmail] RESEND_API_KEY missing; skipping send."
    );
    return;
  }
  const resend = new Resend(apiKey);

  const headline =
    details.outcome === "success"
      ? `Your group booking is confirmed.`
      : details.outcome === "partial"
        ? `Most of your group booking is confirmed.`
        : `We weren't able to confirm your stays.`;

  const intro =
    details.outcome === "success"
      ? `Hi ${escapeHtml(details.guestName.split(" ")[0] || "there")} — all ${details.lines.length} reservations are locked in. We'll send a per-stay confirmation for each one too.`
      : details.outcome === "partial"
        ? `Hi ${escapeHtml(details.guestName.split(" ")[0] || "there")} — we confirmed ${details.lines.filter((l) => l.status === "reserved").length} of ${details.lines.length} reservations. The rest were refunded automatically. Details below.`
        : `Hi ${escapeHtml(details.guestName.split(" ")[0] || "there")} — none of your reservations could be confirmed and your full payment has been refunded. Our team is following up.`;

  const lineCards = details.lines
    .map((line) => {
      const statusBadge =
        line.status === "reserved"
          ? `<span style="display:inline-block;background:#10b981;color:#fff;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">Confirmed</span>`
          : line.status === "refunded"
            ? `<span style="display:inline-block;background:#f59e0b;color:#fff;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">Refunded</span>`
            : `<span style="display:inline-block;background:#dc2626;color:#fff;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">Not confirmed</span>`;

      const photo = line.listingPicture
        ? `<img src="${escapeHtml(line.listingPicture)}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;border-radius:8px;">`
        : "";

      const confirmation = line.confirmationCode
        ? `<p style="margin:6px 0 0 0;font-size:13px;color:#6b6b75;">Confirmation: <strong style="color:#14142b;font-family:'SFMono-Regular',Menlo,monospace;">${escapeHtml(line.confirmationCode)}</strong></p>`
        : "";

      const refundLine =
        line.status === "refunded" && line.refundAmount
          ? `<p style="margin:6px 0 0 0;font-size:13px;color:#92400e;">Refunded: ${fmt(line.refundAmount)}</p>`
          : "";

      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;background:#f9fafb;border-radius:12px;overflow:hidden;">
          ${photo ? `<tr><td>${photo}</td></tr>` : ""}
          <tr>
            <td style="padding:16px 20px;">
              ${statusBadge}
              <h3 style="margin:8px 0 0 0;font-size:16px;color:#14142b;font-weight:600;">${escapeHtml(line.listingTitle)}</h3>
              <p style="margin:4px 0 0 0;font-size:13px;color:#6b6b75;">
                ${line.city ? `${escapeHtml(line.city)} · ` : ""}${escapeHtml(line.checkIn)} → ${escapeHtml(line.checkOut)} · ${line.guests} guest${line.guests === 1 ? "" : "s"}
              </p>
              <p style="margin:6px 0 0 0;font-size:13px;color:#14142b;font-weight:500;">${fmt(line.hostPayout)}</p>
              ${confirmation}
              ${refundLine}
            </td>
          </tr>
        </table>`;
    })
    .join("");

  const totalsBlock =
    details.outcome === "partial"
      ? `
        <tr>
          <td style="padding:0 32px 8px 32px;font-size:14px;color:#4b4b55;">Charged for confirmed stays</td>
          <td align="right" style="padding:0 32px 8px 32px;font-size:14px;color:#14142b;font-weight:500;">${fmt(details.totalCharged)}</td>
        </tr>
        <tr>
          <td style="padding:0 32px 14px 32px;font-size:14px;color:#92400e;">Refunded</td>
          <td align="right" style="padding:0 32px 14px 32px;font-size:14px;color:#92400e;font-weight:500;">−${fmt(details.totalRefunded ?? 0)}</td>
        </tr>`
      : details.outcome === "refunded"
        ? `
        <tr>
          <td style="padding:0 32px 14px 32px;font-size:14px;color:#92400e;">Full refund issued</td>
          <td align="right" style="padding:0 32px 14px 32px;font-size:14px;color:#92400e;font-weight:600;">${fmt(details.totalRefunded ?? 0)}</td>
        </tr>`
        : `
        <tr>
          <td style="padding:0 32px 14px 32px;font-size:14px;color:#14142b;font-weight:600;">Total charged</td>
          <td align="right" style="padding:0 32px 14px 32px;font-size:14px;color:#14142b;font-weight:600;">${fmt(details.totalCharged)}</td>
        </tr>`;

  const subject =
    details.outcome === "success"
      ? `Your Traverse group booking is confirmed`
      : details.outcome === "partial"
        ? `Group booking — ${details.lines.filter((l) => l.status === "reserved").length} of ${details.lines.length} confirmed`
        : `Refund issued — Traverse group booking`;

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f4f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1f1f1f;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f6;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;">
  <tr><td align="center" style="background:#14142b;padding:28px 24px;">
    <img src="${WORDMARK}" alt="Traverse Hospitality" width="180" style="display:block;width:180px;max-width:60%;height:auto;">
  </td></tr>
  <tr><td style="padding:32px 32px 12px 32px;">
    <h1 style="margin:0 0 12px 0;font-size:22px;color:#14142b;font-weight:600;line-height:1.3;">${escapeHtml(headline)}</h1>
    <p style="margin:0;font-size:15px;color:#4b4b55;line-height:1.6;">${intro}</p>
  </td></tr>
  <tr><td style="padding:24px 32px 0 32px;">
    ${lineCards}
  </td></tr>
  <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e5e7eb;margin-top:8px;">
    ${totalsBlock}
  </table></td></tr>
  <tr><td style="padding:0 32px 28px 32px;">
    <p style="margin:0;font-size:13px;color:#6b6b75;line-height:1.5;">
      Reply to this email or call <strong style="color:#14142b;">(720) 759-2013</strong> if anything looks off.
    </p>
  </td></tr>
  <tr><td align="center" style="background:#f4f4f6;padding:24px 32px;border-top:1px solid #e5e7eb;">
    <p style="margin:0 0 8px 0;font-size:12px;color:#6b6b75;">Traverse Hospitality · 115 W 6th St, Leadville, CO 80461</p>
    <p style="margin:0;font-size:12px;color:#6b6b75;"><a href="${SITE_URL}" style="color:#6b6b75;text-decoration:underline;">booktraverse.com</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  await resend.emails.send({
    from: FROM,
    to: details.guestEmail,
    replyTo: REPLY_TO,
    subject,
    html,
  });
}

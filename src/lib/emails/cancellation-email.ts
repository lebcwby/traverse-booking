import { Resend } from "resend";

const FROM = "Book Traverse <noreply@booktraverse.com>";
const REPLY_TO = "hello@booktraverse.com";
const HERO_IMAGE =
  "https://images.squarespace-cdn.com/content/v1/661ed00787739f1c507cd3da/1754173664643-QT90L5DZIU1NRO6Q0FY8/unsplash-image-fkL_jC8rUGI.jpg";
const WORDMARK =
  "https://www.booktraverse.com/book-traverse-wordmark-white.png";
const ICON = "https://www.booktraverse.com/book-traverse-icon.png";
const BROWSE_URL = "https://www.booktraverse.com/properties";

export type CancellationEmailRefundStatus =
  | "full_refund"
  | "non_refundable"
  | "pending_manual"
  | "failed";

export interface CancellationEmailDetails {
  reservationId: string;
  confirmationCode: string | null;
  guestEmail: string;
  guestName: string;
  listingId: string | null;
  listingTitle: string;
  listingPhoto: string | null;
  checkIn: string;
  checkOut: string;
  refundStatus: CancellationEmailRefundStatus;
  refundAmount: number;
  totalPaid: number;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function firstName(fullName: string): string {
  const trimmed = (fullName || "").trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0];
}

function formatMoney(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatLongDate(iso: string): string {
  // iso is YYYY-MM-DD; render as e.g. "Tue, May 12, 2026"
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${days[date.getUTCDay()]}, ${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

function nights(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T00:00:00Z`).getTime();
  const b = new Date(`${checkOut}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24)));
}

function refundSection(
  status: CancellationEmailRefundStatus,
  refundAmount: number
): string {
  if (status === "full_refund") {
    return `
      <tr>
        <td style="padding:8px 0;color:#4b5563;font-size:14px;">Amount refunded</td>
        <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:700;" align="right">${formatMoney(refundAmount)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#4b5563;font-size:14px;">Refund method</td>
        <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;" align="right">Original payment card</td>
      </tr>
      </table>
      <div style="margin-top:16px;padding:14px 16px;background:#ecfdf5;border-radius:8px;color:#065f46;font-size:14px;line-height:21px;">
        Your refund of <strong>${formatMoney(refundAmount)}</strong> has been issued. It typically appears on your card within 5-10 business days.
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    `;
  }

  if (status === "non_refundable") {
    return `
      <tr>
        <td style="padding:8px 0;color:#4b5563;font-size:14px;">Refund status</td>
        <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:700;" align="right">Non-refundable</td>
      </tr>
      </table>
      <div style="margin-top:16px;padding:14px 16px;background:#f3f4f6;border-radius:8px;color:#374151;font-size:14px;line-height:21px;">
        Per our cancellation policy, reservations canceled within 48 hours of check-in are non-refundable.
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    `;
  }

  if (status === "pending_manual") {
    return `
      <tr>
        <td style="padding:8px 0;color:#4b5563;font-size:14px;">Refund status</td>
        <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:700;" align="right">Processing</td>
      </tr>
      </table>
      <div style="margin-top:16px;padding:14px 16px;background:#eff6ff;border-radius:8px;color:#1e40af;font-size:14px;line-height:21px;">
        Your refund is being processed manually. We'll email you with confirmation within 24 hours.
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    `;
  }

  // failed
  return `
    <tr>
      <td style="padding:8px 0;color:#4b5563;font-size:14px;">Refund status</td>
      <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:700;" align="right">Needs attention</td>
    </tr>
    </table>
    <div style="margin-top:16px;padding:14px 16px;background:#fffbeb;border-radius:8px;color:#92400e;font-size:14px;line-height:21px;">
      We were unable to automatically process your refund. A member of our team will reach out to you shortly to resolve this.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
  `;
}

function listingPhotoBlock(photo: string | null, title: string): string {
  if (photo) {
    return `
      <tr>
        <td style="padding:0 32px 16px 32px;">
          <div style="width:100%;max-width:536px;border-radius:12px;overflow:hidden;aspect-ratio:4/3;filter:grayscale(30%);">
            <img src="${escapeHtml(photo)}" alt="${escapeHtml(title)}" width="536" style="display:block;width:100%;height:100%;object-fit:cover;" />
          </div>
        </td>
      </tr>
    `;
  }
  return `
    <tr>
      <td style="padding:0 32px 16px 32px;">
        <div style="width:100%;max-width:536px;border-radius:12px;background:#f3f4f6;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:14px;">
          Book Traverse
        </div>
      </td>
    </tr>
  `;
}

export function buildCancellationEmailHtml(
  details: CancellationEmailDetails
): string {
  const guestFirstName = escapeHtml(firstName(details.guestName));
  const titleEscaped = escapeHtml(details.listingTitle);
  const ci = formatLongDate(details.checkIn);
  const co = formatLongDate(details.checkOut);
  const nightCount = nights(details.checkIn, details.checkOut);
  const confCode = escapeHtml(
    details.confirmationCode || details.reservationId
  );

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Reservation Canceled</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7f9;font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;word-break:break-word;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;">
      <tr>
        <td align="center" style="padding:24px 16px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">

            <!-- Hero header -->
            <tr>
              <td align="center" background="${HERO_IMAGE}" style="background:#1a3c34;background-image:url('${HERO_IMAGE}');background-size:cover;background-position:center 65%;padding:0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center" style="background:rgba(26,60,52,0.45);padding:40px 24px 36px 24px;">
                      <img src="${WORDMARK}" alt="Book Traverse" width="200" style="display:block;max-width:200px;height:auto;" />
                      <p style="margin:8px 0 0 0;font-size:13px;color:#E3AD4F;letter-spacing:0.5px;">Design-forward homes. Walkable neighborhoods.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Main heading -->
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <h1 style="margin:0;font-size:26px;font-weight:700;color:#111827;line-height:32px;">Your reservation has been canceled.</h1>
              </td>
            </tr>

            <!-- Greeting -->
            <tr>
              <td style="padding:8px 32px 24px 32px;color:#4b5563;font-size:15px;line-height:24px;">
                Hi ${guestFirstName}, we've processed your cancellation. Here are the details for your records.
              </td>
            </tr>

            ${listingPhotoBlock(details.listingPhoto, details.listingTitle)}

            <!-- Listing name -->
            <tr>
              <td style="padding:4px 32px 4px 32px;">
                <h2 style="margin:0;font-size:20px;font-weight:700;color:#111827;line-height:26px;">${titleEscaped}</h2>
              </td>
            </tr>
            <tr>
              <td style="padding:2px 32px 24px 32px;color:#6b7280;font-size:14px;">
                Entire home hosted by Book Traverse
              </td>
            </tr>

            <!-- Divider -->
            <tr><td style="padding:0 32px;"><div style="border-top:1px solid #e5e7eb;"></div></td></tr>

            <!-- Check-in / Check-out -->
            <tr>
              <td style="padding:20px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="50%" valign="top" style="padding-right:16px;">
                      <p style="margin:0 0 4px 0;font-size:13px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.5px;">Check-in</p>
                      <p style="margin:0 0 2px 0;font-size:17px;font-weight:700;color:#111827;">${escapeHtml(ci)}</p>
                      <p style="margin:0;font-size:13px;color:#6b7280;">After 4:00 PM</p>
                    </td>
                    <td width="50%" valign="top" style="padding-left:16px;border-left:1px solid #e5e7eb;">
                      <p style="margin:0 0 4px 0;font-size:13px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.5px;">Checkout</p>
                      <p style="margin:0 0 2px 0;font-size:17px;font-weight:700;color:#111827;">${escapeHtml(co)}</p>
                      <p style="margin:0;font-size:13px;color:#6b7280;">By 11:00 AM</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Divider -->
            <tr><td style="padding:0 32px;"><div style="border-top:1px solid #e5e7eb;"></div></td></tr>

            <!-- Reservation details -->
            <tr>
              <td style="padding:20px 32px 8px 32px;">
                <h3 style="margin:0 0 16px 0;font-size:18px;font-weight:700;color:#111827;">Reservation details</h3>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding:8px 0;color:#4b5563;font-size:14px;">Confirmation code</td>
                    <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:700;letter-spacing:0.5px;" align="right">${confCode}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#4b5563;font-size:14px;">Nights</td>
                    <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;" align="right">${nightCount}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#4b5563;font-size:14px;">Status</td>
                    <td style="padding:8px 0;" align="right">
                      <span style="display:inline-block;background:#fef2f2;color:#991b1b;font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:0.3px;">CANCELED</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Divider -->
            <tr><td style="padding:12px 32px 0 32px;"><div style="border-top:1px solid #e5e7eb;"></div></td></tr>

            <!-- Refund section -->
            <tr>
              <td style="padding:20px 32px 8px 32px;">
                <h3 style="margin:0 0 16px 0;font-size:18px;font-weight:700;color:#111827;">Refund</h3>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  ${refundSection(details.refundStatus, details.refundAmount)}
                </table>
              </td>
            </tr>

            <!-- Divider -->
            <tr><td style="padding:12px 32px 0 32px;"><div style="border-top:1px solid #e5e7eb;"></div></td></tr>

            <!-- CTA Button -->
            <tr>
              <td style="padding:24px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center" style="background:#E3AD4F;border-radius:8px;">
                      <a href="${BROWSE_URL}" style="display:block;padding:16px 24px;color:#1a3c34;font-size:16px;font-weight:700;text-decoration:none;text-align:center;">Browse More Stays</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Divider -->
            <tr><td style="padding:0 32px;"><div style="border-top:1px solid #e5e7eb;"></div></td></tr>

            <!-- We're here to help -->
            <tr>
              <td style="padding:24px 32px 8px 32px;">
                <h3 style="margin:0 0 8px 0;font-size:18px;font-weight:700;color:#111827;">We're here to help</h3>
                <p style="margin:0 0 12px 0;color:#4b5563;font-size:14px;line-height:22px;">
                  Contact us with questions. Our team is available to help.
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding:0;">
                      <a href="mailto:hello@booktraverse.com" style="color:#1a3c34;font-size:14px;font-weight:700;text-decoration:underline;">Email us</a>
                    </td>
                    <td align="right" style="padding:0;">
                      <a href="https://www.booktraverse.com" style="color:#1a3c34;font-size:14px;font-weight:700;text-decoration:underline;">Visit website</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Divider -->
            <tr><td style="padding:16px 32px 0 32px;"><div style="border-top:1px solid #e5e7eb;"></div></td></tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="padding:24px 32px 32px 32px;">
                <img src="${ICON}" alt="Book Traverse" width="36" style="display:block;max-width:36px;height:auto;margin:0 auto 12px auto;" />
                <p style="margin:0 0 4px 0;color:#6b7280;font-size:13px;line-height:20px;">
                  Book Traverse &middot; Portland, Oregon
                </p>
                <p style="margin:0;color:#9ca3af;font-size:12px;line-height:18px;">
                  <a href="https://www.booktraverse.com" style="color:#1a3c34;text-decoration:none;">booktraverse.com</a> &middot; <a href="mailto:hello@booktraverse.com" style="color:#1a3c34;text-decoration:none;">hello@booktraverse.com</a>
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendCancellationEmail(
  details: CancellationEmailDetails
): Promise<void> {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  const resend = new Resend(apiKey);
  const subject = `Your reservation at ${details.listingTitle} has been canceled`;
  const html = buildCancellationEmailHtml(details);

  // Resend supports request-level idempotency via the second arg.
  await resend.emails.send(
    {
      from: FROM,
      to: details.guestEmail,
      replyTo: REPLY_TO,
      subject,
      html,
    },
    {
      idempotencyKey: `guest-cancellation-email-${details.reservationId}`,
    }
  );
}

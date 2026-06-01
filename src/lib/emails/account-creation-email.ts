import { Resend } from "resend";
import { userExistsByEmail } from "@/lib/auth-lookup";

const FROM = "Book Traverse <noreply@booktraverse.com>";
const REPLY_TO = "bookings@traversehospitality.com";
const WORDMARK =
  "https://www.booktraverse.com/book-traverse-wordmark-white.png";
const ICON = "https://www.booktraverse.com/book-traverse-icon.png";
const SITE_URL = "https://www.booktraverse.com";
const PORTAL_BASE = "https://portal.booktraverse.com";
// Brand primary: hsl(243 36% 12%) ≈ #15142a (dark navy)
const BRAND_PRIMARY = "#15142a";
// General guest-facing phone
const GUEST_PHONE = "(720) 759-2013";

export interface AccountCreationEmailDetails {
  guestEmail: string;
  guestName: string;
  listingTitle: string;
  listingPhoto: string | null;
  checkIn: string;
  checkOut: string;
  /** Guesty confirmation code — used to build the SuiteOp portal link */
  confirmationCode?: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function firstName(fullName: string): string {
  const trimmed = (fullName || "").trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0];
}

function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${days[date.getUTCDay()]}, ${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

function nights(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T00:00:00Z`).getTime();
  const b = new Date(`${checkOut}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24)));
}

function upsizePhoto(url: string | null): string | null {
  if (!url) return null;
  return url.replace("/t_default_thumb/", "/c_fill,w_536,h_402,f_auto,q_auto/");
}

function buildPortalUrl(confirmationCode: string): string {
  return `${PORTAL_BASE}/${encodeURIComponent(confirmationCode)}`;
}

function buildAccountUrl(): string {
  return `${SITE_URL}/account/reservations`;
}

function buildSignupUrl(email: string): string {
  return `${SITE_URL}/login?create=true&email=${encodeURIComponent(email)}&from=booking`;
}

function listingPhotoBlock(photo: string | null, title: string): string {
  if (photo) {
    return `
      <tr>
        <td style="padding:0 32px 16px 32px;">
          <div style="width:100%;max-width:536px;border-radius:12px;overflow:hidden;aspect-ratio:4/3;">
            <img src="${escapeHtml(photo)}" alt="${escapeHtml(title)}" width="536" style="display:block;width:100%;height:100%;object-fit:cover;" />
          </div>
        </td>
      </tr>
    `;
  }
  return "";
}

export function buildAccountCreationEmailHtml(
  details: AccountCreationEmailDetails,
  variant: "create" | "sign-in" = "create"
): string {
  const guestFirstName = escapeHtml(firstName(details.guestName));
  const titleEscaped = escapeHtml(details.listingTitle);
  const photo = upsizePhoto(details.listingPhoto);
  const ci = formatLongDate(details.checkIn);
  const co = formatLongDate(details.checkOut);
  const nightCount = nights(details.checkIn, details.checkOut);
  const portalUrl = details.confirmationCode
    ? buildPortalUrl(details.confirmationCode)
    : null;
  const portalUrlEscaped = portalUrl ? escapeHtml(portalUrl) : null;

  const accountCtaUrl =
    variant === "create"
      ? buildSignupUrl(details.guestEmail)
      : buildAccountUrl();
  const accountCtaLabel =
    variant === "create" ? "Create Your Account" : "View Your Account";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Your booking is confirmed!</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7f9;font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;word-break:break-word;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;">
      <tr>
        <td align="center" style="padding:24px 16px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">

            <!-- Hero header -->
            <tr>
              <td align="center" style="background:${BRAND_PRIMARY};padding:40px 24px 36px 24px;">
                <img src="${WORDMARK}" alt="Traverse Hospitality" width="200" style="display:block;max-width:200px;height:auto;" />
                <p style="margin:8px 0 0 0;font-size:13px;color:#E3AD4F;letter-spacing:0.5px;">Your dream vacation starts here.</p>
              </td>
            </tr>

            <!-- Main heading -->
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <h1 style="margin:0;font-size:26px;font-weight:700;color:#111827;line-height:32px;">Your booking is confirmed!</h1>
              </td>
            </tr>

            <!-- Greeting -->
            <tr>
              <td style="padding:8px 32px 24px 32px;color:#4b5563;font-size:15px;line-height:24px;">
                Hi ${guestFirstName}, thank you so much for booking a stay with Traverse Hospitality. Complete your pre-check-in steps in our secure guest portal to access check-in instructions and other details about your stay.
              </td>
            </tr>

            ${listingPhotoBlock(photo, details.listingTitle)}

            <!-- Listing name + nights -->
            <tr>
              <td style="padding:4px 32px 4px 32px;">
                <h2 style="margin:0;font-size:20px;font-weight:700;color:#111827;line-height:26px;">${titleEscaped}</h2>
              </td>
            </tr>
            <tr>
              <td style="padding:2px 32px 24px 32px;color:#6b7280;font-size:14px;">
                ${nightCount} night${nightCount !== 1 ? "s" : ""} &middot; Entire home
              </td>
            </tr>

            <!-- Divider -->
            <tr><td style="padding:0 32px;"><div style="border-top:1px solid #e5e7eb;"></div></td></tr>

            <!-- Portal CTA -->
            ${portalUrlEscaped ? `
            <tr>
              <td style="padding:28px 32px 8px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center" style="background:${BRAND_PRIMARY};border-radius:8px;">
                      <a href="${portalUrlEscaped}" style="display:block;padding:16px 24px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;text-align:center;">Access Check-in Instructions</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 28px 32px;">
                <p style="margin:0;font-size:11px;color:#9ca3af;line-height:18px;">
                  If the button doesn't work, paste this URL into your browser:<br/>
                  <a href="${portalUrlEscaped}" style="color:#6b7280;word-break:break-all;">${portalUrlEscaped}</a>
                </p>
              </td>
            </tr>
            ` : `<tr><td style="padding:28px 32px;color:#4b5563;font-size:14px;">Your check-in instructions will be sent closer to your arrival date.</td></tr>`}

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

            ${details.confirmationCode ? `
            <!-- Confirmation code -->
            <tr>
              <td style="padding:20px 32px 8px 32px;">
                <p style="margin:0 0 4px 0;font-size:13px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.5px;">Confirmation Code</p>
                <p style="margin:0;font-size:20px;font-weight:700;color:${BRAND_PRIMARY};letter-spacing:1px;">${escapeHtml(details.confirmationCode)}</p>
              </td>
            </tr>

            <!-- Divider -->
            <tr><td style="padding:12px 32px 0 32px;"><div style="border-top:1px solid #e5e7eb;"></div></td></tr>
            ` : ""}

            <!-- Contact -->
            <tr>
              <td style="padding:20px 32px;">
                <p style="margin:0 0 4px 0;font-size:13px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.5px;">Questions?</p>
                <p style="margin:0;font-size:14px;color:#4b5563;line-height:22px;">
                  If there is anything you need, please text or call us anytime — we'd love to help.<br/>
                  <strong>${GUEST_PHONE}</strong>
                </p>
              </td>
            </tr>

            <!-- Divider -->
            <tr><td style="padding:0 32px;"><div style="border-top:1px solid #e5e7eb;"></div></td></tr>

            <!-- Account CTA section -->
            <tr>
              <td style="padding:24px 32px 8px 32px;">
                <h3 style="margin:0 0 16px 0;font-size:18px;font-weight:700;color:#111827;">
                  ${variant === "create" ? "Create an account to manage your stay" : "Manage your stay online"}
                </h3>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr><td style="padding:6px 0;color:#4b5563;font-size:14px;line-height:22px;">&#10003;&nbsp;&nbsp;View and manage your reservation details</td></tr>
                  <tr><td style="padding:6px 0;color:#4b5563;font-size:14px;line-height:22px;">&#10003;&nbsp;&nbsp;Message your host directly</td></tr>
                  <tr><td style="padding:6px 0;color:#4b5563;font-size:14px;line-height:22px;">&#10003;&nbsp;&nbsp;Request early check-in or late checkout</td></tr>
                  <tr><td style="padding:6px 0;color:#4b5563;font-size:14px;line-height:22px;">&#10003;&nbsp;&nbsp;Save your favorite properties</td></tr>
                </table>
              </td>
            </tr>

            <!-- Account CTA button -->
            <tr>
              <td style="padding:20px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center" style="background:${BRAND_PRIMARY};border-radius:8px;">
                      <a href="${accountCtaUrl}" style="display:block;padding:14px 24px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;text-align:center;">${accountCtaLabel}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            ${variant === "create" ? `
            <!-- Subtle email note -->
            <tr>
              <td style="padding:0 32px 24px 32px;">
                <p style="margin:0;color:#9ca3af;font-size:13px;line-height:20px;text-align:center;">
                  Your account will be created with <strong style="color:#6b7280;">${escapeHtml(details.guestEmail)}</strong>
                </p>
              </td>
            </tr>` : ""}

            <!-- Divider -->
            <tr><td style="padding:0 32px;"><div style="border-top:1px solid #e5e7eb;"></div></td></tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="padding:24px 32px 32px 32px;">
                <img src="${ICON}" alt="Book Traverse" width="36" style="display:block;max-width:36px;height:auto;margin:0 auto 12px auto;" />
                <p style="margin:0 0 4px 0;color:#6b7280;font-size:13px;line-height:20px;">
                  Traverse Hospitality &middot; Colorado
                </p>
                <p style="margin:0 0 8px 0;color:#9ca3af;font-size:12px;line-height:18px;">
                  <a href="${SITE_URL}" style="color:${BRAND_PRIMARY};text-decoration:none;">booktraverse.com</a> &middot; <a href="mailto:bookings@traversehospitality.com" style="color:${BRAND_PRIMARY};text-decoration:none;">bookings@traversehospitality.com</a>
                </p>
                <p style="margin:0;color:#9ca3af;font-size:11px;line-height:16px;">
                  You are receiving this email because you recently booked a stay with Traverse Hospitality.
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

export async function sendAccountCreationEmail(
  details: AccountCreationEmailDetails
): Promise<void> {
  const exists = await userExistsByEmail(details.guestEmail);
  const variant = exists ? "sign-in" : "create";

  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const resend = new Resend(apiKey);
  const subject = `Your booking is confirmed — ${details.listingTitle}`;
  const html = buildAccountCreationEmailHtml(details, variant);

  await resend.emails.send({
    from: FROM,
    to: details.guestEmail,
    replyTo: REPLY_TO,
    subject,
    html,
  });

  console.log(
    `[AccountCreationEmail] Sent ${variant} variant to ${details.guestEmail} for ${details.listingTitle}`
  );
}

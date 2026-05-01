import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import {
  sendKlaviyoEvent,
  subscribeToKlaviyoList,
} from "@/lib/server-tracking";
import { persistVisitorAttribution } from "@/lib/visitor-attribution";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, subject, message, marketingOptIn, attribution } = body;

    // Honeypot check — if this field has a value, it's a bot
    if (body.website) {
      // Return success to not tip off the bot
      return NextResponse.json({ success: true });
    }

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    // Length limits
    if (name.length > 200 || subject.length > 500 || message.length > 10000) {
      return NextResponse.json({ error: "Input too long" }, { status: 400 });
    }

    const resend = new Resend((process.env.RESEND_API_KEY || "").trim());

    const { error } = await resend.emails.send({
      from: "Book Traverse <noreply@booktraverse.com>",
      to: "hello@booktraverse.com",
      replyTo: email,
      subject: `[Contact Form] ${subject}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
        <hr />
        <p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: "Failed to send" }, { status: 500 });
    }

    // Persist attribution for cross-device bridging (fire-and-forget)
    persistVisitorAttribution(email, {
      attribution: request.cookies.get("_sp_attribution")?.value,
      firstTouch: request.cookies.get("_sp_first_touch")?.value,
    }).catch(() => {});

    // Create/update Klaviyo profile + log event (fire-and-forget)
    const [firstName, ...lastParts] = name.trim().split(/\s+/);
    const lastName = lastParts.join(" ");
    const eventProperties: Record<string, unknown> = {
      Subject: subject,
      Message: message,
    };
    if (attribution) {
      if (attribution.landing_page)
        eventProperties["Landing Page"] = attribution.landing_page;
      if (attribution.page_type)
        eventProperties["Page Type"] = attribution.page_type;
      if (attribution.form_type)
        eventProperties["Form Type"] = attribution.form_type;
      if (attribution.offer_type)
        eventProperties["Offer Type"] = attribution.offer_type;
      if (attribution.device_type)
        eventProperties["Device Type"] = attribution.device_type;
    }
    sendKlaviyoEvent("Submitted Contact Form", eventProperties, {
      email,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      attribution: attribution
        ? {
            utm_source: attribution.utm_source,
            utm_medium: attribution.utm_medium,
            utm_campaign: attribution.utm_campaign,
          }
        : undefined,
    }).catch((err) =>
      console.error("[Klaviyo] Contact form event error:", err)
    );

    // Subscribe to marketing list if opted in
    if (marketingOptIn) {
      subscribeToKlaviyoList({
        email,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
      }).catch((err) =>
        console.error("[Klaviyo] Contact form subscribe error:", err)
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

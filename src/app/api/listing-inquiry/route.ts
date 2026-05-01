import { NextResponse } from "next/server";
import { Resend } from "resend";
import { sendKlaviyoEvent } from "@/lib/server-tracking";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      email,
      phone,
      propertyAddress,
      propertyType,
      bedrooms,
      currentChannels,
      message,
    } = body;

    // Honeypot check
    if (body.website) {
      return NextResponse.json({ success: true });
    }

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const resend = new Resend((process.env.RESEND_API_KEY || "").trim());

    const inquiryRecipients = (process.env.LISTING_INQUIRY_RECIPIENTS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const { error } = await resend.emails.send({
      from:
        process.env.LISTING_INQUIRY_FROM ?? "Inquiries <noreply@example.com>",
      to: inquiryRecipients,
      replyTo: email,
      subject: `[Listing Inquiry] ${name} — ${propertyType || "Property"}`,
      html: `
        <h2>New Property Listing Inquiry</h2>
        <table style="border-collapse:collapse;width:100%;max-width:500px">
          <tr><td style="padding:6px 12px 6px 0;font-weight:bold;vertical-align:top">Name</td><td style="padding:6px 0">${escapeHtml(name)}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;font-weight:bold;vertical-align:top">Email</td><td style="padding:6px 0"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
          ${phone ? `<tr><td style="padding:6px 12px 6px 0;font-weight:bold;vertical-align:top">Phone</td><td style="padding:6px 0"><a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></td></tr>` : ""}
          ${propertyAddress ? `<tr><td style="padding:6px 12px 6px 0;font-weight:bold;vertical-align:top">Address</td><td style="padding:6px 0">${escapeHtml(propertyAddress)}</td></tr>` : ""}
          ${propertyType ? `<tr><td style="padding:6px 12px 6px 0;font-weight:bold;vertical-align:top">Type</td><td style="padding:6px 0">${escapeHtml(propertyType)}</td></tr>` : ""}
          ${bedrooms ? `<tr><td style="padding:6px 12px 6px 0;font-weight:bold;vertical-align:top">Bedrooms</td><td style="padding:6px 0">${escapeHtml(bedrooms)}</td></tr>` : ""}
          ${currentChannels ? `<tr><td style="padding:6px 12px 6px 0;font-weight:bold;vertical-align:top">Current Channels</td><td style="padding:6px 0">${escapeHtml(currentChannels)}</td></tr>` : ""}
        </table>
        ${message ? `<hr style="margin:16px 0" /><p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>` : ""}
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: "Failed to send" }, { status: 500 });
    }

    // Klaviyo event (fire-and-forget)
    const [firstName, ...lastParts] = name.trim().split(/\s+/);
    const lastName = lastParts.join(" ");
    sendKlaviyoEvent(
      "Submitted Listing Inquiry",
      {
        "Property Address": propertyAddress || "",
        "Property Type": propertyType || "",
        Bedrooms: bedrooms || "",
        "Current Channels": currentChannels || "",
        Message: message || "",
      },
      {
        email,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
      }
    ).catch((err) =>
      console.error("[Klaviyo] Listing inquiry event error:", err)
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Listing inquiry error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

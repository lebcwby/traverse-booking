import { google } from "googleapis";
import sanitize from "sanitize-html";

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

function getGmailClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: SCOPES,
    subject: process.env.GMAIL_USER_EMAIL || "hello@booktraverse.com",
  });

  return google.gmail({ version: "v1", auth });
}

function getHeader(
  headers: { name?: string | null; value?: string | null }[] | undefined,
  name: string
): string {
  return (
    headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ||
    ""
  );
}

function decodeBody(data: string | undefined | null): string {
  if (!data) return "";
  return Buffer.from(data, "base64url").toString("utf-8");
}

type PartsList = {
  mimeType?: string | null;
  body?: { data?: string | null };
  parts?: PartsList;
}[];

function extractBodyFromParts(parts: PartsList | undefined): {
  html: string;
  text: string;
} {
  if (!parts) return { html: "", text: "" };

  let html = "";
  let text = "";

  for (const part of parts) {
    if (part.mimeType === "text/html" && part.body?.data && !html) {
      html = decodeBody(part.body.data);
    }
    if (part.mimeType === "text/plain" && part.body?.data && !text) {
      text = decodeBody(part.body.data);
    }
  }

  // Recurse into nested parts (e.g. multipart/alternative inside multipart/mixed)
  if (!html || !text) {
    for (const part of parts) {
      if (part.parts) {
        const nested = extractBodyFromParts(part.parts);
        if (!html && nested.html) html = nested.html;
        if (!text && nested.text) text = nested.text;
      }
    }
  }

  return { html, text };
}

function sanitizeEmailHtml(html: string): string {
  return sanitize(html, {
    allowedTags: sanitize.defaults.allowedTags.concat([
      "img",
      "style",
      "center",
      "span",
    ]),
    allowedAttributes: {
      ...sanitize.defaults.allowedAttributes,
      "*": [
        "style",
        "class",
        "id",
        "align",
        "valign",
        "width",
        "height",
        "bgcolor",
        "border",
        "cellpadding",
        "cellspacing",
      ],
      img: ["src", "alt", "width", "height", "style"],
      a: ["href", "target", "rel", "style"],
    },
    allowedSchemes: ["http", "https", "mailto"],
  });
}

function extractSenderName(from: string): string {
  // "John Doe <john@example.com>" → "John Doe"
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : from.split("@")[0];
}

export interface ThreadSummary {
  id: string;
  subject: string;
  snippet: string;
  lastMessageDate: string;
  messageCount: number;
}

export interface ThreadMessage {
  id: string;
  from: string;
  fromName: string;
  to: string;
  date: string;
  body: string;
  bodyHtml: string;
  isFromHost: boolean;
}

export interface ThreadDetail {
  subject: string;
  messages: ThreadMessage[];
}

const HOST_EMAIL = process.env.GMAIL_USER_EMAIL || "hello@booktraverse.com";

export async function getThreadsForGuest(
  guestEmail: string
): Promise<ThreadSummary[]> {
  const gmail = getGmailClient();

  // Search for threads involving this guest email
  const res = await gmail.users.threads.list({
    userId: "me",
    q: guestEmail,
    maxResults: 50,
  });

  const threads = res.data.threads || [];
  if (threads.length === 0) return [];

  // Fetch metadata for all threads in parallel (batches of 10 to avoid rate limits)
  const BATCH_SIZE = 10;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allDetails: { id: string; detail: any }[] = [];
  const threadIds = threads.filter((t) => t.id).map((t) => t.id!);

  for (let i = 0; i < threadIds.length; i += BATCH_SIZE) {
    const batch = threadIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (id) => ({
        id,
        detail: await gmail.users.threads.get({
          userId: "me",
          id,
          format: "metadata",
          metadataHeaders: ["Subject", "Date", "From", "To"],
        }),
      }))
    );
    allDetails.push(...results);
  }

  const summaries: ThreadSummary[] = [];
  for (const { id, detail } of allDetails) {
    const messages = detail.data.messages || [];
    if (messages.length === 0) continue;

    // Verify guest is actually a participant
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isParticipant = messages.some((m: any) => {
      const from = getHeader(m.payload?.headers, "From").toLowerCase();
      const to = getHeader(m.payload?.headers, "To").toLowerCase();
      return (
        from.includes(guestEmail.toLowerCase()) ||
        to.includes(guestEmail.toLowerCase())
      );
    });
    if (!isParticipant) continue;

    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];
    const subject =
      getHeader(firstMessage.payload?.headers, "Subject") || "(No subject)";
    const lastDate = getHeader(lastMessage.payload?.headers, "Date");

    summaries.push({
      id,
      subject,
      snippet:
        detail.data.messages?.[detail.data.messages.length - 1]?.snippet || "",
      lastMessageDate: lastDate ? new Date(lastDate).toISOString() : "",
      messageCount: messages.length,
    });
  }

  // Sort by most recent first
  summaries.sort(
    (a, b) =>
      new Date(b.lastMessageDate).getTime() -
      new Date(a.lastMessageDate).getTime()
  );

  return summaries;
}

export async function getThread(
  threadId: string,
  guestEmail: string
): Promise<ThreadDetail | null> {
  const gmail = getGmailClient();

  const res = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "full",
  });

  const messages = res.data.messages || [];
  if (messages.length === 0) return null;

  // Security check: verify guest email is a participant in this thread
  const isParticipant = messages.some((m) => {
    const from = getHeader(m.payload?.headers, "From").toLowerCase();
    const to = getHeader(m.payload?.headers, "To").toLowerCase();
    return (
      from.includes(guestEmail.toLowerCase()) ||
      to.includes(guestEmail.toLowerCase())
    );
  });
  if (!isParticipant) return null;

  const subject =
    getHeader(messages[0].payload?.headers, "Subject") || "(No subject)";

  const parsed: ThreadMessage[] = messages.map((m) => {
    const from = getHeader(m.payload?.headers, "From");
    const to = getHeader(m.payload?.headers, "To");
    const date = getHeader(m.payload?.headers, "Date");

    let bodyHtml = "";
    let body = "";
    if (m.payload?.parts) {
      const extracted = extractBodyFromParts(m.payload.parts as PartsList);
      bodyHtml = extracted.html;
      body = extracted.text;
    } else if (m.payload?.body?.data) {
      const decoded = decodeBody(m.payload.body.data);
      if (m.payload?.mimeType === "text/html") {
        bodyHtml = decoded;
      } else {
        body = decoded;
      }
    }

    return {
      id: m.id || "",
      from,
      fromName: extractSenderName(from),
      to,
      date: date ? new Date(date).toISOString() : "",
      body,
      bodyHtml: bodyHtml ? sanitizeEmailHtml(bodyHtml) : "",
      isFromHost: from.toLowerCase().includes(HOST_EMAIL.toLowerCase()),
    };
  });

  return { subject, messages: parsed };
}

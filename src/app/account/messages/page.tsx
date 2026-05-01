"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Loader2, Mail, MessageSquare, Reply } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ThreadSummary {
  id: string;
  subject: string;
  snippet: string;
  lastMessageDate: string;
  messageCount: number;
}

interface ThreadMessage {
  id: string;
  from: string;
  fromName: string;
  to: string;
  date: string;
  body: string;
  bodyHtml: string;
  isFromHost: boolean;
}

interface ThreadDetail {
  subject: string;
  messages: ThreadMessage[];
}

interface ReservationSummary {
  id: string;
  confirmation_code: string | null;
  guest_name: string | null;
  listing_name: string | null;
  listing_photo: string | null;
  check_in: string;
  check_out: string;
  guests_count: number | null;
  status: string;
  total: number;
  currency: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HOST_EMAIL = "hello@booktraverse.com";

/** Extract the guest email (non-host participant) from thread messages */
function getGuestEmail(detail: ThreadDetail | null): string | null {
  if (!detail) return null;
  for (const msg of detail.messages) {
    // Check "from" — if it's not the host, that's the guest
    const fromEmail = extractEmail(msg.from);
    if (fromEmail && !fromEmail.toLowerCase().includes(HOST_EMAIL))
      return fromEmail;
    // Check "to" — if it's not the host, that's the guest
    const toEmail = extractEmail(msg.to);
    if (toEmail && !toEmail.toLowerCase().includes(HOST_EMAIL)) return toEmail;
  }
  return null;
}

function extractEmail(headerValue: string): string | null {
  const match = headerValue.match(/<([^>]+)>/);
  if (match) return match[1];
  if (headerValue.includes("@")) return headerValue.trim();
  return null;
}

function getStatusLabel(status: string): string | null {
  switch (status) {
    case "confirmed":
      return "Upcoming reservation";
    case "checked_in":
      return "Currently hosting";
    case "checked_out":
      return "Reservation completed";
    case "canceled":
    case "cancelled":
      return "Reservation cancelled";
    case "inquiry":
      return "Inquiry";
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Reservation matching
// ---------------------------------------------------------------------------

/** Build a lookup map of confirmation_code and guesty_id → reservation */
function buildReservationIndex(reservations: ReservationSummary[]) {
  const map = new Map<string, ReservationSummary>();
  for (const r of reservations) {
    if (r.confirmation_code) map.set(r.confirmation_code.toLowerCase(), r);
    if (r.id) map.set(r.id.toLowerCase(), r);
  }
  return map;
}

/** Search text for any reservation identifier (confirmation code or guesty_id) */
function matchReservationFromText(
  text: string,
  index: Map<string, ReservationSummary>
): ReservationSummary | null {
  const lower = text.toLowerCase();
  let match: ReservationSummary | null = null;
  index.forEach((res, code) => {
    if (!match && lower.includes(code)) match = res;
  });
  return match;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialThreadId = searchParams.get("thread");
  const initialThreadIdRef = useRef(initialThreadId);

  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [reservations, setReservations] = useState<ReservationSummary[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    initialThreadId
  );
  const [threadDetail, setThreadDetail] = useState<ThreadDetail | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch thread list + reservations
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/account/messages");
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (!res.ok) throw new Error("Failed to load messages");
        const data = await res.json();
        setThreads(data.threads);
        setReservations(data.reservations || []);
        // Auto-select first thread if none specified in URL
        if (!initialThreadIdRef.current && data.threads.length > 0) {
          setSelectedThreadId(data.threads[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoadingThreads(false);
      }
    }
    fetchData();
  }, []);

  // Fetch thread detail when selection changes
  useEffect(() => {
    if (!selectedThreadId) {
      setThreadDetail(null);
      return;
    }

    let cancelled = false;
    async function fetchDetail() {
      setLoadingDetail(true);
      try {
        const res = await fetch(`/api/account/messages/${selectedThreadId}`);
        if (!res.ok) throw new Error("Failed to load thread");
        const data = await res.json();
        if (!cancelled) setThreadDetail(data);
      } catch {
        if (!cancelled) setThreadDetail(null);
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    }
    fetchDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedThreadId]);

  // Update URL when thread selection changes (without full navigation)
  function selectThread(threadId: string) {
    setSelectedThreadId(threadId);
    router.replace(`/account/messages?thread=${threadId}`, { scroll: false });
  }

  function goBackToList() {
    setSelectedThreadId(null);
    router.replace("/account/messages", { scroll: false });
  }

  const selectedThread = threads.find((t) => t.id === selectedThreadId) || null;
  const resIndex = buildReservationIndex(reservations);

  // Match by scanning subject + snippet, then fall back to full thread body text
  let matchedReservation: ReservationSummary | null = null;
  if (selectedThread) {
    const summaryText = `${selectedThread.subject} ${selectedThread.snippet}`;
    matchedReservation = matchReservationFromText(summaryText, resIndex);
  }
  if (!matchedReservation && threadDetail) {
    const bodyText = threadDetail.messages
      .map((m) => `${m.body} ${m.bodyHtml}`)
      .join(" ");
    matchedReservation = matchReservationFromText(bodyText, resIndex);
  }

  // Loading state
  if (loadingThreads) {
    return (
      <div className="flex h-[calc(100dvh-56px)] items-center justify-center lg:h-[calc(100vh-80px)]">
        <div className="flex flex-col items-center">
          <Image
            src="/book-traverse-icon.png"
            alt="Book Traverse"
            width={56}
            height={63}
            className="mb-6 animate-pulse"
            priority
          />
          <div className="h-1 w-40 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/50"
              style={{
                animation: "shimmer 2.5s ease-in-out infinite",
                width: "40%",
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  // Empty state
  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Mail className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">No messages yet</p>
      </div>
    );
  }

  return (
    <div className="mx-3 flex h-[calc(100dvh-56px)] overflow-hidden md:mx-5 lg:h-[calc(100dvh-80px)]">
      {/* ---- Thread List (left panel) ---- */}
      <div
        className={cn(
          "w-full shrink-0 border-r border-border lg:w-[480px]",
          // On mobile: hide when a thread is selected
          selectedThreadId ? "hidden lg:block" : "block"
        )}
      >
        <div className="sticky top-0 border-b border-border bg-background px-5 py-4">
          <h1 className="text-lg font-semibold text-foreground">Messages</h1>
        </div>
        <div
          className="overflow-y-auto"
          style={{ height: "calc(100% - 57px)" }}
        >
          {threads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => selectThread(thread.id)}
              className={cn(
                "flex w-full items-start gap-3 border-b border-border px-5 py-4 text-left transition-colors hover:bg-muted/50",
                selectedThreadId === thread.id && "bg-muted"
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground">
                    {thread.subject}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {thread.lastMessageDate
                      ? format(parseISO(thread.lastMessageDate), "MMM d")
                      : ""}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {thread.snippet}
                </p>
                <span className="mt-0.5 text-xs text-muted-foreground">
                  {thread.messageCount}{" "}
                  {thread.messageCount === 1 ? "message" : "messages"}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ---- Chat Panel (center) ---- */}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          // On mobile: hide when no thread selected
          !selectedThreadId ? "hidden lg:flex" : "flex"
        )}
      >
        {selectedThreadId ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 border-b border-border bg-background px-5 py-4">
              <button
                onClick={goBackToList}
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground lg:hidden"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                {threadDetail?.subject || "Loading..."}
              </h2>
              {(() => {
                const guestEmail = getGuestEmail(threadDetail);
                if (!guestEmail) return null;
                const subject = encodeURIComponent(
                  `Re: ${threadDetail?.subject || ""}`
                );
                return (
                  <a
                    href={`mailto:${guestEmail}?subject=${subject}`}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-warm px-3 py-1.5 text-xs font-semibold text-warm-foreground transition-colors hover:bg-warm/90"
                  >
                    <Reply className="h-3.5 w-3.5" />
                    Reply
                  </a>
                );
              })()}
            </div>

            {/* Messages */}
            <ChatMessages detail={threadDetail} loading={loadingDetail} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <Mail className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">
                Select a conversation
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ---- Reservation Sidebar (right panel, desktop only) ---- */}
      <div className="hidden w-[460px] shrink-0 border-l border-border lg:block">
        {matchedReservation ? (
          <ReservationCard reservation={matchedReservation} />
        ) : selectedThreadId ? (
          <div className="flex h-full items-center justify-center px-6">
            <p className="text-center text-xs text-muted-foreground">
              No matching reservation found
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat messages panel
// ---------------------------------------------------------------------------

function ChatMessages({
  detail,
  loading,
}: {
  detail: ThreadDetail | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div className="flex-1 overflow-y-auto px-5 py-6">
      <div className="mx-auto max-w-3xl space-y-4">
        {detail.messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat bubble
// ---------------------------------------------------------------------------

function ChatBubble({ message }: { message: ThreadMessage }) {
  const isHost = message.isFromHost;
  const hasHtml = !!message.bodyHtml;

  // HTML emails render as full-width cards (they have their own layout/styling)
  if (hasHtml) {
    return (
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="flex items-baseline justify-between gap-3 bg-muted/50 px-4 py-2.5">
          <span className="text-xs font-medium text-foreground">
            {message.fromName}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {message.date
              ? format(parseISO(message.date), "MMM d, h:mm a")
              : ""}
          </span>
        </div>
        <div className="px-4 py-3">
          <EmailBody html={message.bodyHtml} />
        </div>
      </div>
    );
  }

  // Plain text messages render as chat bubbles
  return (
    <div className={cn("flex", isHost ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3",
          isHost
            ? "rounded-bl-md bg-muted"
            : "rounded-br-md bg-primary text-primary-foreground"
        )}
      >
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <span
            className={cn(
              "text-xs font-medium",
              isHost ? "text-foreground" : "text-primary-foreground"
            )}
          >
            {message.fromName}
          </span>
          <span
            className={cn(
              "shrink-0 text-[10px]",
              isHost ? "text-muted-foreground" : "text-primary-foreground/70"
            )}
          >
            {message.date
              ? format(parseISO(message.date), "MMM d, h:mm a")
              : ""}
          </span>
        </div>
        <div
          className={cn(
            "whitespace-pre-wrap text-sm leading-relaxed",
            isHost ? "text-foreground" : "text-primary-foreground"
          )}
        >
          {message.body}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Email body (iframe)
// ---------------------------------------------------------------------------

function EmailBody({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(150);

  const resizeIframe = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument?.body) return;
    const h = iframe.contentDocument.body.scrollHeight;
    if (h > 0) setHeight(h);
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    doc.open();
    doc.write(`<!DOCTYPE html>
      <html><head>
        <meta charset="utf-8">
        <base target="_blank">
        <style>
          body {
            margin: 0; padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px; line-height: 1.6;
            color: #1a1a1a;
            word-break: break-word; overflow-wrap: break-word;
            background: transparent;
          }
          img { max-width: 100% !important; height: auto !important; object-fit: cover; }
          a { color: #2563eb; }
          table { max-width: 100% !important; }
          pre, code { white-space: pre-wrap; max-width: 100%; }
        </style>
      </head><body>${html}</body></html>`);
    doc.close();

    resizeIframe();
    const images = doc.querySelectorAll("img");
    images.forEach((img) => {
      if (!img.complete) img.addEventListener("load", resizeIframe);
    });
    const timer = setTimeout(resizeIframe, 500);
    return () => clearTimeout(timer);
  }, [html, resizeIframe]);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
      style={{
        width: "100%",
        height: `${height}px`,
        border: "none",
        display: "block",
        background: "transparent",
      }}
      title="Email content"
    />
  );
}

// ---------------------------------------------------------------------------
// Reservation sidebar card
// ---------------------------------------------------------------------------

function ReservationCard({ reservation }: { reservation: ReservationSummary }) {
  const checkIn = parseISO(reservation.check_in);
  const checkOut = parseISO(reservation.check_out);
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: reservation.currency,
  });

  const statusLabel = getStatusLabel(reservation.status);

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold text-foreground">Reservation</h3>
      </div>

      <div className="px-5 py-5">
        {/* Listing photo */}
        {reservation.listing_photo && (
          <div className="overflow-hidden rounded-xl">
            <Image
              src={reservation.listing_photo}
              alt={reservation.listing_name || "Property"}
              width={400}
              height={260}
              className="aspect-[3/2] w-full object-cover"
            />
          </div>
        )}

        {/* Listing name */}
        <h4 className="mt-4 text-lg font-semibold text-foreground leading-tight">
          {reservation.listing_name || "Property"}
        </h4>

        {/* Status */}
        {statusLabel && (
          <div className="mt-3">
            <p className="text-sm font-semibold text-foreground">
              {statusLabel}
            </p>
          </div>
        )}

        {/* Check-in / Check-out card */}
        <div className="mt-4 rounded-xl border border-border">
          <div className="grid grid-cols-2 divide-x divide-border">
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-foreground">Check-in</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {format(checkIn, "EEE, MMM d")}
              </p>
              <p className="text-sm text-muted-foreground">4:00 PM</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-foreground">Checkout</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {format(checkOut, "EEE, MMM d")}
              </p>
              <p className="text-sm text-muted-foreground">11:00 AM</p>
            </div>
          </div>
        </div>

        {/* Reservation details */}
        <div className="mt-5 space-y-4">
          {reservation.guests_count != null && reservation.guests_count > 0 && (
            <div>
              <p className="text-sm font-semibold text-foreground">
                Who&apos;s coming
              </p>
              <p className="text-sm text-muted-foreground">
                {reservation.guests_count}{" "}
                {reservation.guests_count === 1 ? "guest" : "guests"}
              </p>
            </div>
          )}

          {reservation.guest_name && (
            <div>
              <p className="text-sm font-semibold text-foreground">Guest</p>
              <p className="text-sm text-muted-foreground">
                {reservation.guest_name}
              </p>
            </div>
          )}

          {reservation.confirmation_code && (
            <div>
              <p className="text-sm font-semibold text-foreground">
                Confirmation code
              </p>
              <p className="text-sm text-muted-foreground">
                {reservation.confirmation_code}
              </p>
            </div>
          )}

          {reservation.total > 0 && (
            <div>
              <p className="text-sm font-semibold text-foreground">Total</p>
              <p className="text-sm text-muted-foreground">
                {formatter.format(reservation.total)}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-5 space-y-3 border-t border-border pt-5">
          {reservation.confirmation_code && (
            <a
              href={`https://app.booktraverse.com/${reservation.confirmation_code}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-lg bg-warm px-4 py-2.5 text-sm font-semibold text-warm-foreground transition-colors hover:bg-warm/90"
            >
              Guest portal
            </a>
          )}
          <Link
            href={`/account/reservations/${reservation.id}`}
            className="inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            View trip details
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";
// src/components/plan/save-itinerary.tsx
// "Email my itinerary" button + modal for lead capture.
// Also includes a "Download PDF" button that uses window.print() with
// a clean @media print stylesheet.

import { useState } from "react";
import type { Itinerary } from "@/lib/plan/schema";
import { Mail, X, Check, Loader2 } from "lucide-react";

interface SaveItineraryProps {
  itinerary: Itinerary;
}

export function SaveItinerary({ itinerary }: SaveItineraryProps) {
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmail = async () => {
    if (!email.trim()) return;
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/plan/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          itinerary,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || `Error ${res.status}`);
      }

      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Primary lead-capture CTA — sized for CRO, not visual balance.
          ~56px tall, tinted shadow, lift on hover, dominant in header. */}
      <button
        type="button"
        onClick={() => {
          setShowModal(true);
          setSent(false);
          setError(null);
        }}
        className="group inline-flex w-full shrink-0 items-center justify-center gap-2.5 whitespace-nowrap rounded-full bg-primary px-7 py-4 text-base font-semibold tracking-tight text-primary-foreground shadow-lg shadow-primary/25 ring-1 ring-primary/10 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/95 hover:shadow-xl hover:shadow-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 active:translate-y-0 sm:w-auto"
      >
        <Mail className="h-5 w-5 transition-transform duration-200 group-hover:-rotate-6" />
        Email me my Portland trip plan
      </button>

      {/* Email modal overlay */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">
                  {sent ? "Itinerary sent!" : "Email your itinerary"}
                </h3>
                {!sent && (
                  <p className="mt-1 text-sm text-neutral-500">
                    We'll send a formatted copy of your Portland trip plan to
                    your inbox.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {sent ? (
              <div className="mt-6 flex flex-col items-center gap-3 py-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                  <Check className="h-6 w-6 text-emerald-600" />
                </div>
                <p className="text-center text-sm text-neutral-600">
                  Check your inbox at <strong>{email}</strong> — your itinerary
                  is on its way. Happy travels!
                </p>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="mt-2 rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
                >
                  Done
                </button>
              </div>
            ) : (
              <form
                className="mt-5 flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleEmail();
                }}
              >
                <div>
                  <label
                    htmlFor="plan-email"
                    className="mb-1 block text-sm font-medium text-neutral-700"
                  >
                    Email address
                  </label>
                  <input
                    id="plan-email"
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
                  />
                </div>
                {error && (
                  <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sending || !email.trim()}
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      Send itinerary
                    </>
                  )}
                </button>

                <p className="text-center text-[11px] text-neutral-400">
                  We'll only use your email to send this itinerary and
                  occasional Portland travel tips. Unsubscribe anytime.
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

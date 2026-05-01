"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Send, Loader2, CheckCircle2 } from "lucide-react";
import { identifyUser } from "@/lib/tracking";
import { getEmailCaptureAttribution } from "@/lib/attribution";

const DISMISS_KEY = "sp_exit_intent_dismissed";

export function ExitIntentCapture() {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const firedRef = useRef(false);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  }, []);

  useEffect(() => {
    // Don't show if already dismissed this session
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) return;
    } catch {}

    function handleMouseLeave(e: MouseEvent) {
      // Cursor left through the top of the viewport — exit intent
      if (e.clientY <= 0 && !firedRef.current) {
        firedRef.current = true;
        setVisible(true);
      }
    }

    document.addEventListener("mouseleave", handleMouseLeave);
    return () => document.removeEventListener("mouseleave", handleMouseLeave);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const attribution = getEmailCaptureAttribution("popup", "$50_off");
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          attribution,
        }),
      });
      if (!res.ok) throw new Error();
      identifyUser(email.trim().toLowerCase());
      setStatus("success");
      setTimeout(dismiss, 2500);
    } catch {
      setStatus("error");
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={dismiss} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl bg-primary p-8 text-primary-foreground shadow-2xl">
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 text-primary-foreground/50 transition-colors hover:text-primary-foreground"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {status === "success" ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="h-10 w-10 text-warm" />
            <p className="text-lg font-semibold">You&apos;re in!</p>
            <p className="text-sm text-primary-foreground/60">
              Check your inbox for $50 off your stay.
            </p>
          </div>
        ) : (
          <>
            <p className="text-center text-2xl font-bold tracking-tight">
              Wait — $50 off your stay
            </p>
            <p className="mt-2 text-center text-sm text-primary-foreground/60">
              Get an exclusive discount plus Portland travel tips. No spam,
              unsubscribe anytime.
            </p>
            <form onSubmit={handleSubmit} className="mt-5">
              <div className="flex gap-2">
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (status === "error") setStatus("idle");
                  }}
                  className="h-11 flex-1 rounded-lg border border-primary-foreground/20 bg-primary-foreground/10 px-3 text-sm text-primary-foreground placeholder:text-primary-foreground/40 outline-none focus:border-primary-foreground/40 focus:ring-1 focus:ring-primary-foreground/30"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-warm px-5 text-sm font-medium text-warm-foreground transition-colors hover:bg-warm/90 disabled:opacity-50"
                >
                  {status === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      Claim
                    </>
                  )}
                </button>
              </div>
              {status === "error" && (
                <p className="mt-2 text-center text-xs text-red-300">
                  Something went wrong. Please try again.
                </p>
              )}
            </form>
            <button
              onClick={dismiss}
              className="mt-4 block w-full text-center text-xs text-primary-foreground/40 transition-colors hover:text-primary-foreground/60"
            >
              No thanks, I&apos;ll pay full price
            </button>
          </>
        )}
      </div>
    </div>
  );
}

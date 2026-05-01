"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { identifyUser } from "@/lib/tracking";
import { getEmailCaptureAttribution } from "@/lib/attribution";

const DISMISS_COOKIE = "sp_popup_dismissed";
const SUBMIT_COOKIE = "sp_popup_submitted";
const PAGE_VIEW_KEY = "sp_page_views";
const COOKIE_DAYS = 30;

/** Pages where the popup should never appear */
const EXCLUDED_PREFIXES = ["/book", "/login", "/account", "/terms", "/privacy"];

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value};expires=${expires};path=/;SameSite=Lax`;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? match[1] : null;
}

export function EmailPopup() {
  const [step, setStep] = useState<"hidden" | "step1" | "step2" | "success">(
    "hidden"
  );
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const triggeredRef = useRef(false);

  const shouldSuppress = useCallback(() => {
    if (getCookie(DISMISS_COOKIE) || getCookie(SUBMIT_COOKIE)) return true;
    const path = window.location.pathname;
    return EXCLUDED_PREFIXES.some((p) => path.startsWith(p));
  }, []);

  const show = useCallback(() => {
    if (triggeredRef.current || shouldSuppress()) return;
    triggeredRef.current = true;
    setStep("step1");
    window.dispatchEvent(new CustomEvent("sp-popup-visible"));
  }, [shouldSuppress]);

  const dismiss = useCallback(() => {
    setStep("hidden");
    setCookie(DISMISS_COOKIE, "1", COOKIE_DAYS);
    window.dispatchEvent(new CustomEvent("sp-popup-hidden"));
  }, []);

  useEffect(() => {
    if (shouldSuppress()) return;

    // Track page views across the session
    const views =
      parseInt(sessionStorage.getItem(PAGE_VIEW_KEY) || "0", 10) + 1;
    sessionStorage.setItem(PAGE_VIEW_KEY, String(views));

    // Trigger: 2nd page view
    if (views >= 2) {
      show();
      return;
    }

    // Trigger: 35% scroll depth
    let scrollDone = false;
    function handleScroll() {
      if (scrollDone || triggeredRef.current) return;
      const pct =
        window.scrollY /
        (document.documentElement.scrollHeight - window.innerHeight);
      if (pct >= 0.35) {
        scrollDone = true;
        show();
      }
    }

    // Trigger: exit-intent (desktop — cursor leaves top of viewport)
    function handleMouseLeave(e: MouseEvent) {
      if (e.clientY <= 0 && !triggeredRef.current) {
        show();
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [show, shouldSuppress]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const attribution = getEmailCaptureAttribution("popup", "direct_savings");
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
      setStep("success");
      setCookie(SUBMIT_COOKIE, "1", 365);
      setTimeout(dismiss, 3000);
    } catch {
      setStatus("error");
    }
  }

  if (step === "hidden") return null;

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

        {step === "success" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="h-10 w-10 text-warm" />
            <p className="text-lg font-semibold">You&apos;re in!</p>
            <p className="text-sm text-primary-foreground/60">
              Look for Portland tips and seasonal deals in your inbox.
            </p>
          </div>
        )}

        {step === "step1" && (
          <>
            <p className="text-center text-2xl font-bold tracking-tight">
              Save 10-15% on your Portland stay
            </p>
            <p className="mt-3 text-center text-sm leading-relaxed text-primary-foreground/60">
              The same homes you see on Airbnb — without the service fees. Book
              direct on BookTraverse.com for the lowest price, every time.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => setStep("step2")}
                className="flex h-12 items-center justify-center gap-2 rounded-lg bg-warm px-6 text-sm font-semibold text-warm-foreground transition-colors hover:bg-warm/90"
              >
                Yes, show me how
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={dismiss}
                className="text-center text-xs text-primary-foreground/40 transition-colors hover:text-primary-foreground/60"
              >
                No thanks
              </button>
            </div>
          </>
        )}

        {step === "step2" && (
          <>
            <p className="text-center text-2xl font-bold tracking-tight">
              Stay in the loop
            </p>
            <p className="mt-3 text-center text-sm leading-relaxed text-primary-foreground/60">
              Portland travel tips and seasonal deals — straight to your inbox.
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
                    "Sign up"
                  )}
                </button>
              </div>
              {status === "error" && (
                <p className="mt-2 text-center text-xs text-red-300">
                  Something went wrong. Please try again.
                </p>
              )}
            </form>
            <p className="mt-4 text-center text-xs text-primary-foreground/30">
              No spam, unsubscribe anytime.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

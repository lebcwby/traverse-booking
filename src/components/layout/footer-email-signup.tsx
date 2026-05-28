"use client";

import { useState } from "react";
import { Send, Loader2, CheckCircle2 } from "lucide-react";
import { getEmailCaptureAttribution } from "@/lib/attribution";

export function FooterEmailSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const attribution = getEmailCaptureAttribution(
        "footer",
        "direct_savings"
      );
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          attribution,
        }),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
      setEmail("");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-primary-foreground/80">
        <CheckCircle2 className="h-4 w-4" />
        <span>You&apos;re in! Look for Colorado tips in your inbox.</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-md">
      <p className="text-center text-sm font-medium text-primary-foreground/90">
        Save 10-15% — book direct, skip the fees
      </p>
      <p className="mt-1 text-center text-xs text-primary-foreground/50">
        Plus Colorado travel tips and seasonal deals
      </p>
      <div className="mt-3 flex gap-2">
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          className="h-10 flex-1 rounded-lg border border-primary-foreground/20 bg-primary-foreground/10 px-3 text-sm text-primary-foreground placeholder:text-primary-foreground/40 outline-none focus:border-primary-foreground/40 focus:ring-1 focus:ring-primary-foreground/30"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-warm px-4 text-sm font-medium text-warm-foreground transition-colors hover:bg-warm/90 disabled:opacity-50"
        >
          {status === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Send className="h-3.5 w-3.5" />
              Subscribe
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
  );
}

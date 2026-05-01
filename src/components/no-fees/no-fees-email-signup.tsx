"use client";

import { useState } from "react";

export function NoFeesEmailSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "no-fees" }),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus("ok");
      setMessage("Thanks — check your inbox.");
      setEmail("");
    } catch {
      setStatus("err");
      setMessage("Couldn't sign you up — try again in a moment.");
    }
  }

  return (
    <form className="inline-email" onSubmit={handleSubmit}>
      <label>
        <span>Get Colorado travel tips in your inbox</span>
        <div className="inline-email-row">
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={status === "loading"}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={status === "loading"}
          >
            {status === "loading" ? "…" : "Sign up"}
          </button>
        </div>
        {message && (
          <span
            style={{
              marginTop: 8,
              fontSize: 13,
              color: status === "ok" ? "var(--success)" : "var(--rose)",
              display: "block",
            }}
          >
            {message}
          </span>
        )}
      </label>
    </form>
  );
}

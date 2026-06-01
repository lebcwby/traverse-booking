"use client";

import { useEffect, useState } from "react";
import { TrackedContactLink } from "@/components/analytics/tracked-contact-link";
import {
  applyConsentMode,
  DEFAULT_CONSENT,
  getEffectiveClientConsent,
  IMPLIED_US_CONSENT,
  setClientConsent,
  type ConsentState,
} from "@/lib/consent";

export default function DoNotSellPage() {
  const [choices, setChoices] = useState<ConsentState>(IMPLIED_US_CONSENT);
  const [saved, setSaved] = useState<ConsentState | null>(null);
  const [gpcEnabled, setGpcEnabled] = useState(false);

  useEffect(() => {
    const consent = getEffectiveClientConsent();
    const navigatorWithGpc =
      typeof window !== "undefined"
        ? (window.navigator as Navigator & { globalPrivacyControl?: boolean })
        : undefined;
    setChoices(consent);
    setSaved(consent);
    setGpcEnabled(navigatorWithGpc?.globalPrivacyControl === true);
  }, []);

  function save(next: ConsentState) {
    setClientConsent(next);
    applyConsentMode(next);
    window.dispatchEvent(
      new CustomEvent("sp:consent-changed", { detail: next })
    );
    setChoices(next);
    setSaved({
      analytics: next.analytics,
      marketing: gpcEnabled ? false : next.marketing,
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        Privacy Choices
      </h1>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            Control Your Tracking Preferences
          </h2>
          <p className="mt-2">
            We do not use a pop-up banner for U.S. visitors. Instead, you can
            manage analytics and marketing preferences here at any time for this
            browser.
          </p>
          {gpcEnabled ? (
            <p className="mt-3 rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-foreground">
              Global Privacy Control is enabled in your browser, so marketing
              and ad-sharing features stay off automatically.
            </p>
          ) : null}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            Current Settings
          </h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex items-start gap-3 rounded-xl border border-border p-4">
              <input
                type="checkbox"
                checked={choices.analytics}
                onChange={(e) =>
                  setChoices((prev) => ({
                    ...prev,
                    analytics: e.target.checked,
                  }))
                }
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">
                  Analytics
                </span>
                <span className="block text-xs text-muted-foreground">
                  Google Analytics measurement, attribution, and conversion
                  reporting.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-border p-4">
              <input
                type="checkbox"
                checked={gpcEnabled ? false : choices.marketing}
                disabled={gpcEnabled}
                onChange={(e) =>
                  setChoices((prev) => ({
                    ...prev,
                    marketing: e.target.checked,
                  }))
                }
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">
                  Marketing
                </span>
                <span className="block text-xs text-muted-foreground">
                  Meta pixel, Meta Conversions API matching, and Klaviyo onsite
                  tracking.
                </span>
              </span>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() => save(DEFAULT_CONSENT)}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground"
            >
              Essential only
            </button>
            <button
              onClick={() =>
                save({
                  analytics: choices.analytics,
                  marketing: gpcEnabled ? false : choices.marketing,
                })
              }
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground"
            >
              Save choices
            </button>
            <button
              onClick={() => save(IMPLIED_US_CONSENT)}
              disabled={gpcEnabled}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              Allow all
            </button>
          </div>

          {saved ? (
            <p className="mt-3 text-sm text-foreground">
              Saved for this browser:{" "}
              <span className="font-medium">
                {saved.analytics && saved.marketing
                  ? "Analytics + marketing"
                  : saved.analytics
                    ? "Analytics only"
                    : "Essential only"}
              </span>
            </p>
          ) : null}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            Your California Rights
          </h2>
          <p className="mt-2">
            Under California law, you can opt out of uses of personal
            information that may qualify as advertising-related sharing. You can
            manage that here or contact us directly at{" "}
            <TrackedContactLink
              href="mailto:bookings@traversehospitality.com"
              className="text-primary hover:underline"
            >
              bookings@traversehospitality.com
            </TrackedContactLink>{" "}
            if you prefer.
          </p>
        </section>
      </div>
    </div>
  );
}

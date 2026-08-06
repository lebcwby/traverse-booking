"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    hbspt?: {
      forms: {
        create: (options: {
          portalId: string;
          formId: string;
          region?: string;
          target: string;
          onFormReady?: () => void;
          onFormSubmitted?: () => void;
        }) => void;
      };
    };
  }
}

const EMBED_SRC = "https://js-na2.hsforms.net/forms/embed/v2.js";
const SCRIPT_ID = "hubspot-forms-embed-v2";

/**
 * Renders a HubSpot-hosted form.
 *
 * Loads the v2 embed script once per page and creates the form into a target
 * div. Guarded against double-creation: React re-renders (and StrictMode's
 * double-invoked effects in dev) would otherwise stack two copies of the form.
 *
 * ⚠️ Attribution: HubSpot ties a submission to the visitor's page-view history
 * via the `hubspotutk` cookie, which is set by the HubSpot *tracking* script
 * (js.hs-scripts.com/<portalId>.js) — NOT by this embed. That script is not
 * currently loaded on booktraverse.com, so contacts created here will land
 * without an original source or page path. The form captures the lead either
 * way; it just can't say how they found us until tracking is added.
 *
 * If the script is blocked (ad blocker, network), `failed` renders a fallback
 * with real contact routes rather than leaving the highest-value funnel on the
 * site as an empty box.
 */
export function HubSpotForm({
  portalId,
  formId,
  region = "na2",
  className = "",
  onSubmitted,
}: {
  portalId: string;
  formId: string;
  region?: string;
  className?: string;
  /**
   * Fired on successful submit. HubSpot owns the submission, so this is the
   * only hook left for our own conversion tracking — without it the GA4 event
   * the old hand-rolled form fired would simply disappear.
   */
  onSubmitted?: () => void;
}) {
  const targetId = `hs-form-${formId}`;
  const created = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Held in a ref so a new callback identity never re-runs the effect — that
  // would try to create the form a second time.
  const onSubmittedRef = useRef(onSubmitted);
  onSubmittedRef.current = onSubmitted;

  useEffect(() => {
    let cancelled = false;

    function createForm() {
      if (cancelled || created.current || !window.hbspt) return;
      const target = document.getElementById(targetId);
      // Effect can fire before the target paints, and re-running would append
      // a second form — bail unless the node exists and is still empty.
      if (!target || target.childElementCount > 0) return;
      created.current = true;
      window.hbspt.forms.create({
        portalId,
        formId,
        region,
        target: `#${targetId}`,
        onFormReady: () => !cancelled && setReady(true),
        onFormSubmitted: () => onSubmittedRef.current?.(),
      });
    }

    if (window.hbspt) {
      createForm();
      return () => {
        cancelled = true;
      };
    }

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = EMBED_SRC;
      script.async = true;
      script.charset = "utf-8";
      document.body.appendChild(script);
    }

    const onLoad = () => createForm();
    const onError = () => !cancelled && setFailed(true);
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);

    // The embed occasionally loads but never initialises (blocked XHR, region
    // mismatch). Surface the fallback rather than showing an empty card.
    const timeout = setTimeout(() => {
      if (!cancelled && !window.hbspt) setFailed(true);
    }, 8000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      script?.removeEventListener("load", onLoad);
      script?.removeEventListener("error", onError);
    };
  }, [portalId, formId, region, targetId]);

  if (failed) {
    return (
      <div className={`text-center ${className}`}>
        <p className="text-sm text-muted-foreground">
          The form couldn&apos;t load — it may be blocked by a browser
          extension. Reach us directly and we&apos;ll get you an estimate:
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium">
          <a href="tel:+19705333583" className="underline">
            (970) 533-3583
          </a>
          <a
            href="mailto:bookings@traversehospitality.com"
            className="underline"
          >
            bookings@traversehospitality.com
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div id={targetId} />
      {!ready && (
        <p
          className="py-8 text-center text-sm text-muted-foreground"
          aria-live="polite"
        >
          Loading form…
        </p>
      )}
    </div>
  );
}

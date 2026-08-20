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
 * Attribution: HubSpot ties a submission to the visitor's page-view history via
 * the `hubspotutk` cookie, which is set by the HubSpot *tracking* script — NOT
 * by this embed. That tracker is loaded site-wide by the consent manager under
 * analytics consent (js-na2.hs-scripts.com/<portalId>.js; the unprefixed host
 * only 307-redirects for this na2 portal). Without it, contacts land with no
 * original source and no page path.
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
    let observer: ResizeObserver | undefined;
    let pollHandle: ReturnType<typeof setInterval> | undefined;

    /**
     * Size the HubSpot iframe to its content.
     *
     * When the embed renders into an iframe, HubSpot's own auto-resize does not
     * always fire — observed live on this page: the form rendered all 10 fields
     * but the iframe stayed at the browser's default 150px against 1781px of
     * content, clipping it to a sliver. The iframe is same-origin, so we can
     * observe the inner document and set the height ourselves.
     */
    function syncIframeHeight() {
      const iframe = document
        .getElementById(targetId)
        ?.querySelector("iframe") as HTMLIFrameElement | null;
      if (!iframe) return; // rendered inline — nothing to size

      const apply = () => {
        let doc: Document | null = null;
        try {
          doc = iframe.contentDocument;
        } catch {
          return; // cross-origin: rely on HubSpot's own resize
        }
        const height = doc?.documentElement?.scrollHeight;
        if (height && height > 0) {
          iframe.style.height = `${height}px`;
          iframe.style.width = "100%";
          iframe.style.border = "0";
        }
      };

      apply();

      try {
        const body = iframe.contentDocument?.body;
        if (body && typeof ResizeObserver !== "undefined") {
          observer?.disconnect();
          observer = new ResizeObserver(apply);
          observer.observe(body);
        }
      } catch {
        /* cross-origin — fall through to polling */
      }

      // Belt and braces: conditional fields and validation errors change the
      // height, and a missed resize silently hides part of the form.
      clearInterval(pollHandle);
      let ticks = 0;
      pollHandle = setInterval(() => {
        apply();
        if (++ticks > 20) clearInterval(pollHandle);
      }, 500);
    }

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
        onFormReady: () => {
          if (cancelled) return;
          setReady(true);
          syncIframeHeight();
        },
        onFormSubmitted: () => {
          onSubmittedRef.current?.();
          // The confirmation message is a different height than the form.
          syncIframeHeight();
        },
      });
    }

    if (window.hbspt) {
      createForm();
      return () => {
        cancelled = true;
        observer?.disconnect();
        clearInterval(pollHandle);
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
      observer?.disconnect();
      clearInterval(pollHandle);
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

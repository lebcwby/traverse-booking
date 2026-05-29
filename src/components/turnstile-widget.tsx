"use client";

// Cloudflare Turnstile widget for the /property-management lead form.
//
// The Traverse team app (team.traversehospitality.com) protects its
// public /api/leads endpoint with Turnstile + a per-IP rate limit. Any
// submission without a valid token is rejected with `spam_check_failed`,
// so this booktraverse.com form must render the widget and send the
// token in the POST body as `turnstileToken`.
//
// Site key comes from NEXT_PUBLIC_TURNSTILE_SITE_KEY. It must be the
// SAME widget (or a widget whose allowed-hostnames list includes
// booktraverse.com) configured in the Traverse team app, because the
// team app verifies the token server-side against its own secret.
//
// When the env var is absent the component renders nothing and reports
// turnstileConfigured=false to the parent so the form still works in
// local/dev where the team app skips verification.

import Script from "next/script";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export const turnstileConfigured = Boolean(SITE_KEY);

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
        },
      ) => string;
      reset: (widgetId: string) => void;
    };
  }
}

export type TurnstileHandle = {
  /** Reset the widget so a fresh, single-use token is issued. */
  reset: () => void;
};

type Props = {
  onToken: (token: string) => void;
  className?: string;
};

export const TurnstileWidget = forwardRef<TurnstileHandle, Props>(
  function TurnstileWidget({ onToken, className }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<string | null>(null);
    const [loaded, setLoaded] = useState(false);

    useImperativeHandle(ref, () => ({
      reset() {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
          onToken("");
        }
      },
    }));

    useEffect(() => {
      if (!SITE_KEY || !loaded || !containerRef.current || widgetIdRef.current) {
        return;
      }
      if (!window.turnstile) return;

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: (token) => onToken(token),
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    }, [loaded, onToken]);

    if (!SITE_KEY) return null;

    return (
      <div className={className}>
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={() => setLoaded(true)}
        />
        <div ref={containerRef} className="min-h-[65px]" />
      </div>
    );
  },
);

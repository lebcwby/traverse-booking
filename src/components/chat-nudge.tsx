"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { openConduitWidget } from "@/components/conduit-widget";

const SHOW_DELAY_MS = 45_000;
const AUTO_DISMISS_MS = 10_000;

export function ChatNudge({
  listingId,
  listingTitle,
}: {
  listingId: string;
  listingTitle?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const autoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const storageKey = `chat_nudge_dismissed_${listingId}`;

  // Show after 45 seconds, unless already dismissed for this listing
  useEffect(() => {
    try {
      if (sessionStorage.getItem(storageKey)) {
        setDismissed(true);
        return;
      }
    } catch {
      // sessionStorage unavailable (SSR, privacy mode)
    }

    showTimer.current = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => {
      if (showTimer.current) clearTimeout(showTimer.current);
    };
  }, [storageKey]);

  // Fix #5: Listen for chat opens from ANY source (floating button, desktop bubble)
  // and suppress the nudge if chat was already opened
  useEffect(() => {
    function onChatOpened() {
      dismiss();
      // Also cancel the show timer if nudge hasn't appeared yet
      if (showTimer.current) clearTimeout(showTimer.current);
    }
    window.addEventListener("conduit-chat-opened", onChatOpened);
    return () =>
      window.removeEventListener("conduit-chat-opened", onChatOpened);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-dismiss 10 seconds after appearing
  useEffect(() => {
    if (!visible || dismissed) return;

    autoDismissTimer.current = setTimeout(() => dismiss(), AUTO_DISMISS_MS);
    return () => {
      if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, dismissed]);

  function dismiss() {
    setDismissed(true);
    setVisible(false);
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      // ignore
    }
  }

  function handleChat() {
    // Fix #2: Pass full listing context + trigger so GA4 and Conduit AI get it
    openConduitWidget({
      listingId,
      listingTitle,
      pageType: "property_detail",
      trigger: "proactive_nudge",
    });
    dismiss();
  }

  if (dismissed || !visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[55] flex justify-center pointer-events-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="pointer-events-auto w-full max-w-md mx-4 mb-[88px] lg:mb-4 animate-slide-up-nudge rounded-xl border border-border bg-white shadow-lg">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm text-foreground">
            {listingTitle ? (
              <>
                Questions about{" "}
                <span className="font-medium">{listingTitle}</span>? Ask about
                parking, pets, check-in &amp; more.
              </>
            ) : (
              "Questions about this place? Ask about parking, pets, check-in & more."
            )}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleChat}
              className="bg-[#404f52] text-white rounded-full px-4 py-1.5 text-sm font-medium hover:bg-[#354144] transition-colors"
            >
              Chat with us
            </button>
            <button
              onClick={dismiss}
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideUpNudge {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up-nudge {
          animation: slideUpNudge 0.35s ease-out;
        }
      `}</style>
    </div>
  );
}

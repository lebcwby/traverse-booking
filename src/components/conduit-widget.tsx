"use client";

import { useEffect, useRef } from "react";
import { trackChatOpened } from "@/lib/tracking";

const WIDGET_ID = "5a94469b-0814-436d-6738-04440e5c8986";
const SCRIPT_SRC = "https://base.conduit.ai/widget/widget.min.js";

// --- Types ---

export interface ConduitChatContext {
  listingId?: string;
  listingTitle?: string;
  checkIn?: string;
  checkOut?: string;
  pageType?: string;
  trigger?: string;
}

declare global {
  interface Window {
    __spChatContext?: ConduitChatContext;
    __conduitPendingOpen?: ConduitChatContext | null;
    __spCurrentListing?: { id: string; title: string } | null;
  }
}

// --- Script loading ---

let scriptLoadPromise: Promise<void> | null = null;
let scriptLoadFailed = false;
let bubbleHidden = false;

function injectConduitScript(): Promise<void> {
  if (scriptLoadFailed) {
    scriptLoadPromise = null;
    scriptLoadFailed = false;
    const old = document.querySelector(`script[data-widget-id="${WIDGET_ID}"]`);
    if (old) old.remove();
  }

  if (scriptLoadPromise) return scriptLoadPromise;

  if (document.querySelector(`script[data-widget-id="${WIDGET_ID}"]`)) {
    scriptLoadPromise = Promise.resolve();
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.setAttribute("data-widget-id", WIDGET_ID);
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoadFailed = true;
      reject(new Error("Conduit script failed to load"));
    };
    document.body.appendChild(script);
  });

  return scriptLoadPromise;
}

/** Hide the native Conduit bubble on ALL screens (replaced by ChatTrigger) */
function hideNativeBubble() {
  if (bubbleHidden) return;

  const styleId = "conduit-hide-bubble";

  function tryHide(): boolean {
    const container = document.getElementById("conduit-widget-container");
    const shadow = container?.shadowRoot;
    if (!shadow) return false;

    if (!shadow.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        #conduit-embed-chat-button-container {
          display: none !important;
        }
      `;
      shadow.appendChild(style);
    }

    bubbleHidden = true;
    return true;
  }

  if (!tryHide()) {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (tryHide() || attempts > 150) {
        clearInterval(interval);
      }
    }, 200);
  }
}

/**
 * Triggers lazy-load of the Conduit script:
 * 1. requestIdleCallback (with 5s setTimeout fallback for Safari)
 * 2. First scroll/mousemove/touchstart loads immediately
 */
function scheduleLazyLoad() {
  let loaded = false;

  function load() {
    if (loaded) return;
    loaded = true;
    cleanup();
    injectConduitScript()
      .then(() => {
        processPendingOpen();
        hideNativeBubble();
      })
      .catch(() => {
        // Script failed — will retry on next openConduitWidget() call
      });
  }

  const interactionEvents = ["scroll", "mousemove", "touchstart"] as const;
  interactionEvents.forEach((evt) =>
    window.addEventListener(evt, load, { once: true, passive: true })
  );

  const requestIdle =
    window.requestIdleCallback || ((cb: () => void) => setTimeout(cb, 5000));
  requestIdle(load, { timeout: 5000 });

  function cleanup() {
    interactionEvents.forEach((evt) => window.removeEventListener(evt, load));
  }
}

// --- Pending open queue ---

let pendingOpenActive = false;

function processPendingOpen() {
  const pending = window.__conduitPendingOpen;
  if (pending === undefined || pendingOpenActive) return;
  window.__conduitPendingOpen = undefined;
  pendingOpenActive = true;

  const tryOpen = (attempts: number) => {
    const cs = getConduitSettings();
    if (
      cs &&
      typeof cs.show === "function" &&
      typeof cs.expand === "function"
    ) {
      cs.show();
      cs.expand();
      navigateToNewConversation();
      pendingOpenActive = false;
      trackChatOpened({
        page_type: pending?.pageType,
        listing_id: pending?.listingId,
        trigger: pending?.trigger,
      });
      dispatchChatOpenedEvent();
    } else if (attempts < 30) {
      setTimeout(() => tryOpen(attempts + 1), 200);
    } else {
      pendingOpenActive = false;
    }
  };
  tryOpen(0);
}

// --- Conduit settings accessor ---

function getConduitSettings() {
  return (window as unknown as Record<string, unknown>).ConduitSettings as
    | { show: () => void; expand: () => void }
    | undefined;
}

// --- Custom event so other components know chat was opened ---

function dispatchChatOpenedEvent() {
  window.dispatchEvent(new CustomEvent("conduit-chat-opened"));
}

// --- Component ---

export function ConduitWidget() {
  const initialised = useRef(false);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    scheduleLazyLoad();
  }, []);

  return null;
}

// --- Navigate to new conversation inside the widget ---

// Button labels Conduit has used for "start a new conversation" over time.
// Matched case-insensitively so minor copy changes don't break auto-open.
const NEW_CONVERSATION_LABELS = [
  "send us a message",
  "new conversation",
  "new message",
  "start a conversation",
  "start conversation",
];

function findNewConversationButton(
  shadow: ShadowRoot
): HTMLButtonElement | null {
  const buttons = Array.from(shadow.querySelectorAll("button"));
  for (const btn of buttons) {
    const text = btn.textContent?.trim().toLowerCase() ?? "";
    if (NEW_CONVERSATION_LABELS.some((label) => text === label)) {
      return btn as HTMLButtonElement;
    }
  }
  return null;
}

function navigateToNewConversation() {
  const shadow = document.getElementById(
    "conduit-widget-container"
  )?.shadowRoot;
  if (!shadow) return;

  function tryClick(attempts: number) {
    // Case 1: Conversations list / landing — click "Send us a message" (or
    // whichever start-new-conversation label Conduit currently ships).
    const newConvBtn = findNewConversationButton(shadow!);
    if (newConvBtn) {
      newConvBtn.click();
      return;
    }

    // Case 2: On a conversation view — click "Back to conversations" first
    const backBtn = shadow!.querySelector(
      '[aria-label="Back to conversations"]'
    ) as HTMLButtonElement | null;
    if (backBtn) {
      backBtn.click();
      // Wait for list to render, then click the start-new button
      setTimeout(() => tryClick(0), 300);
      return;
    }

    // Widget may still be rendering — retry
    if (attempts < 10) {
      setTimeout(() => tryClick(attempts + 1), 200);
    }
  }

  // Small delay for the panel to render after show()/expand()
  setTimeout(() => tryClick(0), 300);
}

// --- Public API ---

export function openConduitWidget(context?: ConduitChatContext) {
  const ctx = context || {};

  window.__spChatContext = ctx;

  const cs = getConduitSettings();
  if (cs && typeof cs.show === "function" && typeof cs.expand === "function") {
    cs.show();
    cs.expand();
    navigateToNewConversation();
    trackChatOpened({
      page_type: ctx.pageType,
      listing_id: ctx.listingId,
      trigger: ctx.trigger,
    });
    dispatchChatOpenedEvent();
  } else {
    window.__conduitPendingOpen = ctx;
    injectConduitScript()
      .then(() => {
        processPendingOpen();
        hideNativeBubble();
      })
      .catch(() => {
        window.__conduitPendingOpen = undefined;
      });
  }
}

// Generate a session ID (persisted in sessionStorage for the tab lifetime)
function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = sessionStorage.getItem("_sp_behavior_sid");
  if (!sid) {
    sid =
      globalThis.crypto?.randomUUID?.() ??
      Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    sessionStorage.setItem("_sp_behavior_sid", sid);
  }
  return sid;
}

export function trackBehavior(
  eventType: string,
  properties: Record<string, unknown>
) {
  // Non-blocking fire-and-forget
  fetch("/api/track/behavior", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event_type: eventType,
      session_id: getSessionId(),
      properties,
      page_url: window.location.href,
      referrer: document.referrer || undefined,
    }),
  }).catch(() => {});
}

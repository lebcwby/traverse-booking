/**
 * Wait for the Meta Pixel to be ready AND the _fbp cookie to be set, so that
 * any tracking event fired afterward carries fbp in both the browser fbq call
 * (Meta merges events by event_id) and the CAPI fetch body.
 *
 * Resolves immediately on SPA navigations (pixel + cookie already present).
 * On initial page load, resolves when fbevents.js finishes loading (~200-600ms
 * after consent manager fires sp:meta-pixel-ready). Falls through at maxMs so
 * fast bouncers still get their event sent instead of nothing.
 */
export function waitForPixelAndFbp(maxMs = 1500): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }

    const fbpPresent = () => /(?:^|;\s*)_fbp=/.test(document.cookie);

    if (window.fbq && fbpPresent()) {
      resolve();
      return;
    }

    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      clearInterval(pollTimer);
      clearTimeout(absoluteTimeout);
      resolve();
    };

    const pollTimer = setInterval(() => {
      if (window.fbq && fbpPresent()) done();
    }, 50);

    const absoluteTimeout = setTimeout(done, maxMs);
  });
}

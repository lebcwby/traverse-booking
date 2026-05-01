// IndexNow — instant search engine indexing for Bing, Yandex, Seznam, Yep
// Docs: https://www.indexnow.org/documentation

const INDEXNOW_KEY = "b5fb0364a9f443eb85e0362f908f1ef7";
const SITE_HOST = "www.booktraverse.com";

/**
 * Notify search engines of changed URLs via IndexNow protocol.
 * Supports up to 10,000 URLs per call. Fire-and-forget — failures are logged but not thrown.
 */
export async function submitIndexNow(urls: string[]): Promise<void> {
  if (urls.length === 0) return;

  try {
    const resp = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: SITE_HOST,
        key: INDEXNOW_KEY,
        keyLocation: `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`,
        urlList: urls.slice(0, 10000),
      }),
    });

    if (!resp.ok) {
      console.warn(
        `IndexNow submission failed: ${resp.status} ${resp.statusText}`
      );
    }
  } catch (error) {
    console.warn("IndexNow submission error:", error);
  }
}

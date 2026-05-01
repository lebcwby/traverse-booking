// src/lib/pois/seed/pass-1-extract.ts
// Pass 1: read book-traverse-auth SEO content via getAuthAdmin() (PostgREST),
// then Claude extraction of place mentions. Also mines the already-structured
// `nearby_attractions` field on seo_neighborhood_pages for free POI candidates.

import { getAuthAdmin } from "@/lib/supabase-auth-admin";
import { completeJson } from "./claude-client";
import { writeIntermediate } from "./intermediate-files";
import { dedupeByKey, normalizeNameKey } from "../normalize";

export interface ExtractedPoi {
  name: string;
  category_guess: string;
  why_mentioned: string;
}

export interface CandidatePoi {
  name: string;
  categoryGuess: string;
  whyMentioned: string;
  sourceGuideSlug: string;
  neighborhoodHint?: string;
}

interface ArticleInput {
  slug: string;
  title: string;
  body: string;
  neighborhood?: string;
}

const SYSTEM_PROMPT = `You are a place extraction tool. Given an article about Portland, Oregon, identify every named place (restaurant, coffee shop, bar, park, museum, shop, viewpoint, food cart pod, activity, etc.) explicitly mentioned. Return ONLY a JSON array — no prose, no markdown.

Schema:
[
  {
    "name": "exact name as written",
    "category_guess": "restaurant" | "coffee" | "bar" | "park" | "shop" | "museum" | "viewpoint" | "activity" | "food_cart_pod",
    "why_mentioned": "1 sentence describing what the article says about this place"
  }
]

Rules:
- Skip generic references ("a coffee shop", "various restaurants") — only NAMED places
- Skip neighborhood names themselves (e.g. "the Pearl", "Division Street")
- Skip Portland landmarks that aren't visitable POIs (e.g. "the Willamette River" alone, but DO include "Tom McCall Waterfront Park")
- If the same place appears multiple times, include it once`;

export async function extractFromArticle(
  article: ArticleInput
): Promise<CandidatePoi[]> {
  const userPrompt = `Article title: ${article.title}\n\n${article.body}`;
  const extracted = await completeJson<ExtractedPoi[]>({
    system: SYSTEM_PROMPT,
    user: userPrompt,
    maxTokens: 4096,
  });

  if (!Array.isArray(extracted)) {
    throw new Error(`Pass 1 expected array, got ${typeof extracted}`);
  }

  return extracted.map((e) => ({
    name: e.name,
    categoryGuess: e.category_guess,
    whyMentioned: e.why_mentioned,
    sourceGuideSlug: article.slug,
    neighborhoodHint: article.neighborhood,
  }));
}

// Shape we coerce each SEO table row into before passing to the extractor.
interface SeoArticle {
  slug: string;
  title: string;
  body: string;
  neighborhood?: string;
}

/**
 * Fetch all published SEO content across the 5 auth-DB tables, normalizing
 * each into a {slug, title, body, neighborhood} shape. Uses the existing
 * getAuthAdmin() PostgREST client — no direct pg connection required.
 */
async function fetchSeoArticles(): Promise<SeoArticle[]> {
  const db = getAuthAdmin();
  const articles: SeoArticle[] = [];

  // seo_neighborhood_pages — intro_content_markdown + content_sections_markdown
  {
    const { data, error } = await db
      .from("seo_neighborhood_pages")
      .select(
        "slug, neighborhood_name, intro_content_markdown, content_sections_markdown"
      )
      .eq("status", "published");
    if (error) throw new Error(`seo_neighborhood_pages: ${error.message}`);
    for (const row of data ?? []) {
      const r = row as {
        slug: string;
        neighborhood_name: string;
        intro_content_markdown: string | null;
        content_sections_markdown: string | null;
      };
      const body = [r.intro_content_markdown, r.content_sections_markdown]
        .filter(Boolean)
        .join("\n\n");
      if (!body) continue;
      articles.push({
        slug: r.slug,
        title: r.neighborhood_name,
        body,
        neighborhood: r.slug, // use slug as the neighborhood hint
      });
    }
  }

  // seo_usecase_pages — content_markdown
  {
    const { data, error } = await db
      .from("seo_usecase_pages")
      .select("slug, use_case, content_markdown")
      .eq("status", "published");
    if (error) throw new Error(`seo_usecase_pages: ${error.message}`);
    for (const row of data ?? []) {
      const r = row as {
        slug: string;
        use_case: string;
        content_markdown: string | null;
      };
      if (!r.content_markdown) continue;
      articles.push({
        slug: r.slug,
        title: r.use_case,
        body: r.content_markdown,
      });
    }
  }

  // seo_event_pages — content_markdown
  {
    const { data, error } = await db
      .from("seo_event_pages")
      .select("slug, event_name, content_markdown")
      .eq("status", "published");
    if (error) throw new Error(`seo_event_pages: ${error.message}`);
    for (const row of data ?? []) {
      const r = row as {
        slug: string;
        event_name: string;
        content_markdown: string | null;
      };
      if (!r.content_markdown) continue;
      articles.push({
        slug: r.slug,
        title: r.event_name,
        body: r.content_markdown,
      });
    }
  }

  // seo_comparison_pages — content_markdown
  {
    const { data, error } = await db
      .from("seo_comparison_pages")
      .select("slug, headline, content_markdown")
      .eq("status", "published");
    if (error) throw new Error(`seo_comparison_pages: ${error.message}`);
    for (const row of data ?? []) {
      const r = row as {
        slug: string;
        headline: string;
        content_markdown: string | null;
      };
      if (!r.content_markdown) continue;
      articles.push({
        slug: r.slug,
        title: r.headline,
        body: r.content_markdown,
      });
    }
  }

  // sp_blog_posts — content_markdown
  {
    const { data, error } = await db
      .from("sp_blog_posts")
      .select("slug, title, content_markdown")
      .eq("status", "published");
    if (error) throw new Error(`sp_blog_posts: ${error.message}`);
    for (const row of data ?? []) {
      const r = row as {
        slug: string;
        title: string;
        content_markdown: string | null;
      };
      if (!r.content_markdown) continue;
      articles.push({
        slug: r.slug,
        title: r.title,
        body: r.content_markdown,
      });
    }
  }

  return articles;
}

/**
 * Mine the structured `nearby_attractions` array on every neighborhood page.
 * Each string in that array is already a POI name (e.g. "Powell's Books on
 * Hawthorne (SE 37th)") so we can skip the LLM extraction entirely.
 */
async function mineNearbyAttractions(): Promise<CandidatePoi[]> {
  const db = getAuthAdmin();
  const { data, error } = await db
    .from("seo_neighborhood_pages")
    .select("slug, neighborhood_name, nearby_attractions")
    .eq("status", "published");
  if (error) throw new Error(`mine nearby_attractions: ${error.message}`);

  const out: CandidatePoi[] = [];
  for (const row of data ?? []) {
    const r = row as {
      slug: string;
      neighborhood_name: string;
      nearby_attractions: string[] | null;
    };
    if (!Array.isArray(r.nearby_attractions)) continue;
    for (const name of r.nearby_attractions) {
      if (!name || typeof name !== "string") continue;
      out.push({
        name: name.trim(),
        categoryGuess: "activity", // default — Pass 3 will retag
        whyMentioned: `Listed as a nearby attraction in ${r.neighborhood_name}`,
        sourceGuideSlug: r.slug,
        neighborhoodHint: r.slug,
      });
    }
  }
  return out;
}

export async function runPass1(): Promise<{
  candidates: CandidatePoi[];
  outputFile: string;
}> {
  console.log("[pass-1] fetching SEO content from auth DB...");
  const articles = await fetchSeoArticles();
  console.log(`[pass-1] fetched ${articles.length} articles`);

  console.log("[pass-1] mining structured nearby_attractions...");
  const structured = await mineNearbyAttractions();
  console.log(`[pass-1] mined ${structured.length} structured candidates`);

  const allCandidates: CandidatePoi[] = [...structured];

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i]!;
    console.log(
      `[pass-1] extract (${i + 1}/${articles.length}) ${article.slug}`
    );
    try {
      const candidates = await extractFromArticle(article);
      allCandidates.push(...candidates);
    } catch (e) {
      console.warn(
        `[pass-1] skipping ${article.slug}: ${(e as Error).message}`
      );
    }
  }

  const deduped = dedupeByKey(allCandidates, (c) => normalizeNameKey(c.name));
  const outputFile = await writeIntermediate("pass-1-extracted.json", deduped);
  console.log(
    `[pass-1] total ${allCandidates.length} → deduped ${deduped.length} → ${outputFile}`
  );

  return { candidates: deduped, outputFile };
}

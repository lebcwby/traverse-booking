/**
 * Data fetching for SEO landing pages.
 * Reads from the book-traverse DB via direct Postgres (getPool).
 * Queries gracefully return empty results when DB is unavailable (CI builds).
 */

import { getPool } from "./db";

async function safeQuery<T>(
  queryFn: () => Promise<{ rows: T[] }>
): Promise<T[]> {
  try {
    const { rows } = await queryFn();
    return rows;
  } catch {
    return [];
  }
}

// ─── Types ───────────────────────────────────────────────────────

export interface NeighborhoodPage {
  id: string;
  slug: string;
  neighborhood_name: string;
  guesty_tag: string;
  headline: string;
  meta_title: string;
  meta_description: string;
  intro_content_markdown: string;
  highlights: { icon: string; label: string; description: string }[];
  nearby_attractions: string[];
  content_sections_markdown: string;
  schema_markup: Record<string, unknown>;
  status: string;
}

export interface UseCasePage {
  id: string;
  slug: string;
  use_case: string;
  headline: string;
  meta_title: string;
  meta_description: string;
  target_audience: string | null;
  content_markdown: string;
  conversion_hook: string | null;
  schema_markup: Record<string, unknown>;
  status: string;
}

export interface EventPage {
  id: string;
  slug: string;
  event_name: string;
  headline: string;
  meta_title: string;
  meta_description: string;
  event_description: string;
  typical_dates: string | null;
  content_markdown: string;
  booking_urgency_note: string | null;
  schema_markup: Record<string, unknown>;
  status: string;
}

export interface ComparisonPage {
  id: string;
  slug: string;
  headline: string;
  meta_title: string;
  meta_description: string;
  content_markdown: string;
  schema_markup: Record<string, unknown>;
  status: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  meta_title: string | null;
  meta_description: string | null;
  target_keywords: string[];
  content_markdown: string;
  featured_image_url: string | null;
  published_at: string | null;
  status: string;
  pillar: string | null;
}

// ─── Neighborhood Pages ──────────────────────────────────────────

export async function getNeighborhoodPage(
  slug: string
): Promise<NeighborhoodPage | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT * FROM seo_neighborhood_pages WHERE slug = $1 AND status = 'published' LIMIT 1",
    [slug]
  );
  return rows[0] ?? null;
}

export async function getAllNeighborhoodSlugs(): Promise<string[]> {
  const rows = await safeQuery(() =>
    getPool().query(
      "SELECT slug FROM seo_neighborhood_pages WHERE status = 'published' ORDER BY neighborhood_name"
    )
  );
  return rows.map((r: { slug: string }) => r.slug);
}

// ─── Use-Case Pages ──────────────────────────────────────────────

export async function getUseCasePage(
  slug: string
): Promise<UseCasePage | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT * FROM seo_usecase_pages WHERE slug = $1 AND status = 'published' LIMIT 1",
    [slug]
  );
  return rows[0] ?? null;
}

export async function getAllUseCaseSlugs(): Promise<string[]> {
  const rows = await safeQuery(() =>
    getPool().query(
      "SELECT slug FROM seo_usecase_pages WHERE status = 'published' ORDER BY use_case"
    )
  );
  return rows.map((r: { slug: string }) => r.slug);
}

// ─── Event Pages ─────────────────────────────────────────────────

export async function getEventPage(slug: string): Promise<EventPage | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT * FROM seo_event_pages WHERE slug = $1 AND status = 'published' LIMIT 1",
    [slug]
  );
  return rows[0] ?? null;
}

export async function getAllEventSlugs(): Promise<string[]> {
  const rows = await safeQuery(() =>
    getPool().query(
      "SELECT slug FROM seo_event_pages WHERE status = 'published' ORDER BY event_name"
    )
  );
  return rows.map((r: { slug: string }) => r.slug);
}

// ─── Comparison Pages ────────────────────────────────────────────

export async function getComparisonPage(
  slug: string
): Promise<ComparisonPage | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT * FROM seo_comparison_pages WHERE slug = $1 AND status = 'published' LIMIT 1",
    [slug]
  );
  return rows[0] ?? null;
}

// ─── Blog ────────────────────────────────────────────────────────

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT * FROM sp_blog_posts WHERE slug = $1 AND status = 'published' LIMIT 1",
    [slug]
  );
  return rows[0] ?? null;
}

export async function getAllBlogPosts(): Promise<BlogPost[]> {
  return safeQuery(() =>
    getPool().query(
      `SELECT p.id, p.slug, p.title, p.meta_title, p.meta_description,
              p.featured_image_url, p.published_at, t.pillar
       FROM sp_blog_posts p
       LEFT JOIN sp_blog_topics t ON p.topic_id = t.id
       WHERE p.status = 'published'
       ORDER BY p.published_at DESC`
    )
  );
}

export async function getAllBlogSlugs(): Promise<string[]> {
  const rows = await safeQuery(() =>
    getPool().query(
      "SELECT slug FROM sp_blog_posts WHERE status = 'published' ORDER BY published_at DESC"
    )
  );
  return rows.map((r: { slug: string }) => r.slug);
}

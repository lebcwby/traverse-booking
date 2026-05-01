// src/app/portland-recommendations/[id]/page.tsx
// Two personalities for one route, mirroring /plan/[id]:
//   1. Known SEO slug (e.g. "best-italian-restaurants") → hydrate the
//      recommender chat with a pre-seeded Q&A from sp_plans so the visitor
//      lands mid-answer with POI cards already on screen. Indexable.
//   2. UUID → hydrate the chat with a user's persisted saved chat. noindex.
// Anything else → 404.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { UIMessage } from "ai";
import { RecommendChat } from "@/components/plan/recommend-chat";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  getRecommendSlug,
  allRecommendSlugs,
} from "@/lib/plan/recommend-slug-map";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Props {
  params: Promise<{ id: string }>;
}

// Statically render the known recommendation slugs; UUIDs fall through to dynamic.
export function generateStaticParams() {
  return allRecommendSlugs().map((s) => ({ id: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const entry = getRecommendSlug(id);
  if (entry) {
    const canonical = `https://www.booktraverse.com/portland-recommendations/${entry.slug}`;
    return {
      title: entry.metaTitle,
      description: entry.metaDescription,
      keywords: entry.keywords,
      alternates: { canonical },
      openGraph: {
        title: entry.metaTitle,
        description: entry.metaDescription,
        url: canonical,
        siteName: "Book Traverse",
        type: "article",
        locale: "en_US",
      },
      twitter: {
        card: "summary_large_image",
        title: entry.metaTitle,
        description: entry.metaDescription,
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-snippet": -1,
          "max-image-preview": "large",
        },
      },
    };
  }
  // UUID branch — noindex persisted user chats.
  return {
    title: "Your Portland Picks — Book Traverse",
    description: "A saved set of Portland recommendations from a local.",
    robots: { index: false, follow: true },
  };
}

// Pull the most recent assistant text reply from a cached chat — used as the
// FAQ answer in JSON-LD. Falls back to the subtitle if no text part is found.
function extractAssistantText(messages: UIMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || msg.role !== "assistant") continue;
    const texts: string[] = [];
    for (const part of msg.parts as Array<{ type?: string; text?: string }>) {
      if (part?.type === "text" && typeof part.text === "string") {
        texts.push(part.text);
      }
    }
    if (texts.length > 0) return texts.join("\n").trim();
  }
  return null;
}

async function loadCachedChat(cacheKey: string): Promise<{
  id: string;
  messages: UIMessage[];
} | null> {
  const supa = getSupabaseAdmin();
  const { data } = await supa
    .from("sp_plans")
    .select("id,messages")
    .eq("cache_key", cacheKey)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const messages = (data.messages ?? []) as UIMessage[];
  if (messages.length === 0) return null;
  return { id: data.id as string, messages };
}

export default async function RecommendByIdPage({ params }: Props) {
  const { id } = await params;

  // SEO slug branch — pre-seeded topic chat
  const entry = getRecommendSlug(id);
  if (entry) {
    const cached = await loadCachedChat(entry.cacheKey);
    if (!cached) notFound();

    const canonical = `https://www.booktraverse.com/portland-recommendations/${entry.slug}`;
    const answer = extractAssistantText(cached.messages) ?? entry.subtitle;
    const structuredData = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": `${canonical}#page`,
          name: entry.h1,
          url: canonical,
          description: entry.metaDescription,
          isPartOf: {
            "@type": "WebSite",
            name: "Book Traverse",
            url: "https://www.booktraverse.com",
          },
        },
        {
          "@type": "FAQPage",
          "@id": `${canonical}#faq`,
          mainEntity: [
            {
              "@type": "Question",
              name: entry.opener,
              acceptedAnswer: {
                "@type": "Answer",
                text: answer.slice(0, 1500),
              },
            },
          ],
        },
      ],
    };

    // No initialId on the slug branch: any visitor follow-up should mint a
    // NEW sp_plans row instead of mutating the shared seed (which would
    // corrupt this slug for every subsequent visitor). After the first
    // save, the chat pushes /portland-recommendations/<new-uuid>.
    return (
      <>
        <script
          type="application/ld+json"
          // Static, server-rendered JSON-LD — safe to dangerouslySet
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <RecommendChat initialMessages={cached.messages} />
      </>
    );
  }

  // UUID branch — saved user chat (unchanged behavior)
  if (!UUID_RE.test(id)) notFound();

  const { data, error } = await getSupabaseAdmin()
    .from("sp_plans")
    .select("id,messages")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();

  return (
    <RecommendChat
      initialId={data.id as string}
      initialMessages={(data.messages ?? []) as UIMessage[]}
    />
  );
}

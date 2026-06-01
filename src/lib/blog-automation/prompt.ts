// Build the per-post user prompt. The system prompt (brand context) lives in
// brand.ts and is sent with cache_control so we don't re-pay for it every run.

import type { CalendarEntry } from "./calendar";

export function buildUserPrompt(entry: CalendarEntry): string {
  const lines = [
    `Write the next Traverse Hospitality blog draft.`,
    ``,
    `## Post specification`,
    `- Title: ${entry.title}`,
    `- Slug (must match exactly in frontmatter): ${entry.slug}`,
    `- Primary keyword: ${entry.primaryKeyword}`,
  ];

  if (entry.secondaryKeywords?.length) {
    lines.push(`- Secondary keywords: ${entry.secondaryKeywords.join(", ")}`);
  }

  lines.push(
    `- Pillar: ${entry.pillar}`,
    `- Market: ${entry.market}`,
    `- Category (frontmatter): ${entry.category}`,
    `- Target publish date: ${entry.publishDate}`,
    ``,
    `## Editorial brief`,
    entry.brief,
    ``,
    `## Process`,
    `1. Web research is NOT available to you in this call — use only the facts in the system prompt and brief. If a fact would require fresh verification (a date, price, business open/closed status), phrase it qualitatively ("typically", "most years") instead of inventing a specific number.`,
    `2. Follow the 9-step SEO framework: declarative citable sentences, primary keyword in first 100 words, H2/H3 hierarchy, ≥5 FAQ questions with 40–60 word answers, 2–5 internal links to booktraverse.com / sub-brand domains, 2–3 authoritative external links.`,
    `3. Word count: 1,400–1,800 in the body (excluding frontmatter).`,
    `4. End with a Plan-Your-Trip CTA section that links to the appropriate market page or sub-brand site.`,
    ``,
    `## Output`,
    `Return ONLY the fenced markdown block with YAML frontmatter at the top, as specified in the system prompt. No prose before or after the fence.`,
  );

  return lines.join("\n");
}

/**
 * Build the prompt for a revision pass. Takes the current draft HTML (as
 * stored in the PR's content.ts) plus Nadim's edit notes from an email
 * reply. Claude returns a full new fenced markdown block, same format as
 * the original — the caller re-validates and force-pushes.
 */
export function buildRevisionPrompt(args: {
  entry: CalendarEntry;
  currentHtml: string;
  edits: string;
}): string {
  const { entry, currentHtml, edits } = args;
  return [
    `Revise the Traverse Hospitality blog draft below based on the reviewer's edit notes.`,
    ``,
    `## Post specification (unchanged)`,
    `- Title: ${entry.title}`,
    `- Slug: ${entry.slug}`,
    `- Primary keyword: ${entry.primaryKeyword}`,
    `- Category (frontmatter): ${entry.category}`,
    `- Target publish date: ${entry.publishDate}`,
    ``,
    `## Reviewer's edit notes`,
    edits.trim(),
    ``,
    `## Current draft (rendered HTML — convert mentally back to markdown when rewriting)`,
    "```html",
    currentHtml.trim(),
    "```",
    ``,
    `## Process`,
    `- Apply the reviewer's edits precisely. Do not introduce unrelated changes — preserve sections, headings, FAQs, and CTAs that the reviewer didn't ask to change.`,
    `- Keep all original constraints: brand voice (no banned words), 1,400–1,800 word body, ≥5 FAQ questions with 40–60 word answers, H2/H3 hierarchy, 2–5 internal links, 2–3 external links.`,
    `- The slug must stay exactly "${entry.slug}".`,
    ``,
    `## Output`,
    `Return ONLY the fenced markdown block with YAML frontmatter at the top, as specified in the system prompt. No prose before or after the fence.`,
  ].join("\n");
}

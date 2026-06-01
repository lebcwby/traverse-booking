// Minimal markdown → HTML, matching the shape already used in
// src/app/blog/<slug>/content.ts (h2, h3, p, a, strong, em, ul/li, hr).
// No code blocks, no images — the blog system doesn't use them.

export interface Frontmatter {
  title: string;
  meta_description: string;
  category: string;
  tags: string[];
  slug: string;
  excerpt: string;
  author: string;
}

export interface ParsedDraft {
  frontmatter: Frontmatter;
  body: string; // markdown body, no frontmatter
}

const REQUIRED_FRONTMATTER_KEYS: (keyof Frontmatter)[] = [
  "title",
  "meta_description",
  "category",
  "tags",
  "slug",
  "excerpt",
  "author",
];

/** Strip a fenced ```...``` wrapper if Claude returned one. */
export function unwrapFence(text: string): string {
  const trimmed = text.trim();
  const m = trimmed.match(/^```(?:\w+)?\s*\n([\s\S]*?)\n```\s*$/);
  return m ? m[1] : trimmed;
}

export function parseDraft(raw: string): ParsedDraft {
  const text = unwrapFence(raw);
  const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!m) throw new Error("Draft missing YAML frontmatter");

  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (key) meta[key] = value;
  }

  for (const k of REQUIRED_FRONTMATTER_KEYS) {
    if (!meta[k]) throw new Error(`Frontmatter missing required key: ${k}`);
  }

  return {
    frontmatter: {
      title: meta.title,
      meta_description: meta.meta_description,
      category: meta.category,
      tags: meta.tags.split(",").map((t) => t.trim()).filter(Boolean),
      slug: meta.slug,
      excerpt: meta.excerpt,
      author: meta.author,
    },
    body: m[2].trim(),
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Inline: links, bold, em. Order matters — links first. */
function inline(text: string): string {
  let t = escapeHtml(text);
  t = t.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_m, label, url) => `<a href="${url}">${label}</a>`,
  );
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
  return t;
}

/**
 * Convert markdown body to HTML matching existing posts' shape. Block-level
 * only: h2, h3, p, ul/li, hr. Tables pass through as-is (rare in our drafts).
 */
export function bodyToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inUl = false;

  const flushUl = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    if (line.startsWith("### ")) {
      flushUl();
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      flushUl();
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (line === "---" || line === "***" || line === "___") {
      flushUl();
      out.push("<hr>");
    } else if (/^[-*]\s+/.test(line)) {
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`);
    } else if (line === "") {
      flushUl();
    } else if (line.startsWith("| ")) {
      // Pass through markdown tables — uncommon, but don't mangle.
      flushUl();
      out.push(line);
    } else {
      flushUl();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  flushUl();

  return out.filter(Boolean).join("\n");
}

/** Render the full content.ts module the blog route expects to import. */
export function renderContentModule(html: string): string {
  // Use a template literal and escape backticks + ${ in the content.
  const escaped = html.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
  return `export const pageContent = \`${escaped}\`;\n`;
}

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Simple markdown-to-JSX renderer for SEO content pages.
 * Handles: ## H2, ### H3, **bold**, *italic*, [links](url), lists, paragraphs.
 * Content is our own AI-generated strings (not user input), safe to parse.
 */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function parseInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const linkIdx = remaining.indexOf("[");
    const boldIdx = remaining.indexOf("**");
    const italicIdx = remaining.indexOf("*");

    const candidates: { type: string; idx: number }[] = [];
    if (linkIdx >= 0) candidates.push({ type: "link", idx: linkIdx });
    if (boldIdx >= 0) candidates.push({ type: "bold", idx: boldIdx });
    if (italicIdx >= 0 && italicIdx !== boldIdx)
      candidates.push({ type: "italic", idx: italicIdx });

    candidates.sort((a, b) => a.idx - b.idx);

    if (candidates.length === 0) {
      nodes.push(remaining);
      break;
    }

    const first = candidates[0];

    if (first.idx > 0) {
      nodes.push(remaining.slice(0, first.idx));
      remaining = remaining.slice(first.idx);
    }

    if (first.type === "link") {
      const match = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
      if (match) {
        const [full, linkText, href] = match;
        const isExternal = href.startsWith("http");
        nodes.push(
          <Link
            key={key++}
            href={href}
            className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
            {...(isExternal
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
          >
            {linkText}
          </Link>
        );
        remaining = remaining.slice(full.length);
        continue;
      }
    }

    if (first.type === "bold") {
      const match = remaining.match(/^\*\*([^*]+)\*\*/);
      if (match) {
        const [full, boldText] = match;
        nodes.push(
          <strong key={key++} className="font-semibold text-foreground">
            {boldText}
          </strong>
        );
        remaining = remaining.slice(full.length);
        continue;
      }
    }

    if (first.type === "italic" && first.idx !== boldIdx) {
      const match = remaining.match(/^\*([^*]+)\*/);
      if (match) {
        const [full, italicText] = match;
        nodes.push(<em key={key++}>{italicText}</em>);
        remaining = remaining.slice(full.length);
        continue;
      }
    }

    nodes.push(remaining[0]);
    remaining = remaining.slice(1);
  }

  return nodes;
}

export function MarkdownContent({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  const lines = content.split("\n");
  const elements: ReactNode[] = [];
  let key = 0;
  let currentParagraph: string[] = [];
  let currentList: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const text = currentParagraph.join(" ").trim();
      if (text) {
        elements.push(
          <p
            key={key++}
            className="mb-5 text-base leading-relaxed text-muted-foreground sm:text-[1.05rem] sm:leading-[1.8]"
          >
            {parseInline(text)}
          </p>
        );
      }
      currentParagraph = [];
    }
  };

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul
          key={key++}
          className="mb-5 ml-5 list-disc space-y-2 text-muted-foreground"
        >
          {currentList.map((item, i) => (
            <li key={i} className="text-base leading-relaxed sm:text-[1.05rem]">
              {parseInline(item)}
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "") {
      flushList();
      flushParagraph();
      continue;
    }

    // Images: ![alt](url)
    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      flushList();
      flushParagraph();
      const [, alt, src] = imgMatch;
      const isUnsplash = src.includes("unsplash.com");
      elements.push(
        <figure key={key++} className="my-8">
          {isUnsplash ? (
            <Image
              src={src}
              alt={alt || "Portland Oregon travel photo"}
              width={1200}
              height={675}
              className="w-full rounded-xl object-cover"
              loading="lazy"
              sizes="(max-width: 768px) 100vw, 800px"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt || "Portland Oregon travel photo"}
              className="w-full rounded-xl object-cover"
              loading="lazy"
            />
          )}
          {alt && (
            <figcaption className="mt-2 text-center text-sm text-muted-foreground">
              {alt}
            </figcaption>
          )}
        </figure>
      );
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushList();
      flushParagraph();
      const text = trimmed.slice(3);
      elements.push(
        <h2
          key={key++}
          id={slugify(text)}
          className="mt-10 mb-4 text-2xl font-bold text-foreground first:mt-0 sm:text-[1.65rem]"
        >
          {text}
        </h2>
      );
      continue;
    }

    if (trimmed.startsWith("### ")) {
      flushList();
      flushParagraph();
      const text = trimmed.slice(4);
      elements.push(
        <h3
          key={key++}
          id={slugify(text)}
          className="mt-8 mb-3 text-xl font-semibold text-foreground"
        >
          {text}
        </h3>
      );
      continue;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      flushParagraph();
      currentList.push(trimmed.slice(2));
      continue;
    }

    // Table rows (pass through as-is for now)
    if (trimmed.startsWith("|")) {
      flushList();
      flushParagraph();
      continue;
    }

    currentParagraph.push(trimmed);
  }

  flushList();
  flushParagraph();

  return <div className={className}>{elements}</div>;
}

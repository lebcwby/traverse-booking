// Orchestrator: pick the next due calendar entry, ask Claude to write it,
// validate against the brand rules, return the parsed draft + HTML. Pure
// function — no GitHub side effects here (see github.ts for that).

import Anthropic from "@anthropic-ai/sdk";
import { BRAND_CONTEXT, validateDraft, type ValidationIssue } from "./brand";
import { type CalendarEntry, pickNextDue } from "./calendar";
import { bodyToHtml, parseDraft, type ParsedDraft } from "./markdown";
import { buildRevisionPrompt, buildUserPrompt } from "./prompt";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 8192;
const MAX_ATTEMPTS = 2;

export interface GenerateResult {
  entry: CalendarEntry;
  draft: ParsedDraft;
  html: string;
  issues: ValidationIssue[];
  attempts: number;
  tokensIn: number;
  tokensOut: number;
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required");
  return new Anthropic({ apiKey });
}

async function askClaude(
  client: Anthropic,
  userPrompt: string,
  retryFeedback?: string
): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userPrompt },
  ];
  if (retryFeedback) {
    messages.push(
      { role: "assistant", content: "Understood." },
      {
        role: "user",
        content: `The previous draft failed validation:\n${retryFeedback}\n\nRewrite the full post (frontmatter + body) fixing every issue. Return only the fenced block.`,
      }
    );
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: "text",
        text: BRAND_CONTEXT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages,
  });

  const block = response.content[0];
  if (!block || block.type !== "text") {
    throw new Error("Claude returned non-text content");
  }
  return {
    text: block.text,
    tokensIn: response.usage.input_tokens,
    tokensOut: response.usage.output_tokens,
  };
}

export interface GenerateOptions {
  /** Force a specific calendar entry instead of pickNextDue(). */
  entry?: CalendarEntry;
  /** Date used by pickNextDue. Default: now. */
  today?: Date;
}

export async function generateNextPost(
  opts: GenerateOptions = {}
): Promise<GenerateResult | null> {
  const entry = opts.entry ?? pickNextDue(opts.today);
  if (!entry) return null;

  const client = getClient();
  const userPrompt = buildUserPrompt(entry);

  let lastText = "";
  let lastIssues: ValidationIssue[] = [];
  let totalIn = 0;
  let totalOut = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const feedback =
      attempt === 1
        ? undefined
        : lastIssues.map((i) => `- ${i.kind}: ${i.detail}`).join("\n");

    const { text, tokensIn, tokensOut } = await askClaude(
      client,
      userPrompt,
      feedback
    );
    totalIn += tokensIn;
    totalOut += tokensOut;
    lastText = text;

    let draft: ParsedDraft;
    try {
      draft = parseDraft(text);
    } catch (e) {
      lastIssues = [
        { kind: "missing-faq", detail: `parse error: ${(e as Error).message}` },
      ];
      continue;
    }

    if (draft.frontmatter.slug !== entry.slug) {
      lastIssues = [
        {
          kind: "missing-keyword",
          detail: `slug mismatch: got "${draft.frontmatter.slug}", expected "${entry.slug}"`,
        },
      ];
      continue;
    }

    const issues = validateDraft(draft.body, {
      primaryKeyword: entry.primaryKeyword,
    });

    if (issues.length === 0) {
      return {
        entry,
        draft,
        html: bodyToHtml(draft.body),
        issues: [],
        attempts: attempt,
        tokensIn: totalIn,
        tokensOut: totalOut,
      };
    }

    lastIssues = issues;
  }

  // Exhausted retries — return the last attempt with issues attached so the
  // human reviewer can decide. Better than 500'ing.
  const draft = parseDraft(lastText);
  return {
    entry,
    draft,
    html: bodyToHtml(draft.body),
    issues: lastIssues,
    attempts: MAX_ATTEMPTS,
    tokensIn: totalIn,
    tokensOut: totalOut,
  };
}

export type RevisionResult = GenerateResult;

/**
 * Revise an existing draft using the reviewer's edit notes. Returns a fresh
 * GenerateResult — same validation contract as generateNextPost.
 */
export async function revisePost(args: {
  entry: CalendarEntry;
  currentHtml: string;
  edits: string;
}): Promise<RevisionResult> {
  const { entry, currentHtml, edits } = args;
  const client = getClient();
  const userPrompt = buildRevisionPrompt({ entry, currentHtml, edits });

  let lastText = "";
  let lastIssues: ValidationIssue[] = [];
  let totalIn = 0;
  let totalOut = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const feedback =
      attempt === 1
        ? undefined
        : lastIssues.map((i) => `- ${i.kind}: ${i.detail}`).join("\n");

    const { text, tokensIn, tokensOut } = await askClaude(
      client,
      userPrompt,
      feedback
    );
    totalIn += tokensIn;
    totalOut += tokensOut;
    lastText = text;

    let draft: ParsedDraft;
    try {
      draft = parseDraft(text);
    } catch (e) {
      lastIssues = [
        { kind: "missing-faq", detail: `parse error: ${(e as Error).message}` },
      ];
      continue;
    }

    if (draft.frontmatter.slug !== entry.slug) {
      lastIssues = [
        {
          kind: "missing-keyword",
          detail: `slug mismatch: got "${draft.frontmatter.slug}", expected "${entry.slug}"`,
        },
      ];
      continue;
    }

    const issues = validateDraft(draft.body, {
      primaryKeyword: entry.primaryKeyword,
    });
    if (issues.length === 0) {
      return {
        entry,
        draft,
        html: bodyToHtml(draft.body),
        issues: [],
        attempts: attempt,
        tokensIn: totalIn,
        tokensOut: totalOut,
      };
    }
    lastIssues = issues;
  }

  const draft = parseDraft(lastText);
  return {
    entry,
    draft,
    html: bodyToHtml(draft.body),
    issues: lastIssues,
    attempts: MAX_ATTEMPTS,
    tokensIn: totalIn,
    tokensOut: totalOut,
  };
}

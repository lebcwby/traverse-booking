// Open a "draft post" PR using the GitHub REST API. Creates a branch from
// main, writes src/app/blog/<slug>/content.ts + an updated posts.ts with the
// new row inserted at the top of BLOG_POSTS, opens the PR.
//
// Unmerged PR == draft status. Nadim merges to publish.
//
// Requires:
//   GITHUB_TOKEN  — fine-grained PAT with Contents+PullRequests write on the repo
//   GITHUB_OWNER  — e.g. "lebcwby"
//   GITHUB_REPO   — e.g. "traverse-booking"
//   GITHUB_BASE_BRANCH (optional) — default "main"

import type { CalendarEntry } from "./calendar";
import type { ParsedDraft } from "./markdown";
import { renderContentModule } from "./markdown";

const GH_API = "https://api.github.com";

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`${name} is required for blog automation PR creation`);
  return v;
}

interface GhConfig {
  token: string;
  owner: string;
  repo: string;
  base: string;
}

function cfg(): GhConfig {
  return {
    token: env("GITHUB_TOKEN"),
    owner: env("GITHUB_OWNER"),
    repo: env("GITHUB_REPO"),
    base: env("GITHUB_BASE_BRANCH", "main"),
  };
}

async function gh<T>(
  c: GhConfig,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${GH_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${c.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub ${init.method ?? "GET"} ${path} → ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

function b64encode(s: string): string {
  // Edge + Node both have Buffer or btoa; Buffer is available in Vercel Node runtime.
  if (typeof Buffer !== "undefined") return Buffer.from(s, "utf8").toString("base64");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).btoa(unescape(encodeURIComponent(s)));
}

interface RefResponse {
  object: { sha: string };
}

interface FileGetResponse {
  sha: string;
  content: string;
  encoding: "base64";
}

interface PullResponse {
  number: number;
  html_url: string;
}

/** Insert a new BlogPost row at the top of the BLOG_POSTS array. */
export function insertPostRow(postsTsSource: string, row: string): string {
  const marker = "export const BLOG_POSTS: BlogPost[] = [";
  const idx = postsTsSource.indexOf(marker);
  if (idx === -1) throw new Error("Could not find BLOG_POSTS array marker in posts.ts");
  const insertAt = idx + marker.length;
  return postsTsSource.slice(0, insertAt) + "\n" + row + postsTsSource.slice(insertAt);
}

export function renderPostRow(
  entry: CalendarEntry,
  draft: ParsedDraft,
  imageUrl: string = "",
): string {
  const e = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return [
    "  {",
    `    slug: "${e(entry.slug)}",`,
    `    oldSlug: "${e(entry.slug)}",`,
    `    title: "${e(draft.frontmatter.title)}",`,
    `    excerpt: "${e(draft.frontmatter.excerpt)}",`,
    `    date: "${e(entry.publishDate)}",`,
    `    author: "${e(draft.frontmatter.author)}",`,
    `    category: "${e(draft.frontmatter.category)}",`,
    `    market: "${entry.market}",`,
    `    image: "${e(imageUrl)}",`,
    "  },",
  ].join("\n");
}

export interface OpenedPr {
  number: number;
  url: string;
  branch: string;
}

export interface CoverImageCommit {
  /** repo-relative path, e.g. "public/blog/my-slug.jpg" */
  repoPath: string;
  /** public url that goes on the posts.ts row, e.g. "/blog/my-slug.jpg" */
  publicUrl: string;
  /** base64 file contents */
  contentBase64: string;
}

async function putBinaryFile(
  c: GhConfig,
  branch: string,
  path: string,
  contentBase64: string,
  message: string,
): Promise<void> {
  let sha: string | undefined;
  try {
    const existing = await gh<FileGetResponse>(
      c,
      `/repos/${c.owner}/${c.repo}/contents/${encodeURIComponent(path)}?ref=${branch}`,
    );
    sha = existing.sha;
  } catch {
    // Not found — first commit.
  }
  await gh(c, `/repos/${c.owner}/${c.repo}/contents/${encodeURIComponent(path)}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: contentBase64,
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
}

export async function openDraftPr(args: {
  entry: CalendarEntry;
  draft: ParsedDraft;
  html: string;
  issues?: string[];
  coverImage?: CoverImageCommit;
}): Promise<OpenedPr> {
  const c = cfg();
  const { entry, draft, html, issues, coverImage } = args;
  const branch = `blog-draft/${entry.slug}`;

  // 1. Get base SHA
  const baseRef = await gh<RefResponse>(
    c,
    `/repos/${c.owner}/${c.repo}/git/ref/heads/${encodeURIComponent(c.base)}`,
  );
  const baseSha = baseRef.object.sha;

  // 2. Create branch (idempotent: ignore "already exists")
  try {
    await gh(c, `/repos/${c.owner}/${c.repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
    });
  } catch (e) {
    if (!/already exists/i.test((e as Error).message)) throw e;
  }

  // 3. Write content.ts (create or update — fetch SHA if it exists)
  const contentPath = `src/app/blog/${entry.slug}/content.ts`;
  const contentModule = renderContentModule(html);
  let contentSha: string | undefined;
  try {
    const existing = await gh<FileGetResponse>(
      c,
      `/repos/${c.owner}/${c.repo}/contents/${encodeURIComponent(contentPath)}?ref=${branch}`,
    );
    contentSha = existing.sha;
  } catch {
    // Not found — that's expected for new posts.
  }
  await gh(c, `/repos/${c.owner}/${c.repo}/contents/${encodeURIComponent(contentPath)}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `blog(draft): add ${entry.slug} content.ts`,
      content: b64encode(contentModule),
      branch,
      ...(contentSha ? { sha: contentSha } : {}),
    }),
  });

  // 3b. Commit the cover image binary, if we have one.
  if (coverImage) {
    await putBinaryFile(
      c,
      branch,
      coverImage.repoPath,
      coverImage.contentBase64,
      `blog(draft): add cover image for ${entry.slug}`,
    );
  }

  // 4. Update posts.ts — fetch on the branch, prepend row, commit back.
  const postsPath = "src/app/blog/posts.ts";
  const postsFile = await gh<FileGetResponse>(
    c,
    `/repos/${c.owner}/${c.repo}/contents/${encodeURIComponent(postsPath)}?ref=${branch}`,
  );
  const postsSource = Buffer.from(postsFile.content, "base64").toString("utf8");
  const row = renderPostRow(entry, draft, coverImage?.publicUrl ?? "");

  // If the slug is already in the file (re-run on same draft), skip the insert.
  let updatedSource = postsSource;
  const slugRegex = new RegExp(`slug:\\s*"${entry.slug.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}"`);
  if (!slugRegex.test(postsSource)) {
    updatedSource = insertPostRow(postsSource, row);
  }

  if (updatedSource !== postsSource) {
    await gh(c, `/repos/${c.owner}/${c.repo}/contents/${encodeURIComponent(postsPath)}`, {
      method: "PUT",
      body: JSON.stringify({
        message: `blog(draft): register ${entry.slug} in posts.ts`,
        content: b64encode(updatedSource),
        branch,
        sha: postsFile.sha,
      }),
    });
  }

  // 5. Open PR (or return existing one).
  const issuesNote =
    issues && issues.length
      ? `\n\n## Validation issues — review before merging\n${issues.map((i) => `- ${i}`).join("\n")}`
      : "";
  const prBody = [
    `Auto-generated draft for **${entry.title}**.`,
    ``,
    `- Slug: \`${entry.slug}\``,
    `- Primary keyword: ${entry.primaryKeyword}`,
    `- Pillar: ${entry.pillar}`,
    `- Scheduled publish date: ${entry.publishDate}`,
    ``,
    `Treat this PR as the draft. Review the rendered post, add a hero image to \`image: ""\` in posts.ts, then merge to publish.${issuesNote}`,
  ].join("\n");

  try {
    const pr = await gh<PullResponse>(c, `/repos/${c.owner}/${c.repo}/pulls`, {
      method: "POST",
      body: JSON.stringify({
        title: `Blog draft: ${entry.title}`,
        head: branch,
        base: c.base,
        body: prBody,
        draft: false,
      }),
    });
    return { number: pr.number, url: pr.html_url, branch };
  } catch (e) {
    const msg = (e as Error).message;
    // If a PR already exists for this branch, look it up and return it.
    if (/A pull request already exists/i.test(msg)) {
      const list = await gh<PullResponse[]>(
        c,
        `/repos/${c.owner}/${c.repo}/pulls?head=${c.owner}:${branch}&state=open`,
      );
      const existing = list[0];
      if (existing) return { number: existing.number, url: existing.html_url, branch };
    }
    throw e;
  }
}

interface PrDetail extends PullResponse {
  state: "open" | "closed";
  merged: boolean;
  head: { ref: string; sha: string };
}

/** Look up a PR by branch name. Returns null if none open. */
export async function findOpenPrByBranch(
  branch: string,
): Promise<{ number: number; url: string; sha: string } | null> {
  const c = cfg();
  const list = await gh<PrDetail[]>(
    c,
    `/repos/${c.owner}/${c.repo}/pulls?head=${c.owner}:${branch}&state=open`,
  );
  const open = list[0];
  if (!open) return null;
  return { number: open.number, url: open.html_url, sha: open.head.sha };
}

/** Squash-merge a PR. Returns the merged commit sha. */
export async function mergePullRequest(
  prNumber: number,
  commitTitle: string,
): Promise<{ merged: boolean; sha: string; htmlUrl: string }> {
  const c = cfg();
  // Refuse to merge a PR that is already closed or merged.
  const pr = await gh<PrDetail>(
    c,
    `/repos/${c.owner}/${c.repo}/pulls/${prNumber}`,
  );
  if (pr.merged) {
    return { merged: true, sha: pr.head.sha, htmlUrl: pr.html_url };
  }
  if (pr.state !== "open") {
    throw new Error(`PR #${prNumber} is ${pr.state}, cannot merge`);
  }
  const res = await gh<{ merged: boolean; sha: string }>(
    c,
    `/repos/${c.owner}/${c.repo}/pulls/${prNumber}/merge`,
    {
      method: "PUT",
      body: JSON.stringify({
        commit_title: commitTitle,
        merge_method: "squash",
      }),
    },
  );
  return { merged: res.merged, sha: res.sha, htmlUrl: pr.html_url };
}

/**
 * Overwrite the content.ts of a draft PR with revised HTML. Used by the
 * reply-watcher after Claude rewrites a draft. Idempotent — fetches the
 * current file SHA, overwrites with the new content.
 */
export async function updateDraftContent(args: {
  slug: string;
  branch: string;
  html: string;
  commitMessage: string;
}): Promise<void> {
  const c = cfg();
  const contentPath = `src/app/blog/${args.slug}/content.ts`;
  const contentModule = renderContentModule(args.html);
  const existing = await gh<FileGetResponse>(
    c,
    `/repos/${c.owner}/${c.repo}/contents/${encodeURIComponent(contentPath)}?ref=${args.branch}`,
  );
  await gh(c, `/repos/${c.owner}/${c.repo}/contents/${encodeURIComponent(contentPath)}`, {
    method: "PUT",
    body: JSON.stringify({
      message: args.commitMessage,
      content: b64encode(contentModule),
      branch: args.branch,
      sha: existing.sha,
    }),
  });
}

/**
 * Fetch the current rendered HTML out of a draft PR's content.ts. Used by
 * the reply-watcher so it can pass the current draft (not the original
 * Claude output, which we don't persist) back to Claude for revision.
 */
export async function fetchDraftContent(args: {
  slug: string;
  branch: string;
}): Promise<string> {
  const c = cfg();
  const contentPath = `src/app/blog/${args.slug}/content.ts`;
  const existing = await gh<FileGetResponse>(
    c,
    `/repos/${c.owner}/${c.repo}/contents/${encodeURIComponent(contentPath)}?ref=${args.branch}`,
  );
  const src = Buffer.from(existing.content, "base64").toString("utf8");
  // content.ts is `export const pageContent = \`...\``; pull the backtick body
  // and unescape the same characters renderContentModule escaped.
  const match = src.match(/export const pageContent = `([\s\S]*)`;?\s*$/m);
  if (!match) return src;
  return match[1]
    .replace(/\\\$\{/g, "${")
    .replace(/\\`/g, "`")
    .replace(/\\\\/g, "\\");
}

/**
 * Replace the `image: "..."` value of the BLOG_POSTS entry whose slug matches,
 * leaving every other field and post untouched. Pure + exported so it can be
 * unit-tested without hitting GitHub. Returns the source unchanged if the slug
 * (or its image field) isn't found.
 */
export function setPostImageInSource(
  source: string,
  slug: string,
  imageUrl: string,
): string {
  const escUrl = imageUrl.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const escSlug = slug.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  // Anchor on this slug, then replace the first image: "..." that follows it
  // (each BlogPost object has exactly one image field, after its slug).
  const re = new RegExp(`(slug:\\s*"${escSlug}"[\\s\\S]*?image:\\s*)"[^"]*"`);
  return re.test(source) ? source.replace(re, `$1"${escUrl}"`) : source;
}

/**
 * Commit a reviewer-supplied cover image to a draft branch and point that
 * post's `image` field at it. Used by the reply-watcher when a reviewer
 * replies to a draft with a photo attachment. Returns the public URL written
 * (or null if posts.ts couldn't be updated, e.g. slug not found).
 */
export async function updateDraftCoverImage(args: {
  slug: string;
  branch: string;
  contentBase64: string;
  ext: string;
}): Promise<string | null> {
  const c = cfg();
  const safeExt = /^(jpg|jpeg|png|webp|gif)$/i.test(args.ext)
    ? args.ext.toLowerCase()
    : "jpg";
  const repoPath = `public/blog/${args.slug}-cover.${safeExt}`;
  const publicUrl = `/blog/${args.slug}-cover.${safeExt}`;

  await putBinaryFile(
    c,
    args.branch,
    repoPath,
    args.contentBase64,
    `blog(draft): update cover image for ${args.slug}`,
  );

  const postsPath = "src/app/blog/posts.ts";
  const postsFile = await gh<FileGetResponse>(
    c,
    `/repos/${c.owner}/${c.repo}/contents/${encodeURIComponent(postsPath)}?ref=${args.branch}`,
  );
  const src = Buffer.from(postsFile.content, "base64").toString("utf8");
  const updated = setPostImageInSource(src, args.slug, publicUrl);
  if (updated === src) return null; // slug/image not found — caller decides

  await gh(c, `/repos/${c.owner}/${c.repo}/contents/${encodeURIComponent(postsPath)}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `blog(draft): set cover image for ${args.slug}`,
      content: b64encode(updated),
      branch: args.branch,
      sha: postsFile.sha,
    }),
  });
  return publicUrl;
}

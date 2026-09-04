/**
 * Swap a blog post's cover image using a local file (not from Drive).
 * By default targets the draft PR branch (blog-draft/<slug>); pass
 * --branch main to push directly to a live/published post.
 *
 * Run:
 *   # Update an open draft PR:
 *   npx tsx --env-file=.env.local scripts/swap-cover-from-file.ts <slug> <path>
 *
 *   # Update a live/published post (commits to main):
 *   npx tsx --env-file=.env.local scripts/swap-cover-from-file.ts <slug> <path> --branch main
 */
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { updateDraftCoverImage } from "../src/lib/blog-automation/github";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const [slug, imagePath] = argv;
  if (!slug || !imagePath) {
    console.error("usage: swap-cover-from-file <slug> <path> [--branch <name>]");
    process.exit(1);
  }
  let branch = `blog-draft/${slug}`;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--branch") branch = argv[++i];
  }

  const buf = readFileSync(imagePath);
  const rawExt = extname(imagePath).slice(1).toLowerCase();
  const ext = rawExt === "jpeg" ? "jpg" : (rawExt || "jpg");
  console.log(`Swapping cover for ${slug}`);
  console.log(`  source: ${imagePath} (${buf.length} bytes)`);
  console.log(`  branch: ${branch}`);
  console.log(`  ext:    ${ext}`);
  await updateDraftCoverImage({
    slug,
    branch,
    contentBase64: buf.toString("base64"),
    ext,
  });
  console.log(`✓ cover updated on ${branch}`);
  if (branch === "main") console.log("  Vercel will redeploy in ~2 min.");
}

main().catch((e) => {
  console.error("error:", e);
  process.exit(1);
});

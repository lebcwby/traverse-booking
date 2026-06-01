/**
 * One-shot script: regenerate every favicon / app-icon variant from the
 * Traverse logo sources in /public.
 *
 * Sources:
 *   - public/book-traverse-icon.png        (blue diamonds, transparent bg → light)
 *   - public/book-traverse-icon-white.png  (white diamonds, transparent bg → dark)
 *
 * Outputs (overwrites existing Stay-Portland-era PNGs):
 *   favicon-{16,32,48}x{16,32,48}.png
 *   favicon-light-{32,48}.png
 *   favicon-dark-{32,48}.png
 *   icon-{192,512}.png
 *   icon-light-{192,512}.png
 *   icon-dark-{192,512}.png
 *   icon-maskable-512.png         (navy background, 80% safe-zone)
 *   icon-maskable-dark-512.png    (white-on-navy variant)
 *   apple-touch-icon{,-light,-dark}.png   (180×180)
 *
 * Run: npx tsx scripts/regenerate-favicons.ts
 *
 * Skipped: public/favicon.ico — sharp doesn't output ICO; modern browsers
 * read the <link rel="icon"> PNG instead, and the .ico is legacy fallback.
 * If you want a multi-resolution .ico, use https://realfavicongenerator.net.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const PUBLIC = path.resolve(process.cwd(), "public");
const SRC_LIGHT = path.join(PUBLIC, "book-traverse-icon.png");
// NOTE: book-traverse-icon-white.png in /public is actually a white version
// of the LEGACY Stay-Portland P-house, not the Traverse diamonds. Until a
// white-diamonds source asset exists, use the blue diamonds for both light
// and dark variants — the blue (#3b82f6 family) has acceptable contrast on
// most dark browser chromes. To swap to a true white-on-dark icon later,
// drop a real white-diamonds PNG at SRC_DARK and re-run this script.
const SRC_DARK = SRC_LIGHT;

// Brand navy from CLAUDE.md / no-fees.css.
const NAVY = "#14142b";

interface Plan {
  out: string;
  size: number;
  src: string;
  /** Background color (defaults to transparent). Used for maskable icons
   * which require an opaque background to fill the entire safe zone. */
  background?: string;
  /** When true, the logo is composited at 80% size centered on the
   * background — Android's maskable-icon safe-zone convention. */
  maskable?: boolean;
}

const PLANS: Plan[] = [
  // Generic favicons (default = light variant since most browsers/UAs
  // render against white tabs anyway).
  { out: "favicon-16x16.png", size: 16, src: SRC_LIGHT },
  { out: "favicon-32x32.png", size: 32, src: SRC_LIGHT },
  { out: "favicon-48x48.png", size: 48, src: SRC_LIGHT },

  // Explicit light/dark variants — referenced by layout.tsx when the
  // page sets a prefers-color-scheme media query.
  { out: "favicon-light-32.png", size: 32, src: SRC_LIGHT },
  { out: "favicon-light-48.png", size: 48, src: SRC_LIGHT },
  { out: "favicon-dark-32.png", size: 32, src: SRC_DARK },
  { out: "favicon-dark-48.png", size: 48, src: SRC_DARK },

  // PWA / Android home-screen icons (manifest).
  { out: "icon-192.png", size: 192, src: SRC_LIGHT },
  { out: "icon-512.png", size: 512, src: SRC_LIGHT },
  { out: "icon-light-192.png", size: 192, src: SRC_LIGHT },
  { out: "icon-light-512.png", size: 512, src: SRC_LIGHT },
  { out: "icon-dark-192.png", size: 192, src: SRC_DARK },
  { out: "icon-dark-512.png", size: 512, src: SRC_DARK },

  // Maskable — Android adaptive icons crop edges, so the logo gets a navy
  // background and 80% safe zone. Light + dark variants share the navy
  // bg (white-on-navy and blue-on-navy both look correct).
  {
    out: "icon-maskable-512.png",
    size: 512,
    src: SRC_LIGHT,
    background: NAVY,
    maskable: true,
  },
  {
    out: "icon-maskable-dark-512.png",
    size: 512,
    src: SRC_LIGHT,
    background: NAVY,
    maskable: true,
  },

  // Apple touch icon — 180×180 is the canonical iOS size.
  { out: "apple-touch-icon.png", size: 180, src: SRC_LIGHT },
  { out: "apple-touch-icon-light.png", size: 180, src: SRC_LIGHT },
  { out: "apple-touch-icon-dark.png", size: 180, src: SRC_DARK },
];

async function generate(plan: Plan): Promise<void> {
  const outPath = path.join(PUBLIC, plan.out);
  if (plan.maskable && plan.background) {
    // Composite the logo onto a navy square at 80% size — Android's
    // recommended safe zone for maskable icons.
    const inner = Math.round(plan.size * 0.62);
    const innerBuffer = await sharp(plan.src)
      .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    await sharp({
      create: {
        width: plan.size,
        height: plan.size,
        channels: 4,
        background: plan.background,
      },
    })
      .composite([{ input: innerBuffer, gravity: "center" }])
      .png()
      .toFile(outPath);
  } else if (plan.background) {
    // Solid background, logo at full size — used for non-maskable navy
    // backgrounds if we ever want them. (Not currently in PLANS but kept
    // for future flexibility.)
    const innerBuffer = await sharp(plan.src)
      .resize(plan.size, plan.size, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    await sharp({
      create: {
        width: plan.size,
        height: plan.size,
        channels: 4,
        background: plan.background,
      },
    })
      .composite([{ input: innerBuffer, gravity: "center" }])
      .png()
      .toFile(outPath);
  } else {
    // Plain transparent-background resize — preserves the source's alpha.
    await sharp(plan.src)
      .resize(plan.size, plan.size, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(outPath);
  }
  const stats = await fs.stat(outPath);
  console.log(
    `  ✓ ${plan.out.padEnd(34)} ${plan.size}×${plan.size}  ${(stats.size / 1024).toFixed(1)}kb`
  );
}

async function main() {
  console.log("🎨 Regenerating favicons from Traverse logo sources\n");
  for (const plan of PLANS) {
    await generate(plan);
  }
  console.log(`\n✅ ${PLANS.length} icons written to ${path.relative(process.cwd(), PUBLIC)}/`);
  console.log("\nNote: public/favicon.ico is NOT regenerated (sharp can't output ICO).");
  console.log("Modern browsers use the PNG <link rel='icon'> tags. To refresh");
  console.log(".ico, run the source through https://realfavicongenerator.net.");
}

main().catch((e) => {
  console.error("\n❌ Failed:", e);
  process.exit(1);
});

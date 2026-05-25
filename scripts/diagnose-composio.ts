/**
 * Diagnose Composio connectivity. Lists which toolkits are connected to
 * your account, so we know whether the "Error executing the tool" failures
 * are caused by (a) no connection at all or (b) wrong arguments.
 *
 * Run: npx tsx --env-file=.env.local scripts/diagnose-composio.ts
 */

import { getComposio } from "../src/lib/blog-automation/composio";

async function main(): Promise<void> {
  const c = getComposio();

  console.log("\n── Connected accounts ──\n");
  try {
    const list = await c.connectedAccounts.list({ limit: 50 });
    // SDK shape varies; coerce to a printable form.
    const rows =
      (list as unknown as { items?: Array<Record<string, unknown>> }).items ??
      (list as unknown as Array<Record<string, unknown>>) ??
      [];
    if (Array.isArray(rows) && rows.length > 0) {
      for (const r of rows) {
        const toolkit =
          (r.toolkit as { slug?: string } | string | undefined) ??
          (r as { appName?: string }).appName ??
          "?";
        const slug =
          typeof toolkit === "string"
            ? toolkit
            : (toolkit?.slug ?? JSON.stringify(toolkit));
        const status = r.status ?? "?";
        const userId =
          (r.userId as string | undefined) ??
          (r as { user_id?: string }).user_id ??
          "?";
        const id = r.id ?? "?";
        console.log(
          `  ${slug.toString().padEnd(20)} status=${status}  userId=${userId}  id=${id}`,
        );
      }
    } else {
      console.log("  (none) — you have no linked accounts yet.");
    }
    console.log(`\n  Total: ${Array.isArray(rows) ? rows.length : "?"}`);
  } catch (e) {
    console.log(`  ERROR listing accounts: ${(e as Error).message}`);
  }

  console.log("\n── If gmail or googledrive is missing ──");
  console.log("  Run these to link them (one-time, opens browser):");
  console.log("    composio add gmail        # sign in as marketing@traversehospitality.com");
  console.log("    composio add googledrive  # sign in as folder owner");
  console.log("  Then re-run this diagnostic.\n");
}

main().catch((e) => {
  console.error("Unexpected:", e);
  process.exit(1);
});

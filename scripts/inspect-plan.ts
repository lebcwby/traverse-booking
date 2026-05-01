import { Client } from "pg";

async function main() {
  const c = new Client({ connectionString: process.env.SHARED_DATABASE_URL });
  await c.connect();
  const planId = process.argv[2] ?? "e948d520-0429-4b5f-88b8-88679c677a52";
  const { rows } = await c.query(
    "SELECT id, cache_key, messages, created_at FROM sp_plans WHERE id = $1",
    [planId]
  );
  if (rows.length === 0) {
    console.log("not found");
    await c.end();
    return;
  }
  const row = rows[0];
  console.log("cache_key:", row.cache_key);
  console.log("created_at:", row.created_at);
  const messages = row.messages as Array<{ role: string; parts: unknown[] }>;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]!;
    console.log(`\n--- msg[${i}] role=${m.role} parts=${m.parts?.length ?? 0}`);
    for (const p of m.parts ?? []) {
      const part = p as { type?: string; text?: string };
      if (part.type === "text" && part.text) {
        console.log(`  [text] ${part.text.slice(0, 300)}`);
        continue;
      }
      console.log(`  part.type=${part.type}`);
      if (part.type?.startsWith("tool-")) {
        const tp = p as {
          type: string;
          state?: string;
          output?: unknown;
          input?: unknown;
        };
        console.log(`    state=${tp.state}`);
        if (tp.type === "tool-generate_itinerary" && tp.output) {
          const out = tp.output as {
            itinerary?: {
              days?: Array<{
                dayNumber: number;
                label: string;
                items: Array<{
                  poiId: string;
                  timeSlot: string;
                  durationMinutes?: number;
                }>;
              }>;
            };
          };
          const days = out.itinerary?.days ?? [];
          for (const day of days) {
            const total = day.items.reduce(
              (s, it) => s + (it.durationMinutes ?? 0),
              0
            );
            console.log(
              `    Day ${day.dayNumber}: ${day.items.length} items, ${total} min (${(total / 60).toFixed(1)} hrs) — ${day.label}`
            );
            for (const item of day.items) {
              const dur = item.durationMinutes
                ? `${item.durationMinutes}m`
                : "NO DURATION";
              console.log(
                `      [${item.timeSlot.padEnd(9)}] ${dur.padEnd(15)} ${item.poiId}`
              );
            }
          }
        }
      }
    }
  }
  await c.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

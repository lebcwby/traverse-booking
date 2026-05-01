const { Pool } = require("pg");

// Guesty Open API limits: 15 req/s, 120 req/min, 5,000 req/hr
// We target ~60 req/min (1 req/s) to stay well within limits
const REQUEST_DELAY_MS = 1000;
const RETRY_AFTER_DEFAULT_MS = 60_000; // 1 min if no Retry-After header

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  // Get unique guest IDs missing email
  const res = await pool.query(
    "SELECT DISTINCT guest_id FROM reservations WHERE guest->>'email' IS NULL AND guest_id IS NOT NULL"
  );
  console.log("Guests needing email:", res.rows.length);

  if (res.rows.length === 0) {
    console.log("All guests already have emails. Nothing to do.");
    pool.end();
    return;
  }

  // Get cached Guesty token (never request a new one from this script)
  const tokenRes = await pool.query(
    "SELECT access_token, expires_at FROM guesty_tokens WHERE token_type = 'openapi'"
  );
  if (!tokenRes.rows.length) {
    console.error(
      "No cached Guesty token found. Run the sync edge function first to populate it."
    );
    pool.end();
    process.exit(1);
  }

  const { access_token: token, expires_at } = tokenRes.rows[0];
  const tokenExpiresIn = Math.round((expires_at - Date.now()) / 60000);
  if (tokenExpiresIn < 30) {
    console.warn(`Warning: Token expires in ${tokenExpiresIn} minutes`);
  }
  console.log(`Using cached token (expires in ${tokenExpiresIn} min)`);

  let enriched = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of res.rows) {
    try {
      const resp = await fetch(
        "https://open-api.guesty.com/v1/guests-crud/" + row.guest_id,
        {
          headers: {
            Authorization: "Bearer " + token,
            Accept: "application/json",
          },
        }
      );

      // Check remaining rate limit from response headers
      const remainingMin = resp.headers.get("x-ratelimit-remaining-minute");
      const remainingSec = resp.headers.get("x-ratelimit-remaining-second");
      if (remainingMin !== null && parseInt(remainingMin) < 10) {
        console.log(
          `  Rate limit warning: ${remainingMin} req/min remaining — pausing 30s`
        );
        await new Promise((r) => setTimeout(r, 30_000));
      }

      if (resp.status === 429) {
        const retryAfter = resp.headers.get("retry-after");
        const waitMs = retryAfter
          ? parseInt(retryAfter) * 1000
          : RETRY_AFTER_DEFAULT_MS;
        console.log(
          `Rate limited (429). Waiting ${waitMs / 1000}s then continuing...`
        );
        await new Promise((r) => setTimeout(r, waitMs));
        // Retry this same guest
        continue;
      }

      if (resp.status === 401 || resp.status === 403) {
        console.error(
          "Token expired or invalid. Re-run after sync refreshes the token."
        );
        break;
      }

      if (!resp.ok) {
        console.warn(`  Guest ${row.guest_id}: HTTP ${resp.status} — skipping`);
        errors++;
        continue;
      }

      const guest = await resp.json();
      if (guest.email) {
        await pool.query(
          `UPDATE reservations
           SET guest = guest || jsonb_build_object('email', $1::text, 'firstName', $2::text, 'lastName', $3::text, 'phone', $4::text)
           WHERE guest_id = $5`,
          [
            guest.email,
            guest.firstName || null,
            guest.lastName || null,
            guest.phone || null,
            row.guest_id,
          ]
        );
        enriched++;
        if (enriched % 20 === 0)
          console.log(`  enriched ${enriched}/${res.rows.length}...`);
      } else {
        skipped++;
      }

      // Steady pace: 1 request per second (60/min, half the 120/min limit)
      await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
    } catch (e) {
      console.error("Error enriching guest", row.guest_id, e.message);
      errors++;
    }
  }

  console.log(
    `Done. Enriched: ${enriched}, Skipped (no email): ${skipped}, Errors: ${errors}`
  );

  // Verify
  const check = await pool.query(
    "SELECT count(*) as total, count(CASE WHEN guest->>'email' IS NOT NULL THEN 1 END) as with_email FROM reservations"
  );
  console.log("Verification:", check.rows[0]);

  pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

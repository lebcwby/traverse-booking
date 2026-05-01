const { Pool } = require("pg");

const FIELDS = [
  "status",
  "source",
  "secondarySource",
  "money",
  "guestsCount",
  "nightsCount",
  "guest",
  "confirmationCode",
  "listingId",
  "guestId",
  "checkIn",
  "checkOut",
  "checkInDateLocalized",
  "checkOutDateLocalized",
  "keyCode",
  "isReturningGuest",
  "notes",
  "specialRequests",
  "plannedArrival",
  "plannedDeparture",
  "numberOfGuests",
  "integration",
  "review",
  "confirmedAt",
  "createdAt",
  "updatedAt",
].join(" ");

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const tokenRes = await pool.query(
    "SELECT access_token FROM guesty_tokens WHERE token_type = 'openapi'"
  );
  const token = tokenRes.rows[0].access_token;

  const filter = JSON.stringify([
    { field: "source", operator: "$eq", value: "website" },
  ]);

  let skip = 0;
  let total = 0;
  let hasMore = true;

  while (hasMore) {
    const url =
      "https://open-api.guesty.com/v1/reservations?limit=100&skip=" +
      skip +
      "&sort=_id&fields=" +
      encodeURIComponent(FIELDS) +
      "&filters=" +
      encodeURIComponent(filter);

    const resp = await fetch(url, {
      headers: { Authorization: "Bearer " + token, Accept: "application/json" },
    });

    if (resp.status === 429) {
      console.log("Rate limited, stopping");
      break;
    }
    if (!resp.ok) {
      console.error("Error:", resp.status, await resp.text());
      break;
    }

    const data = await resp.json();
    const results = data.results || [];

    for (const res of results) {
      const guest = res.guest || {};
      const money = res.money || null;
      await pool.query(
        `UPDATE reservations SET
          status = $1, source = $2, secondary_source = $3,
          guests_count = $4, nights_count = $5, key_code = $6,
          guest = COALESCE(guest, '{}'::jsonb) || $7::jsonb,
          money = $8::jsonb,
          is_returning_guest = $9,
          guesty_created_at = $10, guesty_updated_at = $11
        WHERE guesty_id = $12`,
        [
          res.status || null,
          res.source || null,
          res.secondarySource || null,
          res.guestsCount || null,
          res.nightsCount || null,
          res.keyCode || null,
          JSON.stringify({
            email: guest.email || null,
            firstName: guest.firstName || null,
            lastName: guest.lastName || null,
            fullName: guest.fullName || null,
            phone: guest.phone || null,
          }),
          money ? JSON.stringify(money) : null,
          res.isReturningGuest || false,
          res.createdAt || null,
          res.updatedAt || null,
          res._id,
        ]
      );
    }

    total += results.length;
    console.log("Synced page, total so far:", total);
    hasMore = results.length === 100;
    skip += 100;
    if (hasMore) await new Promise((r) => setTimeout(r, 1000));
  }

  const check = await pool.query(
    "SELECT count(*) as total, count(CASE WHEN status IS NOT NULL THEN 1 END) as with_status, count(CASE WHEN guest->>'email' IS NOT NULL THEN 1 END) as with_email FROM reservations"
  );
  console.log("Done. Verification:", check.rows[0]);
  pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

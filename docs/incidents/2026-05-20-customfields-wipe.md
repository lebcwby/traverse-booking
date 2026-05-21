# 2026-05-20 — customFields wipe on ~185 Guesty listings

**Status:** OPEN — Guesty support contacted; awaiting restoration from backup.

**Severity:** HIGH — production data loss on ~185 listings' customFields (welcome
messages, Google review links, phone numbers, unit numbers, door codes, etc.).
The "Book Direct Link" field itself was correctly updated. Site is unaffected
(this is a Guesty-side data issue only — booktraverse.com still works).

## What happened

At approximately **15:30 MT on 2026-05-20**, the admin endpoint
`/api/admin/sync-urls-to-guesty?fieldId=68dd93d0a549970030833297&dryRun=false`
was run to push canonical booktraverse.com URLs into each listing's
"Book Direct Link" custom field.

The endpoint used `PUT /v1/listings/{id}` with body:
```json
{ "customFields": [{ "fieldId": "...", "value": "..." }] }
```

**Assumption (wrong):** Guesty's PUT treats `customFields` as a partial upsert.

**Reality:** Guesty's PUT **replaces the entire `customFields` array**. By
sending only one entry, we removed all other customFields on each listing
we PUT'd.

## Evidence

Field-count diff from `list-fields` before/after the sync:

| Custom Field | Before | After | Delta |
|---|---|---|---|
| Book Direct Link (68dd93d0a549970030833297) | 194 | 280 | +86 (intended) |
| Welcome message (5b3a3a657921d60024779480) | 221 | 120 | **−101** |
| Google review link (62b0c108e8c24700300bd164) | 211 | 101 | **−110** |
| Phone (68cae2d9a63cdc00100083f9) | 193 | 88 | **−105** |
| High Rocky Homes contact (5bdef7d1ee2415003a65cc78) | 162 | 80 | **−82** |
| Unit number (617842ee6ae064002f54d683) | 185 | 78 | **−107** |
| $ field (68fa6534a5ff3400138c4482) | 176 | 77 | **−99** |
| Unit description (68ddd303d0a8c80029b9b163) | 89 | 51 | **−38** |
| Front desk phone (6029735ef967e5002cbcd941) | 81 | 41 | **−40** |
| Door codes (69338be4ece0490010fcf45c) | 57 | 34 | **−23** |
| Pet-friendly note (68cae9de7b4602001c2b6436) | 56 | 16 | **−40** |
| Internal ref (5c7e93cc41d51a001f6ced58) | 53 | 20 | **−33** |
| Owner family bios (6452a935bc4eab004bc665e7) | 21 | 7 | **−14** |
| Expedia pet fee note (690b860c9470e100132b641b) | 17 | 6 | **−11** |

The drop pattern is consistent with the ~185 listings successfully PUT'd
(the other 176 errored on 429 rate limits and were never written to —
their customFields remain intact).

## Recovery

**Step 1 (in progress): Guesty support ticket** — sent 2026-05-20.

Request: restore `customFields` array on the affected listings from a
backup taken BEFORE 15:30 MT on 2026-05-20. Preserve any value currently in
the Book Direct Link field (those are the new correct URLs).

Account ID: `55935b4b5d6bcf0e0084abd6`

Affected listings: see `affected-listings.csv` in this directory.

**Step 2: Verify restoration** — once Guesty restores, re-run the admin
endpoint with `action=list-fields` and confirm the per-field counts return
to pre-sync values.

**Step 3: Patch the sync code** (see below) before any further runs.

## Code patch required before re-running

The fix is read-modify-write semantics. Pseudocode:

```ts
async function patchListingCustomField(token, listingId, fieldId, value) {
  // 1. GET the current listing
  const current = await getOpenAPIReservation(listingId);
  const existing = current.customFields || [];
  
  // 2. Merge: replace the entry matching fieldId, preserve all others
  const others = existing.filter(cf => (cf.fieldId ?? cf._id) !== fieldId);
  const merged = [...others, { fieldId, value }];
  
  // 3. PUT the full merged array
  await fetch(`https://open-api.guesty.com/v1/listings/${listingId}`, {
    method: "PUT",
    body: JSON.stringify({ customFields: merged }),
    ...
  });
}
```

Update site: `src/app/api/admin/sync-urls-to-guesty/route.ts`,
`patchListingCustomField` function.

## Lessons

1. **For any array field in any third-party API, default to read-modify-write
   unless docs explicitly confirm partial-merge semantics.** Don't trust
   that PUT means "partial update" — for object fields it often does, for
   array fields it usually means "replace the whole array."
2. **Smoke-test on ONE listing first** AND inspect not just the target field
   but adjacent state on that listing before doing a batch run.
3. **Idempotent retry is good; read-before-write is better.** The
   `skip-already-correct` short-circuit prevented us from re-corrupting on
   the 5 listings already pointing at booktraverse.com, but that didn't
   help the 185 first-time writes.

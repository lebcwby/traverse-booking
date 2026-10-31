/**
 * Yesterday's guest reviews, summarised for the daily Slack digest.
 *
 * ── Where the data comes from ───────────────────────────────────────────
 *
 * The `reviews` table, filled by `/api/cron/sync-reviews` (`0 8 * * *`) from
 * Guesty. The digest runs at 08:35 UTC, so the sync has already landed and a
 * Mountain-time "yesterday" closed at 06:00/07:00 UTC — the day is complete by
 * the time we read it. Change either schedule and check that still holds.
 *
 * ⚠️ These are **portfolio-wide**, every channel. The bookings half of the
 * digest is website-only; this half is not, and cannot be — a guest reviews
 * the stay, not the channel they booked through.
 *
 * ── Two rating scales in one column ─────────────────────────────────────
 *
 * `overall_rating` is 1–5 for Airbnb but VRBO occasionally writes its 10-point
 * scale into the same column (2 of 2,261 rows when this was written). A raw
 * threshold would read a 10/10 as a catastrophe, so anything above 5 is halved
 * before comparison. The CRM hit the same trap with Booking.com — see memory
 * `project_traverse_crm_reviews`.
 *
 * ── What counts as a red flag ───────────────────────────────────────────
 *
 * Two rules, because the obvious one alone misses most of them:
 *
 *   1. Overall ≤ 3.
 *   2. Overall 4–5 but **some category** ≤ 3.
 *
 * Rule 2 is the one that earns its place. Over the 30 days to 2026-10-30 there
 * were 326 reviews: rule 1 caught 2, rule 2 caught 15. A guest who writes
 * "fabulous location and amenities, we had a lovely time!" and quietly scores
 * cleanliness 3 is telling us something a 5-star average buries, and check-in
 * was the single most common low category — OSV201 twice in three weeks.
 *
 * Together they fire roughly 0.6 times a day. Rare enough that seeing one
 * means something; common enough to be worth a daily look.
 */
import { getPool } from "./db";

/** Ratings at or below this, on a 5-point scale, are worth someone's attention. */
export const RED_FLAG_AT_OR_BELOW = 3;

/** Flags shown in full before the message collapses the rest to a count. */
const MAX_FLAGS_RENDERED = 5;

/** Review-text snippet length. Long enough to place the complaint, short
 *  enough that five of them don't push the message past Slack's block cap. */
const SNIPPET_CHARS = 160;

export interface ReviewRow {
  guesty_id: string | null;
  channel: string | null;
  overall_rating: number | null;
  public_review: string | null;
  reviewer_name: string | null;
  review_date: string | null;
  listing_nickname: string | null;
  listing_id: string | null;
  category_cleanliness: number | null;
  category_accuracy: number | null;
  category_checkin: number | null;
  category_communication: number | null;
  category_location: number | null;
  category_value: number | null;
}

export interface ReviewFlag {
  listing: string;
  channel: string;
  /** Normalised to the 5-point scale. Null when the channel sent no overall. */
  rating: number | null;
  /** Category names scoring at or below the threshold, worst first. */
  lowCategories: Array<{ name: string; score: number }>;
  snippet: string | null;
  reviewerName: string | null;
}

export interface ReviewSummary {
  day: string;
  total: number;
  /** Mean of the normalised overall ratings, or null when none carried one. */
  averageRating: number | null;
  byChannel: Array<{ channel: string; count: number; average: number | null }>;
  flags: ReviewFlag[];
}

/** VRBO sometimes writes its 10-point score into a 5-point column. */
export function normalizeRating(raw: number | null): number | null {
  if (raw === null || !Number.isFinite(raw)) return null;
  return raw > 5 ? raw / 2 : raw;
}

const CATEGORY_LABELS: Array<[keyof ReviewRow, string]> = [
  ["category_cleanliness", "cleanliness"],
  ["category_accuracy", "accuracy"],
  ["category_checkin", "check-in"],
  ["category_communication", "communication"],
  ["category_location", "location"],
  ["category_value", "value"],
];

function lowCategoriesFor(row: ReviewRow): ReviewFlag["lowCategories"] {
  return CATEGORY_LABELS.flatMap(([key, name]) => {
    // Categories share the overall column's scale problem, so normalise the
    // same way rather than assuming every channel sends 1–5 here.
    const score = normalizeRating(row[key] as number | null);
    return score !== null && score <= RED_FLAG_AT_OR_BELOW
      ? [{ name, score }]
      : [];
  }).sort((a, b) => a.score - b.score);
}

/**
 * Phrases that tend to introduce the complaint in an otherwise warm review.
 *
 * "no" earns its place — "there is no light for you to see the key access" is
 * exactly the sentence worth surfacing — but it is excluded in front of
 * issues/problems/complaints, where it means the opposite.
 */
const COMPLAINT_CUE =
  /\b(but|however|unfortunately|only issue|issue|problem|broken|dirty|disappointed|wasn'?t|was not|didn'?t|did not|couldn'?t|could not|needs?|lacking|wish|no(?! (issues|problems|complaints)))\b/i;

function truncate(text: string): string {
  return text.length > SNIPPET_CHARS
    ? `${text.slice(0, SNIPPET_CHARS).trimEnd()}…`
    : text;
}

/**
 * The part of a review worth reading.
 *
 * For a flagged review the first 160 characters are usually the wrong 160:
 * guests open warmly and bury the problem in the middle. A real example —
 * OSV201, check-in 2 — opens "Bedrooms were cozy and comfortable!" and only
 * reaches "there is no light for you to see the key access… we were soaked"
 * four sentences in. Leading with the praise and cutting before the complaint
 * is worse than useless on a line whose whole purpose is the complaint.
 *
 * So when the review is flagged, prefer the first sentence carrying a
 * complaint cue. Cues are English only; a non-English review falls back to
 * the opening, which is the same behaviour as before.
 */
export function excerptReview(
  text: string | null,
  preferComplaint: boolean
): string | null {
  // VRBO sends "0" for an empty body and Airbnb sends "". Neither is a review,
  // and printing either makes a flag look like it has context when it has none.
  const trimmed = (text ?? "").trim();
  if (!trimmed || trimmed === "0") return null;
  const collapsed = trimmed.replace(/\s+/g, " ");

  if (preferComplaint) {
    // Split on sentence ends, keeping the punctuation with its sentence.
    const sentences = collapsed.match(/[^.!?…]+[.!?…]*\s*/g) ?? [collapsed];
    const hit = sentences.find((s) => COMPLAINT_CUE.test(s));
    if (hit) {
      const cleaned = hit.trim();
      // A very short hit ("But wow!") reads as a non-sequitur on its own, so
      // carry the following sentence along when there is room.
      if (cleaned.length < 60) {
        const next = sentences[sentences.indexOf(hit) + 1]?.trim() ?? "";
        return truncate(next ? `${cleaned} ${next}` : cleaned);
      }
      return truncate(cleaned);
    }
  }

  return truncate(collapsed);
}

export function buildReviewSummary(
  rows: ReviewRow[],
  day: string
): ReviewSummary {
  const rated: number[] = [];
  const grouped = new Map<string, { count: number; sum: number; n: number }>();
  const flags: ReviewFlag[] = [];

  for (const row of rows) {
    const rating = normalizeRating(row.overall_rating);
    if (rating !== null) rated.push(rating);

    const channel = row.channel || "(unknown)";
    const g = grouped.get(channel) ?? { count: 0, sum: 0, n: 0 };
    g.count += 1;
    if (rating !== null) {
      g.sum += rating;
      g.n += 1;
    }
    grouped.set(channel, g);

    const lowCategories = lowCategoriesFor(row);
    const lowOverall = rating !== null && rating <= RED_FLAG_AT_OR_BELOW;
    if (lowOverall || lowCategories.length > 0) {
      flags.push({
        listing: row.listing_nickname || row.listing_id || "(unknown listing)",
        channel,
        rating,
        lowCategories,
        // Every review reaching this branch is flagged, so always hunt for
        // the complaint rather than quoting the opening pleasantry.
        snippet: excerptReview(row.public_review, true),
        reviewerName: row.reviewer_name,
      });
    }
  }

  const mean = (xs: number[]) =>
    xs.length === 0
      ? null
      : Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 100) / 100;

  return {
    day,
    total: rows.length,
    averageRating: mean(rated),
    byChannel: [...grouped.entries()]
      .map(([channel, g]) => ({
        channel,
        count: g.count,
        average: g.n === 0 ? null : Math.round((g.sum / g.n) * 100) / 100,
      }))
      .sort((a, b) => b.count - a.count || a.channel.localeCompare(b.channel)),
    // Worst first, and a missing overall sorts last rather than winning the
    // comparison against a number.
    flags: flags.sort(
      (a, b) => (a.rating ?? Infinity) - (b.rating ?? Infinity)
    ),
  };
}

const stars = (r: number | null) => (r === null ? "no rating" : `${r}★`);

/**
 * Slack blocks for the reviews half of the digest.
 *
 * Returns a section even when there is nothing wrong: "12 reviews · 4.9★ · no
 * red flags" is information. Rendering nothing would leave the reader unable
 * to tell a clean day from a broken sync.
 */
export function renderReviewBlocks(
  s: ReviewSummary
): Record<string, unknown>[] {
  if (s.total === 0) {
    return [
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Reviews — ${s.day}*\nNo new reviews.` },
      },
    ];
  }

  const channelLine = s.byChannel
    .map((c) => `${c.channel} ${c.count}${c.average === null ? "" : ` · ${c.average}★`}`)
    .join("  ·  ");

  const headline =
    `*Reviews — ${s.day}*\n` +
    `${s.total} review${s.total === 1 ? "" : "s"}` +
    `${s.averageRating === null ? "" : ` · ${s.averageRating}★ average`}` +
    `\n${channelLine}`;

  const blocks: Record<string, unknown>[] = [
    { type: "section", text: { type: "mrkdwn", text: headline } },
  ];

  if (s.flags.length === 0) {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: "✅ No red flags." }],
    });
    return blocks;
  }

  const shown = s.flags.slice(0, MAX_FLAGS_RENDERED);
  const flagLines = shown.map((f) => {
    const lows = f.lowCategories
      .map((c) => `${c.name} ${c.score}`)
      .join(", ");
    const head =
      `• *${f.listing}* — ${stars(f.rating)} on ${f.channel}` +
      `${lows ? ` _(${lows})_` : ""}`;
    return f.snippet ? `${head}\n   “${f.snippet}”` : head;
  });

  const hidden = s.flags.length - shown.length;
  if (hidden > 0) {
    flagLines.push(`• _…and ${hidden} more flagged review${hidden === 1 ? "" : "s"}._`);
  }

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text:
        `🚩 *${s.flags.length} to look at*\n` + flagLines.join("\n"),
    },
  });

  return blocks;
}

/**
 * Reviews whose `review_date` falls in one civil day.
 *
 * `review_date` is a TEXT column holding an ISO instant, so it is cast rather
 * than compared as text — a string comparison would work for same-format rows
 * and quietly fail for the VRBO rows, which carry no milliseconds.
 *
 * LEFT JOIN so a review on a listing that has left the mirror still appears;
 * it falls back to the raw listing id rather than vanishing.
 */
export async function fetchReviewsForDay(
  dayStartIso: string,
  dayEndIso: string
): Promise<ReviewRow[]> {
  const { rows } = await getPool().query(
    `select r.guesty_id, r.channel, r.overall_rating, r.public_review,
            r.reviewer_name, r.review_date, r.listing_id,
            r.category_cleanliness, r.category_accuracy, r.category_checkin,
            r.category_communication, r.category_location, r.category_value,
            l.nickname as listing_nickname
       from reviews r
       left join listings l on l.guesty_id = r.listing_id
      where r.review_date::timestamptz >= $1::timestamptz
        and r.review_date::timestamptz <  $2::timestamptz
      order by r.review_date asc`,
    [dayStartIso, dayEndIso]
  );
  return rows as ReviewRow[];
}

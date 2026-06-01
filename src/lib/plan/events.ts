// src/lib/plan/events.ts
// Date-aware event queries against sp_events.
//
// Used by the plan agent's preload step to surface "happening during your stay"
// events when the guest's check-in/check-out window overlaps a known annual
// event (Leadville Trail 100, Crested Butte Wildflower Festival, etc.).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazy supabase client. Reading env vars at module top-level breaks Next's
// route-preflight pass during `next build` when the vars aren't present in
// shell (CI without .env, fresh clone, etc.). Same pattern as
// getSupabaseAdmin() in src/lib/supabase-admin.ts.
let _client: SupabaseClient | null = null;
function getSupabaseForEvents(): SupabaseClient | null {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key);
  return _client;
}

export type Town =
  | "Crested Butte"
  | "Leadville"
  | "Twin Lakes"
  | "Vail"
  | "Avon"
  | "Granby";

export type EventCategory =
  | "festival"
  | "race"
  | "music"
  | "nature"
  | "culture"
  | "seasonal"
  | "sport";

export type DateKind = "fixed" | "recurring";

export interface PlanEvent {
  id: string;
  name: string;
  town: Town;
  blurb: string;
  category: EventCategory;
  dateKind: DateKind;
  startDate: string | null; // ISO date 'YYYY-MM-DD' for fixed-date events
  endDate: string | null;
  recurringRuleText: string | null; // human-readable rule for recurring events
  officialUrl: string | null;
  poiId: string | null;
}

interface EventRow {
  id: string;
  name: string;
  town: string;
  blurb: string;
  category: EventCategory;
  date_kind: DateKind;
  start_date: string | null;
  end_date: string | null;
  recurring_rule_text: string | null;
  official_url: string | null;
  poi_id: string | null;
}

function rowToEvent(row: EventRow): PlanEvent {
  return {
    id: row.id,
    name: row.name,
    town: row.town as Town,
    blurb: row.blurb,
    category: row.category,
    dateKind: row.date_kind,
    startDate: row.start_date,
    endDate: row.end_date,
    recurringRuleText: row.recurring_rule_text,
    officialUrl: row.official_url,
    poiId: row.poi_id,
  };
}

/**
 * Returns events that overlap the given check-in/check-out window for the
 * specified town(s). Includes both fixed-date events (where the actual 2026
 * dates intersect) and recurring events (always returned — agent decides
 * whether the recurring rule plausibly fits the window).
 *
 * Dates are inclusive on both ends.
 */
export async function getEventsForStay(opts: {
  town: Town | Town[];
  checkIn: string; // 'YYYY-MM-DD'
  checkOut: string; // 'YYYY-MM-DD'
}): Promise<PlanEvent[]> {
  const supabase = getSupabaseForEvents();
  if (!supabase) return [];

  const towns = Array.isArray(opts.town) ? opts.town : [opts.town];

  // Pull all active events in the requested towns, then filter in JS so we
  // can apply the recurring-vs-fixed logic without a Postgres OR clause.
  const { data, error } = await supabase
    .from("sp_events")
    .select(
      "id, name, town, blurb, category, date_kind, start_date, end_date, recurring_rule_text, official_url, poi_id"
    )
    .in("town", towns)
    .eq("status", "active");

  if (error || !data) return [];

  const events = (data as EventRow[]).map(rowToEvent);

  return events.filter((e) => {
    if (e.dateKind === "recurring") {
      // Always include recurring events — the agent has the rule text and
      // can decide whether to surface it. Cheap to include; high signal.
      return true;
    }
    if (!e.startDate || !e.endDate) return false;
    // Overlap test: event range and stay range share at least one day.
    return e.startDate <= opts.checkOut && e.endDate >= opts.checkIn;
  });
}

/**
 * Compact representation for inclusion in the agent's preload system block.
 * Each line: [date or rule] · [name] · [blurb]
 */
export function formatEventsForAgent(events: PlanEvent[]): string {
  if (events.length === 0) return "(no overlapping events)";
  return events
    .map((e) => {
      const dates =
        e.dateKind === "fixed" && e.startDate
          ? e.startDate === e.endDate
            ? e.startDate
            : `${e.startDate}..${e.endDate}`
          : (e.recurringRuleText ?? "annual");
      return `[${dates}] ${e.name} (${e.town}) — ${e.blurb}`;
    })
    .join("\n");
}

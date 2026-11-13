-- Payment-recording tracking columns
--
-- `payment_target_cents`        — total we must record in Guesty for this
--                                 reservation. Set at INSERT from the Stripe
--                                 captured amount (single-flow) or the line's
--                                 host payout (cart).
-- `payment_recorded_cents`      — running total of what has been successfully
--                                 recorded in Guesty across all top-up
--                                 attempts. Advanced only by the Postgres
--                                 CAS protocol in the writers.
-- `payment_target_cents_set_at` — epoch millis of the moment the target was
--                                 first set on this row. Preserved across
--                                 ON CONFLICT DO UPDATE via COALESCE so the
--                                 30-day retry anchor never shifts.
--
-- Historical rows get NULL / 0 / NULL and are deliberately excluded from the
-- new top-up cron query. The pre-existing `payment_recorded_at` stamp is
-- unchanged in semantics; it is still what everything else keys off of.
alter table "public"."reservations"
  add column if not exists "payment_target_cents"        integer,
  add column if not exists "payment_recorded_cents"      integer not null default 0,
  add column if not exists "payment_target_cents_set_at" bigint;

-- Hot path for the top-up cron: only rows that still owe money to Guesty.
create index if not exists "reservations_payment_shortfall_idx"
  on "public"."reservations" ("payment_target_cents_set_at")
  where "payment_target_cents" is not null
    and "payment_recorded_cents" < "payment_target_cents";

-- Invariant: a row's recorded total can never exceed its target. The
-- application-level CAS in the writers enforces this at write time; this is
-- the last-ditch backstop if a future writer forgets to guard the UPDATE.
-- NOT VALID so the ALTER does not have to re-scan the whole table on apply,
-- and historical rows (where payment_target_cents is NULL) are exempt by the
-- OR arm of the predicate.
alter table "public"."reservations"
  add constraint "reservations_payment_recorded_le_target" check (
    "payment_target_cents" is null
    or "payment_recorded_cents" <= "payment_target_cents"
  ) not valid;

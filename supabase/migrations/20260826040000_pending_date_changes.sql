-- Tracks portal date changes between the moment we move the dates on Guesty
-- and the moment the guest actually pays for them.
--
-- WHY: /api/account/reservations/[id]/extend writes the new dates to Guesty in
-- its *quote* step, before any payment, because Guesty has no dry-run pricing
-- for a date change — moving the dates IS how you get the new price. Undoing
-- that was left entirely to a client-side rollback fired from the modal's
-- close/back buttons, so closing the tab stranded the reservation: Guesty
-- extended and unpaid, our own row still showing the old stay, and nothing
-- anywhere recording that a change had been started.
--
-- That is GY-fYaHGbj5 (2026-08-25). It sat wrong for three days and surfaced
-- only when the guest phoned in to ask why his card had not been charged.
--
-- This table is the server-side memory the flow was missing. A sweeper reads
-- it and decides what to do with anything left pending past its expiry.
CREATE TABLE IF NOT EXISTS public.pending_date_changes (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id           text        NOT NULL,
  confirmation_code        text,

  -- The stay as it was BEFORE we touched anything. Never overwritten on a
  -- re-quote: a guest who quotes twice would otherwise have the second quote's
  -- "original" recorded as the first quote's already-changed dates, and the
  -- rollback would restore a stay they never booked.
  original_check_in        text        NOT NULL,
  original_check_out       text        NOT NULL,

  -- What we last asked Guesty to set. The sweeper refuses to roll back unless
  -- Guesty still matches this, so a human editing the reservation by hand is
  -- never silently reverted.
  new_check_in             text        NOT NULL,
  new_check_out            text        NOT NULL,

  -- Set once the guest reaches the payment step, so the sweeper can check the
  -- real payment directly instead of guessing from Guesty's balance.
  stripe_payment_intent_id text,

  status                   text        NOT NULL DEFAULT 'pending',
  attempts                 integer     NOT NULL DEFAULT 0,
  last_error               text,

  created_at               timestamptz NOT NULL DEFAULT now(),
  expires_at               timestamptz NOT NULL,
  resolved_at              timestamptz,

  CONSTRAINT pending_date_changes_status_check CHECK (
    status IN (
      'pending',             -- dates moved on Guesty, guest has not finished
      'finalized',           -- guest completed through our own flow
      'rolled_back',         -- sweeper put the dates back
      'superseded',          -- Guesty no longer matches what we set; hands off
      'settled_externally',  -- balance cleared elsewhere (e.g. staff collected)
      'paid_not_finalized',  -- guest paid but finalize never ran; needs a human
      'rollback_failed'      -- we tried to put the dates back and could not
    )
  )
);

-- The sweeper's only query: unresolved rows that are past due.
CREATE INDEX IF NOT EXISTS pending_date_changes_sweep_idx
  ON public.pending_date_changes (expires_at)
  WHERE status = 'pending';

-- At most one open change per reservation, so a re-quote updates the existing
-- row rather than racing a second one against it.
CREATE UNIQUE INDEX IF NOT EXISTS pending_date_changes_one_open_idx
  ON public.pending_date_changes (reservation_id)
  WHERE status = 'pending';

-- Server-side only (service role / direct pool). No policies: RLS on with no
-- policy denies every anon and authenticated request, which is what we want —
-- a guest must never read or write another guest's pending change.
ALTER TABLE public.pending_date_changes ENABLE ROW LEVEL SECURITY;

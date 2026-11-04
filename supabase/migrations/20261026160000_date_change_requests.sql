-- Guest date-change requests.
--
-- The account date-change flow no longer moves a stay, charges a card, or
-- refunds one. A guest submits the dates they want; a teammate approves the
-- change in Guesty or replies to the guest. This table is the record of that
-- request. The staff alert points here.
--
-- `pending` is the request the team still needs to handle. A newer request
-- for the same reservation marks the older one `superseded`. Approval itself
-- stays in Guesty, so there is no approved/rejected status to keep in sync.

CREATE TABLE IF NOT EXISTS public.date_change_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id      text        NOT NULL,
  confirmation_code   text,
  guest_email         text,
  guest_name          text,
  listing_id          text,
  listing_title       text,
  current_check_in    text        NOT NULL,
  current_check_out   text        NOT NULL,
  requested_check_in  text        NOT NULL,
  requested_check_out text        NOT NULL,
  note                text,
  status              text        NOT NULL DEFAULT 'pending',
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT date_change_requests_status_check CHECK (
    status IN ('pending', 'superseded')
  )
);

-- One open request per reservation. The insert supersedes the previous
-- pending row in the same statement, then takes this slot.
CREATE UNIQUE INDEX IF NOT EXISTS date_change_requests_one_pending_idx
  ON public.date_change_requests (reservation_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS date_change_requests_pending_created_idx
  ON public.date_change_requests (created_at DESC)
  WHERE status = 'pending';

-- Server-side only. RLS on with no policy denies anon and authenticated
-- clients; the route writes through the service connection.
ALTER TABLE public.date_change_requests ENABLE ROW LEVEL SECURITY;

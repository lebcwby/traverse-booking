CREATE TABLE IF NOT EXISTS public.rate_limits (
  bucket text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at
  ON public.rate_limits (reset_at);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_ms integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count integer;
  current_reset timestamptz;
BEGIN
  IF p_bucket IS NULL OR length(trim(p_bucket)) = 0 THEN
    RAISE EXCEPTION 'p_bucket is required';
  END IF;

  IF p_limit <= 0 OR p_window_ms <= 0 THEN
    RAISE EXCEPTION 'p_limit and p_window_ms must be positive';
  END IF;

  IF random() < 0.01 THEN
    DELETE FROM public.rate_limits
    WHERE reset_at < now() - interval '1 day';
  END IF;

  WITH upserted AS (
    INSERT INTO public.rate_limits AS rl (bucket, count, reset_at, updated_at)
    VALUES (
      p_bucket,
      1,
      now() + (p_window_ms || ' milliseconds')::interval,
      now()
    )
    ON CONFLICT (bucket) DO UPDATE
    SET count = CASE
        WHEN rl.reset_at <= now() THEN 1
        ELSE rl.count + 1
      END,
      reset_at = CASE
        WHEN rl.reset_at <= now() THEN now() + (p_window_ms || ' milliseconds')::interval
        ELSE rl.reset_at
      END,
      updated_at = now()
    RETURNING count, reset_at
  )
  SELECT count, reset_at
  INTO current_count, current_reset
  FROM upserted;

  RETURN jsonb_build_object(
    'allowed', current_count <= p_limit,
    'remaining', GREATEST(p_limit - current_count, 0),
    'resetAt', FLOOR(EXTRACT(EPOCH FROM current_reset) * 1000)::bigint
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;

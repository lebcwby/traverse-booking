CREATE TABLE IF NOT EXISTS public.wishlists (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wishlists_user_id_listing_id_key UNIQUE (user_id, listing_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'wishlists_user_id_fkey'
      AND conrelid = 'public.wishlists'::regclass
  ) THEN
    ALTER TABLE public.wishlists
      ADD CONSTRAINT wishlists_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'wishlists_user_id_listing_id_key'
      AND conrelid = 'public.wishlists'::regclass
  ) THEN
    ALTER TABLE public.wishlists
      ADD CONSTRAINT wishlists_user_id_listing_id_key UNIQUE (user_id, listing_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wishlists_user
  ON public.wishlists (user_id);

ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'wishlists'
      AND policyname = 'Users manage own wishlists'
  ) THEN
    CREATE POLICY "Users manage own wishlists"
      ON public.wishlists
      FOR ALL
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

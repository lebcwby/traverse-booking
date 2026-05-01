ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS review_summary text;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

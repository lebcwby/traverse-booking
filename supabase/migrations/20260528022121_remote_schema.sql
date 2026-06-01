
  create table "public"."calendar_days" (
    "id" bigint generated always as identity not null,
    "listing_id" text not null,
    "date" text not null,
    "price" numeric,
    "currency" text,
    "is_base_price" boolean,
    "min_nights" integer,
    "is_base_min_nights" boolean,
    "status" text not null,
    "raw_status" text,
    "blocks" jsonb,
    "cta" boolean,
    "ctd" boolean,
    "allotment" integer,
    "last_synced_at" bigint not null
      );


alter table "public"."calendar_days" enable row level security;


  create table "public"."guesty_tokens" (
    "id" bigint generated always as identity not null,
    "token_type" text not null,
    "access_token" text not null,
    "expires_at" bigint not null,
    "created_at" bigint not null
      );


alter table "public"."guesty_tokens" enable row level security;


  create table "public"."kv_store" (
    "key" text not null,
    "value" jsonb,
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."kv_store" enable row level security;


  create table "public"."listings" (
    "id" bigint generated always as identity not null,
    "guesty_id" text not null,
    "nickname" text,
    "title" text,
    "property_type" text,
    "room_type" text,
    "bedrooms" integer,
    "bathrooms" numeric,
    "beds" integer,
    "accommodates" integer,
    "area_square_feet" numeric,
    "address" jsonb,
    "prices" jsonb,
    "active" boolean,
    "is_listed" boolean,
    "cleaning_status" jsonb,
    "terms" jsonb,
    "default_check_in_time" text,
    "default_check_out_time" text,
    "timezone" text,
    "picture" text,
    "picture_count" integer,
    "host_name" text,
    "contact_phone" text,
    "amenities" jsonb,
    "tags" jsonb,
    "owners" jsonb,
    "integrations" jsonb,
    "occupancy_stats" jsonb,
    "financials" jsonb,
    "custom_fields" jsonb,
    "wheelhouse_data" jsonb,
    "guesty_created_at" text,
    "guesty_updated_at" text,
    "last_synced_at" bigint not null,
    "beapi_enabled" boolean default false,
    "review_summary" text
      );


alter table "public"."listings" enable row level security;


  create table "public"."pending_checkouts" (
    "payment_intent_id" text not null,
    "quote_id" text not null,
    "rate_plan_id" text,
    "stripe_customer_id" text,
    "guest" jsonb,
    "tracking" jsonb,
    "upsells" jsonb,
    "pets" integer default 0,
    "status" text not null default 'pending'::text,
    "reservation_id" text,
    "quote_snapshot" jsonb,
    "last_error" text,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "stay_key" text,
    "guest_identity_key" text,
    "booking_fingerprint" text
      );


alter table "public"."pending_checkouts" enable row level security;


  create table "public"."rate_limits" (
    "bucket" text not null,
    "count" integer not null default 0,
    "reset_at" timestamp with time zone not null,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."rate_limits" enable row level security;


  create table "public"."reservations" (
    "id" bigint generated always as identity not null,
    "guesty_id" text not null,
    "confirmation_code" text,
    "listing_id" text,
    "guest_id" text,
    "status" text,
    "source" text,
    "secondary_source" text,
    "check_in" text not null,
    "check_out" text not null,
    "check_in_date_localized" text,
    "check_out_date_localized" text,
    "nights_count" integer,
    "guest" jsonb,
    "listing" jsonb,
    "guests_count" integer,
    "number_of_guests" jsonb,
    "money" jsonb,
    "money_full" jsonb,
    "integration" jsonb,
    "notes" jsonb,
    "special_requests" text,
    "planned_arrival" text,
    "planned_departure" text,
    "key_code" text,
    "is_returning_guest" boolean,
    "manually_created" boolean,
    "review" jsonb,
    "confirmed_at" text,
    "guesty_created_at" text,
    "guesty_updated_at" text,
    "last_synced_at" bigint not null,
    "enriched_at" bigint,
    "enrichment_error" text,
    "stripe_payment_intent_id" text,
    "user_id" uuid,
    "payment_recorded_at" bigint,
    "refund_status" text,
    "refund_amount" numeric(10,2),
    "stripe_refund_id" text,
    "canceled_at" timestamp with time zone,
    "listing_title" text,
    "listing_photo" text
      );


alter table "public"."reservations" enable row level security;


  create table "public"."reviews" (
    "id" bigint generated always as identity not null,
    "guesty_id" text not null,
    "listing_id" text not null,
    "reservation_id" text,
    "guest_id" text,
    "channel" text,
    "overall_rating" smallint,
    "public_review" text,
    "category_cleanliness" smallint,
    "category_accuracy" smallint,
    "category_checkin" smallint,
    "category_communication" smallint,
    "category_location" smallint,
    "category_value" smallint,
    "reviewer_name" text,
    "review_date" text,
    "guesty_created_at" text,
    "guesty_updated_at" text,
    "last_synced_at" bigint
      );


alter table "public"."reviews" enable row level security;


  create table "public"."sync_metadata" (
    "id" bigint generated always as identity not null,
    "sync_type" text not null,
    "last_sync_at" bigint not null,
    "last_sync_status" text not null,
    "items_synced" integer not null default 0,
    "error_message" text,
    "current_offset" integer,
    "total_items" integer,
    "initial_sync_complete" boolean default false
      );


alter table "public"."sync_metadata" enable row level security;


  create table "public"."website_reservations" (
    "id" bigint generated always as identity not null,
    "reservation_id" text not null,
    "confirmation_code" text,
    "guest_email" text not null,
    "guest_name" text,
    "guest_phone" text,
    "listing_id" text,
    "listing_name" text,
    "listing_photo" text,
    "listing_address" jsonb,
    "check_in" date,
    "check_out" date,
    "guests_count" integer,
    "status" text default 'confirmed'::text,
    "money" jsonb,
    "key_code" text,
    "special_requests" text,
    "guesty_updated_at" timestamp with time zone,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."website_reservations" enable row level security;


  create table "public"."wishlists" (
    "id" bigint generated always as identity not null,
    "user_id" uuid not null,
    "listing_id" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."wishlists" enable row level security;

alter table "public"."pending_cart_checkouts" enable row level security;

alter table "public"."sp_events" enable row level security;

alter table "public"."sp_plans" enable row level security;

alter table "public"."sp_pois" enable row level security;

CREATE UNIQUE INDEX calendar_days_listing_id_date_key ON public.calendar_days USING btree (listing_id, date);

CREATE UNIQUE INDEX calendar_days_pkey ON public.calendar_days USING btree (id);

CREATE UNIQUE INDEX guesty_tokens_pkey ON public.guesty_tokens USING btree (id);

CREATE UNIQUE INDEX guesty_tokens_token_type_key ON public.guesty_tokens USING btree (token_type);

CREATE INDEX idx_calendar_days_date ON public.calendar_days USING btree (date);

CREATE INDEX idx_calendar_days_listing_date ON public.calendar_days USING btree (listing_id, date);

CREATE INDEX idx_calendar_days_listing_status ON public.calendar_days USING btree (listing_id, status);

CREATE INDEX idx_listings_active ON public.listings USING btree (active);

CREATE INDEX idx_listings_beapi_enabled ON public.listings USING btree (beapi_enabled);

CREATE INDEX idx_listings_guesty_id ON public.listings USING btree (guesty_id);

CREATE INDEX idx_pending_checkouts_booking_fingerprint ON public.pending_checkouts USING btree (booking_fingerprint);

CREATE INDEX idx_pending_checkouts_quote_id ON public.pending_checkouts USING btree (quote_id);

CREATE INDEX idx_pending_checkouts_status_created ON public.pending_checkouts USING btree (status, created_at DESC);

CREATE INDEX idx_pending_checkouts_stay_key_status_created ON public.pending_checkouts USING btree (stay_key, status, created_at DESC);

CREATE INDEX idx_rate_limits_reset_at ON public.rate_limits USING btree (reset_at);

CREATE INDEX idx_reservations_check_in ON public.reservations USING btree (check_in);

CREATE INDEX idx_reservations_check_out ON public.reservations USING btree (check_out);

CREATE INDEX idx_reservations_enriched ON public.reservations USING btree (enriched_at);

CREATE INDEX idx_reservations_listing ON public.reservations USING btree (listing_id);

CREATE INDEX idx_reservations_payment_recorded_at ON public.reservations USING btree (payment_recorded_at);

CREATE INDEX idx_reservations_source ON public.reservations USING btree (source);

CREATE INDEX idx_reservations_status ON public.reservations USING btree (status);

CREATE INDEX idx_reservations_stripe_payment_intent_id ON public.reservations USING btree (stripe_payment_intent_id);

CREATE INDEX idx_reservations_user_id ON public.reservations USING btree (user_id);

CREATE INDEX idx_reviews_date ON public.reviews USING btree (review_date DESC);

CREATE INDEX idx_reviews_listing ON public.reviews USING btree (listing_id);

CREATE UNIQUE INDEX idx_sync_metadata_type ON public.sync_metadata USING btree (sync_type);

CREATE INDEX idx_website_reservations_check_in ON public.website_reservations USING btree (check_in);

CREATE INDEX idx_website_reservations_email ON public.website_reservations USING btree (guest_email);

CREATE INDEX idx_website_reservations_status ON public.website_reservations USING btree (status);

CREATE INDEX idx_wishlists_user ON public.wishlists USING btree (user_id);

CREATE UNIQUE INDEX kv_store_pkey ON public.kv_store USING btree (key);

CREATE UNIQUE INDEX listings_guesty_id_key ON public.listings USING btree (guesty_id);

CREATE UNIQUE INDEX listings_pkey ON public.listings USING btree (id);

CREATE UNIQUE INDEX pending_checkouts_pkey ON public.pending_checkouts USING btree (payment_intent_id);

CREATE UNIQUE INDEX rate_limits_pkey ON public.rate_limits USING btree (bucket);

CREATE UNIQUE INDEX reservations_guesty_id_key ON public.reservations USING btree (guesty_id);

CREATE UNIQUE INDEX reservations_pkey ON public.reservations USING btree (id);

CREATE UNIQUE INDEX reviews_guesty_id_key ON public.reviews USING btree (guesty_id);

CREATE UNIQUE INDEX reviews_pkey ON public.reviews USING btree (id);

CREATE UNIQUE INDEX sync_metadata_pkey ON public.sync_metadata USING btree (id);

CREATE UNIQUE INDEX sync_metadata_sync_type_key ON public.sync_metadata USING btree (sync_type);

CREATE UNIQUE INDEX website_reservations_pkey ON public.website_reservations USING btree (id);

CREATE UNIQUE INDEX website_reservations_reservation_id_key ON public.website_reservations USING btree (reservation_id);

CREATE UNIQUE INDEX wishlists_pkey ON public.wishlists USING btree (id);

CREATE UNIQUE INDEX wishlists_user_id_listing_id_key ON public.wishlists USING btree (user_id, listing_id);

alter table "public"."calendar_days" add constraint "calendar_days_pkey" PRIMARY KEY using index "calendar_days_pkey";

alter table "public"."guesty_tokens" add constraint "guesty_tokens_pkey" PRIMARY KEY using index "guesty_tokens_pkey";

alter table "public"."kv_store" add constraint "kv_store_pkey" PRIMARY KEY using index "kv_store_pkey";

alter table "public"."listings" add constraint "listings_pkey" PRIMARY KEY using index "listings_pkey";

alter table "public"."pending_checkouts" add constraint "pending_checkouts_pkey" PRIMARY KEY using index "pending_checkouts_pkey";

alter table "public"."rate_limits" add constraint "rate_limits_pkey" PRIMARY KEY using index "rate_limits_pkey";

alter table "public"."reservations" add constraint "reservations_pkey" PRIMARY KEY using index "reservations_pkey";

alter table "public"."reviews" add constraint "reviews_pkey" PRIMARY KEY using index "reviews_pkey";

alter table "public"."sync_metadata" add constraint "sync_metadata_pkey" PRIMARY KEY using index "sync_metadata_pkey";

alter table "public"."website_reservations" add constraint "website_reservations_pkey" PRIMARY KEY using index "website_reservations_pkey";

alter table "public"."wishlists" add constraint "wishlists_pkey" PRIMARY KEY using index "wishlists_pkey";

alter table "public"."calendar_days" add constraint "calendar_days_listing_id_date_key" UNIQUE using index "calendar_days_listing_id_date_key";

alter table "public"."guesty_tokens" add constraint "guesty_tokens_token_type_key" UNIQUE using index "guesty_tokens_token_type_key";

alter table "public"."listings" add constraint "listings_guesty_id_key" UNIQUE using index "listings_guesty_id_key";

alter table "public"."reservations" add constraint "reservations_guesty_id_key" UNIQUE using index "reservations_guesty_id_key";

alter table "public"."reviews" add constraint "reviews_guesty_id_key" UNIQUE using index "reviews_guesty_id_key";

alter table "public"."sync_metadata" add constraint "sync_metadata_sync_type_key" UNIQUE using index "sync_metadata_sync_type_key";

alter table "public"."website_reservations" add constraint "website_reservations_reservation_id_key" UNIQUE using index "website_reservations_reservation_id_key";

alter table "public"."wishlists" add constraint "wishlists_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."wishlists" validate constraint "wishlists_user_id_fkey";

alter table "public"."wishlists" add constraint "wishlists_user_id_listing_id_key" UNIQUE using index "wishlists_user_id_listing_id_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.check_rate_limit(p_bucket text, p_limit integer, p_window_ms integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

grant delete on table "public"."calendar_days" to "anon";

grant insert on table "public"."calendar_days" to "anon";

grant references on table "public"."calendar_days" to "anon";

grant select on table "public"."calendar_days" to "anon";

grant trigger on table "public"."calendar_days" to "anon";

grant truncate on table "public"."calendar_days" to "anon";

grant update on table "public"."calendar_days" to "anon";

grant delete on table "public"."calendar_days" to "authenticated";

grant insert on table "public"."calendar_days" to "authenticated";

grant references on table "public"."calendar_days" to "authenticated";

grant select on table "public"."calendar_days" to "authenticated";

grant trigger on table "public"."calendar_days" to "authenticated";

grant truncate on table "public"."calendar_days" to "authenticated";

grant update on table "public"."calendar_days" to "authenticated";

grant delete on table "public"."calendar_days" to "service_role";

grant insert on table "public"."calendar_days" to "service_role";

grant references on table "public"."calendar_days" to "service_role";

grant select on table "public"."calendar_days" to "service_role";

grant trigger on table "public"."calendar_days" to "service_role";

grant truncate on table "public"."calendar_days" to "service_role";

grant update on table "public"."calendar_days" to "service_role";

grant delete on table "public"."guesty_tokens" to "anon";

grant insert on table "public"."guesty_tokens" to "anon";

grant references on table "public"."guesty_tokens" to "anon";

grant select on table "public"."guesty_tokens" to "anon";

grant trigger on table "public"."guesty_tokens" to "anon";

grant truncate on table "public"."guesty_tokens" to "anon";

grant update on table "public"."guesty_tokens" to "anon";

grant delete on table "public"."guesty_tokens" to "authenticated";

grant insert on table "public"."guesty_tokens" to "authenticated";

grant references on table "public"."guesty_tokens" to "authenticated";

grant select on table "public"."guesty_tokens" to "authenticated";

grant trigger on table "public"."guesty_tokens" to "authenticated";

grant truncate on table "public"."guesty_tokens" to "authenticated";

grant update on table "public"."guesty_tokens" to "authenticated";

grant delete on table "public"."guesty_tokens" to "service_role";

grant insert on table "public"."guesty_tokens" to "service_role";

grant references on table "public"."guesty_tokens" to "service_role";

grant select on table "public"."guesty_tokens" to "service_role";

grant trigger on table "public"."guesty_tokens" to "service_role";

grant truncate on table "public"."guesty_tokens" to "service_role";

grant update on table "public"."guesty_tokens" to "service_role";

grant delete on table "public"."kv_store" to "anon";

grant insert on table "public"."kv_store" to "anon";

grant references on table "public"."kv_store" to "anon";

grant select on table "public"."kv_store" to "anon";

grant trigger on table "public"."kv_store" to "anon";

grant truncate on table "public"."kv_store" to "anon";

grant update on table "public"."kv_store" to "anon";

grant delete on table "public"."kv_store" to "authenticated";

grant insert on table "public"."kv_store" to "authenticated";

grant references on table "public"."kv_store" to "authenticated";

grant select on table "public"."kv_store" to "authenticated";

grant trigger on table "public"."kv_store" to "authenticated";

grant truncate on table "public"."kv_store" to "authenticated";

grant update on table "public"."kv_store" to "authenticated";

grant delete on table "public"."kv_store" to "service_role";

grant insert on table "public"."kv_store" to "service_role";

grant references on table "public"."kv_store" to "service_role";

grant select on table "public"."kv_store" to "service_role";

grant trigger on table "public"."kv_store" to "service_role";

grant truncate on table "public"."kv_store" to "service_role";

grant update on table "public"."kv_store" to "service_role";

grant delete on table "public"."listings" to "anon";

grant insert on table "public"."listings" to "anon";

grant references on table "public"."listings" to "anon";

grant select on table "public"."listings" to "anon";

grant trigger on table "public"."listings" to "anon";

grant truncate on table "public"."listings" to "anon";

grant update on table "public"."listings" to "anon";

grant delete on table "public"."listings" to "authenticated";

grant insert on table "public"."listings" to "authenticated";

grant references on table "public"."listings" to "authenticated";

grant select on table "public"."listings" to "authenticated";

grant trigger on table "public"."listings" to "authenticated";

grant truncate on table "public"."listings" to "authenticated";

grant update on table "public"."listings" to "authenticated";

grant delete on table "public"."listings" to "service_role";

grant insert on table "public"."listings" to "service_role";

grant references on table "public"."listings" to "service_role";

grant select on table "public"."listings" to "service_role";

grant trigger on table "public"."listings" to "service_role";

grant truncate on table "public"."listings" to "service_role";

grant update on table "public"."listings" to "service_role";

grant delete on table "public"."pending_checkouts" to "anon";

grant insert on table "public"."pending_checkouts" to "anon";

grant references on table "public"."pending_checkouts" to "anon";

grant select on table "public"."pending_checkouts" to "anon";

grant trigger on table "public"."pending_checkouts" to "anon";

grant truncate on table "public"."pending_checkouts" to "anon";

grant update on table "public"."pending_checkouts" to "anon";

grant delete on table "public"."pending_checkouts" to "authenticated";

grant insert on table "public"."pending_checkouts" to "authenticated";

grant references on table "public"."pending_checkouts" to "authenticated";

grant select on table "public"."pending_checkouts" to "authenticated";

grant trigger on table "public"."pending_checkouts" to "authenticated";

grant truncate on table "public"."pending_checkouts" to "authenticated";

grant update on table "public"."pending_checkouts" to "authenticated";

grant delete on table "public"."pending_checkouts" to "service_role";

grant insert on table "public"."pending_checkouts" to "service_role";

grant references on table "public"."pending_checkouts" to "service_role";

grant select on table "public"."pending_checkouts" to "service_role";

grant trigger on table "public"."pending_checkouts" to "service_role";

grant truncate on table "public"."pending_checkouts" to "service_role";

grant update on table "public"."pending_checkouts" to "service_role";

grant delete on table "public"."rate_limits" to "anon";

grant insert on table "public"."rate_limits" to "anon";

grant references on table "public"."rate_limits" to "anon";

grant select on table "public"."rate_limits" to "anon";

grant trigger on table "public"."rate_limits" to "anon";

grant truncate on table "public"."rate_limits" to "anon";

grant update on table "public"."rate_limits" to "anon";

grant delete on table "public"."rate_limits" to "authenticated";

grant insert on table "public"."rate_limits" to "authenticated";

grant references on table "public"."rate_limits" to "authenticated";

grant select on table "public"."rate_limits" to "authenticated";

grant trigger on table "public"."rate_limits" to "authenticated";

grant truncate on table "public"."rate_limits" to "authenticated";

grant update on table "public"."rate_limits" to "authenticated";

grant delete on table "public"."rate_limits" to "service_role";

grant insert on table "public"."rate_limits" to "service_role";

grant references on table "public"."rate_limits" to "service_role";

grant select on table "public"."rate_limits" to "service_role";

grant trigger on table "public"."rate_limits" to "service_role";

grant truncate on table "public"."rate_limits" to "service_role";

grant update on table "public"."rate_limits" to "service_role";

grant delete on table "public"."reservations" to "anon";

grant insert on table "public"."reservations" to "anon";

grant references on table "public"."reservations" to "anon";

grant select on table "public"."reservations" to "anon";

grant trigger on table "public"."reservations" to "anon";

grant truncate on table "public"."reservations" to "anon";

grant update on table "public"."reservations" to "anon";

grant delete on table "public"."reservations" to "authenticated";

grant insert on table "public"."reservations" to "authenticated";

grant references on table "public"."reservations" to "authenticated";

grant select on table "public"."reservations" to "authenticated";

grant trigger on table "public"."reservations" to "authenticated";

grant truncate on table "public"."reservations" to "authenticated";

grant update on table "public"."reservations" to "authenticated";

grant delete on table "public"."reservations" to "service_role";

grant insert on table "public"."reservations" to "service_role";

grant references on table "public"."reservations" to "service_role";

grant select on table "public"."reservations" to "service_role";

grant trigger on table "public"."reservations" to "service_role";

grant truncate on table "public"."reservations" to "service_role";

grant update on table "public"."reservations" to "service_role";

grant delete on table "public"."reviews" to "anon";

grant insert on table "public"."reviews" to "anon";

grant references on table "public"."reviews" to "anon";

grant select on table "public"."reviews" to "anon";

grant trigger on table "public"."reviews" to "anon";

grant truncate on table "public"."reviews" to "anon";

grant update on table "public"."reviews" to "anon";

grant delete on table "public"."reviews" to "authenticated";

grant insert on table "public"."reviews" to "authenticated";

grant references on table "public"."reviews" to "authenticated";

grant select on table "public"."reviews" to "authenticated";

grant trigger on table "public"."reviews" to "authenticated";

grant truncate on table "public"."reviews" to "authenticated";

grant update on table "public"."reviews" to "authenticated";

grant delete on table "public"."reviews" to "service_role";

grant insert on table "public"."reviews" to "service_role";

grant references on table "public"."reviews" to "service_role";

grant select on table "public"."reviews" to "service_role";

grant trigger on table "public"."reviews" to "service_role";

grant truncate on table "public"."reviews" to "service_role";

grant update on table "public"."reviews" to "service_role";

grant delete on table "public"."sync_metadata" to "anon";

grant insert on table "public"."sync_metadata" to "anon";

grant references on table "public"."sync_metadata" to "anon";

grant select on table "public"."sync_metadata" to "anon";

grant trigger on table "public"."sync_metadata" to "anon";

grant truncate on table "public"."sync_metadata" to "anon";

grant update on table "public"."sync_metadata" to "anon";

grant delete on table "public"."sync_metadata" to "authenticated";

grant insert on table "public"."sync_metadata" to "authenticated";

grant references on table "public"."sync_metadata" to "authenticated";

grant select on table "public"."sync_metadata" to "authenticated";

grant trigger on table "public"."sync_metadata" to "authenticated";

grant truncate on table "public"."sync_metadata" to "authenticated";

grant update on table "public"."sync_metadata" to "authenticated";

grant delete on table "public"."sync_metadata" to "service_role";

grant insert on table "public"."sync_metadata" to "service_role";

grant references on table "public"."sync_metadata" to "service_role";

grant select on table "public"."sync_metadata" to "service_role";

grant trigger on table "public"."sync_metadata" to "service_role";

grant truncate on table "public"."sync_metadata" to "service_role";

grant update on table "public"."sync_metadata" to "service_role";

grant delete on table "public"."website_reservations" to "anon";

grant insert on table "public"."website_reservations" to "anon";

grant references on table "public"."website_reservations" to "anon";

grant select on table "public"."website_reservations" to "anon";

grant trigger on table "public"."website_reservations" to "anon";

grant truncate on table "public"."website_reservations" to "anon";

grant update on table "public"."website_reservations" to "anon";

grant delete on table "public"."website_reservations" to "authenticated";

grant insert on table "public"."website_reservations" to "authenticated";

grant references on table "public"."website_reservations" to "authenticated";

grant select on table "public"."website_reservations" to "authenticated";

grant trigger on table "public"."website_reservations" to "authenticated";

grant truncate on table "public"."website_reservations" to "authenticated";

grant update on table "public"."website_reservations" to "authenticated";

grant delete on table "public"."website_reservations" to "service_role";

grant insert on table "public"."website_reservations" to "service_role";

grant references on table "public"."website_reservations" to "service_role";

grant select on table "public"."website_reservations" to "service_role";

grant trigger on table "public"."website_reservations" to "service_role";

grant truncate on table "public"."website_reservations" to "service_role";

grant update on table "public"."website_reservations" to "service_role";

grant delete on table "public"."wishlists" to "anon";

grant insert on table "public"."wishlists" to "anon";

grant references on table "public"."wishlists" to "anon";

grant select on table "public"."wishlists" to "anon";

grant trigger on table "public"."wishlists" to "anon";

grant truncate on table "public"."wishlists" to "anon";

grant update on table "public"."wishlists" to "anon";

grant delete on table "public"."wishlists" to "authenticated";

grant insert on table "public"."wishlists" to "authenticated";

grant references on table "public"."wishlists" to "authenticated";

grant select on table "public"."wishlists" to "authenticated";

grant trigger on table "public"."wishlists" to "authenticated";

grant truncate on table "public"."wishlists" to "authenticated";

grant update on table "public"."wishlists" to "authenticated";

grant delete on table "public"."wishlists" to "service_role";

grant insert on table "public"."wishlists" to "service_role";

grant references on table "public"."wishlists" to "service_role";

grant select on table "public"."wishlists" to "service_role";

grant trigger on table "public"."wishlists" to "service_role";

grant truncate on table "public"."wishlists" to "service_role";

grant update on table "public"."wishlists" to "service_role";


  create policy "Public read access"
  on "public"."sp_events"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Public read access"
  on "public"."sp_plans"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Public read access"
  on "public"."sp_pois"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Service role full access"
  on "public"."website_reservations"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "Users can view own reservations"
  on "public"."website_reservations"
  as permissive
  for select
  to authenticated
using ((lower(guest_email) = lower((auth.jwt() ->> 'email'::text))));



  create policy "Users manage own wishlists"
  on "public"."wishlists"
  as permissive
  for all
  to authenticated
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));




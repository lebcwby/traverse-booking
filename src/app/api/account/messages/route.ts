import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-auth-server";
import { getThreadsForGuest } from "@/lib/gmail";
import { getPool } from "@/lib/db";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch threads and reservations in parallel
    const [threads, reservations] = await Promise.all([
      getThreadsForGuest(user.email),
      fetchReservationSummaries(user.email),
    ]);

    return NextResponse.json({ threads, reservations });
  } catch (err) {
    console.error("[Messages] Failed to fetch data:", err);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

interface ReservationSummary {
  id: string;
  confirmation_code: string | null;
  guest_name: string | null;
  listing_name: string | null;
  listing_photo: string | null;
  check_in: string;
  check_out: string;
  guests_count: number | null;
  status: string;
  total: number;
  currency: string;
}

async function fetchReservationSummaries(
  userEmail: string
): Promise<ReservationSummary[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT
      r.guesty_id,
      r.confirmation_code,
      r.guest,
      r.check_in,
      r.check_out,
      r.guests_count,
      r.status,
      r.money,
      l.title as listing_title,
      l.nickname as listing_nickname,
      l.picture as listing_picture
    FROM reservations r
    LEFT JOIN listings l ON l.guesty_id = r.listing_id
    WHERE lower(r.guest->>'email') = lower($1)
    ORDER BY r.check_in DESC
    LIMIT 500`,
    [userEmail]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result.rows.map((r: any) => ({
    id: r.guesty_id,
    confirmation_code: r.confirmation_code || null,
    guest_name: r.guest?.fullName || r.guest?.full_name || null,
    listing_name: r.listing_title || r.listing_nickname || null,
    listing_photo: upgradeGuestyImage(r.listing_picture),
    check_in: r.check_in,
    check_out: r.check_out,
    guests_count: r.guests_count,
    status: r.status,
    total: r.money?.totalPaid || r.money?.total_paid || 0,
    currency: r.money?.currency || "USD",
  }));
}

function upgradeGuestyImage(url: string | null): string | null {
  if (!url) return null;
  return url.replace("/t_default_thumb/", "/c_fill,w_800,h_600,f_auto,q_auto/");
}

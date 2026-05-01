import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-auth-server";
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
    const pool = getPool();
    const result = await pool.query(
      `SELECT w.listing_id, w.created_at,
              l.title as listing_title,
              l.nickname as listing_nickname,
              l.picture as listing_picture,
              l.bedrooms, l.bathrooms, l.accommodates, l.beds,
              l.prices, l.address
       FROM wishlists w
       LEFT JOIN listings l ON l.guesty_id = w.listing_id
       WHERE w.user_id = $1
       ORDER BY w.created_at DESC`,
      [user.id]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("[Wishlists] Failed to fetch:", err);
    return NextResponse.json(
      { error: "Failed to fetch wishlists" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { listing_id } = await request.json();
    if (!listing_id) {
      return NextResponse.json(
        { error: "listing_id required" },
        { status: 400 }
      );
    }

    const pool = getPool();
    await pool.query(
      `INSERT INTO wishlists (user_id, listing_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [user.id, listing_id]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Wishlists] Failed to add:", err);
    return NextResponse.json(
      { error: "Failed to add to wishlist" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { listing_id } = await request.json();
    if (!listing_id) {
      return NextResponse.json(
        { error: "listing_id required" },
        { status: 400 }
      );
    }

    const pool = getPool();
    await pool.query(
      `DELETE FROM wishlists WHERE user_id = $1 AND listing_id = $2`,
      [user.id, listing_id]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Wishlists] Failed to remove:", err);
    return NextResponse.json(
      { error: "Failed to remove from wishlist" },
      { status: 500 }
    );
  }
}

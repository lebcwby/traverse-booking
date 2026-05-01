import { NextResponse } from "next/server";
import { getAuthAdmin } from "@/lib/supabase-auth-admin";
import { getPool } from "@/lib/db";
import { sendKlaviyoEvent } from "@/lib/server-tracking";

export async function POST(request: Request) {
  try {
    const { email, password, firstName, lastName, phone, reservationId } =
      await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const supabase = getAuthAdmin();

    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
    const userMetadata: Record<string, string> = {};
    if (firstName) userMetadata.first_name = firstName;
    if (lastName) userMetadata.last_name = lastName;
    if (fullName) userMetadata.full_name = fullName;
    if (phone) userMetadata.phone = phone;

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
    });

    if (error) {
      if (error.message?.includes("already been registered")) {
        return NextResponse.json(
          { error: "Account already exists" },
          { status: 409 }
        );
      }
      console.error("[account/create] Error:", error.message);
      return NextResponse.json(
        { error: "Failed to create account" },
        { status: 500 }
      );
    }

    // Create/update Klaviyo profile for abandonment flows + welcome series
    if (data.user.email) {
      sendKlaviyoEvent(
        "Created Account",
        { "Signup Source": "Website" },
        {
          email: data.user.email,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          phone: phone || undefined,
        }
      ).catch((err) =>
        console.error("[Klaviyo] Account create identify error:", err)
      );
    }

    if (reservationId) {
      try {
        const pool = getPool();
        // Verify the reservation's guest email matches the new account email
        await pool.query(
          `UPDATE reservations SET user_id = $1 WHERE guesty_id = $2 AND user_id IS NULL AND lower(guest->>'email') = lower($3)`,
          [data.user.id, reservationId, email]
        );
      } catch (linkErr) {
        console.error("[account/create] Failed to link reservation:", linkErr);
      }
    }

    return NextResponse.json({ userId: data.user.id });
  } catch (err) {
    console.error("[account/create] Unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}

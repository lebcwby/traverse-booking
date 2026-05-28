import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-auth-server";

const DEFAULT_ADMIN_EMAILS = [
  "nadim@traversehospitality.com",
  "ngtannous@gmail.com",
  "alex@traversehospitality.com",
  "sabrina@traversehospitality.com",
];

function configuredAdminEmails() {
  const envEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_ADMIN_EMAILS, ...envEmails]);
}

export async function authorizeAdminRequest(
  request: Request
): Promise<boolean> {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return true;

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email && configuredAdminEmails().has(user.email.toLowerCase())) {
      return true;
    }
  } catch {
    /* fall through */
  }

  return false;
}

export function unauthorizedAdminResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

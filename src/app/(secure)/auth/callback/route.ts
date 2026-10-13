import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { sendKlaviyoEvent } from "@/lib/server-tracking";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const rawRedirect = searchParams.get("redirect") || "/";
  // Prevent open redirect — only allow relative paths starting with /
  const redirectTo =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/";

  if (code) {
    // For password recovery, redirect to the reset password page after exchanging the code
    const destination =
      type === "recovery" ? "/auth/reset-password" : redirectTo;
    const response = NextResponse.redirect(new URL(destination, origin));
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );
    const { data } = await supabase.auth.exchangeCodeForSession(code);

    // Create/update Klaviyo profile so browse/checkout abandonment flows work
    const user = data?.user;
    if (user?.email) {
      const meta = user.user_metadata || {};
      const fullName: string = meta.full_name || meta.name || "";
      const [first, ...rest] = fullName.split(" ");
      sendKlaviyoEvent(
        "Created Account",
        { "Signup Source": "Website" },
        {
          email: user.email,
          firstName: first || meta.first_name || undefined,
          lastName: rest.join(" ") || undefined,
        }
      ).catch((err) =>
        console.error("[Klaviyo] Auth callback identify error:", err)
      );
    }

    return response;
  }

  return NextResponse.redirect(new URL("/login?error=auth", origin));
}

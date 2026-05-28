"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, Lock, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase-auth";
import { identifyUser } from "@/lib/tracking";

type Mode = "magic-link" | "sign-in" | "sign-up" | "forgot-password";

function normalizeMode(value: string | null): Mode | null {
  if (
    value === "magic-link" ||
    value === "sign-in" ||
    value === "sign-up" ||
    value === "forgot-password"
  ) {
    return value;
  }

  return null;
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const requestedMode = normalizeMode(searchParams.get("mode"));
  const isCreateFlow = searchParams.get("create") === "true";
  const prefillEmail = searchParams.get("email") || "";
  const rawRedirect = searchParams.get("redirect") || "/";
  const redirectTo =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/";

  const [mode, setMode] = useState<Mode>(
    requestedMode ?? (isCreateFlow ? "sign-up" : "sign-in")
  );
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = createClient();

  // If already logged in, redirect away from the login page
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        window.location.assign(
          redirectTo === "/" ? "/account/reservations" : redirectTo
        );
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function clearMessages() {
    setError(null);
    setSuccess(null);
  }

  useEffect(() => {
    if (!requestedMode) return;
    clearMessages();
    setMode(requestedMode);
  }, [requestedMode]);

  function switchMode(next: Mode) {
    clearMessages();
    setMode(next);
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo:
            window.location.origin +
            "/auth/callback?redirect=" +
            encodeURIComponent(redirectTo),
        },
      });
      if (error) throw error;
      setSuccess("Check your email for the login link.");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      identifyUser(email);
      // Hard navigation so the next request carries the freshly-set auth
      // cookies through middleware. router.push() races the RSC fetch
      // against cookie propagation and stalls on mobile Safari's first
      // attempt — refresh then "works" only because the cookies have
      // finally landed.
      window.location.assign(redirectTo);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Invalid email or password."
      );
      setLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            window.location.origin +
            "/auth/callback?redirect=" +
            encodeURIComponent(redirectTo),
        },
      });
      if (error) throw error;

      // Supabase intentionally hides whether an email already has an account
      // (anti-enumeration). On a repeated signup it returns 200 with a "user"
      // object that has identities=[] and no confirmation email is sent.
      // Detect that case and surface a helpful message instead of the
      // misleading "check your email" success card.
      const identities = data?.user?.identities ?? [];
      if (data?.user && identities.length === 0) {
        setError(
          "An account already exists for this email. Try signing in instead, or use the magic link option if you've forgotten your password."
        );
        setMode("sign-in");
        return;
      }

      // If email confirmation is disabled in Supabase, signUp returns a
      // session immediately and the user is already logged in — redirect.
      if (data?.session) {
        identifyUser(email);
        window.location.assign(redirectTo);
        return;
      }

      setSuccess("Check your email to confirm your account.");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not create account. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/auth/reset-password",
      });
      if (error) throw error;
      setSuccess("Check your email for the password reset link.");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  // text-base (16px) on mobile prevents iOS Safari from zooming in on focus.
  // sm: breakpoint drops back to 14px where the zoom behaviour doesn't apply.
  const inputClass =
    "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-base sm:text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary";

  const primaryButtonClass =
    "w-full rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50";

  async function handleOAuth(provider: "google") {
    clearMessages();
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo:
          window.location.origin +
          "/auth/callback?redirect=" +
          encodeURIComponent(redirectTo),
      },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center px-6 py-16 sm:px-8">
      <div className="w-full space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {mode === "sign-up"
              ? "Create Account"
              : mode === "forgot-password"
                ? "Reset Password"
                : "Log In"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "magic-link" && "We'll send a login link to your email."}
            {mode === "sign-in" && "Sign in with your email and password."}
            {mode === "sign-up" &&
              "Create an account to manage your reservations."}
            {mode === "forgot-password" &&
              "Enter your email to receive a reset link."}
          </p>
        </div>

        {(mode === "magic-link" || mode === "sign-in" || mode === "sign-up") && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-white px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>
          </div>
        )}

        {mode === "magic-link" && (
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass + " pl-9"}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className={primaryButtonClass}
            >
              {loading ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : (
                "Send magic link"
              )}
            </button>
            <p className="text-center text-xs text-muted-foreground">
              Prefer a password?{" "}
              <button
                type="button"
                onClick={() => switchMode("sign-in")}
                className="text-primary hover:underline"
              >
                Sign in
              </button>
            </p>
          </form>
        )}

        {mode === "sign-in" && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass + " pl-9"}
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className={inputClass + " pl-9"}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className={primaryButtonClass}
            >
              {loading ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : (
                "Log In"
              )}
            </button>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => switchMode("forgot-password")}
                className="text-primary hover:underline"
              >
                Forgot password?
              </button>
              <button
                type="button"
                onClick={() => switchMode("sign-up")}
                className="text-primary hover:underline"
              >
                Create account
              </button>
            </div>
          </form>
        )}

        {mode === "sign-up" && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass + " pl-9"}
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className={inputClass + " pl-9"}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className={primaryButtonClass}
            >
              {loading ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : (
                "Create Account"
              )}
            </button>
            <p className="text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("sign-in")}
                className="text-primary hover:underline"
              >
                Sign in
              </button>
            </p>
          </form>
        )}

        {mode === "forgot-password" && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass + " pl-9"}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className={primaryButtonClass}
            >
              {loading ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : (
                "Send reset link"
              )}
            </button>
            <p className="text-center text-xs text-muted-foreground">
              Remembered it?{" "}
              <button
                type="button"
                onClick={() => switchMode("sign-in")}
                className="text-primary hover:underline"
              >
                Back to login
              </button>
            </p>
          </form>
        )}

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {success && (
          <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </p>
        )}
      </div>
    </div>
  );
}

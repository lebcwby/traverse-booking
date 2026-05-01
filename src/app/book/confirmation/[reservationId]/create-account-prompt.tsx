"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowRight, CheckCircle, Loader2, Lock, Mail } from "lucide-react";
import {
  readConfirmationSession,
  type ConfirmationSession,
} from "./lib/confirmation-session";
import type { ExistingAccountInfo } from "./lib/view-state";

type Status =
  | "idle"
  | "creating"
  | "signing-in"
  | "success"
  | "magic-link-sent"
  | "error"
  | "skipped";

interface Props {
  reservationId: string;
  mode: "create" | "welcome-back";
  /**
   * For welcome-back mode, the resolved existing-account info from the
   * server: the email and which auth providers it has. Used to drive which
   * sign-in options to surface (no Google button if the account was never
   * linked to Google, no password form if no password was ever set).
   */
  existingAccount?: ExistingAccountInfo | null;
}

export function CreateAccountPrompt({
  reservationId,
  mode,
  existingAccount = null,
}: Props) {
  const pathname = usePathname();
  const [session, setSession] = useState<ConfirmationSession | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  useEffect(() => {
    setSession(readConfirmationSession(reservationId));
  }, [reservationId]);

  const email = existingAccount?.email || session?.guestEmail || "";
  const firstName = session?.guestFirstName ?? "";
  const lastName = session?.guestLastName ?? "";
  const phone = session?.guestPhone ?? "";

  // Provider gating for welcome-back mode. In create mode we always show
  // Google + password since the user is building a brand-new account.
  const isWelcomeBack = mode === "welcome-back";
  const providers = existingAccount?.providers ?? [];
  const showGoogleButton = isWelcomeBack ? providers.includes("google") : true;
  const showPasswordOption = isWelcomeBack ? providers.includes("email") : true;

  if (status === "skipped" || !email) return null;

  if (status === "success") {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-sm font-medium text-green-800">
              Account created! Taking you to your trip...
            </p>
          </div>
          <Button
            type="button"
            onClick={() => window.location.assign("/account/reservations")}
            className="w-full"
            size="sm"
          >
            View my trip
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (status === "magic-link-sent") {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="flex items-center gap-3 p-4">
          <Mail className="h-5 w-5 text-green-600" />
          <p className="text-sm font-medium text-green-800">
            Check your email for the login link to activate your account.
          </p>
        </CardContent>
      </Card>
    );
  }

  async function handleGoogle() {
    setErrorMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          window.location.origin +
          "/auth/callback?redirect=" +
          encodeURIComponent(pathname),
      },
    });
    if (error) {
      setErrorMessage(error.message);
      setStatus("error");
    }
  }

  async function handleMagicLink() {
    setErrorMessage("");
    setStatus("creating");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo:
          window.location.origin +
          "/auth/callback?redirect=" +
          encodeURIComponent(pathname),
      },
    });
    if (error) {
      setErrorMessage(error.message);
      setStatus("error");
    } else {
      setStatus("magic-link-sent");
    }
  }

  const passwordMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;
  const canSubmit =
    password.length >= 8 &&
    password === confirmPassword &&
    status !== "creating" &&
    status !== "signing-in";

  // Welcome-back mode: sign in to an existing account with their password.
  // Distinct from handlePasswordSubmit which CREATES an account.
  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!password || status === "signing-in" || status === "creating") return;
    setStatus("signing-in");
    setErrorMessage("");
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setErrorMessage(signInError.message);
        setStatus("error");
        return;
      }
      // Hard navigation so cookies propagate through middleware on the next
      // request — same reasoning as the post-create flow.
      window.location.assign("/account/reservations");
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setStatus("creating");
    setErrorMessage("");

    try {
      const res = await fetch("/api/account/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          phone,
          reservationId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrorMessage(data.error || "Failed to create account");
        setStatus("error");
        return;
      }

      // Account created — now establish a browser session with the same password
      // and redirect to the trips page. The success card is shown as a fallback
      // in case the sign-in step fails (e.g. transient network error).
      setStatus("signing-in");
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error(
          "[create-account] auto sign-in failed:",
          signInError.message
        );
        setStatus("success");
        return;
      }

      // Hard navigation so the request to /account/reservations carries the
      // freshly-set auth cookies through middleware. router.push() races the
      // RSC fetch against cookie propagation and gets stuck.
      window.location.assign("/account/reservations");
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div className="space-y-4">
      {isWelcomeBack && (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Signing in as{" "}
          <span className="font-medium text-foreground">{email}</span>
        </div>
      )}

      <div className="space-y-3">
        {showGoogleButton && (
          <button
            type="button"
            onClick={handleGoogle}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-white px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>
        )}
        <Button
          type="button"
          onClick={handleMagicLink}
          disabled={status === "creating"}
          variant={isWelcomeBack && !showGoogleButton ? "default" : "outline"}
          className="w-full"
        >
          {status === "creating" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              Send magic link
            </>
          )}
        </Button>
      </div>

      {isWelcomeBack && showPasswordOption && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          {!showPasswordForm ? (
            <button
              type="button"
              onClick={() => setShowPasswordForm(true)}
              className="w-full text-center text-sm font-medium text-primary hover:underline"
            >
              Sign in with password
            </button>
          ) : (
            <Card>
              <CardContent className="space-y-4 p-4">
                <form onSubmit={handlePasswordSignIn} className="space-y-4">
                  <div>
                    <label
                      htmlFor="signin-password"
                      className="mb-1 block text-sm font-medium"
                    >
                      Password
                    </label>
                    <Input
                      id="signin-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your password"
                      autoComplete="current-password"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={
                      !password ||
                      status === "signing-in" ||
                      status === "creating"
                    }
                    className="w-full"
                  >
                    {status === "signing-in" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing you in...
                      </>
                    ) : (
                      <>
                        <Lock className="mr-2 h-4 w-4" />
                        Sign in
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {mode === "create" && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          {!showPasswordForm ? (
            <button
              type="button"
              onClick={() => setShowPasswordForm(true)}
              className="w-full text-center text-sm font-medium text-primary hover:underline"
            >
              Create with email &amp; password
            </button>
          ) : (
            <Card>
              <CardContent className="space-y-4 p-4">
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="account-email"
                      className="mb-1 block text-sm font-medium"
                    >
                      Email
                    </label>
                    <Input
                      id="account-email"
                      type="email"
                      value={email}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="account-password"
                      className="mb-1 block text-sm font-medium"
                    >
                      Password
                    </label>
                    <Input
                      id="account-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      minLength={8}
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="account-confirm"
                      className="mb-1 block text-sm font-medium"
                    >
                      Confirm Password
                    </label>
                    <Input
                      id="account-confirm"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className={passwordMismatch ? "border-red-500" : ""}
                    />
                    {passwordMismatch && (
                      <p className="mt-1 text-xs text-red-500">
                        Passwords do not match
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={!canSubmit}
                    className="w-full"
                  >
                    {status === "creating" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : status === "signing-in" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing you in...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {status === "error" && (
        <p className="text-sm text-destructive">{errorMessage}</p>
      )}

      {mode === "create" && (
        <button
          type="button"
          onClick={() => setStatus("skipped")}
          className="w-full text-center text-sm text-muted-foreground hover:underline"
        >
          Skip for now
        </button>
      )}
    </div>
  );
}

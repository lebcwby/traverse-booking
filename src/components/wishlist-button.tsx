"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Heart, Mail, Lock, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase-auth";
import { identifyUser, trackAddToWishlist } from "@/lib/tracking";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Global cache of wishlisted listing IDs — shared across all WishlistButton instances
let wishlistCache: Set<string> | null = null;
let cachePromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

export function clearWishlistCache() {
  wishlistCache = null;
  cachePromise = null;
  notifyListeners();
}

async function loadWishlist() {
  try {
    const res = await fetch("/api/account/wishlists");
    if (!res.ok) {
      wishlistCache = new Set();
      return;
    }
    const data = await res.json();
    wishlistCache = new Set(
      data.map((w: { listing_id: string }) => w.listing_id)
    );
  } catch {
    wishlistCache = new Set();
  }
}

function useWishlistCache() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return wishlistCache;
}

export function WishlistButton({
  listingId,
  className = "",
  variant = "icon",
}: {
  listingId: string;
  className?: string;
  variant?: "icon" | "text";
}) {
  const supabase = createClient();
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const cache = useWishlistCache();

  const isSaved = cache?.has(listingId) ?? false;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setLoggedIn(!!user);
      if (user) {
        // Load wishlist cache once for all buttons
        if (!cachePromise) {
          cachePromise = loadWishlist().then(notifyListeners);
        }
      } else {
        // Clear stale cache when logged out
        if (wishlistCache && wishlistCache.size > 0) {
          clearWishlistCache();
        }
      }
    });
  }, [supabase.auth]);

  const toggle = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (loggedIn === false) {
        setShowLoginDialog(true);
        return;
      }

      // Auth check still loading
      if (loggedIn === null) return;

      if (loading) return;
      setLoading(true);

      try {
        const method = isSaved ? "DELETE" : "POST";
        const res = await fetch("/api/account/wishlists", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listing_id: listingId }),
        });

        if (res.ok) {
          if (isSaved) {
            wishlistCache?.delete(listingId);
          } else {
            wishlistCache?.add(listingId);
            trackAddToWishlist(listingId);
          }
          notifyListeners();
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    },
    [loggedIn, loading, isSaved, listingId]
  );

  const dialogEl = (
    <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center">
          <Image
            src="/book-traverse-icon.png"
            alt="Book Traverse"
            width={40}
            height={45}
            className="mb-1"
          />
          <DialogTitle>Log in to save</DialogTitle>
          <DialogDescription className="text-center">
            Sign in to save your favorite properties and access them anytime.
          </DialogDescription>
        </DialogHeader>
        <LoginForm onSuccess={() => setShowLoginDialog(false)} />
      </DialogContent>
    </Dialog>
  );

  if (variant === "text") {
    return (
      <>
        <button
          onClick={toggle}
          className={`flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-2 hover:underline ${className}`}
          aria-label={isSaved ? "Remove from wishlist" : "Save to wishlist"}
        >
          <Heart
            className={`h-4 w-4 transition-colors ${
              isSaved ? "fill-red-500 text-red-500" : "text-foreground"
            }`}
          />
          {isSaved ? "Saved" : "Save"}
        </button>
        {dialogEl}
      </>
    );
  }

  return (
    <>
      <button
        onClick={toggle}
        className={`flex items-center justify-center rounded-full transition-all ${className}`}
        aria-label={isSaved ? "Remove from wishlist" : "Save to wishlist"}
      >
        <Heart
          className={`h-5 w-5 drop-shadow-md transition-colors ${
            isSaved
              ? "fill-red-500 text-red-500"
              : "fill-black/30 text-white hover:fill-red-500 hover:text-red-500"
          }`}
        />
      </button>
      {dialogEl}
    </>
  );
}

type LoginMode = "magic-link" | "sign-in" | "sign-up" | "forgot-password";

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const router = useRouter();
  const supabase = createClient();
  const callbackUrl =
    typeof window !== "undefined"
      ? window.location.origin +
        "/auth/callback?redirect=" +
        encodeURIComponent(window.location.pathname)
      : "/auth/callback";

  const [mode, setMode] = useState<LoginMode>("magic-link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function clearMessages() {
    setError(null);
    setSuccess(null);
  }

  function switchMode(next: LoginMode) {
    clearMessages();
    setMode(next);
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    setFormLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: callbackUrl },
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
      setFormLoading(false);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    setFormLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      identifyUser(email);
      clearWishlistCache();
      cachePromise = loadWishlist().then(notifyListeners);
      onSuccess();
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Invalid email or password."
      );
    } finally {
      setFormLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    setFormLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: callbackUrl },
      });
      if (error) throw error;
      setSuccess("Check your email to confirm your account.");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not create account. Please try again."
      );
    } finally {
      setFormLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    setFormLoading(true);
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
      setFormLoading(false);
    }
  }

  async function handleOAuth(provider: "google") {
    clearMessages();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl },
    });
    if (error) {
      setError(error.message);
    }
  }

  const inputClass =
    "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary";

  const primaryButtonClass =
    "w-full rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50";

  return (
    <div className="space-y-4">
      {/* Social sign-in */}
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
              <span className="bg-white px-2 text-muted-foreground">or</span>
            </div>
          </div>
        </div>
      )}

      {/* Magic link form */}
      {mode === "magic-link" && (
        <form onSubmit={handleMagicLink} className="space-y-4">
          <div>
            <label
              htmlFor="dialog-email"
              className="block text-sm font-medium text-foreground"
            >
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="dialog-email"
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
            disabled={formLoading}
            className={primaryButtonClass}
          >
            {formLoading ? (
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
              Sign in with password
            </button>
          </p>
        </form>
      )}

      {/* Sign in form */}
      {mode === "sign-in" && (
        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label
              htmlFor="dialog-email"
              className="block text-sm font-medium text-foreground"
            >
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="dialog-email"
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
              htmlFor="dialog-password"
              className="block text-sm font-medium text-foreground"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="dialog-password"
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
            disabled={formLoading}
            className={primaryButtonClass}
          >
            {formLoading ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            ) : (
              "Sign In"
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
          <p className="text-center text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => switchMode("magic-link")}
              className="text-primary hover:underline"
            >
              Use magic link instead
            </button>
          </p>
        </form>
      )}

      {/* Sign up form */}
      {mode === "sign-up" && (
        <form onSubmit={handleSignUp} className="space-y-4">
          <div>
            <label
              htmlFor="dialog-email"
              className="block text-sm font-medium text-foreground"
            >
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="dialog-email"
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
              htmlFor="dialog-password"
              className="block text-sm font-medium text-foreground"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="dialog-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className={inputClass + " pl-9"}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={formLoading}
            className={primaryButtonClass}
          >
            {formLoading ? (
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

      {/* Forgot password form */}
      {mode === "forgot-password" && (
        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div>
            <label
              htmlFor="dialog-email"
              className="block text-sm font-medium text-foreground"
            >
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="dialog-email"
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
            disabled={formLoading}
            className={primaryButtonClass}
          >
            {formLoading ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            ) : (
              "Send reset link"
            )}
          </button>
          <p className="text-center text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => switchMode("sign-in")}
              className="text-primary hover:underline"
            >
              Back to sign in
            </button>
          </p>
        </form>
      )}

      {/* Status messages */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}
    </div>
  );
}

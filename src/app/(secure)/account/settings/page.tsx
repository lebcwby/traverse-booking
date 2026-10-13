"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { format, parseISO, isAfter, startOfToday } from "date-fns";
import {
  Loader2,
  Camera,
  Home,
  User,
  Lock,
  Luggage,
  LogOut,
  ChevronRight,
  ArrowLeft,
  Heart,
} from "lucide-react";
import { createClient } from "@/lib/supabase-auth";

interface Reservation {
  reservation_id: string;
  listing_name: string | null;
  listing_photo: string | null;
  check_in: string | null;
  check_out: string | null;
  status: string | null;
}

type Section = "personal" | "security" | "trips";

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function AccountSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isOAuthOnly, setIsOAuthOnly] = useState(false);

  const initialSection = (searchParams.get("section") as Section) || "personal";
  const [activeSection, setActiveSection] = useState<Section>(
    ["personal", "security", "trips"].includes(initialSection)
      ? initialSection
      : "personal"
  );

  const [mobileView, setMobileView] = useState<"personal" | "security" | null>(
    null
  );

  // Which field is currently being edited
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [fieldSaving, setFieldSaving] = useState(false);
  const [fieldMessage, setFieldMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [avatarUploading, setAvatarUploading] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [pastTrips, setPastTrips] = useState<Reservation[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login?redirect=/account/settings");
        return;
      }
      setUserId(user.id);
      setEmail(user.email || "");
      setFullName(user.user_metadata?.full_name || "");
      setPhone(formatPhone(user.user_metadata?.phone || ""));
      setAvatarUrl(user.user_metadata?.avatar_url || null);

      const hasPasswordIdentity = user.identities?.some(
        (i) => i.provider === "email"
      );
      setIsOAuthOnly(!hasPasswordIdentity);
      setLoading(false);
    }
    loadUser();
  }, [supabase.auth, router]);

  useEffect(() => {
    async function loadTrips() {
      try {
        const res = await fetch("/api/account/reservations");
        if (!res.ok) return;
        const data: Reservation[] = await res.json();
        const today = startOfToday();
        const isCancelled = (s: string | null) =>
          s?.toLowerCase() === "canceled" || s?.toLowerCase() === "cancelled";
        const past = data.filter(
          (r) =>
            isCancelled(r.status) ||
            (r.check_in && !isAfter(parseISO(r.check_in), today))
        );
        setPastTrips(past);
      } catch {
        // silently fail
      } finally {
        setTripsLoading(false);
      }
    }
    loadTrips();
  }, []);

  function startEditingField(field: string, currentValue: string) {
    setEditingField(field);
    setEditValue(currentValue);
    setFieldMessage(null);
  }

  function cancelEditing() {
    setEditingField(null);
    setEditValue("");
    setFieldMessage(null);
  }

  async function saveField(field: string) {
    setFieldMessage(null);
    setFieldSaving(true);
    try {
      if (field === "name") {
        const { error } = await supabase.auth.updateUser({
          data: { full_name: editValue },
        });
        if (error) throw error;
        setFullName(editValue);
      } else if (field === "phone") {
        const { error } = await supabase.auth.updateUser({
          data: { phone: editValue },
        });
        if (error) throw error;
        setPhone(editValue);
      }
      setEditingField(null);
      setEditValue("");
    } catch (err) {
      setFieldMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save.",
      });
    } finally {
      setFieldSaving(false);
    }
  }

  const handleAvatarUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !userId) return;

      setAvatarUploading(true);
      try {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${userId}/avatar.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, file, { upsert: true });
        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("avatars").getPublicUrl(path);

        const url = `${publicUrl}?t=${Date.now()}`;

        const { error: updateError } = await supabase.auth.updateUser({
          data: { avatar_url: url },
        });
        if (updateError) throw updateError;

        setAvatarUrl(url);
      } catch (err) {
        setFieldMessage({
          type: "error",
          text: err instanceof Error ? err.message : "Failed to upload photo.",
        });
      } finally {
        setAvatarUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [userId, supabase.storage, supabase.auth]
  );

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword.length < 6) {
      setPasswordMessage({
        type: "error",
        text: "Password must be at least 6 characters.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage({ type: "success", text: "Password updated." });
    } catch (err) {
      setPasswordMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update password.",
      });
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-16 sm:px-8">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary";
  const displayName = fullName || email.split("@")[0];

  const navItems: { key: Section; label: string; icon: React.ReactNode }[] = [
    {
      key: "personal",
      label: "Personal info",
      icon: <User className="h-5 w-5" />,
    },
    {
      key: "security",
      label: "Login & security",
      icon: <Lock className="h-5 w-5" />,
    },
    {
      key: "trips",
      label: "Past trips",
      icon: <Luggage className="h-5 w-5" />,
    },
  ];

  const firstTripPhoto = pastTrips[0]?.listing_photo;

  return (
    <>
      {/* ── Mobile Profile Hub ── */}
      <div className="md:hidden">
        {mobileView === null ? (
          <div className="px-6 pb-8 pt-6">
            {/* Header */}
            <h1 className="text-2xl font-bold text-foreground">Profile</h1>

            {/* Profile Card */}
            <div className="mt-6 rounded-2xl border border-border p-5 shadow-sm">
              <div className="flex items-center gap-5">
                {/* Avatar + name */}
                <div className="flex flex-col items-center">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-muted">
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt={displayName}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-primary/10 text-2xl font-semibold text-primary">
                        {displayName[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {displayName}
                  </p>
                  <p className="text-xs text-muted-foreground">Guest</p>
                </div>

                {/* Stats */}
                <div className="ml-auto flex gap-6 text-center">
                  <div>
                    <p className="text-xl font-bold text-foreground">
                      {pastTrips.length}
                    </p>
                    <p className="text-xs text-muted-foreground">Trips</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action Cards */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Link
                href="/account/reservations"
                className="group overflow-hidden rounded-xl border border-border shadow-sm"
              >
                <div className="relative h-24 w-full bg-muted">
                  {firstTripPhoto ? (
                    <Image
                      src={firstTripPhoto}
                      alt="Past trips"
                      fill
                      className="object-cover"
                      sizes="50vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Luggage className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <p className="px-3 py-2.5 text-sm font-medium text-foreground">
                  Past trips
                </p>
              </Link>
              <Link
                href="/account/wishlists"
                className="flex flex-col items-center justify-center rounded-xl border border-border px-3 py-6 shadow-sm"
              >
                <Heart className="h-7 w-7 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium text-foreground">
                  Wishlists
                </p>
              </Link>
            </div>

            {/* Menu Items */}
            <div className="mt-6 space-y-0 divide-y divide-border">
              <button
                onClick={() => {
                  setMobileView("personal");
                  cancelEditing();
                }}
                className="flex w-full items-center gap-3 py-4 text-left"
              >
                <User className="h-5 w-5 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium text-foreground">
                  Personal info
                </span>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
              <button
                onClick={() => {
                  setMobileView("security");
                  cancelEditing();
                }}
                className="flex w-full items-center gap-3 py-4 text-left"
              >
                <Lock className="h-5 w-5 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium text-foreground">
                  Login & security
                </span>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
              <Link
                href="/contact"
                className="flex w-full items-center gap-3 py-4"
              >
                <Home className="h-5 w-5 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium text-foreground">
                  Contact
                </span>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Link>
              <Link
                href="/terms"
                className="flex w-full items-center gap-3 py-4"
              >
                <Home className="h-5 w-5 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium text-foreground">
                  Terms
                </span>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Link>
              <Link
                href="/privacy"
                className="flex w-full items-center gap-3 py-4"
              >
                <Home className="h-5 w-5 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium text-foreground">
                  Privacy
                </span>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Link>
            </div>

            {/* Divider + Log out */}
            <div className="mt-2 border-t border-border pt-2">
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 py-4 text-left"
              >
                <LogOut className="h-5 w-5 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium text-foreground">
                  Log out
                </span>
              </button>
            </div>
          </div>
        ) : (
          /* ── Mobile Sub-view (Personal / Security) ── */
          <div className="px-6 pb-8 pt-6">
            <button
              onClick={() => {
                setMobileView(null);
                cancelEditing();
              }}
              className="flex items-center gap-1 text-sm text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            {mobileView === "personal" && (
              <div className="mt-4">
                <h2 className="text-xl font-semibold text-foreground">
                  Personal info
                </h2>

                {/* Avatar row */}
                <div className="mt-6 flex items-center justify-between border-b border-border pb-6">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-muted"
                      disabled={avatarUploading}
                    >
                      {avatarUrl ? (
                        <Image
                          src={avatarUrl}
                          alt={displayName}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-primary/10 text-xl font-semibold text-primary">
                          {displayName[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                        {avatarUploading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-white" />
                        ) : (
                          <Camera className="h-4 w-4 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                        )}
                      </div>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Profile photo
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {avatarUrl
                          ? "Click photo to change"
                          : "Click to upload"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm font-semibold text-foreground underline underline-offset-2 hover:text-foreground/70"
                  >
                    Edit
                  </button>
                </div>

                {/* Name row */}
                <div className="border-b border-border py-6">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        Name
                      </p>
                      {editingField === "name" ? (
                        <div className="mt-2 space-y-3">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            placeholder="Your name"
                            className={inputClass}
                            autoFocus
                          />
                          {fieldMessage && editingField === "name" && (
                            <p
                              className={`text-xs ${fieldMessage.type === "error" ? "text-red-600" : "text-green-600"}`}
                            >
                              {fieldMessage.text}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveField("name")}
                              disabled={fieldSaving}
                              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-foreground/80 disabled:opacity-50"
                            >
                              {fieldSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Save"
                              )}
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="text-sm font-medium text-foreground underline underline-offset-2"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {fullName || "Not provided"}
                        </p>
                      )}
                    </div>
                    {editingField !== "name" && (
                      <button
                        onClick={() => startEditingField("name", fullName)}
                        className="shrink-0 text-sm font-semibold text-foreground underline underline-offset-2 hover:text-foreground/70"
                      >
                        {fullName ? "Edit" : "Add"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Email row */}
                <div className="border-b border-border py-6">
                  <p className="text-sm font-medium text-foreground">
                    Email address
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {email}
                  </p>
                </div>

                {/* Phone row */}
                <div className="border-b border-border py-6">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        Phone number
                      </p>
                      {editingField === "phone" ? (
                        <div className="mt-2 space-y-3">
                          <input
                            type="tel"
                            value={editValue}
                            onChange={(e) =>
                              setEditValue(formatPhone(e.target.value))
                            }
                            placeholder="(555) 555-5555"
                            className={inputClass}
                            autoFocus
                          />
                          {fieldMessage && editingField === "phone" && (
                            <p
                              className={`text-xs ${fieldMessage.type === "error" ? "text-red-600" : "text-green-600"}`}
                            >
                              {fieldMessage.text}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveField("phone")}
                              disabled={fieldSaving}
                              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-foreground/80 disabled:opacity-50"
                            >
                              {fieldSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Save"
                              )}
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="text-sm font-medium text-foreground underline underline-offset-2"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {phone || "Not provided"}
                        </p>
                      )}
                    </div>
                    {editingField !== "phone" && (
                      <button
                        onClick={() => startEditingField("phone", phone)}
                        className="shrink-0 text-sm font-semibold text-foreground underline underline-offset-2 hover:text-foreground/70"
                      >
                        {phone ? "Edit" : "Add"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {mobileView === "security" && (
              <div className="mt-4">
                <h2 className="text-xl font-semibold text-foreground">
                  Login & security
                </h2>

                {/* Password row */}
                <div className="mt-6 border-b border-border pb-6">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        Password
                      </p>
                      {isOAuthOnly ? (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          You sign in with Google. No password set.
                        </p>
                      ) : editingField === "password" ? (
                        <form
                          onSubmit={handlePasswordChange}
                          className="mt-2 space-y-3"
                        >
                          <input
                            type="password"
                            required
                            minLength={6}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="New password"
                            className={inputClass}
                            autoFocus
                          />
                          <input
                            type="password"
                            required
                            minLength={6}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                            className={inputClass}
                          />
                          {passwordMessage && (
                            <p
                              className={`text-xs ${passwordMessage.type === "error" ? "text-red-600" : "text-green-600"}`}
                            >
                              {passwordMessage.text}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={passwordSaving}
                              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-foreground/80 disabled:opacity-50"
                            >
                              {passwordSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Update"
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingField(null);
                                setNewPassword("");
                                setConfirmPassword("");
                                setPasswordMessage(null);
                              }}
                              className="text-sm font-medium text-foreground underline underline-offset-2"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          Last updated: unknown
                        </p>
                      )}
                    </div>
                    {!isOAuthOnly && editingField !== "password" && (
                      <button
                        onClick={() => {
                          setEditingField("password");
                          setPasswordMessage(null);
                        }}
                        className="shrink-0 text-sm font-semibold text-foreground underline underline-offset-2 hover:text-foreground/70"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                {/* Login method row */}
                <div className="border-b border-border py-6">
                  <p className="text-sm font-medium text-foreground">
                    Login method
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {isOAuthOnly ? "Google" : "Email & password"}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Desktop Settings (unchanged) ── */}
      <div className="hidden md:block">
        <div className="mx-auto max-w-5xl px-6 py-12 sm:px-8 sm:py-16">
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
            Account settings
          </h1>

          <div className="mt-8 flex flex-col gap-10 md:flex-row md:gap-16">
            {/* Sidebar */}
            <nav className="w-full shrink-0 md:w-64">
              <ul className="space-y-1">
                {navItems.map((item) => (
                  <li key={item.key}>
                    <button
                      onClick={() => setActiveSection(item.key)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        activeSection === item.key
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  </li>
                ))}
                <li>
                  <div className="my-2 border-t border-border" />
                </li>
                <li>
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  >
                    <LogOut className="h-5 w-5" />
                    Log out
                  </button>
                </li>
              </ul>
            </nav>

            {/* Content */}
            <div className="min-w-0 flex-1">
              {/* ── Personal Info ── */}
              {activeSection === "personal" && (
                <div>
                  <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
                    Personal info
                  </h2>

                  {/* Avatar row */}
                  <div className="mt-8 flex items-center justify-between border-b border-border pb-6">
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-muted"
                        disabled={avatarUploading}
                      >
                        {avatarUrl ? (
                          <Image
                            src={avatarUrl}
                            alt={displayName}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-primary/10 text-xl font-semibold text-primary">
                            {displayName[0]?.toUpperCase()}
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                          {avatarUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                          ) : (
                            <Camera className="h-4 w-4 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                          )}
                        </div>
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleAvatarUpload}
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Profile photo
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {avatarUrl
                            ? "Click photo to change"
                            : "Click to upload"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-sm font-semibold text-foreground underline underline-offset-2 hover:text-foreground/70"
                    >
                      Edit
                    </button>
                  </div>

                  {/* Name row */}
                  <div className="border-b border-border py-6">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          Name
                        </p>
                        {editingField === "name" ? (
                          <div className="mt-2 max-w-sm space-y-3">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              placeholder="Your name"
                              className={inputClass}
                              autoFocus
                            />
                            {fieldMessage && editingField === "name" && (
                              <p
                                className={`text-xs ${fieldMessage.type === "error" ? "text-red-600" : "text-green-600"}`}
                              >
                                {fieldMessage.text}
                              </p>
                            )}
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveField("name")}
                                disabled={fieldSaving}
                                className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-foreground/80 disabled:opacity-50"
                              >
                                {fieldSaving ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Save"
                                )}
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="text-sm font-medium text-foreground underline underline-offset-2"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {fullName || "Not provided"}
                          </p>
                        )}
                      </div>
                      {editingField !== "name" && (
                        <button
                          onClick={() => startEditingField("name", fullName)}
                          className="shrink-0 text-sm font-semibold text-foreground underline underline-offset-2 hover:text-foreground/70"
                        >
                          {fullName ? "Edit" : "Add"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Email row */}
                  <div className="border-b border-border py-6">
                    <p className="text-sm font-medium text-foreground">
                      Email address
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {email}
                    </p>
                  </div>

                  {/* Phone row */}
                  <div className="border-b border-border py-6">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          Phone number
                        </p>
                        {editingField === "phone" ? (
                          <div className="mt-2 max-w-sm space-y-3">
                            <input
                              type="tel"
                              value={editValue}
                              onChange={(e) =>
                                setEditValue(formatPhone(e.target.value))
                              }
                              placeholder="(555) 555-5555"
                              className={inputClass}
                              autoFocus
                            />
                            {fieldMessage && editingField === "phone" && (
                              <p
                                className={`text-xs ${fieldMessage.type === "error" ? "text-red-600" : "text-green-600"}`}
                              >
                                {fieldMessage.text}
                              </p>
                            )}
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveField("phone")}
                                disabled={fieldSaving}
                                className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-foreground/80 disabled:opacity-50"
                              >
                                {fieldSaving ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Save"
                                )}
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="text-sm font-medium text-foreground underline underline-offset-2"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {phone || "Not provided"}
                          </p>
                        )}
                      </div>
                      {editingField !== "phone" && (
                        <button
                          onClick={() => startEditingField("phone", phone)}
                          className="shrink-0 text-sm font-semibold text-foreground underline underline-offset-2 hover:text-foreground/70"
                        >
                          {phone ? "Edit" : "Add"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Login & Security ── */}
              {activeSection === "security" && (
                <div>
                  <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
                    Login & security
                  </h2>

                  {/* Password row */}
                  <div className="mt-8 border-b border-border pb-6">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          Password
                        </p>
                        {isOAuthOnly ? (
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            You sign in with Google. No password set.
                          </p>
                        ) : editingField === "password" ? (
                          <form
                            onSubmit={handlePasswordChange}
                            className="mt-2 max-w-sm space-y-3"
                          >
                            <input
                              type="password"
                              required
                              minLength={6}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="New password"
                              className={inputClass}
                              autoFocus
                            />
                            <input
                              type="password"
                              required
                              minLength={6}
                              value={confirmPassword}
                              onChange={(e) =>
                                setConfirmPassword(e.target.value)
                              }
                              placeholder="Confirm new password"
                              className={inputClass}
                            />
                            {passwordMessage && (
                              <p
                                className={`text-xs ${passwordMessage.type === "error" ? "text-red-600" : "text-green-600"}`}
                              >
                                {passwordMessage.text}
                              </p>
                            )}
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={passwordSaving}
                                className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-foreground/80 disabled:opacity-50"
                              >
                                {passwordSaving ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Update"
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingField(null);
                                  setNewPassword("");
                                  setConfirmPassword("");
                                  setPasswordMessage(null);
                                }}
                                className="text-sm font-medium text-foreground underline underline-offset-2"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : (
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            Last updated: unknown
                          </p>
                        )}
                      </div>
                      {!isOAuthOnly && editingField !== "password" && (
                        <button
                          onClick={() => {
                            setEditingField("password");
                            setPasswordMessage(null);
                          }}
                          className="shrink-0 text-sm font-semibold text-foreground underline underline-offset-2 hover:text-foreground/70"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Account row */}
                  <div className="border-b border-border py-6">
                    <p className="text-sm font-medium text-foreground">
                      Login method
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {isOAuthOnly ? "Google" : "Email & password"}
                    </p>
                  </div>
                </div>
              )}

              {/* ── Past Trips ── */}
              {activeSection === "trips" && (
                <div>
                  <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
                    Past trips
                  </h2>

                  {tripsLoading ? (
                    <div className="mt-8 flex justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : pastTrips.length === 0 ? (
                    <div className="mt-8">
                      <p className="text-sm text-muted-foreground">
                        No past trips yet.
                      </p>
                      <Link
                        href="/properties"
                        className="mt-3 inline-block text-sm font-medium text-primary underline underline-offset-4 hover:opacity-80"
                      >
                        Browse properties
                      </Link>
                    </div>
                  ) : (
                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      {pastTrips.map((trip) => (
                        <Link
                          key={trip.reservation_id}
                          href={`/account/reservations/${trip.reservation_id}`}
                          className="group overflow-hidden rounded-xl border border-border transition-shadow hover:shadow-md"
                        >
                          <div className="relative h-36 w-full bg-muted">
                            {trip.listing_photo ? (
                              <Image
                                src={trip.listing_photo}
                                alt={trip.listing_name || "Property"}
                                fill
                                className="object-cover"
                                sizes="(min-width: 640px) 50vw, 100vw"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <Home className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="font-medium text-foreground truncate">
                              {trip.listing_name || "Property"}
                            </p>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {trip.check_in && trip.check_out
                                ? `${format(parseISO(trip.check_in), "MMM d")} – ${format(parseISO(trip.check_out), "MMM d, yyyy")}`
                                : "Dates TBD"}
                            </p>
                            {(trip.status?.toLowerCase() === "canceled" ||
                              trip.status?.toLowerCase() === "cancelled") && (
                              <span className="mt-1.5 inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                                Cancelled
                              </span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

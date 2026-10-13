"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, Home, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  readConfirmationSession,
  type ConfirmationSession,
} from "./lib/confirmation-session";
import type { ClientSafeViewState } from "./lib/view-state";
import { CreateAccountPrompt } from "./create-account-prompt";

interface Props {
  state: ClientSafeViewState;
  reservationId: string;
}

function getLoginHref(
  reservationId: string,
  mode: "sign-in" | "sign-up"
): string {
  const redirect = encodeURIComponent(`/book/confirmation/${reservationId}`);
  return `/login?redirect=${redirect}&mode=${mode}`;
}

export function WhatsNext({ state, reservationId }: Props) {
  const [session, setSession] = useState<ConfirmationSession | null>(null);

  useEffect(() => {
    setSession(readConfirmationSession(reservationId));
  }, [reservationId]);

  if (state.kind === "stranger") return null;

  const ownerName =
    state.kind === "owner" && session?.guestFirstName
      ? session.guestFirstName
      : null;
  const showInlinePrompt =
    (state.kind === "guest" || state.kind === "existing-account") &&
    Boolean(session?.guestEmail);
  const fallbackMode =
    state.kind === "existing-account" ? "sign-in" : "sign-up";

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <h3 className="font-semibold">What&apos;s Next</h3>

        {state.kind === "owner" && (
          <div className="flex items-center gap-2 rounded-lg bg-primary/10 p-3 text-sm font-medium text-primary">
            <CheckCircle className="h-4 w-4 shrink-0" />
            {ownerName
              ? `Saved to your account, ${ownerName}`
              : "Saved to your account"}
          </div>
        )}

        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p>
            You&apos;ll receive a confirmation email with your booking details,
            check-in instructions, and property access information.
          </p>
        </div>

        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          <Home className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p>
            Check-in details including property address and access codes will be
            sent closer to your arrival date.
          </p>
        </div>

        {(state.kind === "guest" || state.kind === "existing-account") && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <User className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {state.kind === "existing-account"
                      ? "Welcome back"
                      : "Save this trip to your account"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {state.kind === "existing-account"
                      ? "Sign in to add this reservation to your account."
                      : "Create an account to manage your reservation and book faster next time."}
                  </p>
                </div>
              </div>

              {showInlinePrompt ? (
                <CreateAccountPrompt
                  reservationId={reservationId}
                  mode={
                    state.kind === "existing-account"
                      ? "welcome-back"
                      : "create"
                  }
                  existingAccount={
                    state.kind === "existing-account" ? state.account : null
                  }
                />
              ) : (
                <Button asChild className="w-full">
                  <Link href={getLoginHref(reservationId, fallbackMode)}>
                    {state.kind === "existing-account"
                      ? "Sign In to Manage This Trip"
                      : "Create Account to Manage This Trip"}
                  </Link>
                </Button>
              )}
            </div>
          </>
        )}

        <Separator />

        <div className="flex flex-col gap-3">
          {state.kind === "owner" && (
            <Button asChild>
              <Link href="/account/reservations">View Your Trips</Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/properties">Browse More Properties</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

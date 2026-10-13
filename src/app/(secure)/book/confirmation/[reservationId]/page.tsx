import Image from "next/image";
import { CheckCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { TrackConfirmation } from "./track-confirmation";
import { ConfirmationCode } from "./confirmation-code";
import { BookingSummary } from "./booking-summary";
import { SubscribePrompt } from "./subscribe-prompt";
import { WhatsNext } from "./whats-next";
import {
  AuthResolutionError,
  ReservationNotFoundError,
  resolveViewState,
} from "./lib/resolve-view-state";
import { toClientSafeViewState } from "./lib/view-state";

interface Props {
  params: Promise<{ reservationId: string }>;
}

export default async function ConfirmationPage({ params }: Props) {
  const { reservationId } = await params;

  let viewState;
  try {
    viewState = await resolveViewState(reservationId);
  } catch (error) {
    if (error instanceof ReservationNotFoundError) {
      notFound();
    }

    if (error instanceof AuthResolutionError) {
      throw error;
    }

    throw error;
  }

  if (viewState.kind === "stranger") {
    notFound();
  }

  const data = viewState.data;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12 sm:px-6 lg:max-w-5xl lg:px-8">
      <TrackConfirmation reservationId={reservationId} />

      <Card className="mb-6">
        <CardContent className="flex flex-col items-center gap-3 p-6 sm:flex-row sm:gap-5 sm:p-8">
          <Link href="/" className="shrink-0">
            <Image
              src="/book-traverse-wordmark-dark.png"
              alt="Book Traverse"
              width={120}
              height={40}
            />
          </Link>
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">
                Booking Confirmed!
              </h1>
              <p className="text-sm text-muted-foreground">
                Your reservation has been successfully created.
              </p>
            </div>
          </div>
          <div className="sm:ml-auto">
            <ConfirmationCode code={data.confirmationCode} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <BookingSummary data={data} />
        </div>

        <div className="space-y-6 lg:col-span-2">
          <WhatsNext
            state={toClientSafeViewState(viewState)}
            reservationId={reservationId}
          />
          <SubscribePrompt
            reservationId={reservationId}
            isOwner={viewState.kind === "owner"}
          />
        </div>
      </div>
    </div>
  );
}

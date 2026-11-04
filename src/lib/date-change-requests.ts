/**
 * Guest date-change requests.
 *
 * Guests do not extend, shorten, or move a stay themselves. They ask, and a
 * teammate approves the change in Guesty or writes back. This module is the
 * copy and the validation for that request. It does not charge, refund, or
 * call Guesty.
 *
 * A refund of a price difference follows the 14-day cancellation policy,
 * measured against the check-in that is booked today. The team applies that
 * when they approve. This file does not move money.
 */

import {
  CANCELLATION_POLICY_DAYS,
  isFullRefundEligible,
  resolveCheckInDate,
} from "./cancellation-policy";

export const DATE_CHANGE_NOTE_MAX = 2000;

export const DATE_CHANGE_REQUEST_LEAD =
  "This is a request, not a confirmed change. Your stay stays as booked until our team approves it or contacts you. Submitting a request does not charge your card, issue a refund, or change the reservation.";

export const DATE_CHANGE_REQUEST_SUMMARY = `Date changes are requests, not self-service. A guest submits the dates they want from their account; the team approves the change or contacts them. Nothing is charged, refunded, or changed on the reservation until then. Any price difference or refund follows the ${CANCELLATION_POLICY_DAYS}-day cancellation policy.`;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatStayDate(iso: string): string {
  const match = DATE_ONLY.exec(iso);
  if (!match) return iso;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return iso;
  return `${MONTHS[month - 1]} ${day}, ${match[1]}`;
}

/**
 * What a price difference means for this stay. With a check-in, the sentence
 * says whether a cheaper stay can still be refunded. Without one, it states
 * the rule.
 */
export function dateChangePriceCopy(
  checkIn?: string | null,
  now: Date = new Date()
): string {
  const arrival = checkIn ? resolveCheckInDate(checkIn) : null;
  const charge =
    "If the approved dates cost more, we'll confirm the difference with you before any charge.";

  if (!arrival) {
    return `${charge} If they cost less, a refund follows the ${CANCELLATION_POLICY_DAYS}-day cancellation policy: the difference is refunded only when the request is made ${CANCELLATION_POLICY_DAYS} or more days before check-in. Within ${CANCELLATION_POLICY_DAYS} days the original stay is non-refundable.`;
  }

  if (isFullRefundEligible(arrival, now)) {
    return `${charge} You're ${CANCELLATION_POLICY_DAYS} or more days before check-in, so if the approved dates cost less, that difference can be refunded.`;
  }

  return `${charge} You're within ${CANCELLATION_POLICY_DAYS} days of check-in, so the original stay is non-refundable and a shorter or cheaper stay is not refunded.`;
}

export interface ParsedDateChangeRequest {
  requestedCheckIn: string;
  requestedCheckOut: string;
  note: string | null;
}

function isRealCalendarDate(iso: string): boolean {
  const match = DATE_ONLY.exec(iso);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 2020 || year > 2040) return false;
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

export function parseDateChangeRequest(
  body: {
    requestedCheckIn?: unknown;
    requestedCheckOut?: unknown;
    note?: unknown;
  },
  currentCheckIn: string,
  currentCheckOut: string
): { ok: true; value: ParsedDateChangeRequest } | { ok: false; error: string } {
  const requestedCheckIn = body.requestedCheckIn;
  const requestedCheckOut = body.requestedCheckOut;
  if (
    typeof requestedCheckIn !== "string" ||
    typeof requestedCheckOut !== "string"
  ) {
    return { ok: false, error: "Choose a check-in and a check-out date." };
  }
  if (
    !isRealCalendarDate(requestedCheckIn) ||
    !isRealCalendarDate(requestedCheckOut)
  ) {
    return { ok: false, error: "Those dates aren't valid." };
  }
  if (requestedCheckOut <= requestedCheckIn) {
    return { ok: false, error: "Check-out must be after check-in." };
  }
  if (
    requestedCheckIn === currentCheckIn &&
    requestedCheckOut === currentCheckOut
  ) {
    return { ok: false, error: "Those are already your dates." };
  }

  if (body.note != null && typeof body.note !== "string") {
    return { ok: false, error: "The note has to be text." };
  }
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > DATE_CHANGE_NOTE_MAX) {
    return {
      ok: false,
      error: `Keep the note under ${DATE_CHANGE_NOTE_MAX} characters.`,
    };
  }

  return {
    ok: true,
    value: {
      requestedCheckIn,
      requestedCheckOut,
      note: note.length > 0 ? note : null,
    },
  };
}

export function guestDisplayName(guest: unknown): string | null {
  if (!guest || typeof guest !== "object") return null;
  const record = guest as Record<string, unknown>;
  const full =
    typeof record.fullName === "string" ? record.fullName.trim() : "";
  if (full) return full;
  const first =
    typeof record.firstName === "string" ? record.firstName.trim() : "";
  const last =
    typeof record.lastName === "string" ? record.lastName.trim() : "";
  const joined = `${first} ${last}`.trim();
  return joined || null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildDateChangeRequestAlert(input: {
  requestId: string;
  reservationId: string;
  confirmationCode: string | null;
  guestName: string | null;
  guestEmail: string;
  currentCheckIn: string;
  currentCheckOut: string;
  requestedCheckIn: string;
  requestedCheckOut: string;
  note: string | null;
}): { subject: string; html: string; alertKey: string } {
  const who = input.confirmationCode || input.reservationId;
  const guest = input.guestName
    ? `${escapeHtml(input.guestName)} (${escapeHtml(input.guestEmail)})`
    : escapeHtml(input.guestEmail);
  const note = input.note
    ? escapeHtml(input.note).replaceAll("\n", "<br/>")
    : "None";

  return {
    subject: `Date change request — ${who}`,
    alertKey: `date-change-request-${input.requestId}`,
    html:
      `Guest ${guest} asked to change <strong>${escapeHtml(who)}</strong>.<br/><br/>` +
      `Current: ${formatStayDate(input.currentCheckIn)} – ${formatStayDate(input.currentCheckOut)}<br/>` +
      `Requested: ${formatStayDate(input.requestedCheckIn)} – ${formatStayDate(input.requestedCheckOut)}<br/><br/>` +
      `Note: ${note}<br/><br/>` +
      `This is a request only. Nothing was charged, refunded, or changed in Guesty. ` +
      `Approve the dates in Guesty, or reply to the guest. ` +
      `The row is in <code>date_change_requests</code> (id ${escapeHtml(input.requestId)}).`,
  };
}

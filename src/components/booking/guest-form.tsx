"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

export interface GuestInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface GuestFormProps {
  guest: GuestInfo;
  onChange: (guest: GuestInfo) => void;
  onEmailBlur?: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function stripPhoneFormatting(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function GuestForm({ guest, onChange, onEmailBlur }: GuestFormProps) {
  const [emailTouched, setEmailTouched] = useState(false);

  function update(field: keyof GuestInfo, value: string) {
    onChange({ ...guest, [field]: value });
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = stripPhoneFormatting(e.target.value);
    update("phone", raw);
  }

  const emailInvalid =
    emailTouched && guest.email.length > 0 && !isValidEmail(guest.email);

  return (
    <fieldset className="space-y-4" name="guest">
      <h3 className="text-lg font-semibold">Guest Information</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="guest-fname"
            className="mb-1.5 block text-sm font-medium sm:text-sm"
          >
            First Name *
          </label>
          <Input
            id="guest-fname"
            name="fname"
            autoComplete="given-name"
            value={guest.firstName}
            onChange={(e) => update("firstName", e.target.value)}
            className="h-11 text-base sm:h-9 sm:text-sm"
            required
          />
        </div>
        <div>
          <label
            htmlFor="guest-lname"
            className="mb-1.5 block text-sm font-medium sm:text-sm"
          >
            Last Name *
          </label>
          <Input
            id="guest-lname"
            name="lname"
            autoComplete="family-name"
            value={guest.lastName}
            onChange={(e) => update("lastName", e.target.value)}
            className="h-11 text-base sm:h-9 sm:text-sm"
            required
          />
        </div>
        <div>
          <label
            htmlFor="guest-email"
            className="mb-1.5 block text-sm font-medium sm:text-sm"
          >
            Email *
          </label>
          <Input
            id="guest-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={guest.email}
            onChange={(e) => update("email", e.target.value)}
            onBlur={() => {
              setEmailTouched(true);
              onEmailBlur?.();
            }}
            className={`h-11 text-base sm:h-9 sm:text-sm ${emailInvalid ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
            required
          />
          {emailInvalid && (
            <p className="mt-1 text-xs text-red-500">
              Please enter a valid email address
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="guest-phone"
            className="mb-1.5 block text-sm font-medium sm:text-sm"
          >
            Phone *
          </label>
          <Input
            id="guest-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(503) 555-1234"
            value={formatPhoneNumber(guest.phone)}
            onChange={handlePhoneChange}
            className="h-11 text-base sm:h-9 sm:text-sm"
            required
          />
        </div>
      </div>
    </fieldset>
  );
}

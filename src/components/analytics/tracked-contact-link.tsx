"use client";

import type { ReactNode } from "react";
import { trackEmailClick, trackPhoneClick } from "@/lib/tracking";

export function TrackedContactLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const isEmail = href.startsWith("mailto:");
  const isPhone = href.startsWith("tel:");

  return (
    <a
      href={href}
      className={className}
      onClick={() => {
        if (isEmail) trackEmailClick(href.replace(/^mailto:/, ""));
        if (isPhone) trackPhoneClick(href.replace(/^tel:/, ""));
      }}
    >
      {children}
    </a>
  );
}

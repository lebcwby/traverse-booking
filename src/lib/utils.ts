import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number,
  { cents = false }: { cents?: boolean } = {}
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MMM d, yyyy");
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MM/dd/yyyy");
}

export function pluralize(
  count: number,
  singular: string,
  plural?: string
): string {
  return count === 1
    ? `${count} ${singular}`
    : `${count} ${plural || singular + "s"}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function getListingSlug(title: string | null, guestyId: string): string {
  if (!title) return guestyId;
  return `${slugify(title)}-${guestyId}`;
}

export function extractIdFromSlug(slug: string): string {
  // Guesty IDs are 24-char hex strings — extract from end of slug
  const match = slug.match(/([a-f0-9]{24})$/);
  return match ? match[1] : slug;
}

/**
 * Pass through review averages from Guesty (10-point scale).
 * Returns null for missing/zero values, caps at 10.
 */
export function clampReviewAvg(avg: number | null | undefined): number | null {
  if (avg == null || avg === 0) return null;
  return Math.min(avg, 10);
}

export function getPhotoUrl(url: string, width = 800): string {
  if (!url) return "/placeholder-property.jpg";
  // Replace existing Cloudinary transform prefix
  if (/\/t_[a-z_]+\//.test(url)) {
    return url.replace(/\/t_[a-z_]+\//, `/w_${width},c_fill,q_auto,f_auto/`);
  }
  // Insert transform after /image/upload/ for URLs without one
  if (url.includes("/image/upload/")) {
    return url.replace(
      "/image/upload/",
      `/image/upload/w_${width},c_fill,q_auto,f_auto/`
    );
  }
  return url;
}

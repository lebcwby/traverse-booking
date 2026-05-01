import { cookies, headers } from "next/headers";
import { nearestZip } from "@/lib/zip-lookup";

export interface AnonymousMatching {
  external_id?: string;
  ct?: string;
  st?: string;
  zp?: string;
  country?: string;
}

function safeDecode(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const decoded = decodeURIComponent(value);
    return decoded.length > 0 ? decoded : undefined;
  } catch {
    return value.length > 0 ? value : undefined;
  }
}

export async function readAnonymousMatching(): Promise<AnonymousMatching> {
  const h = await headers();
  const c = await cookies();
  const ct = safeDecode(h.get("x-vercel-ip-city"));
  const st = h.get("x-vercel-ip-country-region") || undefined;
  const country = h.get("x-vercel-ip-country") || undefined;
  const external_id = c.get("_sp_visitor_id")?.value || undefined;

  let zp = h.get("x-vercel-ip-postal-code") || undefined;
  if (!zp) {
    const latStr = h.get("x-vercel-ip-latitude");
    const lngStr = h.get("x-vercel-ip-longitude");
    if (latStr && lngStr) {
      zp = nearestZip(Number(latStr), Number(lngStr)) || undefined;
    }
  }

  return { external_id, ct, st, zp, country };
}

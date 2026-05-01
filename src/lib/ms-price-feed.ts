/**
 * Microsoft Advertising Price feed — PULL mode helpers.
 *
 * Microsoft POSTs a Query message identifying (PropertyList, Checkin, Nights).
 * We respond with a Transaction containing one Result per (Property × Checkin ×
 * Nights) itinerary for which all nights are available.
 *
 * Schemas:
 *  - Query XSD: https://bhacstatic.z22.web.core.windows.net/schemas/query.xsd
 *  - Transaction XSD: https://bhacstatic.z22.web.core.windows.net/schemas/transaction.xsd
 */

import { xmlEscape } from "@/lib/ms-travel-feed";

export const MS_PRICE_FEED_TAX_RATE = 0.13;

export interface ParsedQuery {
  properties: string[];
  checkin: string;
  nights: number;
}

export interface PriceResult {
  property: string;
  checkin: string;
  nights: number;
  baserate: number;
  tax: number;
  otherFees: number;
}

/**
 * Parse a Microsoft Query message. Supports pointQueryGroup only
 * (single Checkin + Nights) since we use plain pull, not pull with hints.
 */
export function parseQuery(xml: string): ParsedQuery {
  const properties: string[] = [];
  const propRe = /<Property>\s*([^<]+?)\s*<\/Property>/g;
  let m: RegExpExecArray | null;
  while ((m = propRe.exec(xml)) !== null) {
    properties.push(m[1].trim());
  }

  const checkinMatch = xml.match(
    /<Checkin>\s*(\d{4}-\d{2}-\d{2})\s*<\/Checkin>/
  );
  const nightsMatch = xml.match(/<Nights>\s*(\d+)\s*<\/Nights>/);

  if (!checkinMatch || !nightsMatch) {
    throw new Error("Query missing Checkin or Nights");
  }

  const nights = parseInt(nightsMatch[1], 10);
  if (!Number.isFinite(nights) || nights < 1) {
    throw new Error(`Invalid Nights value: ${nightsMatch[1]}`);
  }

  return {
    properties,
    checkin: checkinMatch[1],
    nights,
  };
}

function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

export function buildPriceFeed(results: PriceResult[]): string {
  const timestamp = new Date().toISOString();
  const transactionId = crypto.randomUUID();

  const resultBlocks = results.map(
    (r) =>
      `  <Result>\n` +
      `    <Property>${xmlEscape(r.property)}</Property>\n` +
      `    <Checkin>${xmlEscape(r.checkin)}</Checkin>\n` +
      `    <Nights>${r.nights}</Nights>\n` +
      `    <Baserate currency="USD">${money(r.baserate)}</Baserate>\n` +
      `    <Tax currency="USD">${money(r.tax)}</Tax>\n` +
      `    <OtherFees currency="USD">${money(r.otherFees)}</OtherFees>\n` +
      `  </Result>`
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<Transaction timestamp="${timestamp}" id="${transactionId}">`,
    ...resultBlocks,
    `</Transaction>`,
    ``,
  ].join("\n");
}

/**
 * Given nightly rates indexed by date and a checkin + nights range, compute
 * the Baserate/Tax/OtherFees for the itinerary, or null if any night in the
 * range is missing or unavailable.
 */
export function buildResult(
  property: string,
  checkin: string,
  nights: number,
  nightlyRates: Map<string, number>,
  cleaningFee: number
): PriceResult | null {
  const checkinDate = new Date(`${checkin}T00:00:00Z`);
  if (Number.isNaN(checkinDate.getTime())) return null;

  let baserate = 0;
  for (let i = 0; i < nights; i++) {
    const d = new Date(checkinDate);
    d.setUTCDate(d.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    const rate = nightlyRates.get(key);
    if (rate === undefined || rate <= 0) return null;
    baserate += rate;
  }

  const tax = (baserate + cleaningFee) * MS_PRICE_FEED_TAX_RATE;
  return {
    property,
    checkin,
    nights,
    baserate,
    tax,
    otherFees: cleaningFee,
  };
}

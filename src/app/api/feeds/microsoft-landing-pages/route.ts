import { NextResponse } from "next/server";

export const dynamic = "force-static";

/**
 * Microsoft Advertising Landing Pages (POS) feed.
 *
 * Static Point-of-Sale config that tells Bing which URL to deep-link to
 * for hotel price ads. Microsoft substitutes the (PARTNER-HOTEL-ID),
 * (CHECKINYEAR/MONTH/DAY), (CHECKOUTYEAR/MONTH/DAY) macros at ad-render
 * time. SP is responsive, so one POS matches every device.
 *
 * Schema: https://bhacstatic.z22.web.core.windows.net/schemas/point_of_sale.xsd
 * Docs: https://learn.microsoft.com/en-us/advertising/pos-feed/reference
 *
 * `pointofsale=bing` is passed through to Guesty BEAPI for attribution.
 */
const BODY = `<?xml version="1.0" encoding="UTF-8"?>
<PointsOfSale xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.gstatic.com/localfeed/local_feed.xsd">
  <PointOfSale id="booktraverse-en">
    <DisplayNames display_text="BookTraverse.com" display_language="en" />
    <Match status="yes" language="en" />
    <URL>https://www.booktraverse.com/properties/(PARTNER-HOTEL-ID)?checkIn=(CHECKINYEAR)-(CHECKINMONTH)-(CHECKINDAY)&amp;checkOut=(CHECKOUTYEAR)-(CHECKOUTMONTH)-(CHECKOUTDAY)&amp;pointofsale=bing</URL>
  </PointOfSale>
</PointsOfSale>
`;

export function GET() {
  return new NextResponse(BODY, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}

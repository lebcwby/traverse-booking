import type { Metadata } from "next";
import { NoFeesHeader } from "@/components/no-fees/no-fees-header";
import "../no-fees/no-fees.css";

// Private owner/vendor form (W-9 + payment authorization, collects sensitive
// PII inside the Adobe Sign widget) — shared by direct link, never indexed.
export const metadata: Metadata = {
  title: "W-9 & Payment Authorization Form",
  description:
    "Secure W-9 and payment authorization form for Traverse Hospitality owners and vendors.",
  robots: { index: false, follow: false },
};

const ESIGN_WIDGET_SRC =
  "https://na2.documents.adobe.com/public/esignWidget?wid=CBFCIBAA3AAABLblqZhCFptBVRv96aZxrGWHkJzJr7t1EiQpo09_VHdX0IUH0_3GQTufsZ1IuWvwImr_7q_I*&hosted=false";

export default function Page() {
  return (
    <div data-no-fees-layout={true}>
      <NoFeesHeader />
      <main
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "32px 16px 64px",
        }}
      >
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "#14142b",
            margin: "0 0 8px",
          }}
        >
          W-9 &amp; Payment Authorization
        </h1>
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.55,
            color: "#404f52",
            margin: "0 0 24px",
          }}
        >
          Please complete and sign the secure form below. Your information is
          submitted directly and securely through Adobe Acrobat Sign.
        </p>
        <iframe
          src={ESIGN_WIDGET_SRC}
          title="W-9 and Payment Authorization Form"
          width="100%"
          style={{
            border: 0,
            width: "100%",
            minHeight: 1200,
            overflow: "hidden",
          }}
        />
      </main>
    </div>
  );
}

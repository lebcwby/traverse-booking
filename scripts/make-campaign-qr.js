// Regenerates the Crested Butte owner-campaign QR code.
//
// `qrcode` is NOT a dependency of this repo — it is needed once, to make a
// file that then lives in public/qr/, so adding it to package.json would put
// a build-time dependency in the way of every future install for no gain.
// Run it from a scratch directory instead:
//
//   mkdir -p /tmp/qrgen && cd /tmp/qrgen
//   npm install qrcode@1.5.4 --no-save
//   node <path-to-repo>/scripts/make-campaign-qr.js
//
// Then copy the two files into public/qr/. Verify the output decodes before
// sending it to print — a QR that does not scan is expensive on paper:
//
//   npm install jsqr@1.4.0 pngjs@7.0.0 --no-save
//   # read the PNG back with jsQR and compare the string
//
// The URL carries utm_* because the site's proxy captures those into the
// _sp_attribution cookie, which already flows into pending_checkouts, GA4 and
// the reservation row — so a scan is attributable end to end with no new
// tracking. A bare URL would arrive as direct traffic and the campaign would
// be unmeasurable.
const QRCode = require("qrcode");
const fs = require("fs");

const URL =
  "https://www.booktraverse.com/cb-property-management" +
  "?utm_source=qr&utm_medium=print&utm_campaign=cb-owner-2026";

// High error correction: print QR gets folded, creased and photographed at an
// angle. H tolerates ~30% damage, and at this size the density cost is
// irrelevant for a scan from a page.
const opts = { errorCorrectionLevel: "H", margin: 2 };

(async () => {
  // SVG for print — vector, so it scales to any size on a mailer without
  // going fuzzy. This is the one to hand a designer.
  const svg = await QRCode.toString(URL, { ...opts, type: "svg" });
  fs.writeFileSync("cb-property-management-qr.svg", svg);

  // PNG at 1200px for slides, email and anything that cannot take SVG.
  await QRCode.toFile("cb-property-management-qr.png", URL, {
    ...opts,
    width: 1200,
  });

  console.log("URL encoded:", URL);
})();

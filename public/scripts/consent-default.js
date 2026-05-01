(function () {
  window.dataLayer = window.dataLayer || [];
  window.uetq = window.uetq || [];
  window.gtag =
    window.gtag ||
    function () {
      window.dataLayer.push(arguments);
    };

  var cookies = document.cookie ? document.cookie.split("; ") : [];
  var consentCookie = cookies.find(function (entry) {
    return entry.indexOf("_sp_consent=") === 0;
  });
  var consentValue = consentCookie
    ? consentCookie.split("=").slice(1).join("=")
    : "";
  var params = new URLSearchParams(consentValue || "");
  var legacyOptOut = cookies.some(function (entry) {
    return entry === "_sp_ccpa_optout=1";
  });
  var analytics = params.has("a") ? params.get("a") === "1" : true;
  var marketing = params.has("m") ? params.get("m") === "1" : true;

  // Sec-GPC / navigator.globalPrivacyControl is intentionally NOT honored —
  // see src/lib/consent.ts comment. Only explicit on-site opt-outs suppress.
  marketing = marketing && !legacyOptOut;

  window.gtag("consent", "default", {
    ad_storage: marketing ? "granted" : "denied",
    ad_user_data: marketing ? "granted" : "denied",
    ad_personalization: marketing ? "granted" : "denied",
    analytics_storage: analytics ? "granted" : "denied",
    functionality_storage: "granted",
    personalization_storage: marketing ? "granted" : "denied",
    security_storage: "granted",
  });
})();

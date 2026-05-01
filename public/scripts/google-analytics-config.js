(function () {
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function () {
      window.dataLayer.push(arguments);
    };

  var ignoreReferrer = [
    "checkout.stripe.com",
    "buy.stripe.com",
    "hooks.stripe.com",
    "booking.guesty.com",
  ].some(function (domain) {
    return document.referrer.indexOf(domain) !== -1;
  });

  window.gtag("js", new Date());
  window.gtag("config", "G-PPWFFFPC42", {
    cookie_domain: "booktraverse.com",
    linker: { domains: ["booktraverse.com", "www.booktraverse.com"] },
    ignore_referrer: ignoreReferrer,
  });
})();

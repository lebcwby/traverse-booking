(function () {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    "gtm.start": new Date().getTime(),
    event: "gtm.js",
  });

  var firstScript = document.getElementsByTagName("script")[0];
  var script = document.createElement("script");

  script.async = true;
  script.src = "https://www.googletagmanager.com/gtm.js?id=GTM-KN2S5WQV";

  if (firstScript && firstScript.parentNode) {
    firstScript.parentNode.insertBefore(script, firstScript);
  } else {
    document.head.appendChild(script);
  }
})();

// Detects the Android app (Capacitor WebView) and hides payment UI there.
// Google Play policy: digital content must not be sold with bKash/Nagad inside the app,
// so the app only logs in and shows unlock status; payment happens on the website.
//
// Usage in pages: mark any payment button/modal/section with  data-payment
// (or class="payment-only"). Put the in-app hint in an element with class="app-unlock-note".
(function () {
  var ua = navigator.userAgent || '';
  var cap = window.Capacitor;
  var isApp = /MedhaApp\//.test(ua) || !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  window.MEDHA_NATIVE_APP = isApp;
  if (!isApp) return;

  document.documentElement.classList.add('is-native-app');
  var style = document.createElement('style');
  style.textContent =
    '.is-native-app [data-payment], .is-native-app .payment-only { display: none !important; }' +
    '.app-unlock-note { display: none; }' +
    '.is-native-app .app-unlock-note { display: block !important; }';
  document.head.appendChild(style);
})();

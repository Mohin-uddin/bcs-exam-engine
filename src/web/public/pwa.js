// "Install the app" for phone browsers (PWA).
// - Android Chrome / Edge / Samsung Internet: shows our own Bangla banner and opens the browser's install box.
// - iPhone Safari: Safari has no install button, so the banner explains "Share → Add to Home Screen".
// Not shown inside the Play Store app, when already installed, or for 7 days after "পরে".
(function () {
  if (!('serviceWorker' in navigator) || window.IS_NATIVE_APP) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });

  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone) return;

  var KEY = 'sh_install_dismissed_at';
  var WAIT_MS = 7 * 24 * 60 * 60 * 1000;
  try {
    var last = Number(localStorage.getItem(KEY) || 0);
    if (last && Date.now() - last < WAIT_MS) return;
  } catch (e) {}

  var ua = navigator.userAgent || '';
  var isPhone = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || window.matchMedia('(max-width: 900px)').matches;
  var isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var deferred = null;

  function addStyles() {
    if (document.getElementById('pwaInstallStyle')) return;
    var s = document.createElement('style');
    s.id = 'pwaInstallStyle';
    s.textContent =
      '.pwa-banner{position:fixed;left:12px;right:12px;bottom:calc(72px + env(safe-area-inset-bottom));z-index:70;' +
      'display:flex;gap:12px;align-items:center;padding:12px 14px;border-radius:16px;background:#fff;color:#1f2937;' +
      'border:1px solid #d6e6df;box-shadow:0 12px 32px rgba(0,0,0,.18);font-family:"Noto Sans Bengali",sans-serif;max-width:520px;margin:0 auto}' +
      '.pwa-banner img{width:44px;height:44px;border-radius:12px;flex:none}' +
      '.pwa-banner .t{font-weight:700;font-size:15px;line-height:1.3}' +
      '.pwa-banner .s{font-size:12.5px;color:#4b5563;line-height:1.45;margin-top:2px}' +
      '.pwa-banner .a{display:flex;flex-direction:column;gap:6px;margin-left:auto;flex:none}' +
      '.pwa-banner button{border-radius:10px;padding:7px 12px;font-weight:700;font-size:13.5px}' +
      '.pwa-banner .go{background:#006a4e;color:#fff}' +
      '.pwa-banner .no{background:transparent;color:#6b7280;font-weight:500;padding:2px 6px}' +
      '@media (min-width:1024px){.pwa-banner{bottom:20px;left:auto;right:20px}}' +
      'html.theme-dark .pwa-banner{background:#1b2420;color:#e8efe9;border-color:#2c3a33}html.theme-dark .pwa-banner .s{color:#a9b8b0}';
    document.head.appendChild(s);
  }

  function hide(remember) {
    var b = document.getElementById('pwaInstallBanner');
    if (b) b.remove();
    if (remember) { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} }
  }

  function show(mode) {
    if (document.getElementById('pwaInstallBanner')) return;
    addStyles();
    var b = document.createElement('div');
    b.id = 'pwaInstallBanner';
    b.className = 'pwa-banner';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-label', 'অ্যাপ ইনস্টল করুন');
    var sub = mode === 'ios'
      ? 'নিচের <b>শেয়ার ⬆️</b> বাটন চাপুন, তারপর <b>"Add to Home Screen"</b> বেছে নিন।'
      : 'ফোনের হোম স্ক্রিনে আইকন থাকবে, এক চাপে খুলবে। কোনো প্লে স্টোর লাগবে না।';
    b.innerHTML =
      '<img src="/icon-192.png" alt="">' +
      '<div><div class="t">সোনার হরিণ অ্যাপটি ফোনে রাখুন</div><div class="s">' + sub + '</div></div>' +
      '<div class="a">' +
      (mode === 'ios' ? '' : '<button type="button" class="go">ইনস্টল</button>') +
      '<button type="button" class="no">' + (mode === 'ios' ? 'ঠিক আছে' : 'পরে') + '</button></div>';
    document.body.appendChild(b);
    var go = b.querySelector('.go');
    if (go) go.onclick = function () {
      if (!deferred) return hide(false);
      deferred.prompt();
      deferred.userChoice.then(function (r) { hide(r && r.outcome !== 'accepted'); deferred = null; });
    };
    b.querySelector('.no').onclick = function () { hide(true); };
  }

  // Lets any page offer an "install" button too (for example in the menu): window.SonarInstall()
  window.SonarInstall = function () {
    if (deferred) { deferred.prompt(); return true; }
    if (isIOS) { show('ios'); return true; }
    return false;
  };

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    document.documentElement.classList.add('can-install');
    if (isPhone) setTimeout(function () { show('android'); }, 4000);
  });
  window.addEventListener('appinstalled', function () { hide(true); document.documentElement.classList.remove('can-install'); });

  if (isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua)) {
    document.documentElement.classList.add('can-install');
    setTimeout(function () { show('ios'); }, 6000);
  }
})();

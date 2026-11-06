/**
 * Question-set protection (website + Android app WebView).
 *
 * Mark any element that shows questions with class="cg-protect". Inside it:
 *  - A faint watermark with the logged-in user's phone number is tiled over the
 *    questions, so a leaked screenshot or phone photo points back to the account.
 *  - The questions blur when the tab/window loses focus (Snipping Tool, screen
 *    recorders, switching apps) and for a moment when PrintScreen / Win / Cmd+Shift
 *    is pressed. PrintScreen also wipes the clipboard.
 *  - Text selection, copy/cut, right-click, long-press menu and drag are blocked.
 *  - Printing / Save as PDF is only for premium members; for everyone else the
 *    printed page is blank and window.print() opens the unlock dialog instead.
 *
 * In the Android app screenshots and screen recording are blocked by the OS
 * (FLAG_SECURE in MainActivity), so the watermark is skipped there.
 *
 * A browser can never fully stop a screenshot (OS shortcuts and phone cameras are
 * outside the page), so on the web this is deterrence plus traceability.
 *
 * Public API: window.ContentGuard.canPrint(), ContentGuard.requirePrint()
 */
(function () {
  if (window.ContentGuard) return;
  var isApp = Boolean(window.IS_NATIVE_APP);
  var root = document.documentElement;
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

  var css =
    '.cg-protect{position:relative;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}' +
    '.cg-protect input,.cg-protect textarea,.cg-protect select{-webkit-user-select:text;user-select:text}' +
    '.cg-protect img{-webkit-user-drag:none;pointer-events:none}' +
    'html.cg-wm .cg-protect::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:40;' +
    'background-image:var(--cg-wm);background-repeat:repeat;background-size:260px 150px}' +
    '.cg-protect>*{transition:filter .12s}' +
    'html.cg-hide .cg-protect>*{filter:blur(16px)!important}' +
    '#cg-shield{position:fixed;inset:0;z-index:2147483646;display:none;align-items:center;justify-content:center;' +
    'background:rgba(15,23,42,.55);color:#fff;font:600 17px "Noto Sans Bengali",sans-serif;text-align:center;padding:24px}' +
    'html.cg-hide.cg-has-protect #cg-shield{display:flex}' +
    '.cg-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;background:#1e293b;color:#fff;' +
    'padding:10px 16px;border-radius:10px;font:14px "Noto Sans Bengali",sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:90vw;text-align:center}' +
    '@media print{html:not(.cg-can-print) .cg-protect{display:none!important}' +
    'html:not(.cg-can-print) body::before{content:"প্রিন্ট ও ডাউনলোড শুধু প্রিমিয়াম সদস্যদের জন্য — সোনার হরিণ";' +
    'display:block;padding:40px;text-align:center;font:600 18px sans-serif}' +
    'html.cg-wm .cg-protect::after{-webkit-print-color-adjust:exact;print-color-adjust:exact}}';
  var style = document.createElement('style');
  style.id = 'cg-style';
  style.textContent = css;
  (document.head || root).appendChild(style);

  // ---------------------------------------------------------------- helpers
  function account() { return window.Account || null; }
  function user() { var a = account(); return a && a.user; }
  function canPrint() { var a = account(); return Boolean(a && a.isPremium && a.isPremium()); }
  function inProtected(node) {
    var el = node && (node.nodeType === 1 ? node : node.parentElement);
    return Boolean(el && el.closest && el.closest('.cg-protect'));
  }
  function isField(node) {
    var el = node && (node.nodeType === 1 ? node : node.parentElement);
    return Boolean(el && el.closest && el.closest('input,textarea,select,[contenteditable="true"]'));
  }
  function hasProtectedOnScreen() {
    var list = document.querySelectorAll('.cg-protect');
    for (var i = 0; i < list.length; i++) {
      if (list[i].offsetWidth || list[i].offsetHeight || list[i].getClientRects().length) return true;
    }
    return false;
  }
  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('cg-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cg-toast';
      el.className = 'cg-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 3500);
  }

  // -------------------------------------------------------------- watermark
  var wmText = '';
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c];
    });
  }
  function renderWatermark() {
    if (isApp) return;
    var u = user();
    var who = u ? (u.phone || u.name || '') : '';
    var d = new Date();
    var stamp = d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
    var line1 = 'সোনার হরিণ' + (who ? ' • ' + who : '');
    var line2 = who ? stamp : 'অনুমতি ছাড়া কপি নিষেধ';
    var key = line1 + '|' + line2;
    if (key === wmText) return;
    wmText = key;
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="260" height="150">' +
      '<g transform="rotate(-24 130 75)" fill="#0f172a" fill-opacity="0.075" ' +
      'font-family="Noto Sans Bengali, sans-serif" font-weight="700" text-anchor="middle">' +
      '<text x="130" y="72" font-size="17">' + esc(line1) + '</text>' +
      '<text x="130" y="94" font-size="12">' + esc(line2) + '</text></g></svg>';
    root.style.setProperty('--cg-wm', 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")');
    root.classList.add('cg-wm');
  }

  // ------------------------------------------------------- blur / hide view
  var hideTimer = null;
  function setHidden(on) { root.classList.toggle('cg-hide', on); }
  function flashHide(ms) {
    root.classList.toggle('cg-has-protect', hasProtectedOnScreen());
    setHidden(true);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      if (document.hasFocus() && !document.hidden) setHidden(false);
    }, ms);
  }
  function mountShield() {
    if (document.getElementById('cg-shield')) return;
    var s = document.createElement('div');
    s.id = 'cg-shield';
    s.textContent = 'প্রশ্ন সুরক্ষিত রাখতে স্ক্রিন ঝাপসা করা হয়েছে। দেখতে এই পেজে ক্লিক বা ট্যাপ করুন।';
    s.addEventListener('click', function () { setHidden(false); });
    document.body.appendChild(s);
  }

  // The Android app blocks capture at OS level; blurring there would only annoy.
  if (!isApp) {
    window.addEventListener('blur', function () {
      root.classList.toggle('cg-has-protect', hasProtectedOnScreen());
      setHidden(true);
    });
    window.addEventListener('focus', function () { clearTimeout(hideTimer); setHidden(false); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { root.classList.toggle('cg-has-protect', hasProtectedOnScreen()); setHidden(true); }
      else if (document.hasFocus()) setHidden(false);
    });
  }

  // ------------------------------------------------------------- keyboard
  document.addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase();
    var mod = e.ctrlKey || e.metaKey;
    // Windows key / Cmd+Shift (start of Win+Shift+S, Cmd+Shift+3/4/5): hide first
    if (!isApp && (e.metaKey && e.shiftKey || (!isMac && (k === 'meta' || k === 'os')))) flashHide(1500);
    if (k === 'printscreen') { flashHide(1500); return; }
    if (mod && k === 'p') {
      if (!canPrint()) { e.preventDefault(); e.stopImmediatePropagation(); requirePrint(); }
      return;
    }
    if (!hasProtectedOnScreen()) return;
    if (mod && k === 's') { e.preventDefault(); toast('প্রশ্নসেট সেভ করা যাবে না।'); return; }
    if (mod && (k === 'c' || k === 'x' || k === 'a') && !isField(e.target)) {
      e.preventDefault();
      if (k !== 'a') toast('প্রশ্ন কপি করা যাবে না।');
    }
  }, true);
  document.addEventListener('keyup', function (e) {
    if ((e.key || '').toLowerCase() !== 'printscreen') return;
    flashHide(1500);
    try { navigator.clipboard && navigator.clipboard.writeText(''); } catch (err) { /* not allowed */ }
    toast('স্ক্রিনশট নেওয়া যাবে না — প্রতিটি প্রশ্নে আপনার নম্বর জলছাপ হিসেবে থাকে।');
  }, true);

  // -------------------------------------------------- copy / menu / drag
  function block(e) {
    if (inProtected(e.target) && !isField(e.target)) e.preventDefault();
  }
  document.addEventListener('contextmenu', block, true);
  document.addEventListener('dragstart', block, true);
  document.addEventListener('selectstart', block, true);
  ['copy', 'cut'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      var sel = window.getSelection && window.getSelection();
      var node = sel && sel.anchorNode;
      if ((node && inProtected(node)) || (!node && hasProtectedOnScreen())) {
        if (isField(e.target)) return;
        e.preventDefault();
        if (e.clipboardData) e.clipboardData.setData('text/plain', '');
        toast('প্রশ্ন কপি করা যাবে না।');
      }
    }, true);
  });

  // ------------------------------------------------------------- printing
  function syncPrintClass() { root.classList.toggle('cg-can-print', canPrint()); }
  function requirePrint() {
    syncPrintClass();
    if (canPrint()) return true;
    toast('প্রিন্ট ও PDF ডাউনলোড শুধু প্রিমিয়াম সদস্যদের জন্য।');
    var a = account();
    if (a && a.openUnlock) a.openUnlock();
    return false;
  }
  var nativePrint = window.print ? window.print.bind(window) : null;
  window.print = function () {
    if (!requirePrint()) return;
    if (nativePrint) nativePrint();
  };
  window.addEventListener('beforeprint', syncPrintClass);

  // ------------------------------------------------------------------ start
  function refresh() { renderWatermark(); syncPrintClass(); }
  function init() {
    mountShield();
    refresh();
    // Account.js logs the user in asynchronously (and can log in/out later):
    // keep the watermark and print permission in step. refresh() is a no-op when unchanged.
    setInterval(refresh, 2000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.ContentGuard = { canPrint: canPrint, requirePrint: requirePrint, refresh: refresh };
})();

/**
 * Google AdSense ad spots. The server adds window.SH_ADS = { client, slots: { home, list, result } }
 * and Google's script to the page only after the publisher id is saved in /admin (adsense.js).
 * Without it this file does nothing and the spots (<div class="ad-slot" data-ad="...">) stay hidden.
 *
 * - An ad is placed in a spot only when the spot is on screen (a hidden tab has no width, and
 *   AdSense refuses ads with no width), and only if that spot has an ad unit id.
 * - Never while a timed exam is running (body.exam-running, set by app.js updateExamControls).
 * - The "result" spot shows only after the exam is submitted (body.exam-submitted).
 * - The installed Android app (native-app.js) shows no AdSense ads: Play Store apps use AdMob.
 */
(function () {
  const cfg = window.SH_ADS;
  if (!cfg || !/^ca-pub-\d+$/.test(cfg.client || '')) return;
  if (document.documentElement.classList.contains('is-native-app')) return;

  const blocked = () => document.body.classList.contains('exam-running');

  function fill(spot) {
    if (spot.dataset.filled || blocked()) return;
    const slot = cfg.slots && cfg.slots[spot.dataset.ad];
    if (!slot) return;
    if (spot.classList.contains('ad-after-exam') && !document.body.classList.contains('exam-submitted')) return;
    spot.dataset.filled = '1';
    spot.classList.add('ad-on');
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.dataset.adClient = cfg.client;
    ins.dataset.adSlot = slot;
    ins.dataset.adFormat = 'auto';
    ins.dataset.fullWidthResponsive = 'true';
    spot.appendChild(ins);
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      spot.classList.remove('ad-on');
    }
  }

  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) fill(en.target); }), { rootMargin: '200px' })
    : null;

  function refresh() {
    document.querySelectorAll('.ad-slot[data-ad]').forEach(spot => {
      if (spot.dataset.filled) return;
      if (io) { io.unobserve(spot); io.observe(spot); } else if (spot.offsetParent) fill(spot);
    });
  }

  window.ShAds = { refresh };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh);
  else refresh();
})();

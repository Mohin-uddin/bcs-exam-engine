/**
 * First-visit guided tour (Bangla): points at each section of the website and explains
 * what it is for, then shows the plans. Runs once per browser; "Tour.start()" runs it again
 * (account menu has a button for it).
 * Steps whose element is missing on the page are skipped, so it keeps working when the
 * layout changes. On phones the side menu is opened for the menu steps.
 */
(function () {
  const DONE_KEY = 'sh_tour_done_v1';
  const isMobile = () => window.matchMedia('(max-width: 1023px)').matches;

  const STEPS = [
    { center: true, title: '🦌 সোনার হরিণে স্বাগতম!', text: 'বিসিএস, প্রাথমিক, শিক্ষক নিবন্ধন, ব্যাংকসহ সব সরকারি চাকরির প্রস্তুতি এক জায়গায়। চলুন ১ মিনিটে দেখে নিই কোথায় কী আছে। সব ফিচার ফ্রিতে ঘুরে দেখতে পারবেন।', next: 'দেখান কোথায় কী আছে', skip: 'পরে দেখব' },
    { sel: '#tab-home', nav: true, title: '🏠 আজকের পড়া', text: 'প্রতিদিন এখান থেকে শুরু করুন। আজ কোন প্রশ্নগুলো রিভিশন দেওয়ার সময় হয়েছে, কতটুকু এগোলেন — সব এক নজরে দেখাবে।' },
    { sel: '#tab-exam', nav: true, title: '📝 মডেল টেস্ট', text: 'আসল পরীক্ষার প্রশ্নপত্রের মতো পূর্ণ মডেল টেস্ট। সময় ধরে পরীক্ষা দিন, ভুলে নম্বর কাটবে (বিসিএসে ০.৫০, প্রাথমিকে ০.২৫), শেষে সাথে সাথে ফলাফল।' },
    { sel: '#tab-past-bank', nav: true, title: '📚 বিগত সালের প্রশ্ন', text: 'আগের বছরগুলোর আসল প্রশ্ন, সাল ও বিষয় অনুযায়ী সাজানো। প্রতিটি প্রশ্নের সঠিক উত্তর ও ব্যাখ্যা দেখতে পারবেন।' },
    { sel: '#tab-custom-quiz', nav: true, title: '🎯 নিজের মতো অনুশীলন', text: 'যে বিষয় বা অধ্যায় দুর্বল, শুধু সেটা থেকে নিজের পছন্দমতো প্রশ্ন সংখ্যা নিয়ে ছোট পরীক্ষা দিন।' },
    { sel: '.side-nav a[href="/live"]', nav: true, title: '🏆 লাইভ পরীক্ষা ও মেধা তালিকা', text: 'নির্দিষ্ট সময়ে সবাই একসাথে পরীক্ষা দেয়। পরীক্ষা শেষে মেধা তালিকায় দেখবেন সারা দেশে আপনার অবস্থান।' },
    { sel: '#tab-mistakes', nav: true, title: '📕 ভুল খাতা', text: 'পরীক্ষায় যে প্রশ্নগুলো ভুল করেন সেগুলো নিজে থেকেই এখানে জমা হয়। "অসাবধানতা" না "বুঝিনি" — চিহ্ন দিয়ে রাখুন, আবার অনুশীলন করে ঠিক করুন।' },
    { sel: '#tab-flashcards', nav: true, title: '🧠 ফ্ল্যাশকার্ড', text: 'কার্ডে প্রথমে শুধু প্রশ্ন, উল্টালে উত্তর, ছন্দ ও শর্টকাট। যেটা ভুলে যান সেটা আগে আগে আসে, যেটা মনে থাকে সেটা দেরিতে — তাই কম সময়ে বেশি মনে থাকে।' },
    { sel: '#tab-bookmarks', nav: true, title: '⭐ বুকমার্ক', text: 'গুরুত্বপূর্ণ প্রশ্নে ⭐ দিলে এখানে জমা থাকবে, পরীক্ষার আগের রাতে এক জায়গায় রিভিশন দিন।' },
    { sel: '#tab-confusing-hot', nav: true, title: '🔥 কনফিউজিং ও কমন প্রশ্ন', text: 'যে প্রশ্নগুলো বারবার পরীক্ষায় আসে এবং যেগুলোতে সবাই গুলিয়ে ফেলে — আলাদা করে সাজানো।' },
    { sel: '#tab-master-toolkit', nav: true, title: '🧮 শর্টকাট, ভাইভা ও রুটিন', text: 'অঙ্কের শর্টকাট সূত্র, মনে রাখার বাংলা ছন্দ, ভাইভার প্রস্তুতি আর পড়ার রুটিন।' },
    { sel: '#tab-analytics', nav: true, title: '📊 ফলাফল ও দুর্বলতা', text: 'আপনার সব পরীক্ষার ফলাফল আর কোন বিষয়ে দুর্বল তা চার্টে দেখাবে, যাতে কোথায় বেশি পড়তে হবে বুঝতে পারেন।' },
    { sel: '.nav-more', nav: true, open: true, title: '🧰 আরও টুলস', text: 'ছাপানো উত্তরপত্রে দাগিয়ে মোবাইলে ছবি তুলে ফলাফল দেখা, প্রশ্নপত্র প্রিন্ট, পূর্ণ পরীক্ষার হল, নম্বর ক্যালকুলেটর আর কুইজ খেলা — সব এখানে।' },
    { sel: '#accountSlot', title: '👤 অ্যাকাউন্ট ও প্যাকেজ', text: 'মোবাইল নম্বর দিয়ে লগইন করলে আপনার অগ্রগতি সব ডিভাইসে থাকবে। এখান থেকেই প্যাকেজ অর্ডার করবেন এবং প্রশ্নসেটের সাথে পাওয়া কোড দেবেন।' },
    {
      center: true, final: true, title: '📦 আমাদের প্যাকেজ',
      text: `<b>ফ্রি:</b> সব ফিচার ঘুরে দেখা, প্রতি বিভাগে কয়েকটি সেট আর লক করা সেটের প্রথম কয়েকটি প্রশ্ন।<br>
        <b>সাধারণ প্যাকেজ:</b> ছাপানো প্রশ্নসেট বাসায় + অনলাইনে সব সেট দেখা ও পরীক্ষা (ডাউনলোড / প্রিন্ট নেই)।<br>
        <b>⭐ প্রিমিয়াম প্যাকেজ:</b> ছাপানো প্রশ্নসেট + সব সেট + যেকোনো প্রশ্নসেট ডাউনলোড ও প্রিন্ট।<br><br>
        🚚 <b>ক্যাশ অন ডেলিভারি:</b> প্রশ্নসেট হাতে পেয়ে টাকা দেবেন। প্যাকেটে একটি কোড থাকবে, ওয়েবসাইটে কোডটি দিলেই সব খুলে যাবে।`,
      next: 'প্যাকেজ দেখুন', skip: 'ফ্রিতে ঘুরে দেখি'
    }
  ];

  const css = `
  .tour-shade{position:fixed;inset:0;z-index:9400;background:rgba(15,23,42,.6)}
  .tour-hole{position:fixed;z-index:9401;border-radius:12px;box-shadow:0 0 0 9999px rgba(15,23,42,.6),0 0 0 3px #fbbf24;transition:all .25s ease;pointer-events:none}
  .tour-card{position:fixed;z-index:9402;background:#fff;color:#0f172a;border-radius:16px;padding:16px 16px 12px;width:min(360px,calc(100vw - 24px));box-shadow:0 20px 50px rgba(0,0,0,.35);font:400 14.5px/1.6 'Noto Sans Bengali',system-ui,sans-serif}
  .tour-card h4{margin:0 0 6px;font-size:17px;font-weight:700}
  .tour-card p{margin:0 0 12px}
  .tour-card .tour-foot{display:flex;align-items:center;gap:8px}
  .tour-card .tour-count{color:#64748b;font-size:12px;margin-right:auto}
  .tour-card button{border:0;border-radius:10px;padding:8px 14px;font:700 14px 'Noto Sans Bengali',sans-serif;cursor:pointer}
  .tour-card .tour-next{background:#006a4e;color:#fff}
  .tour-card .tour-skip{background:#f1f5f9;color:#334155}
  .tour-card.center{left:50%!important;top:50%!important;transform:translate(-50%,-50%)}
  .tour-help{position:fixed;left:14px;bottom:76px;z-index:8000;border:1px solid #cbd5e1;background:#fff;color:#0f172a;border-radius:999px;padding:7px 12px;font:600 13px 'Noto Sans Bengali',sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.12);cursor:pointer}
  @media (min-width:1024px){.tour-help{bottom:14px}}
  @media print{.tour-shade,.tour-hole,.tour-card,.tour-help{display:none!important}}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const bn = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
  let shade = null;
  let hole = null;
  let card = null;
  let steps = [];
  let idx = 0;

  const visible = el => el && el.getClientRects().length > 0;

  function cleanup() {
    [shade, hole, card].forEach(el => el && el.remove());
    shade = hole = card = null;
    if (isMobile() && typeof window.toggleSideNav === 'function') window.toggleSideNav(false);
    window.removeEventListener('resize', place);
    document.removeEventListener('keydown', onKey);
  }

  function finish(openPlans) {
    try { localStorage.setItem(DONE_KEY, '1'); } catch { /* storage blocked */ }
    cleanup();
    if (openPlans && window.Account && window.Account.openPlans) window.Account.openPlans();
  }

  function onKey(ev) {
    if (ev.key === 'Escape') finish(false);
    if (ev.key === 'ArrowRight' || ev.key === 'Enter') go(idx + 1);
    if (ev.key === 'ArrowLeft') go(idx - 1);
  }

  function target(step) {
    if (step.center || !step.sel) return null;
    const el = document.querySelector(step.sel);
    return visible(el) || step.nav ? el : null;
  }

  function place() {
    const step = steps[idx];
    const el = target(step);
    if (!el || step.center) {
      hole.style.display = 'none';
      shade.style.display = 'block';
      card.classList.add('center');
      card.style.left = card.style.top = '';
      return;
    }
    shade.style.display = 'none';
    hole.style.display = 'block';
    card.classList.remove('center');
    const r = el.getBoundingClientRect();
    const pad = 6;
    Object.assign(hole.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left;
    let top;
    if (isMobile()) {
      // Phone: the card sits at the bottom or top, away from the item
      left = (vw - cw) / 2;
      top = r.top + r.height / 2 > vh / 2 ? 12 : vh - ch - 12;
    } else if (r.right + 16 + cw < vw) {
      // Side menu item: card to its right
      left = r.right + 16;
      top = Math.min(Math.max(12, r.top + r.height / 2 - ch / 2), vh - ch - 12);
    } else {
      left = Math.min(Math.max(12, r.left + r.width / 2 - cw / 2), vw - cw - 12);
      top = r.bottom + 14 + ch < vh ? r.bottom + 14 : Math.max(12, r.top - ch - 14);
    }
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }

  function go(i) {
    if (i < 0) return;
    if (i >= steps.length) return finish(false);
    idx = i;
    const step = steps[idx];
    if (isMobile() && typeof window.toggleSideNav === 'function') window.toggleSideNav(Boolean(step.nav));
    const el = document.querySelector(step.sel || '#__none');
    if (step.open && el && el.tagName === 'DETAILS') el.open = true;
    const total = steps.length;
    card.innerHTML = `<h4>${step.title}</h4><p>${step.text}</p>
      <div class="tour-foot">
        <span class="tour-count">${step.center && !step.final ? '' : `${bn(idx)}/${bn(total - 2)}`}</span>
        <button type="button" class="tour-skip">${step.skip || (idx > 1 ? 'আগের' : 'বন্ধ')}</button>
        <button type="button" class="tour-next">${step.next || 'পরের →'}</button>
      </div>`;
    if (step.final) card.querySelector('.tour-count').textContent = '';
    card.querySelector('.tour-next').onclick = () => (step.final ? finish(true) : go(idx + 1));
    card.querySelector('.tour-skip').onclick = () => (step.skip ? finish(false) : idx > 1 ? go(idx - 1) : finish(false));
    if (el && !step.center) {
      // Let the side menu slide in on phones before measuring
      setTimeout(() => {
        el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        place();
      }, isMobile() && step.nav ? 230 : 0);
    } else {
      place();
    }
  }

  function start() {
    cleanup();
    // Skip items that are not on this page (keeps welcome + final)
    steps = STEPS.filter(s => s.center || document.querySelector(s.sel));
    shade = document.createElement('div');
    shade.className = 'tour-shade';
    hole = document.createElement('div');
    hole.className = 'tour-hole';
    card = document.createElement('div');
    card.className = 'tour-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-live', 'polite');
    document.body.append(shade, hole, card);
    window.addEventListener('resize', place);
    document.addEventListener('keydown', onKey);
    go(0);
  }

  window.Tour = { start };

  function init() {
    // "Guide" button to run the tour again
    const help = document.createElement('button');
    help.type = 'button';
    help.className = 'tour-help';
    help.textContent = '🧭 গাইড';
    help.title = 'ওয়েবসাইটে কোথায় কী আছে দেখুন';
    help.onclick = start;
    document.body.appendChild(help);

    let done = false;
    try { done = localStorage.getItem(DONE_KEY) === '1'; } catch { done = true; }
    const busy = /[?&]payment=/.test(location.search);
    if (!done && !busy) setTimeout(() => { if (!document.querySelector('.acc-overlay:not([hidden])')) start(); }, 1200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

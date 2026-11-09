/**
 * Anonymous journey events for the admin's "ইউজার কোথায় থামছে" report (server: src/web/funnel.js).
 * - A random visitor id in this browser (localStorage 'sh_vid'); never a name, phone or account id.
 * - Sent with navigator.sendBeacon, so it never slows the page and works when the tab closes.
 * - Funnel.ev(name, {tab}) from other scripts; switchTab, past paper choice, exam start / submit are hooked here.
 */
(function () {
  const rnd = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => (b % 36).toString(36)).join('');
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } return v; };
  let vid = ls('sh_vid');
  if (!/^[a-z0-9]{8,32}$/.test(vid || '')) vid = ls('sh_vid', rnd());

  // The user's exam, as the live exam uses it (admission split into university / medical)
  function track() {
    const t = (window.Study && Study.data && Study.data.settings.track) || ls('sh_goal_v1') || '';
    if (t !== 'ADMISSION') return t;
    return ls('sh_adm_kind') === 'medical' ? 'ADMISSION_MED' : 'ADMISSION_UNI';
  }
  const loggedIn = () => Boolean(window.Account && Account.user);

  let screen = '';
  // Boxes that open over a page count as the screen the visitor is on (for "last screen before leaving")
  const OVERLAY = { picker_shown: 'picker', signup_prompt_shown: 'signup-box', plans_open: 'plans', order_form_open: 'order-form', order_placed: 'order-done', exam_submit: 'result' };
  function ev(name, extra = {}) {
    if (OVERLAY[name]) screen = OVERLAY[name];
    try {
      const body = JSON.stringify({ vid, ev: name, track: track(), li: loggedIn() ? 1 : 0, ...extra });
      const blob = new Blob([body], { type: 'application/json' });
      if (!(navigator.sendBeacon && navigator.sendBeacon('/api/ev', blob))) {
        fetch('/api/ev', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
      }
    } catch { /* never break the page */ }
  }
  function screenView(name) {
    if (!name || name === screen) return;
    screen = name;
    ev('screen', { tab: name });
  }

  // Landing: once per visit (tab session), with where the visitor came from (site name only, never the full address)
  try {
    if (!sessionStorage.getItem('sh_landed')) {
      sessionStorage.setItem('sh_landed', '1');
      const q = new URLSearchParams(location.search);
      const src = q.get('utm_source') || (q.get('fbclid') ? 'facebook' : '');
      let ref = '';
      try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch { ref = ''; }
      if (ref === location.hostname) ref = '';
      ev('landing', { src: String(src).toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40), ref: ref.toLowerCase().slice(0, 60) });
    }
  } catch { /* storage blocked */ }

  // Which page of the site this is
  const PAGE = { '/live': 'live', '/exam-hall': 'exam-hall' }[location.pathname.replace(/\/+$/, '')];
  if (PAGE) screenView(PAGE);

  // Leaving (tab hidden / closed): the last screen they were on
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && screen) ev('leave', { tab: screen }); });

  // Hooks into the main app (app.js globals); each wrapper only adds an event, then does the original
  function wrap(name, before) {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () {
      try { before.apply(this, arguments); } catch { /* ignore */ }
      return orig.apply(this, arguments);
    };
  }
  function hookApp() {
    wrap('switchTab', tab => screenView(String(tab || '')));
    wrap('filterPastBank', () => ev('past_set_open'));
    wrap('startTimer', () => ev('exam_start', { tab: typeof currentExamId !== 'undefined' && currentExamId === 'CUSTOM' ? 'practice' : 'model' }));
    wrap('submitExam', () => { if (typeof examSubmitted !== 'undefined' && !examSubmitted) ev('exam_submit'); });
    // The page opened on a tab already
    const pane = document.querySelector('.tab-pane:not(.hidden)');
    if (pane && pane.id && pane.id.startsWith('pane-')) screenView(pane.id.slice(5));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(hookApp, 0));
  else hookApp();

  window.Funnel = { ev, screen: screenView };
})();

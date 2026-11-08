/**
 * সোনার হরিণ — "কিসের প্রস্তুতি নিচ্ছেন?" (one exam per user)
 * - First visit: a full-screen picker: government-job exams and university / medical admission, side by side.
 *   Whatever is chosen, the same home page opens, showing only that exam's data. The choice is saved as the
 *   study track (Study.setSetting('track')) and synced to the account like every other setting.
 * - Admission: university -> unit -> year are chosen inside "বিগত পরীক্ষার ধাঁচে প্রশ্ন" (adm-pick.js).
 * - Then, once only: "ফ্রি অ্যাকাউন্ট খুলুন" (register / login), then the guided tour (tour.js). Never again after that.
 * - Direct links for ads and sharing: /bcs, /primary, /ntrca, /bank, /ministry, /non-cadre, /nursing, /admission, /medical
 *   (server.js serves index.html there) open the app already set to that exam.
 * Loaded after study.js and app.js; app.js calls Goal.applyToPages() once its data is ready.
 */
(function () {
  const GOALS = [
    { t: 'BCS', ic: '🏛️', name: 'বিসিএস', sub: 'প্রিলিমিনারি • ২০০ নম্বর' },
    { t: 'PRIMARY', ic: '🏫', name: 'প্রাথমিক শিক্ষক', sub: 'সহকারী শিক্ষক নিয়োগ' },
    { t: 'NTRCA', ic: '🎓', name: 'শিক্ষক নিবন্ধন', sub: 'NTRCA প্রিলিমিনারি' },
    { t: 'BANK', ic: '🏦', name: 'ব্যাংক', sub: 'সরকারি ও বেসরকারি ব্যাংক' },
    { t: 'MINISTRY', ic: '🏢', name: 'মন্ত্রণালয় ও অধিদপ্তর', sub: 'খাদ্য, অডিটর, অফিস সহায়ক' },
    { t: 'NON_CADRE', ic: '📜', name: 'নন-ক্যাডার ও দুদক', sub: '৯ম–১০ম গ্রেড' },
    { t: 'NURSING', ic: '🩺', name: 'নার্সিং', sub: 'সিনিয়র স্টাফ নার্স' }
  ];
  // Admission: two cards, one track (the card only decides which university the year list opens on)
  const ADMISSION_CARDS = [
    { t: 'ADMISSION', kind: 'university', ic: '🏛️', name: 'বিশ্ববিদ্যালয় ভর্তি', sub: 'ঢাবি, জাবি, রাবি, চবি, বুয়েট, গুচ্ছ, জাতীয় বিশ্ববিদ্যালয়' },
    { t: 'ADMISSION', kind: 'medical', ic: '🩺', name: 'মেডিকেল ও ডেন্টাল ভর্তি', sub: 'MBBS, BDS, AFMC' }
  ];
  const PATHS = { '/bcs': 'BCS', '/primary': 'PRIMARY', '/ntrca': 'NTRCA', '/bank': 'BANK', '/ministry': 'MINISTRY', '/non-cadre': 'NON_CADRE', '/nursing': 'NURSING', '/admission': 'ADMISSION', '/medical': 'ADMISSION' };
  const JOB_TRACKS = GOALS.map(g => g.t);
  // Exams the app narrows itself to once chosen (admission included: it narrows further to the student's target)
  const GOAL_TRACKS = [...JOB_TRACKS, 'ADMISSION'];

  const nameOf = t => (t === 'ADMISSION' ? 'বিশ্ববিদ্যালয় ও মেডিকেল ভর্তি' : (GOALS.find(g => g.t === t) || {}).name || '');

  const css = `
    .goal-overlay{position:fixed;inset:0;z-index:9000;background:var(--bg,#f4f6f5);overflow-y:auto;padding:28px 16px 40px}
    .goal-overlay[hidden]{display:none}
    .goal-box{max-width:560px;margin:0 auto}
    .goal-logo{width:56px;height:56px;border-radius:16px}
    .goal-title{font-size:26px;font-weight:800;line-height:1.3;margin:14px 0 4px;color:var(--ink,#0f172a)}
    .goal-sub{color:var(--ink-soft,#475569);font-size:15px;margin-bottom:20px}
    .goal-group{font-size:14px;font-weight:700;color:var(--ink-soft,#475569);margin:18px 0 10px}
    .goal-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .goal-card{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;padding:14px;border-radius:16px;
      background:var(--surface,#fff);border:2px solid var(--line,#e2e8f0);min-height:96px}
    .goal-card:active{transform:scale(.98)}
    .goal-card.on{border-color:var(--green,#047857);background:var(--green-tint,#ecfdf5)}
    .goal-card .ic{font-size:26px;line-height:1.2}
    .goal-card b{font-size:16px;color:var(--ink,#0f172a)}
    .goal-card span.s{font-size:12.5px;color:var(--ink-soft,#64748b);line-height:1.4}
    @media (min-width:900px){.goal-box{max-width:860px}.goal-grid{grid-template-columns:repeat(3,1fr)}}
    .goal-card.wide{grid-column:1/-1;flex-direction:row;align-items:center;gap:12px;min-height:0}
    .goal-other{margin-top:20px;font-size:14px;color:var(--ink-soft,#475569)}
    .goal-other a{color:var(--green,#047857);font-weight:700}
    .goal-close{display:block;margin:22px auto 0;color:var(--ink-soft,#475569);text-decoration:underline;font-size:14px}
    .goal-line{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-radius:14px;
      background:var(--green-tint,#ecfdf5);border:1px solid var(--line,#e2e8f0);font-size:15px}
    .goal-line b{color:var(--ink,#0f172a)}
    .goal-line button,.goal-line .goal-change{color:var(--green,#047857);font-weight:700;white-space:nowrap;text-decoration:none}
    body.has-goal #examTrackPicker, body.has-goal #pastTrackPicker{display:none}
    body.goal-not-bcs #btnSubViewSuperHot, body.goal-not-bcs #btnSuperHotExam{display:none}
    body.goal-not-primary #tab-primary-calc{display:none}
    body.goal-admission #tab-confusing-hot, body.goal-admission #tab-master-toolkit, body.goal-admission .side-nav a[href="/live"]{display:none}
  `;

  let overlay = null;

  function track() {
    return (window.Study && Study.data.settings.track) || null;
  }

  function addStyle() {
    if (document.getElementById('goalStyle')) return;
    const style = document.createElement('style');
    style.id = 'goalStyle';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function build() {
    addStyle();
    overlay = document.createElement('div');
    overlay.className = 'goal-overlay acc-overlay-like';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'কিসের প্রস্তুতি নিচ্ছেন');
    document.body.appendChild(overlay);
  }

  function card(g, current, wide) {
    return `<button type="button" class="goal-card ${wide ? 'wide' : ''} ${g.t === current && !g.kind ? 'on' : ''}" onclick="Goal.choose('${g.t}'${g.kind ? `,'${g.kind}'` : ''})">
      <span class="ic">${g.ic}</span><span><b>${g.name}</b><br><span class="s">${g.sub}</span></span></button>`;
  }

  function open() {
    if (!overlay) build();
    const current = track();
    overlay.innerHTML = `<div class="goal-box">
      <img src="/icon-192.png" class="goal-logo" alt="">
      <h1 class="goal-title">${current ? 'অন্য পরীক্ষা বেছে নিন' : 'আপনি কিসের প্রস্তুতি নিচ্ছেন?'}</h1>
      <p class="goal-sub">একটা বেছে নিন, তাহলে শুধু ওই পরীক্ষার প্রশ্ন আর মডেল টেস্ট দেখাবে। পরে যেকোনো সময় বদলাতে পারবেন।</p>
      <div class="goal-group">💼 সরকারি চাকরি</div>
      <div class="goal-grid">${GOALS.map(g => card(g, current)).join('')}</div>
      <div class="goal-group">🎓 ভর্তি পরীক্ষা (HSC পাস)</div>
      <div class="goal-grid">${ADMISSION_CARDS.map(g => card(g, current)).join('')}</div>
      ${current ? '<button type="button" class="goal-close" onclick="Goal.close()">বন্ধ করুন</button>' : ''}
    </div>`;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function close() {
    autoOpened = false;
    if (overlay) overlay.hidden = true;
    document.body.style.overflow = '';
  }

  // The choice is also kept on its own key: logging out or a progress reset never brings the picker back
  const GOAL_KEY = 'sh_goal_v1';
  const remember = t => { try { if (t) localStorage.setItem(GOAL_KEY, t); } catch { /* storage blocked */ } };
  function choose(t, kind) {
    remember(t);
    if (t === 'ADMISSION' && window.AdmPick) AdmPick.preset(kind || 'university');
    Study.setTrack(t);
    close();
    applyToPages();
    if (typeof setPastBankTrack === 'function' && t === 'ADMISSION') setPastBankTrack('ADMISSION');
    if (typeof switchTab === 'function') switchTab('home');
    welcome();
  }

  // ---- First visit only: free account first, then the tour. Never shown again. ----
  const WELCOME_KEY = 'sh_welcome_done_v1';
  const seen = () => { try { return localStorage.getItem(WELCOME_KEY) === '1'; } catch { return true; } };
  function welcome() {
    if (seen() || !window.Account) return;
    const go = () => {
      if (seen()) return;
      try { localStorage.setItem(WELCOME_KEY, '1'); } catch { /* storage blocked */ }
      const tour = () => setTimeout(() => window.Tour && Tour.startOnce(), 300);
      // Already has an account (e.g. logged in on a new phone): not a new user, no box and no tour
      if (Account.user) return;
      Account.openLogin(null, null, { welcome: true, later: true, mode: 'register', onClose: tour });
    };
    if (Account.loaded) go();
    else window.addEventListener('account:ready', go, { once: true });
  }

  // Bars that replace the exam chips on the model-test and question-bank pages
  function ensureLine(id, beforeEl) {
    let el = document.getElementById(id);
    if (!el && beforeEl) {
      el = document.createElement('div');
      el.id = id;
      el.className = 'goal-line';
      beforeEl.parentNode.insertBefore(el, beforeEl);
    }
    return el;
  }

  function refreshLines() {
    const t = track();
    const on = t && GOAL_TRACKS.includes(t);
    document.body.classList.toggle('has-goal', !!on);
    const examPicker = document.getElementById('examTrackPicker');
    const pastPicker = document.getElementById('pastTrackPicker');
    [['goalLineExam', examPicker, typeof activeExamTrack !== 'undefined' ? activeExamTrack : t],
     ['goalLinePast', pastPicker, typeof pastBankTrack !== 'undefined' ? pastBankTrack : t]].forEach(([id, picker, shown]) => {
      const el = ensureLine(id, picker);
      if (!el) return;
      el.hidden = !on;
      el.innerHTML = `<span>📌 পরীক্ষা: <b>${nameOf(shown) || nameOf(t)}</b></span><button type="button" onclick="Goal.open()">বদলান</button>`;
    });
  }

  // Shared lists (confusing pairs, math shortcuts) name the exams each item came in:
  // keep only the items that came in the user's exam, so a primary-teacher user sees primary items
  const EXAM_WORDS = {
    BCS: /বিসিএস/, PRIMARY: /প্রাইমারি|প্রাথমিক/, NTRCA: /NTRCA|নিবন্ধন/, BANK: /ব্যাংক/,
    MINISTRY: /খাদ্য|অডিটর|মন্ত্রণালয়|সমাজসেবা|রেলওয়ে|এলজিইডি|এটিইও|অধিদপ্তর/, NON_CADRE: /নন-ক্যাডার|দুদক/, NURSING: /নার্স/
  };
  const shared = {};
  function filterShared(t) {
    const rx = EXAM_WORDS[t];
    const keep = list => String(list || '').split(/,\s*/).filter(part => rx.test(part)).join(', ');
    // Confusing pairs: only pairs that came in this exam; under each term, only this exam's papers
    if (!('confusingPairsData' in shared)) shared.confusingPairsData = window.confusingPairsData;
    const pairs = shared.confusingPairsData;
    if (Array.isArray(pairs)) {
      const mine = rx ? pairs.filter(p => rx.test(`${p.repeatBadge || ''} ${(p.items || []).map(i => i.exams || '').join(' ')}`)) : pairs;
      window.confusingPairsData = !rx || !mine.length ? pairs : mine.map(p => ({
        ...p,
        // "🔥 ১৪ বার এসেছে (বিসিএস • প্রাইমারি • ...)" -> "🔥 ১৪ বার এসেছে" (the count is across all exams)
        repeatBadge: String(p.repeatBadge || '').replace(/\s*\([^)]*\)\s*$/, ''),
        items: (p.items || []).map(i => ({ ...i, exams: keep(i.exams) }))
      }));
    }
    // Math shortcuts: only the ones that came in this exam
    if (!('mathShortcutSheets' in shared)) shared.mathShortcutSheets = window.mathShortcutSheets;
    const sheets = shared.mathShortcutSheets;
    if (Array.isArray(sheets)) {
      const mine = rx ? sheets.filter(m => rx.test(m.examFrequency || '')) : sheets;
      window.mathShortcutSheets = !rx || !mine.length ? sheets : mine.map(m => ({ ...m, examFrequency: String(m.examFrequency || '').replace(/\s*\([^)]*\)\s*$/, '') }));
    }
  }

  // Open both pages on the user's exam (called by app.js once the question data is loaded)
  function applyToPages(opts = {}) {
    const t = track();
    filterShared(t);
    // The 200 hard questions are BCS questions: other exams do not see them
    document.body.classList.toggle('goal-not-bcs', !!t && t !== 'BCS');
    // The 100-mark final score calculator is for primary teachers only
    document.body.classList.toggle('goal-not-primary', !!t && t !== 'PRIMARY');
    if (t && t !== 'BCS' && typeof setConfusingHotSubView === 'function' && typeof confusingHotSubView !== 'undefined' && confusingHotSubView !== 'PAIRS') setConfusingHotSubView('PAIRS');
    // Job exams and admission: confusing pairs, shortcuts, viva, the BCS live exam are job-exam things
    document.body.classList.toggle('goal-admission', t === 'ADMISSION');
    if (t && GOAL_TRACKS.includes(t)) {
      if (!opts.keepExam && typeof selectExamTrack === 'function' && activeExamTrack !== t) selectExamTrack(t);
      if (typeof setPastBankTrack === 'function' && pastBankTrack !== t) setPastBankTrack(t);
    }
    refreshLines();
  }

  // A direct link (/bcs, /nursing, ...) sets the exam before anything is drawn
  function fromPath() {
    const t = PATHS[location.pathname.replace(/\/+$/, '').toLowerCase()];
    if (t && window.Study && Study.data.settings.track !== t) Study.setSetting('track', t);
    return t || null;
  }

  // Read the link at once: app.js reads the exam as soon as its own start-up runs
  const linked = fromPath();
  // Chosen before on this browser but the progress copy lost it (logout, cleared data): use the saved choice
  try {
    const saved = localStorage.getItem('sh_goal_v1');
    if (!linked && saved && window.Study && !Study.data.settings.track) Study.setSetting('track', saved);
  } catch { /* storage blocked */ }
  // Old admission-page choices: no longer used
  try { ['admissionGoal', 'admissionUnit', 'admissionStep', 'admissionGroup'].forEach(k => localStorage.removeItem(k)); } catch { /* storage blocked */ }
  if (location.pathname.replace(/\/+$/, '').toLowerCase() === '/medical' && window.AdmPick) AdmPick.preset('medical');
  // A set opened from a shared link (/?set=...) goes straight to the exam
  const linkedSet = new URLSearchParams(location.search).get('set') || '';
  if (linkedSet.startsWith('ADM_') && window.Study && !Study.data.settings.track) Study.setSetting('track', 'ADMISSION');

  // A logged-in person's choice is in their account and arrives a moment after the page opens:
  // show the picker only once it is clear this is a new user (not logged in, or the account has no choice)
  let autoOpened = false;
  function openWhenNew() {
    let done = false;
    const decide = () => {
      if (done || track()) return;
      done = true;
      const show = () => { if (!track()) { autoOpened = true; open(); } };
      if (window.Account && Account.user) setTimeout(show, 2500);
      else show();
    };
    if (!window.Account || Account.loaded) decide();
    else {
      window.addEventListener('account:ready', decide, { once: true });
      setTimeout(decide, 4000); // offline: the account check never answers
    }
  }

  function init() {
    addStyle();

    if (!linked && !linkedSet && !track()) openWhenNew();
    // Came by a direct link (/bcs, /admission ...) or already had an exam: the free-account box once, then the tour
    else if (!linkedSet) welcome();
    // The exam came from the account (logged in on another device): use it, and close a picker opened meanwhile
    let applied = track();
    if (window.Study) Study.onChange(() => {
      const t = track();
      if (!t || t === applied) return;
      applied = t;
      remember(t);
      if (autoOpened && overlay && !overlay.hidden) close();
      applyToPages();
      if (typeof Study.refresh === 'function') Study.refresh();
    });
    // Keep the bars right when another part of the app switches the exam
    ['selectExamTrack', 'setPastBankTrack'].forEach(fn => {
      const orig = window[fn];
      if (typeof orig !== 'function') return;
      window[fn] = function () {
        const r = orig.apply(this, arguments);
        refreshLines();
        return r;
      };
    });
    refreshLines();
  }

  window.Goal = { open, close, choose, applyToPages, refreshLines, GOALS, linked: linked || linkedSet || null, isOpen: () => !!overlay && !overlay.hidden };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

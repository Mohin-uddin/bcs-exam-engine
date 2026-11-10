/**
 * First visit home (until the visitor has finished an exam or quiz), with no full-screen exam picker:
 *   [বিসিএস | প্রাথমিক | ... | বিশ্ববিদ্যালয় ভর্তি | মেডিকেল]   <- one row of exam chips, BCS chosen at first
 *   that exam's past papers (free ones first, one tap starts) / admission dropdowns
 *   "একটা প্রশ্ন দিয়ে দেখুন" (a real question, answer + explanation at once)
 * Drawn twice: right away from /catalog.js (small) while /seed-data.js (the questions, ~1 MB) is still loading,
 * then again by study.js when the app is ready. A tap before the app is ready waits and then goes on.
 */
(function () {
  const bn = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { return null; } return v; };
  const cat = () => window.HOME_CATALOG || { locked: [], exams: [], archives: {}, admission: [], tries: {} };

  const CHIPS = [
    ['BCS', 'বিসিএস'], ['PRIMARY', 'প্রাথমিক'], ['ADMISSION_UNI', 'বিশ্ববিদ্যালয় ভর্তি'], ['ADMISSION_MED', 'মেডিকেল ভর্তি'],
    ['NTRCA', 'শিক্ষক নিবন্ধন'], ['BANK', 'ব্যাংক'], ['MINISTRY', 'মন্ত্রণালয়'], ['NON_CADRE', 'নন-ক্যাডার'], ['NURSING', 'নার্সিং']
  ];
  const TITLE = {
    BCS: 'বিসিএস প্রিলির বিগত সালের প্রশ্ন', PRIMARY: 'প্রাথমিক শিক্ষক নিয়োগের বিগত প্রশ্ন', NTRCA: 'শিক্ষক নিবন্ধনের প্রশ্নসেট',
    BANK: 'ব্যাংক নিয়োগের প্রশ্নসেট', MINISTRY: 'মন্ত্রণালয় ও অধিদপ্তরের প্রশ্নসেট', NON_CADRE: 'নন-ক্যাডার ও দুদকের প্রশ্নসেট',
    NURSING: 'নার্সিং নিয়োগের প্রশ্নসেট', ADMISSION_UNI: 'বিশ্ববিদ্যালয় ভর্তির বিগত সালের প্রশ্ন', ADMISSION_MED: 'মেডিকেল ভর্তির বিগত সালের প্রশ্ন'
  };
  const trackOf = key => (String(key).startsWith('ADMISSION') ? 'ADMISSION' : key);

  // The app is ready once app.js has loaded the questions (app.js fires 'app:ready')
  const ready = () => Boolean(window.__appReady && window.Study && typeof window.launchExamFromPastBank === 'function');

  // The visitor's exam key: BCS ... ADMISSION_UNI / ADMISSION_MED (BCS until they choose)
  // A link that names the exam (/bcs, /medical, ?track=nursing): the same rule as goal.js
  const LINK = { bcs: 'BCS', primary: 'PRIMARY', ntrca: 'NTRCA', bank: 'BANK', ministry: 'MINISTRY', 'non-cadre': 'NON_CADRE', non_cadre: 'NON_CADRE',
    nursing: 'NURSING', admission: 'ADMISSION_UNI', university: 'ADMISSION_UNI', medical: 'ADMISSION_MED' };
  function linkKey() {
    const path = location.pathname.replace(/\/+$/, '').replace(/^\//, '').toLowerCase();
    const q = String(new URLSearchParams(location.search).get('track') || '').toLowerCase();
    return LINK[path] || LINK[q] || null;
  }
  function currentKey() {
    if (window.Goal && Goal.liveTrack && window.Study && Study.data.settings.track) return Goal.liveTrack();
    if (linkKey()) return linkKey();
    const t = ls('sh_goal_v1');
    if (t === 'ADMISSION') return ls('sh_adm_kind') === 'medical' ? 'ADMISSION_MED' : 'ADMISSION_UNI';
    return CHIPS.some(c => c[0] === t) ? t : 'BCS';
  }

  const isLocked = id => (window.Account && Account.isLocked && window.__appReady ? Account.isLocked(id) : cat().locked.includes(id));
  const examsList = () => (ready() && window.availableExams) || cat().exams;
  const examById = id => examsList().find(e => e.id === id || e.id === `${id}_SET`) || null;
  const qCount = e => (e ? (e.questionIds ? e.questionIds.length : e.n) : 0);

  // The exam's sets as cards: { id, title, sub, n }
  function sets(key) {
    if (key === 'BCS') {
      return examsList().filter(e => /^BCS_\d+_SET$/.test(e.id))
        .sort((a, b) => Number(b.id.match(/\d+/)[0]) - Number(a.id.match(/\d+/)[0]))
        .map(e => ({ id: e.id, title: `${(e.title.match(/^\S+তম/) || [''])[0]} বিসিএস`, sub: (e.title.match(/(২০|১৯)[০-৯]{2}(?=\))/) || [''])[0], n: qCount(e) }));
    }
    const list = cat().archives[key] || [];
    return [...list].sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0)).map(a => {
      const ex = examById(a.code);
      const phase = String(a.phase || '');
      const title = a.year
        ? [bn(a.year), phase.split('(')[0].trim()].filter(Boolean).join(' • ')
        : String(a.title || '').replace(/^[^ঀ-৿A-Za-z0-9]+/, '').split('(')[0].replace(/স্পেশাল\s*|পূর্ণাঙ্গ\s*|বিপিএসসি\s*/g, '').replace(/\s+/g, ' ').trim().slice(0, 44);
      return { id: ex ? ex.id : a.code, title, sub: a.year ? ((phase.match(/\((.+)\)/) || [])[1] || '') : String(a.setNameBn || ''), n: a.n || qCount(ex) };
    });
  }

  // Admission dropdowns need the year papers; before the questions load they come from the catalog
  function admReady() {
    if (!window.admissionExamsArchive && cat().admission.length) window.admissionExamsArchive = cat().admission;
    return Boolean(window.AdmPick && window.admissionExamsArchive);
  }

  function chipsHtml(key) {
    return `<div class="exam-chip-row" role="tablist" aria-label="কোন পরীক্ষার প্রস্তুতি">${CHIPS.map(([k, name]) =>
      `<button type="button" role="tab" aria-selected="${k === key}" class="exam-chip ${k === key ? 'on' : ''}" onclick="FirstHome.choose('${k}')">${esc(name)}</button>`).join('')}</div>`;
  }

  function heroHtml(key) {
    let body = '';
    let line = '';
    if (key.startsWith('ADMISSION') && admReady()) {
      const papers = (window.admissionExamsArchive || []).filter(a => a.isPastStyle && a.admType && !a.isPatternModel).length;
      const unis = AdmPick.list(false).length + AdmPick.list(true).length;
      line = `${bn(unis)}টি বিশ্ববিদ্যালয় ও পরীক্ষা • ${bn(papers)}টি সালের প্রশ্নপত্র, উত্তর ও ব্যাখ্যাসহ`;
      body = '<div id="heroAdmPick"></div>';
    } else {
      const list = sets(key);
      const total = list.reduce((n, x) => n + (Number(x.n) || 0), 0);
      line = `${bn(list.length)}টি প্রশ্নসেট • মোট ${bn(total.toLocaleString('en-US'))} প্রশ্ন, উত্তর ও ব্যাখ্যাসহ`;
      const shown = [...list.filter(x => !isLocked(x.id)), ...list.filter(x => isLocked(x.id))].slice(0, 6);
      body = `<div class="hero-sets">${shown.map(x => {
        const free = !isLocked(x.id);
        return `<button type="button" class="hero-set ${free ? 'free' : 'locked'}" data-set="${esc(x.id)}" onclick="FirstHome.start('${esc(trackOf(key))}','${esc(x.id)}', this)">
          <b>${esc(x.title)}</b><span class="muted">${esc([x.sub, x.n ? `${bn(x.n)} প্রশ্ন` : ''].filter(Boolean).join(' • '))}</span>
          <span class="hero-tag">${free ? 'ফ্রি • এখনই শুরু ▶' : '🔒 প্যাকেজে'}</span></button>`;
      }).join('')}</div>`;
    }
    return `<div class="first-hero panel">
      ${chipsHtml(key)}
      <h2 class="fh-title">${esc(TITLE[key] || 'বিগত সালের প্রশ্ন')}</h2>
      <p class="fh-sub">${line}</p>
      ${body}
      <button type="button" class="fh-all" onclick="FirstHome.all()">সব ${key.startsWith('ADMISSION') ? 'বিশ্ববিদ্যালয় ও সাল' : 'প্রশ্নসেট'} দেখুন →</button>
    </div>`;
  }

  // ---- One question to try ----
  let tryQ = null;
  let tryPicked = null;
  const tryStats = { n: 0, right: 0 };
  function pickTry(key) {
    const pool = (cat().tries[key] || []).filter(q => !tryQ || q.id !== tryQ.id);
    return pool.length ? { ...pool[Math.floor(Math.random() * pool.length)], _for: key } : null;
  }
  function tryHtml(key) {
    if (!tryQ || tryQ._for !== key) { tryQ = pickTry(key); tryPicked = null; }
    if (!tryQ) return '';
    const q = tryQ;
    const done = tryPicked !== null;
    const right = done && tryPicked === q.correctOption;
    return `<div class="try-card panel" id="tryCard">
      <div class="try-head"><span>🧠 একটা প্রশ্ন দিয়ে দেখুন</span>${tryStats.n ? `<span class="muted">${bn(tryStats.right)}/${bn(tryStats.n)} ঠিক</span>` : ''}</div>
      <p class="try-q">${esc(q.stemBn)}</p>
      <div class="try-opts">${Object.entries(q.options).map(([k, v]) => {
        const cls = !done ? '' : k === q.correctOption ? 'ok' : k === tryPicked ? 'bad' : 'dim';
        return `<button type="button" class="try-opt ${cls}" ${done ? 'disabled' : ''} onclick="FirstHome.answer('${esc(k)}')"><b>${esc({ A: 'ক', B: 'খ', C: 'গ', D: 'ঘ' }[k] || k)}</b> ${esc(v)}</button>`;
      }).join('')}</div>
      ${done ? `<div class="try-exp ${right ? 'ok' : 'bad'}"><b>${right ? '✅ সঠিক!' : '❌ হয়নি।'}</b> ${esc(q.explanationBn)}</div>
        <div class="try-actions"><button type="button" class="btn btn-primary" onclick="FirstHome.next()">আরেকটা প্রশ্ন →</button></div>` : ''}
    </div>`;
  }
  function answer(k) {
    if (!tryQ || tryPicked !== null) return;
    tryPicked = k;
    tryStats.n += 1;
    if (k === tryQ.correctOption) tryStats.right += 1;
    if (window.Funnel) Funnel.ev('try_answer');
    const el = document.getElementById('tryCard');
    if (el) el.outerHTML = tryHtml(tryQ._for);
  }
  function next() {
    const key = tryQ ? tryQ._for : currentKey();
    tryPicked = null;
    tryQ = pickTry(key) || tryQ;
    if (tryQ) tryQ._for = key;
    const el = document.getElementById('tryCard');
    if (el) el.outerHTML = tryHtml(key);
  }

  // The first-visit block: chips + papers + one question
  function html(key = currentKey()) {
    return heroHtml(key) + tryHtml(key);
  }

  // After it is drawn: admission dropdowns in place; their button starts the paper at once
  function bind() {
    const box = document.getElementById('heroAdmPick');
    if (!box || !admReady()) return;
    const draw = code => {
      box.innerHTML = AdmPick.html(code);
      AdmPick.bind(box, draw);
      const btn = box.querySelector('.adm-start');
      const id = btn && (btn.getAttribute('onclick').match(/'([^']+)'\)$/) || [])[1];
      if (btn && id) {
        btn.removeAttribute('onclick');
        btn.textContent = isLocked(id) ? '🔒 এই সাল প্যাকেজে • দেখুন' : '▶ এই সালের পরীক্ষা শুরু করুন (ফ্রি)';
        btn.addEventListener('click', () => start('ADMISSION', id, btn));
      }
    };
    draw(AdmPick.current());
  }

  // Open a set and start it (locked: package box; not logged in: sign-up box, then it starts).
  // Tapped before the app is ready: say so on the button and do it when ready.
  let pending = null;
  function start(track, id, el) {
    if (!ready()) {
      pending = { track, id };
      if (el) { el.classList.add('is-loading'); const tag = el.querySelector('.hero-tag'); if (tag) tag.textContent = 'খুলছে… প্রশ্ন লোড হচ্ছে'; else el.textContent = 'খুলছে… প্রশ্ন লোড হচ্ছে'; }
      return;
    }
    if (isLocked(id)) { if (window.Account) Account.allow(id); return; }
    window.launchExamFromPastBank(track, id);
    setTimeout(() => { if (typeof window.startExam === 'function') window.startExam(); }, 250);
  }
  function all() {
    if (ready()) return window.switchTab('past-bank');
    location.hash = 'past-bank';
  }

  // Chip: switch exam at once (saved; the app takes it over once ready)
  function choose(key) {
    const t = trackOf(key);
    const kind = key === 'ADMISSION_MED' ? 'medical' : 'university';
    ls('sh_goal_v1', t);
    if (t === 'ADMISSION') ls('sh_adm_kind', kind);
    ls('sh_track_auto', null);
    tryQ = null;
    if (ready() && window.Goal) { Goal.choose(t, kind); return; }
    if (window.Funnel) Funnel.ev('track_chosen');
    drawEarly(true);
  }

  // ---- Drawn right away, before the questions have loaded ----
  function isNewVisitor() {
    try {
      const raw = JSON.parse(localStorage.getItem('sh_progress_v1') || 'null');
      return !(raw && raw.data && raw.data.attempts && raw.data.attempts.length);
    } catch { return true; }
  }
  function drawEarly(force) {
    const pane = document.getElementById('homeBody');
    if (!pane || (ready() && !force)) return;
    const hash = location.hash.replace('#', '');
    if ((hash && hash !== 'home') || /[?&]set=/.test(location.search) || !isNewVisitor()) return;
    pane.innerHTML = `${html()}<p class="muted" style="text-align:center;padding:8px">⏳ বাকি অংশ লোড হচ্ছে…</p>`;
    bind();
    if (window.Funnel) Funnel.ev('home_view');
  }

  window.addEventListener('app:ready', () => {
    if (!pending) return;
    const p = pending;
    pending = null;
    setTimeout(() => start(p.track, p.id), 300);
  });

  window.FirstHome = { html, bind, start, choose, answer, next, all, currentKey, isNewVisitor, chipsHtml };
  if (window.HOME_CATALOG) drawEarly();
  else document.addEventListener('DOMContentLoaded', () => drawEarly());
})();

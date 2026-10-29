/**
 * ============================================================================
 * সোনার হরিণ — personal study layer (loaded before app.js)
 * ============================================================================
 * - Progress: Mistake Vault, bookmarks, SM-2 flashcards, exam history, daily streak.
 *   Saved in this browser at once, and synced to the account when logged in
 *   (/api/progress), so the website and the Android app show the same progress.
 * - Home dashboard ("আজকের পড়া"), results & weak-subject analysis, smart practice,
 *   question search, cut-mark comparison, settings (dark mode, text size, exam goal).
 * Needs: progress-core.js (ProgressCore), seed-data.js (window.sampleQuestions ...).
 */
(function () {
  const core = window.ProgressCore;
  const LS_KEY = 'sh_progress_v1';
  const DAY = core.DAY;

  const bn = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const OPT_BN = { A: 'ক', B: 'খ', C: 'গ', D: 'ঘ' };
  const TRACK_BN = {
    BCS: 'বিসিএস', PRIMARY: 'প্রাথমিক শিক্ষক', NTRCA: 'শিক্ষক নিবন্ধন', BANK: 'ব্যাংক',
    MINISTRY: 'মন্ত্রণালয় ও অধিদপ্তর', NON_CADRE: 'নন-ক্যাডার ও দুদক', NURSING: 'নার্সিং'
  };
  const TRACK_NEG = { BCS: 0.5, NON_CADRE: 0.5, NURSING: 0.5 };
  const negOf = track => TRACK_NEG[track] || 0.25;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const fmtDate = ms => new Date(ms).toLocaleDateString('bn-BD', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short' });
  const fmtMin = sec => `${bn(Math.floor(sec / 60))} মি. ${bn(sec % 60)} সে.`;

  // ---------------------------------------------------------------------------
  // Questions
  // ---------------------------------------------------------------------------
  let qIndex = null;
  const allQuestions = () => window.sampleQuestions || [];
  function qById(id) {
    if (!qIndex || qIndex.size !== allQuestions().length) qIndex = new Map(allQuestions().map(q => [q.id, q]));
    return qIndex.get(id) || null;
  }
  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------------------------------------------------------------------------
  // Toast
  // ---------------------------------------------------------------------------
  function toast(msg) {
    let el = document.getElementById('appToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'appToast';
      el.className = 'app-toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('show'), 3200);
  }

  // ---------------------------------------------------------------------------
  // Progress store: localStorage now, server when logged in
  // ---------------------------------------------------------------------------
  let data = core.empty();
  let owner = null; // account id this copy belongs to (null = not logged in)
  let pushTimer = null;
  let syncing = false;
  let loggedIn = false;
  const listeners = [];

  function readLocal() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (raw && raw.data) {
        data = core.sanitize(raw.data);
        owner = raw.owner || null;
      }
    } catch { /* storage blocked: keep in memory only */ }
  }

  function writeLocal() {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ owner, data })); } catch { /* storage full or blocked */ }
  }

  function emit() {
    listeners.forEach(fn => { try { fn(data); } catch (e) { console.error(e); } });
  }

  function change(fn) {
    fn(data);
    writeLocal();
    emit();
    if (loggedIn) {
      clearTimeout(pushTimer);
      pushTimer = setTimeout(push, 2500);
    }
  }

  async function push(keepalive = false) {
    clearTimeout(pushTimer);
    pushTimer = null;
    if (!loggedIn) return;
    try {
      const res = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress: data }),
        credentials: 'same-origin',
        keepalive
      });
      if (res.status === 401) {
        loggedIn = false;
        return;
      }
      const out = await res.json();
      if (out.progress && !keepalive) {
        data = core.merge(data, out.progress);
        writeLocal();
        emit();
      }
    } catch { /* offline: next change or next visit sends it */ }
  }

  async function sync() {
    if (syncing) return;
    syncing = true;
    try {
      // Not logged in: skip the request (it would only answer 401)
      const guest = window.Account && !window.Account.user;
      const res = guest ? { status: 401 } : await fetch('/api/progress', { credentials: 'same-origin' });
      if (res.status === 401) {
        loggedIn = false;
        // The previous person on this browser logged out: don't show them their progress
        if (owner) {
          owner = null;
          data = core.empty();
          writeLocal();
          emit();
        }
        return;
      }
      const out = await res.json();
      loggedIn = true;
      const server = core.sanitize(out.progress);
      // Practice done before logging in is carried into the account; another account's data is not
      data = owner && owner !== out.userId ? server : core.merge(data, server);
      owner = out.userId;
      writeLocal();
      emit();
      if (JSON.stringify(data) !== JSON.stringify(server)) push();
    } catch { /* offline */ } finally {
      syncing = false;
    }
  }

  readLocal();
  window.addEventListener('account:change', sync);
  window.addEventListener('pagehide', () => { if (pushTimer) push(true); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && pushTimer) push(true); });

  // ---------------------------------------------------------------------------
  // Daily activity
  // ---------------------------------------------------------------------------
  function addActivity(count) {
    if (!count) return;
    change(d => {
      const k = core.dayKey();
      d.days[k] = (d.days[k] || 0) + count;
    });
  }
  const todayCount = () => data.days[core.dayKey()] || 0;
  const goal = () => data.settings.goal || 50;

  // ---------------------------------------------------------------------------
  // Mistake Vault (ভুল খাতা)
  // ---------------------------------------------------------------------------
  function initialTag(q) {
    if (/নয়|সঠিক নয়|not correct|incorrect/i.test(q.stemBn || '')) return 'UNREAD_STEM';
    return q.difficulty === 'STANDARD' ? 'SILLY_MISTAKE' : 'CONCEPT_GAP';
  }

  // wrong: [{ q, sel }]
  function addMistakes(wrong, src) {
    if (!wrong.length) return;
    const now = Date.now();
    change(d => {
      wrong.forEach(({ q, sel }) => {
        const old = d.mistakes[q.id];
        d.mistakes[q.id] = old
          ? { ...old, sel, src, n: old.n + 1, t: now, reps: 0, iv: 1, due: now + DAY, status: 'OPEN' }
          : { qid: q.id, sel, tag: initialTag(q), n: 1, src, at: now, t: now, ef: 2.5, reps: 0, iv: 1, due: now + DAY, status: 'OPEN' };
      });
    });
  }

  function mistakeList() {
    return Object.values(data.mistakes)
      .map(m => ({ ...m, q: qById(m.qid) }))
      .filter(m => m.q)
      .sort((a, b) => b.t - a.t);
  }

  function reviewMistake(qid, quality) {
    const m = data.mistakes[qid];
    if (!m) return;
    const next = core.sm2(m, quality);
    change(d => { d.mistakes[qid] = { ...m, ...next }; });
    addActivity(1);
    const days = next.iv;
    toast(quality < 3 ? 'আগামীকাল আবার আসবে।' : `পরের রিভিশন ${bn(days)} দিন পর।`);
  }

  function tagMistake(qid, tag) {
    if (!data.mistakes[qid]) return;
    change(d => { d.mistakes[qid] = { ...d.mistakes[qid], tag, t: Date.now() }; });
  }

  // ---------------------------------------------------------------------------
  // Bookmarks
  // ---------------------------------------------------------------------------
  const isBookmarked = qid => Boolean(data.bookmarks[qid] && data.bookmarks[qid].on);
  function toggleBookmark(qid) {
    const on = !isBookmarked(qid);
    change(d => { d.bookmarks[qid] = { on, t: Date.now() }; });
    toast(on ? '⭐ বুকমার্ক করা হয়েছে' : 'বুকমার্ক সরানো হয়েছে');
    return on;
  }
  const bookmarkIds = () => Object.keys(data.bookmarks).filter(isBookmarked).filter(id => qById(id));

  // ---------------------------------------------------------------------------
  // Flashcards (SM-2 per card)
  // ---------------------------------------------------------------------------
  function dueReviewIds(now = Date.now()) {
    const ids = new Set();
    Object.values(data.mistakes).forEach(m => { if (m.status !== 'MASTERED' && core.isDue(m, now) && qById(m.qid)) ids.add(m.qid); });
    Object.entries(data.cards).forEach(([qid, c]) => { if (core.isDue(c, now) && qById(qid)) ids.add(qid); });
    return [...ids];
  }

  // Due cards first, then new cards from bookmarks and the user's exam type
  function buildDeck(limit = 30) {
    const due = dueReviewIds();
    const seen = new Set([...due, ...Object.keys(data.cards)]);
    const track = data.settings.track || 'BCS';
    const fresh = [
      ...bookmarkIds(),
      ...shuffle(allQuestions().filter(q => q.examTrack === track && (q.mnemonicBn || q.explanationBn)).map(q => q.id))
    ].filter(id => !seen.has(id));
    return { due: due.length, ids: [...due, ...[...new Set(fresh)]].slice(0, limit) };
  }

  function rateCard(qid, quality) {
    const now = Date.now();
    const card = core.sm2(data.cards[qid], quality, now);
    change(d => {
      d.cards[qid] = { ef: card.ef, reps: card.reps, iv: card.iv, due: card.due, t: now };
      // A card that is also in the Mistake Vault moves on the same schedule
      if (d.mistakes[qid]) d.mistakes[qid] = { ...d.mistakes[qid], ...core.sm2(d.mistakes[qid], quality, now) };
    });
    addActivity(1);
    return card;
  }

  // ---------------------------------------------------------------------------
  // Exam history
  // ---------------------------------------------------------------------------
  // r: { examId, title, track, questions, answers, neg, dur, time }
  function recordAttempt(r) {
    const subj = {};
    let c = 0;
    let w = 0;
    let b = 0;
    const wrong = [];
    r.questions.forEach(q => {
      const s = subj[q.subjectCode || 'OTHER'] || (subj[q.subjectCode || 'OTHER'] = { name: q.subjectNameBn || 'অন্যান্য', c: 0, w: 0, b: 0 });
      const sel = r.answers[q.id];
      if (!sel) { b++; s.b++; } else if (sel === q.correctOption) { c++; s.c++; } else { w++; s.w++; wrong.push(q.id); }
    });
    const attempt = {
      id: `at_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      examId: r.examId || 'CUSTOM',
      title: r.title || 'অনুশীলন',
      track: r.track || '',
      at: Date.now(),
      n: r.questions.length,
      c, w, b,
      neg: r.neg,
      net: Number((c - w * r.neg).toFixed(2)),
      dur: r.dur || 0,
      time: r.time || 0,
      subj,
      wrong
    };
    const prev = data.attempts.find(a => a.examId === attempt.examId && attempt.examId !== 'CUSTOM');
    change(d => { d.attempts = [attempt, ...d.attempts]; });
    addActivity(c + w);
    return { attempt, prev };
  }

  // Safe cut-mark from the last 5 real papers of this exam type, scaled to this set's size
  function cutMarkFor(track, totalQ) {
    const lists = { BCS: window.bcs20YearsArchive, PRIMARY: window.primaryExamsArchive };
    const list = (lists[track] || []).filter(a => a.safeScoreTrend && a.totalMarks).slice(0, 5);
    if (!list.length || !totalQ) return null;
    const toNum = s => Number(String(s).replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d)));
    const ratios = list.map(a => {
      const nums = String(a.safeScoreTrend).split(/[-–]/).map(toNum).filter(Number.isFinite);
      return nums.length ? (nums.reduce((x, y) => x + y, 0) / nums.length) / a.totalMarks : null;
    }).filter(Boolean);
    if (!ratios.length) return null;
    const ratio = ratios.reduce((x, y) => x + y, 0) / ratios.length;
    return { mark: Math.round(ratio * totalQ * 2) / 2, ratio, years: ratios.length };
  }

  // Subject accuracy over all saved exams
  function subjectStats(track) {
    const acc = {};
    data.attempts.filter(a => !track || a.track === track).forEach(a => {
      Object.entries(a.subj || {}).forEach(([code, s]) => {
        const x = acc[code] || (acc[code] = { code, name: s.name, c: 0, w: 0, b: 0 });
        x.c += s.c; x.w += s.w; x.b += s.b;
      });
    });
    return Object.values(acc)
      .map(s => ({ ...s, total: s.c + s.w + s.b, acc: pct(s.c, s.c + s.w) }))
      .filter(s => s.c + s.w >= 3)
      .sort((a, b) => a.acc - b.acc);
  }

  // ---------------------------------------------------------------------------
  // Smart practice question picking
  // ---------------------------------------------------------------------------
  // source: ALL | WEAK | MISTAKES | BOOKMARKS | UNSEEN ; subject: code or ALL
  function pickQuestions({ track, subject = 'ALL', source = 'ALL', count = 20 }) {
    let pool = allQuestions().filter(q => !track || q.examTrack === track);
    if (subject !== 'ALL') pool = pool.filter(q => q.subjectCode === subject);
    if (source === 'MISTAKES') {
      const ids = new Set(Object.values(data.mistakes).filter(m => m.status !== 'MASTERED').map(m => m.qid));
      pool = allQuestions().filter(q => ids.has(q.id) && (subject === 'ALL' || q.subjectCode === subject));
    } else if (source === 'BOOKMARKS') {
      const ids = new Set(bookmarkIds());
      pool = allQuestions().filter(q => ids.has(q.id) && (subject === 'ALL' || q.subjectCode === subject));
    } else if (source === 'WEAK') {
      const weak = subjectStats(track).slice(0, 3).map(s => s.code);
      if (weak.length) pool = pool.filter(q => weak.includes(q.subjectCode));
    } else if (source === 'UNSEEN') {
      const seen = new Set([...Object.keys(data.mistakes), ...Object.keys(data.cards)]);
      data.attempts.forEach(a => (a.wrong || []).forEach(id => seen.add(id)));
      pool = pool.filter(q => !seen.has(q.id));
    }
    return shuffle(pool).slice(0, count);
  }

  function subjectsOf(track) {
    const map = new Map();
    allQuestions().forEach(q => {
      if (track && q.examTrack !== track) return;
      if (!map.has(q.subjectCode)) map.set(q.subjectCode, { code: q.subjectCode, name: q.subjectNameBn, n: 0 });
      map.get(q.subjectCode).n++;
    });
    return [...map.values()].sort((a, b) => b.n - a.n);
  }

  // Starts a practice set in the model test page (app.js)
  function startPractice({ title, list, track, neg, minutes }) {
    if (!list.length) {
      toast('এই শর্তে কোনো প্রশ্ন পাওয়া যায়নি।');
      return;
    }
    window.startQuestionSet({
      examId: 'CUSTOM',
      title,
      questions: list,
      track: track || data.settings.track || 'BCS',
      negRate: neg ?? negOf(track || data.settings.track || 'BCS'),
      durationMin: minutes || Math.max(5, Math.ceil(list.length * 0.6))
    });
  }

  function dailyQuiz() {
    const track = data.settings.track || 'BCS';
    // Half from what needs revision or weak subjects, half new
    const weak = pickQuestions({ track, source: 'WEAK', count: 10 });
    const fresh = pickQuestions({ track, source: 'UNSEEN', count: 20 }).filter(q => !weak.some(x => x.id === q.id));
    const list = shuffle([...weak, ...fresh].slice(0, 20));
    startPractice({ title: `আজকের ২০ প্রশ্ন • ${TRACK_BN[track]}`, list, track, minutes: 15 });
  }

  // ---------------------------------------------------------------------------
  // HOME: আজকের পড়া
  // ---------------------------------------------------------------------------
  let liveCache = null;
  async function loadLive() {
    try {
      const res = await fetch('/api/live/exams');
      const out = await res.json();
      liveCache = (out.exams || []).filter(e => e.phase !== 'ENDED');
    } catch {
      liveCache = [];
    }
    if (document.getElementById('homeLiveBox')) renderLiveBox();
  }

  function renderLiveBox() {
    const box = document.getElementById('homeLiveBox');
    if (!box) return;
    if (!liveCache) {
      box.innerHTML = '<p class="muted">লাইভ পরীক্ষার তালিকা আনা হচ্ছে...</p>';
      return;
    }
    const next = liveCache[0];
    box.innerHTML = next
      ? `<div class="home-live-title">${next.phase === 'LIVE' ? '🔴 এখন চলছে' : '⏳ আসন্ন'}: ${esc(next.title)}</div>
         <p class="muted">${new Date(next.startAt).toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })} • ${bn(next.totalQuestions)} প্রশ্ন • ${bn(next.durationMin)} মিনিট</p>
         <a href="/live" class="btn btn-primary mt-2">${next.phase === 'LIVE' ? 'পরীক্ষায় অংশ নিন' : 'নিবন্ধন করুন'} →</a>`
      : `<p class="muted">এই মুহূর্তে কোনো লাইভ পরীক্ষার ঘোষণা নেই।</p><a href="/live" class="link">আগের পরীক্ষার মেধা তালিকা দেখুন →</a>`;
  }

  function renderHome() {
    const pane = document.getElementById('homeBody');
    if (!pane) return;
    const track = data.settings.track;
    const streak = core.streak(data.days);
    const today = todayCount();
    const g = goal();
    const due = dueReviewIds().length;
    const last = data.attempts[0];
    const weak = subjectStats(track || undefined).slice(0, 3);
    const user = window.Account && window.Account.user;

    const trackChips = core.TRACKS.map(t => `<button type="button" class="chip ${t === track ? 'chip-active' : ''}" onclick="Study.setTrack('${t}')">${TRACK_BN[t]}</button>`).join('');

    pane.innerHTML = `
      <div class="home-hero panel">
        <div class="home-hero-top">
          <div>
            <h2 class="home-title">${user ? `${esc(user.name.split(' ')[0])}, ` : ''}আজকের পড়া</h2>
            <p class="muted">${new Date().toLocaleDateString('bn-BD', { timeZone: 'Asia/Dhaka', weekday: 'long', day: 'numeric', month: 'long' })}${track ? ` • লক্ষ্য: ${TRACK_BN[track]}` : ''}</p>
          </div>
          <div class="streak" title="টানা যতদিন অনুশীলন করেছেন">🔥 <b>${bn(streak)}</b> দিন</div>
        </div>
        <div class="goal-row">
          <div class="goal-bar"><span style="width:${Math.min(100, pct(today, g))}%"></span></div>
          <span class="muted">আজ ${bn(today)} / ${bn(g)} প্রশ্ন</span>
        </div>
        ${!track ? `<div class="mt-3"><span class="section-label">কোন পরীক্ষার প্রস্তুতি নিচ্ছেন? (একবার বেছে নিন)</span><div class="chip-row">${trackChips}</div></div>` : ''}
        ${!user ? `<p class="home-login-note">💾 আপনার অগ্রগতি এই ব্রাউজারে সংরক্ষিত হচ্ছে। <button type="button" class="link" onclick="Account.openLogin()">লগইন করুন</button>, তাহলে ফোন ও কম্পিউটার দুই জায়গাতেই পাবেন।</p>` : ''}
      </div>

      <div class="home-grid">
        <div class="panel home-card">
          <div class="home-card-ic">🧠</div>
          <h3>রিভিশন বাকি</h3>
          <div class="home-big">${bn(due)}<small> টি</small></div>
          <p class="muted">${due ? 'ভুল খাতা ও ফ্ল্যাশকার্ডের যেগুলো আজ ঝালাই করার কথা।' : 'আজকের রিভিশন শেষ। নতুন কার্ড দেখতে পারেন।'}</p>
          <button type="button" class="btn btn-primary" onclick="switchTab('flashcards')">${due ? 'রিভিশন শুরু' : 'ফ্ল্যাশকার্ড খুলুন'} →</button>
        </div>
        <div class="panel home-card">
          <div class="home-card-ic">🎯</div>
          <h3>আজকের ২০ প্রশ্ন</h3>
          <div class="home-big">১৫<small> মিনিট</small></div>
          <p class="muted">দুর্বল বিষয় আর এখনো না দেখা প্রশ্ন মিলিয়ে প্রতিদিন নতুন সেট।</p>
          <button type="button" class="btn btn-primary" onclick="Study.dailyQuiz()">শুরু করুন →</button>
        </div>
        <div class="panel home-card">
          <div class="home-card-ic">🏆</div>
          <h3>লাইভ পরীক্ষা</h3>
          <div id="homeLiveBox"></div>
        </div>
      </div>

      <div class="home-grid two">
        <div class="panel">
          <h3 class="panel-title">📈 সর্বশেষ ফলাফল</h3>
          ${last ? resultLine(last) : `<p class="muted">এখনো কোনো পরীক্ষা দেননি। একটি মডেল টেস্ট দিন, ফলাফল ও দুর্বল বিষয় এখানে দেখাবে।</p>
            <button type="button" class="btn btn-primary mt-2" onclick="switchTab('exam')">মডেল টেস্ট দিন →</button>`}
          ${last ? `<button type="button" class="link mt-2" onclick="switchTab('analytics')">সব ফলাফল ও বিশ্লেষণ →</button>` : ''}
        </div>
        <div class="panel">
          <h3 class="panel-title">⚠️ দুর্বল বিষয়</h3>
          ${weak.length ? weak.map(s => `
            <div class="weak-row">
              <span>${esc(s.name)}</span>
              <span class="weak-acc ${s.acc < 50 ? 'bad' : s.acc < 70 ? 'mid' : 'good'}">${bn(s.acc)}%</span>
              <button type="button" class="link" onclick="Study.practiceSubject('${esc(s.code)}')">২০ প্রশ্ন অনুশীলন</button>
            </div>`).join('') : '<p class="muted">কয়েকটি পরীক্ষা দেওয়ার পর কোন বিষয়ে আপনি দুর্বল, তা এখানে দেখাবে।</p>'}
        </div>
      </div>

      <div class="panel">
        <h3 class="panel-title">🔎 যেকোনো প্রশ্ন খুঁজুন</h3>
        <input id="qSearchInput" type="search" class="search-input" placeholder="যেমন: চর্যাপদ, সংবিধান, ঐকিক নিয়ম..." oninput="Study.search(this.value)" autocomplete="off">
        <div id="qSearchResults" class="space-y-3 mt-3"></div>
      </div>`;
    renderLiveBox();
    if (!liveCache) loadLive();
  }

  function resultLine(a) {
    const cm = cutMarkFor(a.track, a.n);
    const pass = cm ? a.net >= cm.mark : null;
    return `<div class="result-line">
      <div class="result-title">${esc(a.title)}</div>
      <div class="result-nums">
        <span class="big">${bn(a.net)}</span><span class="muted"> / ${bn(a.n)}</span>
        <span class="pill ok">✓ ${bn(a.c)}</span><span class="pill bad">✗ ${bn(a.w)}</span><span class="pill">— ${bn(a.b)}</span>
      </div>
      ${cm ? `<p class="${pass ? 'ok-text' : 'bad-text'}">${pass ? '✅' : '⚠️'} গত ${bn(cm.years)} বছরের নিরাপদ কাট-মার্ক এই মাপে প্রায় ${bn(cm.mark)}। আপনি ${pass ? `${bn((a.net - cm.mark).toFixed(1))} নম্বর উপরে` : `${bn((cm.mark - a.net).toFixed(1))} নম্বর পিছিয়ে`}।</p>` : ''}
      <p class="muted">${fmtDate(a.at)}${a.time ? ` • সময় ${fmtMin(a.time)}` : ''} • প্রতি ভুলে −${bn(a.neg)}</p>
    </div>`;
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------
  function search(text) {
    const box = document.getElementById('qSearchResults');
    if (!box) return;
    const words = String(text || '').trim().toLowerCase().split(/\s+/).filter(w => w.length > 1);
    if (!words.length) {
      box.innerHTML = '';
      return;
    }
    const hits = [];
    for (const q of allQuestions()) {
      const hay = `${q.stemBn} ${Object.values(q.options || {}).join(' ')} ${q.topicNameBn || ''}`.toLowerCase();
      if (words.every(w => hay.includes(w))) {
        hits.push(q);
        if (hits.length >= 25) break;
      }
    }
    box.innerHTML = hits.length
      ? `<p class="muted">${bn(hits.length)}${hits.length >= 25 ? '+' : ''}টি প্রশ্ন পাওয়া গেছে</p>${hits.map(questionCard).join('')}`
      : '<p class="muted">কোনো প্রশ্ন পাওয়া যায়নি। অন্য শব্দ দিয়ে খুঁজুন।</p>';
  }

  // Question with answer + where it came in real exams
  function questionCard(q) {
    const seen = [...new Set([...(q.crossExamRepeats || []), ...(q.previousExams || [])])].slice(0, 6);
    return `<div class="q-card">
      <div class="q-card-head">
        <span class="muted">${esc(q.subjectNameBn || '')}${q.topicNameBn ? ` • ${esc(q.topicNameBn)}` : ''}</span>
        <span>
          <button type="button" class="icon-mini" title="বুকমার্ক" onclick="toggleBookmark('${q.id}')">${isBookmarked(q.id) ? '⭐' : '☆'}</button>
          <button type="button" class="icon-mini" title="ভুল রিপোর্ট করুন" onclick="openReportModal('${q.id}')">🚩</button>
        </span>
      </div>
      <div class="q-card-stem">${esc(q.stemBn)}</div>
      <div class="q-card-opts">${['A', 'B', 'C', 'D'].map(k => `<span class="${k === q.correctOption ? 'right' : ''}">(${OPT_BN[k]}) ${esc(q.options[k])}</span>`).join('')}</div>
      ${q.explanationBn ? `<div class="q-card-exp">${esc(q.explanationBn)}</div>` : ''}
      ${seen.length ? `<div class="q-card-seen">📌 এসেছে: ${seen.map(esc).join(' • ')}</div>` : ''}
    </div>`;
  }

  // ---------------------------------------------------------------------------
  // RESULTS & ANALYSIS (pane-analytics)
  // ---------------------------------------------------------------------------
  function renderResults() {
    const box = document.getElementById('resultsBody');
    if (!box) return;
    const list = data.attempts;
    if (!list.length) {
      box.innerHTML = `<div class="panel empty-state">
        <div class="empty-ic">📊</div>
        <h3>এখনো কোনো ফলাফল নেই</h3>
        <p class="muted">মডেল টেস্ট, বিগত প্রশ্ন বা অনুশীলনের পরীক্ষা দিলে প্রতিটির ফলাফল, বিষয়ভিত্তিক দুর্বলতা আর উন্নতির গ্রাফ এখানে জমা হবে।</p>
        <button type="button" class="btn btn-primary" onclick="switchTab('exam')">প্রথম মডেল টেস্ট দিন →</button>
      </div>`;
      return;
    }
    const tot = list.reduce((s, a) => ({ c: s.c + a.c, w: s.w + a.w, lost: s.lost + a.w * a.neg }), { c: 0, w: 0, lost: 0 });
    const recent = list.slice(0, 12).reverse();
    const subj = subjectStats();
    box.innerHTML = `
      <div class="stat-grid">
        <div class="panel stat"><span class="muted">মোট পরীক্ষা</span><b>${bn(list.length)}</b></div>
        <div class="panel stat"><span class="muted">সঠিক উত্তরের হার</span><b>${bn(pct(tot.c, tot.c + tot.w))}%</b></div>
        <div class="panel stat"><span class="muted">নেগেটিভে হারানো নম্বর</span><b class="bad-text">−${bn(tot.lost.toFixed(1))}</b></div>
        <div class="panel stat"><span class="muted">ভুল খাতায় জমা</span><b>${bn(Object.keys(data.mistakes).length)}</b></div>
      </div>

      <div class="panel">
        <h3 class="panel-title">📈 নম্বরের অগ্রগতি (শেষ ${bn(recent.length)}টি পরীক্ষা, শতকরা)</h3>
        <div class="trend">
          ${recent.map(a => {
            const p = Math.max(0, pct(a.net, a.n));
            return `<div class="trend-col" title="${esc(a.title)} • ${bn(a.net)}/${bn(a.n)}"><span class="trend-val">${bn(p)}%</span><span class="trend-bar" style="height:${Math.max(4, p)}%"></span><span class="trend-date">${fmtDate(a.at)}</span></div>`;
          }).join('')}
        </div>
      </div>

      <div class="panel">
        <h3 class="panel-title">📚 বিষয়ভিত্তিক সঠিক উত্তরের হার (দুর্বলটি আগে)</h3>
        ${subj.length ? subj.map(s => `
          <div class="subj-row">
            <div class="subj-head"><span>${esc(s.name)}</span><span class="${s.acc < 50 ? 'bad-text' : s.acc < 70 ? 'mid-text' : 'ok-text'}">${bn(s.acc)}% <small class="muted">(${bn(s.c)}/${bn(s.c + s.w)})</small></span></div>
            <div class="subj-bar"><span class="${s.acc < 50 ? 'bad' : s.acc < 70 ? 'mid' : 'good'}" style="width:${s.acc}%"></span></div>
            ${s.acc < 70 ? `<button type="button" class="link" onclick="Study.practiceSubject('${esc(s.code)}')">এই বিষয়ে ২০ প্রশ্ন অনুশীলন →</button>` : ''}
          </div>`).join('') : '<p class="muted">আরও কয়েকটি প্রশ্নের উত্তর দিলে বিষয়ভিত্তিক হিসাব দেখাবে।</p>'}
      </div>

      <div class="panel">
        <h3 class="panel-title">🗂️ সব পরীক্ষার ইতিহাস</h3>
        <div class="table-scroll">
          <table class="hist-table">
            <thead><tr><th>তারিখ</th><th>পরীক্ষা</th><th>নেট নম্বর</th><th>সঠিক / ভুল / ফাঁকা</th><th>সময়</th></tr></thead>
            <tbody>${list.slice(0, 60).map(a => `<tr>
              <td>${fmtDate(a.at)}</td><td>${esc(a.title)}</td>
              <td><b>${bn(a.net)}</b> / ${bn(a.n)}</td>
              <td><span class="ok-text">${bn(a.c)}</span> / <span class="bad-text">${bn(a.w)}</span> / ${bn(a.b)}</td>
              <td>${a.time ? fmtMin(a.time) : '—'}</td></tr>`).join('')}</tbody>
          </table>
        </div>
      </div>`;
  }

  // ---------------------------------------------------------------------------
  // SMART PRACTICE (pane-custom-quiz)
  // ---------------------------------------------------------------------------
  function renderPracticeForm() {
    const trackSel = document.getElementById('spTrack');
    const subjSel = document.getElementById('spSubject');
    if (!trackSel || !subjSel) return;
    if (!trackSel.options.length) {
      trackSel.innerHTML = core.TRACKS.map(t => `<option value="${t}">${TRACK_BN[t]}</option>`).join('');
      trackSel.value = data.settings.track || 'BCS';
    }
    const cur = subjSel.value;
    subjSel.innerHTML = `<option value="ALL">সব বিষয়</option>${subjectsOf(trackSel.value).map(s => `<option value="${esc(s.code)}">${esc(s.name)} (${bn(s.n)})</option>`).join('')}`;
    if ([...subjSel.options].some(o => o.value === cur)) subjSel.value = cur;
    const neg = document.getElementById('spNeg');
    if (neg && !neg.dataset.touched) neg.value = String(negOf(trackSel.value));
    const counts = {
      MISTAKES: Object.values(data.mistakes).filter(m => m.status !== 'MASTERED' && qById(m.qid)).length,
      BOOKMARKS: bookmarkIds().length
    };
    document.querySelectorAll('[data-sp-count]').forEach(el => { el.textContent = bn(counts[el.dataset.spCount] || 0); });
  }

  function startSmartPractice() {
    const track = document.getElementById('spTrack').value;
    const subject = document.getElementById('spSubject').value;
    const source = (document.querySelector('input[name="spSource"]:checked') || {}).value || 'ALL';
    const count = Number(document.getElementById('spCount').value) || 20;
    const minutes = Number(document.getElementById('spTime').value) || 0;
    const neg = Number(document.getElementById('spNeg').value);
    const list = pickQuestions({ track, subject, source, count });
    const SOURCE_BN = { ALL: 'সব প্রশ্ন', WEAK: 'দুর্বল বিষয়', MISTAKES: 'ভুল খাতা', BOOKMARKS: 'বুকমার্ক', UNSEEN: 'নতুন প্রশ্ন' };
    const subjName = subject === 'ALL' ? '' : ` • ${(subjectsOf(track).find(s => s.code === subject) || {}).name || ''}`;
    if (source === 'WEAK' && !subjectStats(track).length) toast('দুর্বল বিষয় বের করতে আগে কয়েকটি পরীক্ষা দিন। এখন সব বিষয় থেকে দেওয়া হলো।');
    startPractice({ title: `অনুশীলন: ${SOURCE_BN[source]}${subjName} (${bn(list.length)} প্রশ্ন)`, list, track, neg, minutes: minutes || Math.max(5, Math.ceil(list.length * 0.6)) });
  }

  function practiceSubject(code) {
    const track = data.settings.track || (allQuestions().find(q => q.subjectCode === code) || {}).examTrack || 'BCS';
    let list = pickQuestions({ track, subject: code, count: 20 });
    if (!list.length) list = pickQuestions({ track: '', subject: code, count: 20 });
    const name = (list[0] && list[0].subjectNameBn) || '';
    startPractice({ title: `বিষয় অনুশীলন: ${name}`, list, track, minutes: 12 });
  }

  function practiceBookmarks() {
    const list = pickQuestions({ source: 'BOOKMARKS', count: 100 });
    startPractice({ title: `বুকমার্ক থেকে পরীক্ষা (${bn(list.length)} প্রশ্ন)`, list });
  }

  function practiceMistakes() {
    const list = pickQuestions({ source: 'MISTAKES', count: 50 });
    startPractice({ title: `ভুল খাতা থেকে পরীক্ষা (${bn(list.length)} প্রশ্ন)`, list });
  }

  // ---------------------------------------------------------------------------
  // Settings: dark mode, text size, exam goal
  // ---------------------------------------------------------------------------
  function applySettings() {
    const s = data.settings;
    document.documentElement.classList.toggle('theme-dark', s.theme === 'dark');
    document.documentElement.style.setProperty('--ui-zoom', String(s.font || 1));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', s.theme === 'dark' ? '#111816' : '#006a4e');
  }

  function setSetting(key, value) {
    change(d => { d.settings = { ...d.settings, [key]: value, t: Date.now() }; });
    applySettings();
  }

  function setTrack(track) {
    setSetting('track', track);
    toast(`লক্ষ্য: ${TRACK_BN[track]}`);
    renderHome();
  }

  function openSettings() {
    const s = data.settings;
    let box = document.getElementById('settingsSheet');
    if (!box) {
      box = document.createElement('div');
      box.id = 'settingsSheet';
      box.className = 'sheet-backdrop';
      box.addEventListener('click', e => { if (e.target === box) box.hidden = true; });
      document.body.appendChild(box);
    }
    box.hidden = false;
    box.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="সেটিংস">
      <div class="sheet-head"><h3>⚙️ সেটিংস</h3><button type="button" class="icon-btn" onclick="document.getElementById('settingsSheet').hidden=true" aria-label="বন্ধ করুন">✕</button></div>
      <span class="section-label">রং</span>
      <div class="chip-row">
        <button type="button" class="chip ${s.theme !== 'dark' ? 'chip-active' : ''}" onclick="Study.setSetting('theme','light');Study.openSettings()">☀️ আলো</button>
        <button type="button" class="chip ${s.theme === 'dark' ? 'chip-active' : ''}" onclick="Study.setSetting('theme','dark');Study.openSettings()">🌙 অন্ধকার (রাতে পড়ার জন্য)</button>
      </div>
      <span class="section-label mt-3">লেখার আকার</span>
      <div class="chip-row">
        ${[[0.9, 'ছোট'], [1, 'স্বাভাবিক'], [1.1, 'বড়'], [1.2, 'আরও বড়']].map(([v, l]) => `<button type="button" class="chip ${Math.abs((s.font || 1) - v) < 0.01 ? 'chip-active' : ''}" onclick="Study.setSetting('font',${v});Study.openSettings()">${l}</button>`).join('')}
      </div>
      <span class="section-label mt-3">কোন পরীক্ষার প্রস্তুতি</span>
      <div class="chip-row">
        ${core.TRACKS.map(t => `<button type="button" class="chip ${s.track === t ? 'chip-active' : ''}" onclick="Study.setSetting('track','${t}');Study.openSettings();Study.refresh()">${TRACK_BN[t]}</button>`).join('')}
      </div>
      <span class="section-label mt-3">প্রতিদিনের লক্ষ্য (প্রশ্ন)</span>
      <div class="chip-row">
        ${[20, 50, 100, 200].map(v => `<button type="button" class="chip ${goal() === v ? 'chip-active' : ''}" onclick="Study.setSetting('goal',${v});Study.openSettings();Study.refresh()">${bn(v)}</button>`).join('')}
      </div>
    </div>`;
  }

  // Re-draw whichever personal section is open
  function refresh() {
    const open = location.hash.replace('#', '') || 'home';
    if (open === 'home') renderHome();
    if (open === 'analytics') renderResults();
    if (open === 'custom-quiz') renderPracticeForm();
    if (typeof window.updateMistakeBadge === 'function') window.updateMistakeBadge();
    if (typeof window.updateBookmarkBadges === 'function') window.updateBookmarkBadges();
  }

  applySettings();
  listeners.push(() => refresh());
  // Sync once the page is ready (account.js also triggers a sync after it knows who is logged in)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(sync, 0));
  else setTimeout(sync, 0);

  window.Study = {
    get data() { return data; },
    get loggedIn() { return loggedIn; },
    TRACK_BN, negOf, qById, shuffle, toast, esc, bn,
    addMistakes, mistakeList, reviewMistake, tagMistake,
    isBookmarked, toggleBookmark, bookmarkIds,
    dueReviewIds, buildDeck, rateCard,
    recordAttempt, cutMarkFor, subjectStats, addActivity,
    pickQuestions, startSmartPractice, practiceSubject, practiceMistakes, practiceBookmarks, dailyQuiz,
    renderHome, renderResults, renderPracticeForm, search, questionCard,
    openSettings, setSetting, setTrack, refresh, sync,
    onChange: fn => listeners.push(fn)
  };
})();

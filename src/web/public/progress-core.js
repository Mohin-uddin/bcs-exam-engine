/**
 * Study progress: data shape, SM-2 scheduling and merge rules.
 * Shared by the browser (study.js) and the server (src/web/progress.js), so a phone,
 * a laptop and the server all merge the same way.
 *
 * progress = {
 *   v: 1,
 *   mistakes:  { [qid]: { qid, sel, tag, n, src, at, t, ef, reps, iv, due, status } },
 *   bookmarks: { [qid]: { on, t } },            // on:false keeps a removal from coming back on merge
 *   cards:     { [qid]: { ef, reps, iv, due, t } },
 *   attempts:  [ { id, examId, title, track, at, n, c, w, b, neg, net, dur, time, subj, wrong } ],
 *   days:      { 'YYYY-MM-DD': questionsPractised },
 *   settings:  { theme, font, track, goal, t }   // goal = questions per day
 * }
 * Times are epoch milliseconds; `t` is "last changed", the newer one wins on merge.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ProgressCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DAY = 86400000;
  const LIMITS = { mistakes: 3000, bookmarks: 3000, cards: 5000, attempts: 200, days: 400 };
  const TAGS = ['SILLY_MISTAKE', 'CONCEPT_GAP', 'TIME_PRESSURE', 'UNREAD_STEM'];
  const OPTS = ['A', 'B', 'C', 'D'];
  const TRACKS = ['BCS', 'PRIMARY', 'NTRCA', 'BANK', 'MINISTRY', 'NON_CADRE', 'NURSING'];

  function empty() {
    return { v: 1, mistakes: {}, bookmarks: {}, cards: {}, attempts: [], days: {}, settings: {} };
  }

  // Bangladesh date (UTC+6) as YYYY-MM-DD, so a streak day ends at midnight in Dhaka
  function dayKey(ms = Date.now()) {
    return new Date(ms + 6 * 3600000).toISOString().slice(0, 10);
  }

  /**
   * SuperMemo SM-2. quality 0..5 (below 3 = forgot).
   * Returns the new schedule; does not change `item`.
   */
  function sm2(item, quality, now = Date.now()) {
    const q = Math.max(0, Math.min(5, Math.round(Number(quality) || 0)));
    let ef = Number(item && item.ef) || 2.5;
    let reps = Number(item && item.reps) || 0;
    let iv = Number(item && item.iv) || 0;
    if (q < 3) {
      reps = 0;
      iv = 1;
    } else {
      iv = reps === 0 ? 1 : reps === 1 ? 6 : Math.round(iv * ef);
      reps += 1;
    }
    ef = Math.max(1.3, Number((ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))).toFixed(2)));
    const status = q < 3 ? 'OPEN' : iv >= 21 ? 'MASTERED' : 'IN_REVIEW';
    return { ef, reps, iv, due: now + iv * DAY, status, t: now };
  }

  const isDue = (item, now = Date.now()) => Boolean(item) && (Number(item.due) || 0) <= now;

  // ---------------------------------------------------------------------------
  // Sanitize: anything from a browser is checked before the server keeps it
  // ---------------------------------------------------------------------------
  const str = (v, max) => String(v == null ? '' : v).slice(0, max);
  const num = (v, min, max, dflt = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
  };
  const QID = /^[\w.-]{1,80}$/;
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const T_MAX = 4102444800000; // year 2100

  function keepNewest(map, limit, timeOf) {
    const keys = Object.keys(map);
    if (keys.length <= limit) return map;
    const out = {};
    keys.sort((a, b) => timeOf(map[b]) - timeOf(map[a])).slice(0, limit).forEach(k => { out[k] = map[k]; });
    return out;
  }

  function sanitize(p) {
    const out = empty();
    if (!p || typeof p !== 'object') return out;

    Object.entries(p.mistakes || {}).forEach(([qid, m]) => {
      if (!QID.test(qid) || !m || typeof m !== 'object') return;
      out.mistakes[qid] = {
        qid,
        sel: OPTS.includes(m.sel) ? m.sel : '',
        tag: TAGS.includes(m.tag) ? m.tag : 'CONCEPT_GAP',
        n: Math.round(num(m.n, 1, 999, 1)),
        src: str(m.src, 160),
        at: num(m.at, 0, T_MAX),
        t: num(m.t, 0, T_MAX),
        ef: num(m.ef, 1.3, 5, 2.5),
        reps: Math.round(num(m.reps, 0, 999)),
        iv: Math.round(num(m.iv, 0, 3650)),
        due: num(m.due, 0, T_MAX),
        status: ['OPEN', 'IN_REVIEW', 'MASTERED'].includes(m.status) ? m.status : 'OPEN'
      };
    });
    out.mistakes = keepNewest(out.mistakes, LIMITS.mistakes, m => m.t);

    Object.entries(p.bookmarks || {}).forEach(([qid, b]) => {
      if (!QID.test(qid) || !b || typeof b !== 'object') return;
      out.bookmarks[qid] = { on: Boolean(b.on), t: num(b.t, 0, T_MAX) };
    });
    out.bookmarks = keepNewest(out.bookmarks, LIMITS.bookmarks, b => b.t);

    Object.entries(p.cards || {}).forEach(([qid, c]) => {
      if (!QID.test(qid) || !c || typeof c !== 'object') return;
      out.cards[qid] = {
        ef: num(c.ef, 1.3, 5, 2.5),
        reps: Math.round(num(c.reps, 0, 999)),
        iv: Math.round(num(c.iv, 0, 3650)),
        due: num(c.due, 0, T_MAX),
        t: num(c.t, 0, T_MAX)
      };
    });
    out.cards = keepNewest(out.cards, LIMITS.cards, c => c.t);

    const seen = new Set();
    (Array.isArray(p.attempts) ? p.attempts : []).forEach(a => {
      if (!a || typeof a !== 'object' || !QID.test(String(a.id)) || seen.has(a.id)) return;
      seen.add(a.id);
      const subj = {};
      Object.entries(a.subj && typeof a.subj === 'object' ? a.subj : {}).slice(0, 30).forEach(([code, s]) => {
        if (!/^[\w-]{1,40}$/.test(code) || !s) return;
        subj[code] = { name: str(s.name, 80), c: Math.round(num(s.c, 0, 1000)), w: Math.round(num(s.w, 0, 1000)), b: Math.round(num(s.b, 0, 1000)) };
      });
      out.attempts.push({
        id: a.id,
        examId: str(a.examId, 80),
        title: str(a.title, 200),
        track: str(a.track, 20),
        at: num(a.at, 0, T_MAX),
        n: Math.round(num(a.n, 0, 1000)),
        c: Math.round(num(a.c, 0, 1000)),
        w: Math.round(num(a.w, 0, 1000)),
        b: Math.round(num(a.b, 0, 1000)),
        neg: num(a.neg, 0, 1),
        net: num(a.net, -1000, 1000),
        dur: Math.round(num(a.dur, 0, 86400)),
        time: Math.round(num(a.time, 0, 86400)),
        subj,
        wrong: (Array.isArray(a.wrong) ? a.wrong : []).filter(q => QID.test(String(q))).slice(0, 300)
      });
    });
    out.attempts = out.attempts.sort((x, y) => y.at - x.at).slice(0, LIMITS.attempts);

    Object.entries(p.days || {}).forEach(([d, n]) => {
      if (DATE.test(d)) out.days[d] = Math.round(num(n, 0, 100000));
    });
    const dayKeys = Object.keys(out.days).sort().reverse();
    if (dayKeys.length > LIMITS.days) {
      const keep = {};
      dayKeys.slice(0, LIMITS.days).forEach(d => { keep[d] = out.days[d]; });
      out.days = keep;
    }

    const s = p.settings || {};
    out.settings = {
      theme: s.theme === 'dark' ? 'dark' : 'light',
      font: num(s.font, 0.9, 1.3, 1),
      track: TRACKS.includes(s.track) ? s.track : '',
      goal: Math.round(num(s.goal, 10, 500, 50)),
      t: num(s.t, 0, T_MAX)
    };
    return out;
  }

  // ---------------------------------------------------------------------------
  // Merge two copies (e.g. this phone + the server). Newer `t` wins per item.
  // ---------------------------------------------------------------------------
  function mergeMap(a, b, timeOf) {
    const out = { ...a };
    Object.entries(b).forEach(([k, v]) => {
      if (!out[k] || timeOf(v) > timeOf(out[k])) out[k] = v;
    });
    return out;
  }

  function merge(a, b) {
    const x = sanitize(a);
    const y = sanitize(b);
    const out = empty();
    out.mistakes = mergeMap(x.mistakes, y.mistakes, m => m.t);
    out.bookmarks = mergeMap(x.bookmarks, y.bookmarks, v => v.t);
    out.cards = mergeMap(x.cards, y.cards, c => c.t);
    const byId = new Map();
    [...x.attempts, ...y.attempts].forEach(at => { if (!byId.has(at.id)) byId.set(at.id, at); });
    out.attempts = [...byId.values()];
    out.days = { ...x.days };
    Object.entries(y.days).forEach(([d, n]) => { out.days[d] = Math.max(out.days[d] || 0, n); });
    out.settings = y.settings.t > x.settings.t ? y.settings : x.settings;
    return sanitize(out); // re-applies the size limits
  }

  // Days in a row (ending today or yesterday) with any practice
  function streak(days, now = Date.now()) {
    let count = 0;
    let t = now;
    if (!days[dayKey(t)]) t -= DAY; // today not started yet: the streak is still alive
    while (days[dayKey(t)]) {
      count++;
      t -= DAY;
    }
    return count;
  }

  return { DAY, LIMITS, TAGS, TRACKS, empty, dayKey, sm2, isDue, sanitize, merge, streak };
});

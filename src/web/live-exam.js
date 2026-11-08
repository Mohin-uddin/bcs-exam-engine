/**
 * ============================================================================
 * Live Scheduled Exam & Merit List (মেধা তালিকা) Engine
 * ============================================================================
 * - Admin announces an exam (question set, start time, duration, negative mark)
 * - Candidates register, enter the hall only while the exam is live, submit once
 * - Answer key never leaves the server until the exam has ended
 * - Merit list: Net Score first, then the tie-breaker (1 - Time_Taken / Total_Duration)
 * - State is persisted to a JSON file (or Postgres via `store` when DATABASE_URL is set)
 *   so a server restart keeps exams & results
 * - Weekly exam: every week (default Friday 9 PM Dhaka) an exam is created by itself from the
 *   least-used question set of the chosen track. Admin can change day, time and track.
 * - Free accounts may take `freeLimit` live exams (default 2); after that a subscription is needed.
 *   Taking an exam (opening the paper) needs a login so the limit can be counted.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { isAdmin } = require('./admin-auth');

const DATA_FILE = process.env.LIVE_DATA_FILE || path.join(__dirname, '..', '..', 'data', 'live-exams.json');
const SUBMIT_GRACE_SEC = 90; // network slack for auto-submit at the final second

const TRACK_META = {
  BCS: { labelBn: 'বিসিএস প্রিলিমিনারি', orgBn: 'বাংলাদেশ সরকারি কর্ম কমিশন (BPSC)', negativeMark: 0.5 },
  PRIMARY: { labelBn: 'প্রাথমিক শিক্ষক নিয়োগ', orgBn: 'প্রাথমিক শিক্ষা অধিদপ্তর (DPE)', negativeMark: 0.25 },
  NTRCA: { labelBn: 'শিক্ষক নিবন্ধন (NTRCA)', orgBn: 'বেসরকারি শিক্ষক নিবন্ধন ও প্রত্যয়ন কর্তৃপক্ষ (NTRCA)', negativeMark: 0.25 },
  BANK: { labelBn: 'ব্যাংক নিয়োগ', orgBn: 'ব্যাংকার্স সিলেকশন কমিটি', negativeMark: 0.25 },
  MINISTRY: { labelBn: 'মন্ত্রণালয় ও অধিদপ্তর', orgBn: 'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার', negativeMark: 0.25 },
  NON_CADRE: { labelBn: 'পিএসসি নন-ক্যাডার', orgBn: 'বাংলাদেশ সরকারি কর্ম কমিশন (BPSC)', negativeMark: 0.5 },
  NURSING: { labelBn: 'নার্সিং নিয়োগ', orgBn: 'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার', negativeMark: 0.25 },
  ADMISSION: { labelBn: 'বিশ্ববিদ্যালয় ভর্তি', orgBn: 'বিশ্ববিদ্যালয় ভর্তি প্রস্তুতি • সোনার হরিণ', negativeMark: 0.25 },
  ADMISSION_UNI: { labelBn: 'বিশ্ববিদ্যালয় ভর্তি', orgBn: 'বিশ্ববিদ্যালয় ভর্তি প্রস্তুতি • সোনার হরিণ', negativeMark: 0.25 },
  ADMISSION_MED: { labelBn: 'মেডিকেল ও ডেন্টাল ভর্তি', orgBn: 'মেডিকেল ভর্তি প্রস্তুতি • সোনার হরিণ', negativeMark: 0.25 }
};

// Weekly live exam of each exam type: its question bank and the size of the real exam
// (sets of exactly that size are used in turn; medical is drawn from the medical papers)
const WEEKLY_TRACKS = {
  BCS: { questions: 200, durationMin: 120 },
  PRIMARY: { questions: 80, durationMin: 60 },
  NTRCA: { questions: 100, durationMin: 60 },
  BANK: { questions: 100, durationMin: 60 },
  MINISTRY: { questions: 70, durationMin: 60 },
  NON_CADRE: { questions: 100, durationMin: 60 },
  NURSING: { questions: 100, durationMin: 60 },
  ADMISSION_UNI: { questions: 100, durationMin: 60 },
  ADMISSION_MED: { questions: 100, durationMin: 60 }
};
const isMedicalSet = e => e.admTarget === 'medical' || /মেডিকেল|ডেন্টাল|AFMC/.test(`${e.unitBn || ''}`);

const STORE_KEY = 'live-exams';
const DHAKA_OFFSET_MS = 6 * 3600000; // Bangladesh has no daylight saving
const WEEKDAY_BN = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
// Shared by every exam type
const DEFAULT_WEEKLY = {
  freeLimit: 2,
  targetCount: 0 // admin's own goal for registrations (only the admin sees counts)
};
// Each exam type's schedule (admin can change it per type)
const DEFAULT_SLOT = {
  enabled: true,
  weekday: 5, // 0 = Sunday ... 5 = Friday
  hour: 21,
  minute: 0,
  durationMin: 0 // 0 = the exam's own length
};

function createLiveExamEngine({ availableExams, sampleQuestions, store = null, currentUser = () => null, isPremium = () => false }) {
  const questionById = new Map((sampleQuestions || []).map(q => [q.id, q]));
  const catalog = (availableExams || []).filter(e => Array.isArray(e.questionIds) && e.questionIds.length > 0);
  const catalogById = new Map(catalog.map(e => [e.id, e]));

  let state = { exams: [] };
  let saveTimer = null;
  let writeChain = Promise.resolve();

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------
  function load() {
    if (store) return; // loaded asynchronously in ready()
    try {
      if (fs.existsSync(DATA_FILE)) {
        state = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        if (!Array.isArray(state.exams)) state.exams = [];
      }
    } catch (e) {
      console.error(`[live-exam] Could not read ${DATA_FILE}: ${e.message}`);
    }
  }

  function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (store) {
      // One write at a time, each with a snapshot taken now: when many candidates submit in the
      // last second, an older snapshot can never land after (and overwrite) a newer one
      const snapshot = JSON.parse(JSON.stringify(state));
      writeChain = writeChain
        .then(() => store.set(STORE_KEY, snapshot))
        .catch(e => console.error(`[live-exam] Could not save to database: ${e.message}`));
      return writeChain;
    }
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, DATA_FILE);
  }

  function save() {
    if (!saveTimer) saveTimer = setTimeout(saveNow, 500);
  }

  load();
  if (!store) process.on('exit', () => { if (saveTimer) saveNow(); });


  // Call once before the server starts listening (no-op without a database)
  async function ready() {
    if (!store) return;
    const saved = await store.get(STORE_KEY);
    if (saved) {
      state = saved;
      if (!Array.isArray(state.exams)) state.exams = [];
    }
    ensureWeekly();
  }

  // Write any pending change now (used on shutdown)
  async function flush() {
    if (saveTimer) saveNow();
    await writeChain;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const newId = prefix => `${prefix}_${crypto.randomBytes(6).toString('hex')}`;

  // ---------------------------------------------------------------------------
  // Weekly exam, created by itself
  // ---------------------------------------------------------------------------
  const weeklyCfg = () => ({ ...DEFAULT_WEEKLY, freeLimit: (state.weekly || {}).freeLimit ?? DEFAULT_WEEKLY.freeLimit, targetCount: (state.weekly || {}).targetCount ?? 0 });
  // Older data had one schedule (state.weekly: weekday, hour, minute, track) for the BCS exam: it becomes BCS's slot
  function slots() {
    if (!state.weeklyTracks) {
      const old = state.weekly || {};
      state.weeklyTracks = {};
      if (old.weekday !== undefined) {
        state.weeklyTracks[old.track && WEEKLY_TRACKS[old.track] ? old.track : 'BCS'] = {
          enabled: old.enabled !== false, weekday: old.weekday, hour: old.hour, minute: old.minute, durationMin: old.durationMin || 0
        };
      }
    }
    return state.weeklyTracks;
  }
  const slotOf = t => ({ ...DEFAULT_SLOT, ...(slots()[t] || {}) });
  // Weekly exams made before exam types had their own: they were all of their set's track
  // (a weekly exam of the old single "ADMISSION" type is the university admission one)
  const weeklyTrackOf = e => {
    const t = e.weeklyTrack || e.track;
    return t === 'ADMISSION' ? 'ADMISSION_UNI' : t;
  };

  // Start of this week's slot in Dhaka time, or next week's once this one has ended
  function nextWeeklyStart(cfg, now = Date.now(), durationMin = 60) {
    const local = new Date(now + DHAKA_OFFSET_MS);
    const ahead = (cfg.weekday - local.getUTCDay() + 7) % 7;
    let start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + ahead, cfg.hour, cfg.minute) - DHAKA_OFFSET_MS;
    if (start + durationMin * 60000 <= now) start += 7 * 86400000;
    return start;
  }

  // Seeded shuffle: the same week always gets the same paper
  function seeded(list, seed) {
    let h = 2166136261;
    for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
      const j = h % (i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // This exam type's paper for the week: the least-used set of the real exam's size,
  // or (medical, or no set of that size) questions drawn from the type's own bank
  function pickWeeklyPaper(t, weekKey) {
    const pat = WEEKLY_TRACKS[t];
    // Medical: only the medical year papers (the AFMC pattern test borrows questions from other banks)
    const bank = t === 'ADMISSION_MED' ? catalog.filter(e => e.examTrack === 'ADMISSION' && e.admTarget === 'medical')
      : t === 'ADMISSION_UNI' ? catalog.filter(e => e.examTrack === 'ADMISSION' && !isMedicalSet(e) && !e.isSubjectDrill && !/^ADM_SUBJECT_/.test(e.id))
        : catalog.filter(e => e.examTrack === t);
    if (!bank.length) return null;
    const full = t === 'ADMISSION_MED' ? [] : bank.filter(e => e.questionIds.length === pat.questions);
    if (full.length) {
      const used = new Map();
      state.exams.filter(e => e.auto).forEach(e => used.set(e.setId, (used.get(e.setId) || 0) + 1));
      const set = full.reduce((best, e) => ((used.get(e.id) || 0) < (used.get(best.id) || 0) ? e : best), full[0]);
      return { setId: set.id, setCode: set.setCodeBn || 'ক', questionIds: [...set.questionIds], negativeMark: set.negativeMark };
    }
    const ids = [...new Set(bank.flatMap(e => e.questionIds))].filter(id => questionById.has(id));
    if (!ids.length) return null;
    return { setId: `${t}_DRAW`, setCode: 'ক', questionIds: seeded(ids, `${t}|${weekKey}`).slice(0, pat.questions), negativeMark: undefined };
  }

  function ensureWeeklyFor(t) {
    const cfg = slotOf(t);
    if (!cfg.enabled) return null;
    const durationMin = cfg.durationMin > 0 ? cfg.durationMin : WEEKLY_TRACKS[t].durationMin;
    const mine = state.exams.filter(e => e.auto && weeklyTrackOf(e) === t);
    // An exam the admin moved to a date of their own stays until it has ended
    const moved = mine.find(e => e.movedByAdmin && !e.cancelled && phaseOf(e) !== 'ENDED');
    if (moved) return moved;
    const startMs = nextWeeklyStart(cfg, Date.now(), durationMin);
    const weekKey = new Date(startMs + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
    // A cancelled weekly exam counts too: admin cancelled this week on purpose
    const same = mine.filter(e => e.weekKey === weekKey);
    // Two for the same week (an older exam of this type and one made after an update): keep the one people
    // registered for, else the one made for this type (right size), and drop the other while it is still empty
    if (same.length > 1) {
      const keep = same.find(e => e.candidates.length) || same.find(e => e.weeklyTrack === t) || same[0];
      const drop = same.filter(e => e !== keep && !e.candidates.length && phaseOf(e) === 'UPCOMING');
      if (drop.length) { state.exams = state.exams.filter(e => !drop.includes(e)); save(); }
      return keep;
    }
    if (same.length) return same[0];
    const paper = pickWeeklyPaper(t, weekKey);
    if (!paper) return null;
    const meta = TRACK_META[t];
    const dateBn = new Date(startMs).toLocaleDateString('bn-BD', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'long' });
    const exam = {
      id: newId('lx'),
      auto: true,
      weeklyTrack: t,
      weekKey,
      title: `${meta.labelBn}: সাপ্তাহিক লাইভ পরীক্ষা • ${dateBn}`,
      track: t,
      setId: paper.setId,
      setCode: paper.setCode,
      questionIds: paper.questionIds,
      startAt: new Date(startMs).toISOString(),
      durationMin,
      negativeMark: typeof paper.negativeMark === 'number' ? paper.negativeMark : meta.negativeMark,
      noticeBn: `প্রতি ${WEEKDAY_BN[cfg.weekday]} লাইভ পরীক্ষা। পরীক্ষা শেষ হলেই উত্তর ও মেধা তালিকা প্রকাশ হবে।`,
      createdAt: new Date().toISOString(),
      nextRoll: 100001,
      candidates: []
    };
    state.exams.push(exam);
    save();
    return exam;
  }

  function ensureWeekly() {
    const out = {};
    Object.keys(WEEKLY_TRACKS).forEach(t => { out[t] = ensureWeeklyFor(t); });
    return out;
  }

  // How many live exams this account has already sat (opened the paper of), not counting `exceptExam`
  function liveExamsTaken(user, exceptExam = null) {
    if (!user) return 0;
    return state.exams.filter(e => e !== exceptExam && !e.cancelled && e.candidates.some(c => c.userId === user.id && c.startedAt)).length;
  }

  function accessOf(user) {
    const cfg = weeklyCfg();
    if (!user) return { loggedIn: false, premium: false, freeLimit: cfg.freeLimit, used: 0, left: cfg.freeLimit };
    const premium = Boolean(isPremium(user));
    const used = liveExamsTaken(user);
    return { loggedIn: true, premium, freeLimit: cfg.freeLimit, used, left: premium ? null : Math.max(0, cfg.freeLimit - used) };
  }

  function phaseOf(exam, now = Date.now()) {
    if (exam.cancelled) return 'CANCELLED';
    const start = Date.parse(exam.startAt);
    const end = start + exam.durationMin * 60000;
    if (now < start) return 'UPCOMING';
    if (now < end) return 'LIVE';
    return 'ENDED';
  }

  const endAtOf = exam => new Date(Date.parse(exam.startAt) + exam.durationMin * 60000).toISOString();

  function maskPhone(phone) {
    if (!phone) return '';
    return phone.length > 5 ? `${phone.slice(0, 3)}****${phone.slice(-3)}` : '****';
  }

  function publicExam(exam) {
    const meta = TRACK_META[exam.track] || TRACK_META.BCS;
    return {
      id: exam.id,
      title: exam.title,
      track: exam.track,
      trackLabelBn: meta.labelBn,
      orgBn: exam.orgBn || meta.orgBn,
      setCode: exam.setCode,
      startAt: exam.startAt,
      endAt: endAtOf(exam),
      durationMin: exam.durationMin,
      negativeMark: exam.negativeMark,
      totalQuestions: exam.questionIds.length,
      noticeBn: exam.noticeBn || '',
      phase: phaseOf(exam),
      weekly: Boolean(exam.auto),
      weeklyTrack: exam.auto ? weeklyTrackOf(exam) : null
    };
  }
  // Counts are for the admin only
  const adminExam = exam => ({
    ...publicExam(exam),
    registeredCount: exam.candidates.length,
    submittedCount: exam.candidates.filter(c => c.submittedAt).length
  });

  function findExam(id) {
    return state.exams.find(e => e.id === id && !e.cancelled);
  }

  function findCandidate(exam, token) {
    return token ? exam.candidates.find(c => c.token === token) : null;
  }

  function normalizeAnswers(exam, raw) {
    const out = {};
    const allowed = new Set(exam.questionIds);
    Object.entries(raw || {}).forEach(([qid, val]) => {
      if (!allowed.has(qid)) return;
      const arr = (Array.isArray(val) ? val : [val]).filter(v => ['A', 'B', 'C', 'D'].includes(v));
      if (arr.length) out[qid] = [...new Set(arr)];
    });
    return out;
  }

  function scoreAnswers(exam, answers) {
    let correct = 0;
    let wrong = 0;
    let blank = 0;
    exam.questionIds.forEach(qid => {
      const q = questionById.get(qid);
      const chosen = answers[qid];
      if (!chosen || chosen.length === 0) blank++;
      else if (chosen.length === 1 && q && chosen[0] === q.correctOption) correct++;
      else wrong++; // multiple bubbles filled counts as wrong, as on the real OMR
    });
    const penalty = Number((wrong * exam.negativeMark).toFixed(2));
    const netScore = Number((correct - penalty).toFixed(2));
    return { correct, wrong, blank, penalty, netScore };
  }

  /**
   * Merit list ordering. Net Score decides first; the tie-breaker
   * (1 - Time_Taken / Total_Duration) only orders candidates on the same net
   * score, so a fast 5.00 never jumps above a slower 5.25.
   */
  function buildMerit(exam) {
    const totalSec = exam.durationMin * 60;
    const rows = exam.candidates
      .filter(c => c.submittedAt && c.result)
      .map(c => ({
        candidateId: c.id,
        roll: c.roll,
        name: c.name,
        phoneMasked: maskPhone(c.phone),
        ...c.result,
        tieBreakerRankScore: Number((c.result.netScore + (1 - c.result.timeTakenSec / totalSec)).toFixed(6))
      }))
      .sort((a, b) => b.netScore - a.netScore || a.timeTakenSec - b.timeTakenSec || a.roll - b.roll);

    rows.forEach((row, i) => {
      const prev = rows[i - 1];
      row.rank = prev && prev.netScore === row.netScore && prev.timeTakenSec === row.timeTakenSec ? prev.rank : i + 1;
      row.percentile = Number((((rows.length - row.rank + 1) / rows.length) * 100).toFixed(1));
    });
    return rows;
  }

  function stripQuestion(q, idx) {
    return {
      id: q.id,
      qNo: idx + 1,
      subjectNameBn: q.subjectNameBn,
      stemBn: q.stemBn,
      options: q.options
    };
  }

  // ---------------------------------------------------------------------------
  // HTTP plumbing
  // ---------------------------------------------------------------------------
  function send(res, status, data) {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify({ serverNow: new Date().toISOString(), ...data }));
  }

  const fail = (res, status, code, messageBn, extra = {}) => send(res, status, { status: 'ERROR', code, messageBn, ...extra });

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 2e6) req.destroy();
      });
      req.on('end', () => {
        try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Route handler. Returns true when it handled the request.
  // ---------------------------------------------------------------------------
  // Admin view: shared settings + every exam type's schedule and coming exam (with counts)
  function weeklyOverview() {
    const next = ensureWeekly();
    return {
      weekly: weeklyCfg(),
      tracks: Object.keys(WEEKLY_TRACKS).map(t => ({
        id: t, labelBn: TRACK_META[t].labelBn, ...slotOf(t),
        defaultDurationMin: WEEKLY_TRACKS[t].durationMin,
        next: next[t] && !next[t].cancelled ? adminExam(next[t]) : null
      }))
    };
  }

  async function handle(req, res, pathname, searchParams) {
    if (!pathname.startsWith('/api/live/')) return false;
    const method = req.method;
    let body = {};
    if (method === 'POST') {
      try { body = await readBody(req); } catch { return fail(res, 400, 'BAD_JSON', 'অনুরোধটি সঠিক নয়।'), true; }
    }

    // ---------------- Admin ----------------
    if (pathname.startsWith('/api/live/admin/')) {
      if (!isAdmin(req)) return fail(res, 401, 'ADMIN_ONLY', 'অ্যাডমিন কী সঠিক নয়।'), true;

      if (pathname === '/api/live/admin/catalog' && method === 'GET') {
        send(res, 200, {
          status: 'SUCCESS',
          tracks: Object.entries(TRACK_META).map(([id, m]) => ({ id, ...m })),
          sets: catalog.map(e => ({
            id: e.id,
            track: e.examTrack,
            title: e.title,
            setCode: e.setCodeBn || 'ক',
            totalQuestions: e.questionIds.length,
            durationMin: e.durationMin || 60,
            negativeMark: typeof e.negativeMark === 'number' ? e.negativeMark : (TRACK_META[e.examTrack] || TRACK_META.BCS).negativeMark
          }))
        });
        return true;
      }

      if (pathname === '/api/live/admin/exams' && method === 'GET') {
        send(res, 200, {
          status: 'SUCCESS',
          exams: state.exams.filter(e => !e.cancelled).map(adminExam).sort((a, b) => b.startAt.localeCompare(a.startAt))
        });
        return true;
      }

      if (pathname === '/api/live/admin/exams' && method === 'POST') {
        const set = catalogById.get(body.setId);
        if (!set) return fail(res, 400, 'BAD_SET', 'প্রশ্নসেট খুঁজে পাওয়া যায়নি।'), true;
        const startMs = Date.parse(body.startAt);
        if (!Number.isFinite(startMs)) return fail(res, 400, 'BAD_TIME', 'শুরুর সময় সঠিক নয়।'), true;
        const durationMin = Math.round(Number(body.durationMin) || set.durationMin || 60);
        if (durationMin < 1 || durationMin > 600) return fail(res, 400, 'BAD_DURATION', 'সময়সীমা ১ থেকে ৬০০ মিনিটের মধ্যে দিন।'), true;
        const track = set.examTrack in TRACK_META ? set.examTrack : 'BCS';
        const negativeMark = body.negativeMark !== undefined && body.negativeMark !== ''
          ? Number(body.negativeMark)
          : TRACK_META[track].negativeMark;
        if (!(negativeMark >= 0 && negativeMark <= 1)) return fail(res, 400, 'BAD_NEGATIVE', 'নেগেটিভ মার্ক ০ থেকে ১ এর মধ্যে দিন।'), true;

        const exam = {
          id: newId('lx'),
          title: String(body.title || set.title).trim().slice(0, 200),
          track,
          setId: set.id,
          setCode: set.setCodeBn || 'ক',
          questionIds: [...set.questionIds],
          startAt: new Date(startMs).toISOString(),
          durationMin,
          negativeMark,
          noticeBn: String(body.noticeBn || '').trim().slice(0, 1000),
          createdAt: new Date().toISOString(),
          nextRoll: 100001,
          candidates: []
        };
        state.exams.push(exam);
        saveNow();
        send(res, 200, { status: 'SUCCESS', exam: adminExam(exam) });
        return true;
      }

      if (pathname === '/api/live/admin/weekly' && method === 'GET') {
        send(res, 200, { status: 'SUCCESS', ...weeklyOverview() });
        return true;
      }

      // Shared settings (freeLimit, targetCount) and / or one exam type's schedule:
      // { track, enabled, weekday, hour, minute, durationMin } and optionally startAt = move this week's exam
      if (pathname === '/api/live/admin/weekly' && method === 'POST') {
        const int = (v, lo, hi) => (v === undefined || v === '' ? undefined : Number.isInteger(Number(v)) && Number(v) >= lo && Number(v) <= hi ? Number(v) : NaN);
        const shared = { freeLimit: int(body.freeLimit, 0, 100), targetCount: int(body.targetCount, 0, 1000000) };
        const slot = { weekday: int(body.weekday, 0, 6), hour: int(body.hour, 0, 23), minute: int(body.minute, 0, 59), durationMin: int(body.durationMin, 0, 600) };
        if ([...Object.values(shared), ...Object.values(slot)].some(v => Number.isNaN(v))) return fail(res, 400, 'BAD_WEEKLY', 'দিন, সময়, মিনিট ও সংখ্যাগুলো সঠিকভাবে দিন।'), true;
        const t = body.track;
        if (t !== undefined && !WEEKLY_TRACKS[t]) return fail(res, 400, 'BAD_TRACK', 'পরীক্ষার ধরন সঠিক নয়।'), true;
        const moveTo = body.startAt ? Date.parse(body.startAt) : null;
        if (body.startAt && (!Number.isFinite(moveTo) || moveTo < Date.now() - 60000)) return fail(res, 400, 'BAD_TIME', 'নতুন তারিখ ও সময় সঠিকভাবে দিন (এখনকার পরের সময়)।'), true;
        state.weekly = { ...weeklyCfg() };
        Object.entries(shared).forEach(([k, v]) => { if (v !== undefined) state.weekly[k] = v; });
        if (t) {
          const cfg = slotOf(t);
          Object.entries(slot).forEach(([k, v]) => { if (v !== undefined) cfg[k] = v; });
          if (body.enabled !== undefined) cfg.enabled = Boolean(body.enabled);
          slots()[t] = cfg;
          const coming = state.exams.filter(e => e.auto && weeklyTrackOf(e) === t && !e.cancelled && phaseOf(e) === 'UPCOMING');
          if (moveTo) {
            // Move this week's exam to the admin's date and time (registrations stay)
            const exam = coming[0] || ensureWeeklyFor(t);
            if (exam) { exam.startAt = new Date(moveTo).toISOString(); exam.movedByAdmin = true; }
          } else {
            // New weekly schedule: the coming exam follows it (registrations stay)
            const durationMin = cfg.durationMin > 0 ? cfg.durationMin : WEEKLY_TRACKS[t].durationMin;
            coming.forEach(e => {
              if (!cfg.enabled && !e.candidates.length) { state.exams = state.exams.filter(x => x !== e); return; }
              e.startAt = new Date(nextWeeklyStart(cfg, Date.now(), durationMin)).toISOString();
              e.weekKey = new Date(Date.parse(e.startAt) + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
              e.durationMin = durationMin;
              e.movedByAdmin = false;
              e.noticeBn = `প্রতি ${WEEKDAY_BN[cfg.weekday]} লাইভ পরীক্ষা। পরীক্ষা শেষ হলেই উত্তর ও মেধা তালিকা প্রকাশ হবে।`;
            });
          }
        }
        saveNow();
        send(res, 200, { status: 'SUCCESS', ...weeklyOverview() });
        return true;
      }

      let m = pathname.match(/^\/api\/live\/admin\/exams\/([\w-]+)\/cancel$/);
      if (m && method === 'POST') {
        const exam = findExam(m[1]);
        if (!exam) return fail(res, 404, 'NOT_FOUND', 'পরীক্ষাটি পাওয়া যায়নি।'), true;
        exam.cancelled = true;
        saveNow();
        send(res, 200, { status: 'SUCCESS' });
        return true;
      }

      m = pathname.match(/^\/api\/live\/admin\/exams\/([\w-]+)$/);
      if (m && method === 'GET') {
        const exam = findExam(m[1]);
        if (!exam) return fail(res, 404, 'NOT_FOUND', 'পরীক্ষাটি পাওয়া যায়নি।'), true;
        send(res, 200, {
          status: 'SUCCESS',
          exam: adminExam(exam),
          candidates: exam.candidates.map(c => ({
            roll: c.roll, name: c.name, phone: c.phone, registeredAt: c.registeredAt,
            startedAt: c.startedAt || null, submittedAt: c.submittedAt || null
          })),
          merit: buildMerit(exam)
        });
        return true;
      }

      return fail(res, 404, 'NOT_FOUND', 'রুট পাওয়া যায়নি।'), true;
    }

    // ---------------- Public ----------------
    // Home page card: the coming weekly exam of the user's exam type (?track=BCS | ADMISSION_MED ...) + my free limit.
    // No counts: users only see the exam, its time and their own access.
    if (pathname === '/api/live/weekly' && method === 'GET') {
      const t = WEEKLY_TRACKS[searchParams.get('track')] ? searchParams.get('track') : 'BCS';
      const cfg = slotOf(t);
      const next = ensureWeeklyFor(t);
      send(res, 200, {
        status: 'SUCCESS',
        track: t,
        trackLabelBn: TRACK_META[t].labelBn,
        exam: next && !next.cancelled && phaseOf(next) !== 'ENDED' ? publicExam(next) : null,
        schedule: { enabled: cfg.enabled, weekday: cfg.weekday, weekdayBn: WEEKDAY_BN[cfg.weekday], hour: cfg.hour, minute: cfg.minute },
        access: accessOf(currentUser(req)),
        serverNow: new Date().toISOString()
      });
      return true;
    }

    // ?track=: only that exam type's live exams (weekly ones of the type + the admin's own ones of its question bank)
    if (pathname === '/api/live/exams' && method === 'GET') {
      const t = searchParams.get('track');
      const mineOnly = t && WEEKLY_TRACKS[t] ? e => (e.auto ? weeklyTrackOf(e) === t : e.track === t || (t.startsWith('ADMISSION_') && e.track === 'ADMISSION')) : () => true;
      send(res, 200, {
        status: 'SUCCESS',
        exams: state.exams.filter(e => !e.cancelled && mineOnly(e)).map(publicExam).sort((a, b) => a.startAt.localeCompare(b.startAt))
      });
      return true;
    }

    const m = pathname.match(/^\/api\/live\/exams\/([\w-]+)(?:\/(register|me|paper|answers|submit|merit|review))?$/);
    if (!m) return fail(res, 404, 'NOT_FOUND', 'রুট পাওয়া যায়নি।'), true;
    const exam = findExam(m[1]);
    if (!exam) return fail(res, 404, 'NOT_FOUND', 'পরীক্ষাটি পাওয়া যায়নি বা বাতিল করা হয়েছে।'), true;
    const action = m[2];
    const phase = phaseOf(exam);
    const token = body.token || searchParams.get('token');
    const candidate = findCandidate(exam, token);

    if (!action && method === 'GET') {
      send(res, 200, { status: 'SUCCESS', exam: publicExam(exam) });
      return true;
    }

    if (action === 'register' && method === 'POST') {
      if (phase === 'ENDED') return fail(res, 409, 'ENDED', 'পরীক্ষা শেষ হয়ে গেছে, এখন নিবন্ধন করা যাবে না।'), true;
      const name = String(body.name || '').trim().slice(0, 80);
      const phone = String(body.phone || '').replace(/[^\d+]/g, '').slice(0, 15);
      if (name.length < 2) return fail(res, 400, 'BAD_NAME', 'আপনার পূর্ণ নাম লিখুন।'), true;
      if (phone.length < 11) return fail(res, 400, 'BAD_PHONE', 'সঠিক মোবাইল নম্বর দিন (১১ ডিজিট)।'), true;

      // A phone number alone is not proof of who someone is: the existing seat is only handed back to
      // the same account (or to that phone's own account). Otherwise anyone could type another
      // candidate's number and answer or read results in their name.
      const user = currentUser(req);
      const last11 = p => String(p || '').replace(/\D/g, '').slice(-11); // +8801… and 01… are the same number
      let c = exam.candidates.find(x => last11(x.phone) === last11(phone)) || (user && exam.candidates.find(x => x.userId === user.id));
      if (c) {
        const sameUser = user && (c.userId === user.id || (!c.userId && last11(user.phone) === last11(c.phone)));
        if (!sameUser) {
          return fail(res, 409, 'ALREADY_REGISTERED',
            'এই নম্বরে আগেই নিবন্ধন হয়েছে। যে ফোন/ব্রাউজারে নিবন্ধন করেছিলেন সেখান থেকে খুলুন, অথবা এই নম্বরের অ্যাকাউন্টে লগইন করে আবার চেষ্টা করুন।'), true;
        }
        if (!c.userId) {
          c.userId = user.id;
          save();
        }
      } else {
        c = {
          id: newId('cand'),
          token: crypto.randomBytes(18).toString('hex'),
          roll: exam.nextRoll++,
          name,
          phone,
          userId: user ? user.id : null,
          registeredAt: new Date().toISOString(),
          draftAnswers: {}
        };
        exam.candidates.push(c);
        saveNow();
      }
      send(res, 200, { status: 'SUCCESS', candidate: { roll: c.roll, name: c.name, token: c.token }, exam: publicExam(exam) });
      return true;
    }

    if (!candidate) return fail(res, 401, 'NOT_REGISTERED', 'আগে এই পরীক্ষায় নিবন্ধন করুন।'), true;

    if (action === 'me' && method === 'GET') {
      const out = {
        roll: candidate.roll,
        name: candidate.name,
        submitted: Boolean(candidate.submittedAt),
        submittedAt: candidate.submittedAt || null
      };
      if (candidate.result) out.result = candidate.result;
      if (phase === 'ENDED' && candidate.result) {
        const row = buildMerit(exam).find(r => r.candidateId === candidate.id);
        if (row) Object.assign(out, { rank: row.rank, percentile: row.percentile, totalExaminees: exam.candidates.filter(c => c.submittedAt).length });
      }
      send(res, 200, { status: 'SUCCESS', exam: publicExam(exam), me: out });
      return true;
    }

    if (action === 'paper' && method === 'GET') {
      if (phase === 'UPCOMING') return fail(res, 403, 'NOT_STARTED', 'পরীক্ষা এখনো শুরু হয়নি।', { exam: publicExam(exam) }), true;
      if (phase === 'ENDED') return fail(res, 410, 'ENDED', 'পরীক্ষার সময় শেষ।', { exam: publicExam(exam) }), true;
      if (candidate.submittedAt) return fail(res, 409, 'ALREADY_SUBMITTED', 'আপনি ইতিমধ্যে উত্তরপত্র জমা দিয়েছেন।', { exam: publicExam(exam) }), true;
      if (!candidate.startedAt) {
        // Free limit is counted per account, so sitting the exam needs a login
        const user = currentUser(req);
        if (!user) return fail(res, 401, 'LOGIN_REQUIRED', 'লাইভ পরীক্ষা দিতে আগে লগইন করুন (অ্যাকাউন্ট না থাকলে ফ্রিতে খুলুন)।', { exam: publicExam(exam) }), true;
        if (candidate.userId && candidate.userId !== user.id) {
          return fail(res, 403, 'OTHER_ACCOUNT', 'এই রোল অন্য অ্যাকাউন্টের। যে অ্যাকাউন্ট দিয়ে নিবন্ধন করেছিলেন সেটিতে লগইন করুন।', { exam: publicExam(exam) }), true;
        }
        const limit = weeklyCfg().freeLimit;
        if (!isPremium(user) && liveExamsTaken(user, exam) >= limit) {
          return fail(res, 402, 'PREMIUM_REQUIRED', `ফ্রিতে ${limit}টি লাইভ পরীক্ষা দেওয়া যায়, আপনি সেগুলো দিয়ে ফেলেছেন। প্রতি সপ্তাহের লাইভ পরীক্ষা দিতে প্যাকেজ নিন।`, { exam: publicExam(exam) }), true;
        }
        candidate.userId = user.id;
        candidate.startedAt = new Date().toISOString();
        save();
      }
      const questions = exam.questionIds.map(id => questionById.get(id)).filter(Boolean).map(stripQuestion);
      send(res, 200, {
        status: 'SUCCESS',
        exam: publicExam(exam),
        candidate: { roll: candidate.roll, name: candidate.name },
        questions,
        draftAnswers: candidate.draftAnswers || {}
      });
      return true;
    }

    if (action === 'answers' && method === 'POST') {
      if (phase !== 'LIVE' || candidate.submittedAt) return fail(res, 409, 'CLOSED', 'এখন উত্তর সংরক্ষণ করা যাবে না।'), true;
      candidate.draftAnswers = normalizeAnswers(exam, body.answers);
      save();
      send(res, 200, { status: 'SUCCESS' });
      return true;
    }

    if (action === 'submit' && method === 'POST') {
      if (candidate.submittedAt) return fail(res, 409, 'ALREADY_SUBMITTED', 'আপনি ইতিমধ্যে উত্তরপত্র জমা দিয়েছেন।'), true;
      const now = Date.now();
      const startMs = Date.parse(exam.startAt);
      const endMs = startMs + exam.durationMin * 60000;
      if (now < startMs) return fail(res, 403, 'NOT_STARTED', 'পরীক্ষা এখনো শুরু হয়নি।'), true;
      if (now > endMs + SUBMIT_GRACE_SEC * 1000) return fail(res, 410, 'ENDED', 'জমা দেওয়ার সময় শেষ হয়ে গেছে।'), true;

      const answers = normalizeAnswers(exam, body.answers || candidate.draftAnswers);
      // Time is measured on the server from the official start, like a real exam hall
      const timeTakenSec = Math.max(1, Math.min(exam.durationMin * 60, Math.round((now - startMs) / 1000)));
      candidate.answers = answers;
      candidate.submittedAt = new Date(now).toISOString();
      candidate.result = { ...scoreAnswers(exam, answers), timeTakenSec, totalQuestions: exam.questionIds.length };
      delete candidate.draftAnswers;
      saveNow();
      send(res, 200, { status: 'SUCCESS', result: candidate.result, resultPublishAt: endAtOf(exam) });
      return true;
    }

    if (action === 'merit' && method === 'GET') {
      if (phase !== 'ENDED') return fail(res, 403, 'NOT_PUBLISHED', 'পরীক্ষা শেষ হওয়ার পর মেধা তালিকা প্রকাশ হবে।', { exam: publicExam(exam) }), true;
      const merit = buildMerit(exam).map(({ candidateId, ...row }) => ({ ...row, isMe: candidateId === candidate.id }));
      send(res, 200, {
        status: 'SUCCESS',
        exam: publicExam(exam),
        absentCount: exam.candidates.filter(c => !c.submittedAt).length,
        merit
      });
      return true;
    }

    if (action === 'review' && method === 'GET') {
      if (phase !== 'ENDED') return fail(res, 403, 'NOT_PUBLISHED', 'পরীক্ষা শেষ হওয়ার পর উত্তর মিলিয়ে দেখা যাবে।'), true;
      const questions = exam.questionIds.map(id => questionById.get(id)).filter(Boolean).map((q, i) => ({
        ...stripQuestion(q, i),
        correctOption: q.correctOption,
        explanationBn: q.explanationBn || '',
        shortcutFormula: q.shortcutFormula || ''
      }));
      send(res, 200, {
        status: 'SUCCESS',
        exam: publicExam(exam),
        candidate: { roll: candidate.roll, name: candidate.name },
        questions,
        answers: candidate.answers || {},
        result: candidate.result || null
      });
      return true;
    }

    return fail(res, 404, 'NOT_FOUND', 'রুট পাওয়া যায়নি।'), true;
  }

  // With a database the state arrives in ready(), which then creates the weekly exam
  if (!store) ensureWeekly();
  setInterval(ensureWeekly, 10 * 60000).unref();

  return { handle, buildMerit, scoreAnswers, phaseOf, ready, flush, nextWeeklyStart, _state: () => state, _saveNow: saveNow };
}

module.exports = { createLiveExamEngine, TRACK_META };

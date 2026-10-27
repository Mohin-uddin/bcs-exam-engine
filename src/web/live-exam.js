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
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DATA_FILE = process.env.LIVE_DATA_FILE || path.join(__dirname, '..', '..', 'data', 'live-exams.json');
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';
const SUBMIT_GRACE_SEC = 90; // network slack for auto-submit at the final second

const TRACK_META = {
  BCS: { labelBn: 'বিসিএস প্রিলিমিনারি', orgBn: 'বাংলাদেশ সরকারি কর্ম কমিশন (BPSC)', negativeMark: 0.5 },
  PRIMARY: { labelBn: 'প্রাথমিক শিক্ষক নিয়োগ', orgBn: 'প্রাথমিক শিক্ষা অধিদপ্তর (DPE)', negativeMark: 0.25 },
  NTRCA: { labelBn: 'শিক্ষক নিবন্ধন (NTRCA)', orgBn: 'বেসরকারি শিক্ষক নিবন্ধন ও প্রত্যয়ন কর্তৃপক্ষ (NTRCA)', negativeMark: 0.25 },
  BANK: { labelBn: 'ব্যাংক নিয়োগ', orgBn: 'ব্যাংকার্স সিলেকশন কমিটি', negativeMark: 0.25 },
  MINISTRY: { labelBn: 'মন্ত্রণালয় ও অধিদপ্তর', orgBn: 'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার', negativeMark: 0.25 },
  NON_CADRE: { labelBn: 'পিএসসি নন-ক্যাডার', orgBn: 'বাংলাদেশ সরকারি কর্ম কমিশন (BPSC)', negativeMark: 0.5 },
  NURSING: { labelBn: 'নার্সিং নিয়োগ', orgBn: 'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার', negativeMark: 0.25 }
};

const STORE_KEY = 'live-exams';

function createLiveExamEngine({ availableExams, sampleQuestions, store = null }) {
  const questionById = new Map((sampleQuestions || []).map(q => [q.id, q]));
  const catalog = (availableExams || []).filter(e => Array.isArray(e.questionIds) && e.questionIds.length > 0);
  const catalogById = new Map(catalog.map(e => [e.id, e]));

  let state = { exams: [] };
  let saveTimer = null;

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
      return store.set(STORE_KEY, state).catch(e => console.error(`[live-exam] Could not save to database: ${e.message}`));
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
  }

  // Write any pending change now (used on shutdown)
  async function flush() {
    if (saveTimer) await saveNow();
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const newId = prefix => `${prefix}_${crypto.randomBytes(6).toString('hex')}`;

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
      registeredCount: exam.candidates.length,
      submittedCount: exam.candidates.filter(c => c.submittedAt).length
    };
  }

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

  const isAdmin = req => req.headers['x-admin-key'] === ADMIN_KEY;

  // ---------------------------------------------------------------------------
  // Route handler. Returns true when it handled the request.
  // ---------------------------------------------------------------------------
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
          exams: state.exams.filter(e => !e.cancelled).map(publicExam).sort((a, b) => b.startAt.localeCompare(a.startAt))
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
        send(res, 200, { status: 'SUCCESS', exam: publicExam(exam) });
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
          exam: publicExam(exam),
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
    if (pathname === '/api/live/exams' && method === 'GET') {
      send(res, 200, {
        status: 'SUCCESS',
        exams: state.exams.filter(e => !e.cancelled).map(publicExam).sort((a, b) => a.startAt.localeCompare(b.startAt))
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

      // Same phone = same candidate: lets someone re-open the exam on another device
      let c = exam.candidates.find(x => x.phone === phone);
      if (!c) {
        c = {
          id: newId('cand'),
          token: crypto.randomBytes(18).toString('hex'),
          roll: exam.nextRoll++,
          name,
          phone,
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

  return { handle, buildMerit, scoreAnswers, phaseOf, ready, flush, _state: () => state, _saveNow: saveNow };
}

module.exports = { createLiveExamEngine, TRACK_META };

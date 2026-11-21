/**
 * App tests: progress merge/SM-2 rules and the real HTTP server
 * (accounts, live-exam seat protection, progress sync, question reports, admin key, gzip).
 * Starts the server on a free port with throw-away data files; nothing touches real data.
 */
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const core = require('../src/web/public/progress-core');

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push(true);
    console.log(`✓ ${name}`);
  } catch (e) {
    results.push(false);
    console.error(`✗ ${name}\n  ${e.stack || e.message}`);
  }
}

// ---------------------------------------------------------------------------
// progress-core (no server)
// ---------------------------------------------------------------------------
async function coreTests() {
  console.log('\n--- PROGRESS CORE ---');
  const now = Date.UTC(2026, 0, 1);

  await test('SM-2: 1 day, 6 days, then interval x EF; forgetting resets', () => {
    let s = core.sm2({}, 5, now);
    assert.equal(s.iv, 1);
    s = core.sm2(s, 5, now);
    assert.equal(s.iv, 6);
    s = core.sm2(s, 4, now);
    assert.equal(s.iv, Math.round(6 * 2.7));
    const forgot = core.sm2(s, 1, now);
    assert.equal(forgot.reps, 0);
    assert.equal(forgot.iv, 1);
    assert.equal(forgot.status, 'OPEN');
    assert.ok(core.sm2({}, 0, now).ef >= 1.3);
  });

  await test('merge: newer edit wins per item, attempts and days combine', () => {
    const a = core.empty();
    const b = core.empty();
    a.mistakes.q1 = { qid: 'q1', sel: 'A', tag: 'TYPO', t: 100 };
    b.mistakes.q1 = { qid: 'q1', sel: 'B', tag: 'SILLY_MISTAKE', t: 200 };
    a.bookmarks.q2 = { on: true, t: 300 };
    b.bookmarks.q2 = { on: false, t: 400 }; // removed later on the other device
    a.attempts = [{ id: 'att1', at: 1 }];
    b.attempts = [{ id: 'att1', at: 1 }, { id: 'att2', at: 2 }];
    a.days = { '2026-01-01': 5 };
    b.days = { '2026-01-01': 9, '2026-01-02': 3 };
    const m = core.merge(a, b);
    assert.equal(m.mistakes.q1.sel, 'B');
    assert.equal(m.mistakes.q1.tag, 'SILLY_MISTAKE');
    assert.equal(m.bookmarks.q2.on, false);
    assert.deepEqual(m.attempts.map(x => x.id).sort(), ['att1', 'att2']);
    assert.deepEqual(m.days, { '2026-01-01': 9, '2026-01-02': 3 });
  });

  await test('sanitize: drops bad ids, clamps numbers, caps list sizes', () => {
    const p = { mistakes: { 'bad id!': { t: 1 }, ok: { ef: 99, n: -4, t: 1 } }, attempts: [] };
    for (let i = 0; i < 250; i++) p.attempts.push({ id: `a${i}`, at: i });
    const s = core.sanitize(p);
    assert.deepEqual(Object.keys(s.mistakes), ['ok']);
    assert.equal(s.mistakes.ok.ef, 5);
    assert.equal(s.mistakes.ok.n, 1);
    assert.equal(s.attempts.length, core.LIMITS.attempts);
    assert.equal(s.attempts[0].id, 'a249'); // newest kept
  });

  await test('streak counts back from today (or yesterday)', () => {
    const day = core.dayKey;
    const DAY = core.DAY;
    assert.equal(core.streak({ [day(now)]: 3, [day(now - DAY)]: 1, [day(now - 3 * DAY)]: 1 }, now), 2);
    assert.equal(core.streak({ [day(now - DAY)]: 1, [day(now - 2 * DAY)]: 1 }, now), 2);
    assert.equal(core.streak({}, now), 0);
  });
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
function freePort() {
  return new Promise(resolve => {
    const s = net.createServer().listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

async function startServer(extraEnv = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sh-test-'));
  const port = await freePort();
  const env = {
    ...process.env,
    PORT: String(port),
    ADMIN_KEY: 'test-admin-key',
    ACCOUNTS_DATA_FILE: path.join(dir, 'accounts.json'),
    LIVE_DATA_FILE: path.join(dir, 'live.json'),
    REPORTS_DATA_FILE: path.join(dir, 'reports.json'),
    FUNNEL_DATA_FILE: path.join(dir, 'funnel.json'),
    PROGRESS_DATA_DIR: path.join(dir, 'progress'),
    // OTP codes are written to the server log instead of being sent by SMS
    SMS_PROVIDER: 'console',
    ...extraEnv
  };
  delete env.DATABASE_URL;
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'web', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', d => { log += d; });
  child.stderr.on('data', d => { log += d; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`${base}/api/live/exams`);
      if (r.ok) return { base, child, dir, getLog: () => log };
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 100));
  }
  child.kill();
  throw new Error(`server did not start:\n${log}`);
}

async function serverTests() {
  console.log('\n--- SERVER ---');
  const { base, child, dir, getLog } = await startServer();
  const call = async (method, url, { body, cookie, admin, headers = {} } = {}) => {
    const res = await fetch(base + url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(admin ? { 'X-Admin-Key': admin } : {}),
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, res };
  };
  const signUp = async (name, phone) => {
    const r = await call('POST', '/api/auth/register', { body: { name, phone, password: 'secret123' } });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    return r.res.headers.get('set-cookie').split(';')[0];
  };

  try {
    const alice = await signUp('Alice', '01711111111');
    const bob = await signUp('Bob', '01822222222');

    await test('user journey: anonymous events are counted per step; no personal data kept; admin only', async () => {
      const ev = (vid, e, extra = {}, ua) => call('POST', '/api/ev', { body: { vid, ev: e, ...extra }, headers: ua ? { 'User-Agent': ua } : {} });
      // Visitor 1: Facebook ad -> picks medical -> signs up -> opens past papers -> starts and submits an exam
      const a = 'aaaaaaaaaaaa1';
      assert.equal((await ev(a, 'landing', { src: 'facebook', ref: 'm.facebook.com', track: '' })).status, 204);
      await ev(a, 'picker_shown');
      await ev(a, 'track_chosen', { track: 'ADMISSION_MED' });
      await ev(a, 'signup_prompt_shown', { track: 'ADMISSION_MED', tab: 'welcome' });
      await ev(a, 'signup_done', { track: 'ADMISSION_MED', phone: '01799999999', name: 'Secret Name' });
      await ev(a, 'screen', { track: 'ADMISSION_MED', tab: 'past-bank' });
      await ev(a, 'exam_start', { track: 'ADMISSION_MED', li: 1 });
      await ev(a, 'exam_submit', { track: 'ADMISSION_MED', li: 1 });
      // Visitor 2: direct -> picks BCS -> leaves at the sign-up box
      const b = 'bbbbbbbbbbbb2';
      await ev(b, 'landing');
      await ev(b, 'picker_shown');
      await ev(b, 'track_chosen', { track: 'BCS' });
      await ev(b, 'signup_prompt_shown', { track: 'BCS' });
      await ev(b, 'leave', { track: 'BCS', tab: 'home' });
      // Ignored: a bot, a bad id, an unknown event
      await ev('cccccccccccc3', 'landing', {}, 'Mozilla/5.0 (compatible; Googlebot/2.1)');
      await ev('NOT VALID', 'landing');
      await ev(a, 'hack_the_planet');

      assert.equal((await call('GET', '/api/admin/funnel?days=1')).status, 401, 'admin key needed');
      const r = await call('GET', '/api/admin/funnel?days=1', { admin: 'test-admin-key' });
      assert.equal(r.status, 200, JSON.stringify(r.json));
      const step = k => r.json.steps.find(x => x.key === k).count;
      assert.equal(r.json.visitors, 2);
      assert.equal(step('landing'), 2);
      assert.equal(step('signup_prompt_shown'), 2);
      assert.equal(step('account'), 1);
      assert.equal(step('tab_past-bank'), 1);
      assert.equal(step('exam_submit'), 1);
      assert.equal(r.json.sources.find(x => x.source === 'facebook').count, 1);
      assert.equal(r.json.sources.find(x => x.source === 'direct').count, 1);
      const med = await call('GET', '/api/admin/funnel?days=1&track=ADMISSION_MED', { admin: 'test-admin-key' });
      assert.equal(med.json.visitors, 1);
      // What is kept: no phone, name or address of the visitor's connection
      await new Promise(r2 => setTimeout(r2, 5500)); // saved within 5 s
      const saved = fs.readFileSync(path.join(dir, 'funnel.json'), 'utf8');
      assert.ok(!/01799999999|Secret Name|127\.0\.0\.1|::1|facebook\.com/.test(saved), 'no personal data saved');
      assert.ok(saved.includes(a));
    });

    await test('admin: wrong key refused, right key accepted', async () => {
      assert.equal((await call('GET', '/api/admin/reports', { admin: 'nope' })).status, 401);
      assert.equal((await call('GET', '/api/admin/reports')).status, 401);
      assert.equal((await call('GET', '/api/admin/reports', { admin: 'test-admin-key' })).status, 200);
    });

    await test('live exam: a phone number alone cannot take over someone else\'s seat', async () => {
      const cat = await call('GET', '/api/live/admin/catalog', { admin: 'test-admin-key' });
      const setId = cat.json.sets[0].id;
      const made = await call('POST', '/api/live/admin/exams', {
        admin: 'test-admin-key',
        body: { setId, startAt: new Date(Date.now() + 3600e3).toISOString(), durationMin: 30 }
      });
      assert.equal(made.status, 200, JSON.stringify(made.json));
      const url = `/api/live/exams/${made.json.exam.id}/register`;

      const first = await call('POST', url, { cookie: alice, body: { name: 'Alice', phone: '01711111111' } });
      assert.equal(first.status, 200);
      const again = await call('POST', url, { cookie: alice, body: { name: 'Alice', phone: '+8801711111111' } });
      assert.equal(again.status, 200);
      assert.equal(again.json.candidate.token, first.json.candidate.token);

      const stranger = await call('POST', url, { body: { name: 'Someone', phone: '01711111111' } });
      assert.equal(stranger.status, 409);
      const otherAccount = await call('POST', url, { cookie: bob, body: { name: 'Bob', phone: '01711111111' } });
      assert.equal(otherAccount.status, 409);
    });

    await test('progress: login needed, saved per account, newer edit wins', async () => {
      assert.equal((await call('GET', '/api/progress')).status, 401);
      const p = core.empty();
      p.mistakes.q1 = { qid: 'q1', sel: 'A', tag: 'TYPO', t: 100 };
      let r = await call('POST', '/api/progress', { cookie: alice, body: { progress: p } });
      assert.equal(r.status, 200);
      p.mistakes.q1 = { qid: 'q1', sel: 'C', tag: 'TYPO', t: 50 }; // older copy from another phone
      r = await call('POST', '/api/progress', { cookie: alice, body: { progress: p } });
      assert.equal(r.json.progress.mistakes.q1.sel, 'A');
      r = await call('GET', '/api/progress', { cookie: alice });
      assert.equal(r.json.progress.mistakes.q1.sel, 'A');
      r = await call('GET', '/api/progress', { cookie: bob });
      assert.deepEqual(r.json.progress.mistakes, {});
    });

    await test('question report reaches the admin and can be closed', async () => {
      const cat = await call('GET', '/api/live/admin/catalog', { admin: 'test-admin-key' });
      assert.ok(cat.json.sets.length);
      const bad = await call('POST', '/api/reports', { body: { questionId: 'no-such-question', reason: 'TYPO' } });
      assert.equal(bad.status, 400);
      const list0 = await call('GET', '/api/admin/reports?status=ALL', { admin: 'test-admin-key' });
      const qid = require('../src/web/seed-data').sampleQuestions[0].id;
      const ok = await call('POST', '/api/reports', { cookie: bob, body: { questionId: qid, reason: 'WRONG_ANSWER', comment: 'উত্তর গ হবে' } });
      assert.equal(ok.status, 200, JSON.stringify(ok.json));
      const open = await call('GET', '/api/admin/reports?status=OPEN', { admin: 'test-admin-key' });
      const rep = open.json.reports.find(x => x.questionId === qid);
      assert.ok(rep, 'report listed');
      assert.equal(open.json.reports.length, list0.json.reports.length + 1);
      const done = await call('POST', `/api/admin/reports/${rep.id}/done`, { admin: 'test-admin-key', body: {} });
      assert.equal(done.status, 200);
      const after = await call('GET', '/api/admin/reports?status=OPEN', { admin: 'test-admin-key' });
      assert.ok(!after.json.reports.some(x => x.id === rep.id));
    });

    await test('the app is free: everyone gets every question, nothing is locked, everyone may print', async () => {
      const anon = await fetch(base + '/seed-data.js');
      const anonBody = await anon.text();
      assert.equal(anon.status, 200);
      assert.ok(anonBody.includes('window.APP_ACCESS = {"premium":true'), 'visitors get the full bundle');
      assert.ok(anonBody.includes('window.APP_ACCESS.lockedExamIds = [];'), 'no locked sets');
      const mine = await fetch(base + '/seed-data.js', { headers: { Cookie: alice } });
      assert.equal(mine.headers.get('etag'), anon.headers.get('etag'), 'logged-in users get the same data');
      const me = await call('GET', '/api/auth/me', { cookie: alice });
      assert.equal(me.json.user.premium, true);
      assert.equal(me.json.user.canPrint, true);
      const q = await call('GET', '/api/exam/questions');
      if (q.status === 200 && Array.isArray(q.json && q.json.questions)) {
        const withAcc = await call('GET', '/api/exam/questions', { cookie: alice });
        assert.equal(q.json.questions.length, withAcc.json.questions.length);
      }
    });

    await test('the app is free: no plan, payment or cash-on-delivery order can be started', async () => {
      const posts = [
        ['/api/payment/initiate', { planId: 'monthly' }],
        ['/api/payment/submit', { planId: 'monthly', method: 'bkash', senderNumber: '01711111111', trxId: 'ABC123XYZ' }],
        ['/api/payment/cod', { planId: 'half_year' }],
        ['/api/cod/otp', { phone: '01933333333' }],
        ['/api/cod/order', { planId: 'cod_premium', exam: 'BCS', name: 'Karim', phone: '01933333333' }],
        ['/api/cod/redeem', { code: 'AAAA-BBBB' }]
      ];
      for (const [url, body] of posts) {
        for (const cookie of [undefined, alice]) {
          const r = await call('POST', url, { cookie, body });
          assert.equal(r.status, 410, `${url} ${JSON.stringify(r.json)}`);
          assert.equal(r.json.code, 'FREE_APP', url);
        }
      }
    });

    await test('weekly live exam is created by itself; every account may sit as many as it likes (free app)', async () => {
      const w = await call('GET', '/api/live/weekly');
      assert.equal(w.status, 200, JSON.stringify(w.json));
      assert.ok(w.json.exam && w.json.exam.weekly, 'weekly exam exists');
      const start = new Date(w.json.exam.startAt);
      assert.equal(start.getUTCDay(), 5); // Friday
      assert.equal(start.getUTCHours(), 15); // 9 PM in Dhaka
      assert.equal(w.json.access.left, null, 'no limit for visitors');
      // Same exam (same count, same start) for a second visitor
      const w2 = await call('GET', '/api/live/weekly', { cookie: bob });
      assert.equal(w2.json.exam.id, w.json.exam.id);
      assert.equal(w2.json.access.left, null);

      const cat = await call('GET', '/api/live/admin/catalog', { admin: 'test-admin-key' });
      const setId = cat.json.sets[0].id;
      const liveNow = async () => (await call('POST', '/api/live/admin/exams', {
        admin: 'test-admin-key', body: { setId, startAt: new Date(Date.now() - 60e3).toISOString(), durationMin: 30 }
      })).json.exam.id;
      const sit = async (id, cookie, phone) => {
        const reg = await call('POST', `/api/live/exams/${id}/register`, { cookie, body: { name: 'Carol', phone } });
        assert.equal(reg.status, 200, JSON.stringify(reg.json));
        return call('GET', `/api/live/exams/${id}/paper?token=${reg.json.candidate.token}`, { cookie });
      };
      const carol = await signUp('Carol', '01933333333');
      const ids = [await liveNow(), await liveNow(), await liveNow()];
      const anon = await call('POST', `/api/live/exams/${ids[0]}/register`, { body: { name: 'Anon', phone: '01544444444' } });
      // Free app: a visitor who skipped registration may sit too (the candidate token proves the seat)
      assert.equal((await call('GET', `/api/live/exams/${ids[0]}/paper?token=${anon.json.candidate.token}`)).status, 200);
      assert.equal((await call('GET', `/api/live/exams/${ids[0]}/paper?token=wrong`)).status, 401);
      assert.equal((await sit(ids[0], carol, '01933333333')).status, 200);
      assert.equal((await sit(ids[1], carol, '01933333333')).status, 200);
      assert.equal((await sit(ids[2], carol, '01933333333')).status, 200, 'third live exam is free too');
      assert.equal((await sit(ids[0], carol, '01933333333')).status, 200);
      const left = await call('GET', '/api/live/weekly', { cookie: carol });
      assert.equal(left.json.access.premium, true);
      assert.equal(left.json.access.left, null);
    });

    await test('every exam type has its own weekly live exam, sized like the real exam; users never see counts', async () => {
      const sizes = { BCS: 200, PRIMARY: 80, NTRCA: 100, BANK: 100, MINISTRY: 70, NON_CADRE: 100, NURSING: 100, ADMISSION_UNI: 100, ADMISSION_MED: 100 };
      const ids = new Set();
      for (const [t, n] of Object.entries(sizes)) {
        const w = await call('GET', `/api/live/weekly?track=${t}`);
        assert.equal(w.status, 200, JSON.stringify(w.json));
        assert.ok(w.json.exam, `${t}: weekly exam exists`);
        assert.equal(w.json.exam.weeklyTrack, t);
        assert.equal(w.json.exam.totalQuestions, n, `${t}: ${n} questions`);
        assert.equal(w.json.exam.registeredCount, undefined, `${t}: no count for users`);
        assert.equal(w.json.targetCount, undefined);
        ids.add(w.json.exam.id);
      }
      assert.equal(ids.size, Object.keys(sizes).length, 'one exam per type');
      // The list for one type has only that type's exams, and no counts
      const list = await call('GET', '/api/live/exams?track=ADMISSION_MED');
      assert.ok(list.json.exams.length && list.json.exams.every(e => e.track === 'ADMISSION_MED' || e.track === 'ADMISSION'));
      assert.ok(list.json.exams.every(e => e.registeredCount === undefined && e.submittedCount === undefined));
      // The pages users see have no count either
      for (const f of ['/live.js', '/study.js']) {
        const js = await (await fetch(base + f)).text();
        assert.ok(!/registeredCount|submittedCount|নিবন্ধিত:|নিবন্ধন করেছেন/.test(js), `${f} shows no count`);
      }
      // Admin still sees them
      const admin = await call('GET', '/api/live/admin/weekly', { admin: 'test-admin-key' });
      assert.ok(admin.json.tracks.every(t => t.next && typeof t.next.registeredCount === 'number'));
    });

    await test('weekly questions come only from that exam type\'s bank', async () => {
      process.env.LIVE_DATA_FILE = path.join(os.tmpdir(), `live-${Date.now()}.json`);
      const seed = require('../src/web/seed-data');
      const { createLiveExamEngine } = require('../src/web/live-exam');
      const engine = createLiveExamEngine({ availableExams: seed.availableExams, sampleQuestions: seed.sampleQuestions });
      // A type's bank = the questions of that type's own papers (job papers share general-knowledge questions)
      const bankOf = t => new Set(seed.availableExams.filter(e => e.examTrack === t && e.questionIds).flatMap(e => e.questionIds));
      const medical = new Set(seed.availableExams.filter(e => e.examTrack === 'ADMISSION' && e.admTarget === 'medical').flatMap(e => e.questionIds));
      for (const e of engine._state().exams.filter(x => x.auto)) {
        const want = e.weeklyTrack.startsWith('ADMISSION') ? 'ADMISSION' : e.weeklyTrack;
        const bank = bankOf(want);
        assert.ok(e.questionIds.every(id => bank.has(id)), `${e.weeklyTrack}: only ${want} papers' questions`);
        if (e.weeklyTrack === 'ADMISSION_MED') assert.ok(e.questionIds.every(id => medical.has(id)), 'medical: only medical papers');
        assert.equal(new Set(e.questionIds).size, e.questionIds.length, `${e.weeklyTrack}: no repeats`);
      }
      fs.rmSync(process.env.LIVE_DATA_FILE, { force: true });
    });

    await test('an older weekly exam of the single "ADMISSION" type stays the university exam (no duplicate, registrations kept)', async () => {
      const file = path.join(os.tmpdir(), `live-legacy-${Date.now()}.json`);
      const seed = require('../src/web/seed-data');
      const set = seed.availableExams.find(e => e.examTrack === 'ADMISSION' && e.questionIds && e.questionIds.length);
      // Friday 9 PM Dhaka of this week (the default slot)
      const { createLiveExamEngine } = require('../src/web/live-exam');
      const probe = createLiveExamEngine({ availableExams: [], sampleQuestions: [] });
      const startMs = probe.nextWeeklyStart({ weekday: 5, hour: 21, minute: 0 }, Date.now(), 60);
      const weekKey = new Date(startMs + 6 * 3600000).toISOString().slice(0, 10);
      const legacy = { id: 'lx_legacy', auto: true, weekKey, title: 'পুরনো', track: 'ADMISSION', weeklyTrack: 'ADMISSION', setId: set.id, setCode: 'ক',
        questionIds: set.questionIds, startAt: new Date(startMs).toISOString(), durationMin: 60, negativeMark: 0.25, createdAt: new Date().toISOString(),
        nextRoll: 100002, candidates: [{ roll: 100001, name: 'X', phone: '01700000000', token: 't', registeredAt: new Date().toISOString() }] };
      const dup = { ...legacy, id: 'lx_dup', track: 'ADMISSION_UNI', weeklyTrack: 'ADMISSION_UNI', candidates: [] };
      fs.writeFileSync(file, JSON.stringify({ exams: [legacy, dup], weekly: { weekday: 5, hour: 21, minute: 0, track: 'ADMISSION' } }));
      delete require.cache[require.resolve('../src/web/live-exam')];
      process.env.LIVE_DATA_FILE = file;
      const { createLiveExamEngine: fresh } = require('../src/web/live-exam');
      const engine = fresh({ availableExams: seed.availableExams, sampleQuestions: seed.sampleQuestions });
      const uni = engine._state().exams.filter(e => e.auto && (e.weeklyTrack === 'ADMISSION_UNI' || e.weeklyTrack === 'ADMISSION') && e.weekKey === weekKey);
      assert.deepEqual(uni.map(e => e.id), ['lx_legacy'], 'one university exam this week: the one with the registration');
      fs.rmSync(file, { force: true });
    });

    await test('admin sets each exam type\'s day and time, or moves this week\'s exam; users see the new time', async () => {
      const before = (await call('GET', '/api/live/weekly?track=BCS')).json.exam;
      const r = await call('POST', '/api/live/admin/weekly', { admin: 'test-admin-key', body: { track: 'ADMISSION_MED', weekday: 3, hour: 18, minute: 30, targetCount: 2000 } });
      assert.equal(r.status, 200, JSON.stringify(r.json));
      const med = (await call('GET', '/api/live/weekly?track=ADMISSION_MED')).json;
      const start = new Date(med.exam.startAt);
      assert.equal(start.getUTCDay(), 3); // Wednesday
      assert.equal(`${start.getUTCHours()}:${start.getUTCMinutes()}`, '12:30'); // 6:30 PM Dhaka
      assert.equal(med.schedule.weekdayBn, 'বুধবার');
      // Other types keep their own time
      assert.equal((await call('GET', '/api/live/weekly?track=BCS')).json.exam.startAt, before.startAt);
      // Move this week's BCS exam to a date of the admin's choice; registrations stay
      const bob2 = await signUp('Reg', '01866666666');
      await call('POST', `/api/live/exams/${before.id}/register`, { cookie: bob2, body: { name: 'Reg', phone: '01866666666' } });
      const when = new Date(Date.now() + 3 * 86400000); when.setUTCSeconds(0, 0);
      const mv = await call('POST', '/api/live/admin/weekly', { admin: 'test-admin-key', body: { track: 'BCS', startAt: when.toISOString() } });
      assert.equal(mv.status, 200, JSON.stringify(mv.json));
      const moved = (await call('GET', '/api/live/weekly?track=BCS')).json.exam;
      assert.equal(moved.id, before.id);
      assert.equal(moved.startAt, when.toISOString());
      const adminView = (await call('GET', '/api/live/admin/weekly', { admin: 'test-admin-key' })).json;
      assert.equal(adminView.tracks.find(t => t.id === 'BCS').next.registeredCount, 1);
      assert.equal(adminView.weekly.targetCount, 2000);
      assert.equal((await call('POST', '/api/live/admin/weekly', { admin: 'test-admin-key', body: { track: 'BCS', hour: 99 } })).status, 400);
      assert.equal((await call('POST', '/api/live/admin/weekly', { admin: 'test-admin-key', body: { track: 'XYZ' } })).status, 400);
    });

    await test('admin can reset a password; old sessions stop working', async () => {
      const users = await call('GET', '/api/admin/accounts/users', { admin: 'test-admin-key' });
      const list = users.json.users || users.json.items || [];
      const b = list.find(u => u.phone === '01822222222');
      assert.ok(b, 'user listed');
      const r = await call('POST', `/api/admin/accounts/users/${b.id}/password`, { admin: 'test-admin-key', body: { password: 'newpass99' } });
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.equal((await call('GET', '/api/progress', { cookie: bob })).status, 401);
      const login = await call('POST', '/api/auth/login', { body: { phone: '01822222222', password: 'newpass99' } });
      assert.equal(login.status, 200);
    });

    await test('admission: /admission opens the main app (with the year dropdowns), every set has its questions, practice questions never claim a past exam', async () => {
      const page = await fetch(base + '/admission');
      assert.equal(page.status, 200);
      assert.match(await page.text(), /adm-pick\.js/);
      const seed = require('../src/web/seed-data');
      const ids = new Set(seed.sampleQuestions.map(q => q.id));
      const sets = seed.availableExams.filter(e => e.examTrack === 'ADMISSION');
      assert.ok(sets.length >= 12, 'unit model tests + subject sets');
      for (const unit of ['SCIENCE', 'HUMANITIES', 'BUSINESS', 'PRIVATE']) assert.ok(sets.some(e => e.unitType === unit), unit);
      for (const e of sets) {
        assert.equal(e.questionIds.length, e.questionCount, e.id);
        assert.equal(new Set(e.questionIds).size, e.questionIds.length, `${e.id} repeats a question`);
        e.questionIds.forEach(id => assert.ok(ids.has(id), `${e.id}: ${id}`));
      }
      seed.sampleQuestions.filter(q => q.examTrack === 'ADMISSION').forEach(q => {
        if (q.isVerifiedPast) return;
        // Year-wise sets are shown like the BCS bank ("বিগত পরীক্ষার ধাঁচে"), never as verified real papers
        if (q.isPastStyle) {
          assert.match(q.reference, /বিগত পরীক্ষার ধাঁচে/, q.id);
          assert.ok(!/✅|আসল প্রশ্ন/.test(q.reference), q.id);
          return;
        }
        assert.equal(q.previousExams.length, 0, q.id);
        assert.match(q.reference, /আসল প্রশ্ন নয়/, q.id);
      });
      assert.ok(!seed.superHotQuestionIds.some(id => id.startsWith('adm_')), 'admission questions stay out of the job-exam hard sets');
    });

    await test('pages and the question bundle are sent gzipped', async () => {
      for (const url of ['/', '/app.css', '/app.js', '/seed-data.js']) {
        const res = await fetch(base + url, { headers: { 'Accept-Encoding': 'gzip' } });
        assert.equal(res.status, 200, url);
        assert.equal(res.headers.get('content-encoding'), 'gzip', url);
      }
    });
  } finally {
    child.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

(async () => {
  await coreTests();
  await serverTests();
  const failed = results.filter(ok => !ok).length;
  console.log(`\n${results.length - failed}/${results.length} app tests passed`);
  if (failed) process.exit(1);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

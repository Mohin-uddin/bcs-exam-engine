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

    await test('printed-pack plans need an address and show up in the shipping list', async () => {
      const cfg = (await call('GET', '/api/payment/config')).json;
      const print = cfg.plans.find(p => p.printPack);
      assert.ok(print);
      // Old one-click cash on delivery is replaced by the OTP order form
      assert.equal(cfg.codEnabled, false);
      assert.ok(cfg.cod && cfg.cod.enabled);
      const old = await call('POST', '/api/payment/cod', { cookie: alice, body: { planId: print.id } });
      assert.equal(old.json.code, 'USE_COD_ORDER');

      const noAddr = await call('POST', '/api/payment/submit', { cookie: bob, body: { planId: print.id, method: 'bkash', senderNumber: '01822222222', trxId: 'ABC123XYZ' } });
      assert.equal(noAddr.json.code, 'BAD_ADDRESS');
      const delivery = { name: 'Alice', phone: '01711111111', district: 'ঢাকা', address: 'বাসা ১২, রোড ৩, মিরপুর' };
      const ok = await call('POST', '/api/payment/submit', { cookie: alice, body: { planId: print.id, method: 'bkash', senderNumber: '01711111111', trxId: 'PACK12345', delivery } });
      assert.equal(ok.status, 200, JSON.stringify(ok.json));
      const id = ok.json.payment.id;
      await call('POST', `/api/admin/accounts/payments/${id}/approve`, { admin: 'test-admin-key', body: {} });
      const toShip = await call('GET', '/api/admin/accounts/payments?status=SHIP', { admin: 'test-admin-key' });
      assert.ok(toShip.json.payments.some(p => p.id === id));
      assert.equal((await call('POST', `/api/admin/accounts/payments/${id}/shipped`, { admin: 'test-admin-key', body: {} })).status, 200);
      const after = await call('GET', '/api/admin/accounts/payments?status=SHIP', { admin: 'test-admin-key' });
      assert.ok(!after.json.payments.some(p => p.id === id));
    });

    await test('cash on delivery: OTP, far-location flag, access code unlocks a view-only plan once', async () => {
      const cod = (await call('GET', '/api/cod/config')).json;
      assert.ok(cod.enabled && cod.otpReady);
      const normal = cod.plans.find(p => p.tier === 'NORMAL');
      const phone = '01933333333';
      assert.equal((await call('POST', '/api/cod/otp', { body: { phone } })).status, 200);
      const otp = [...getLog().matchAll(/OTP: (\d{6})/g)].pop()[1];
      const order = { planId: normal.id, exam: 'BCS', name: 'Karim', phone, districtId: 'rajshahi', area: 'Boalia', address: 'House 1, Road 2', geo: { lat: 23.81, lng: 90.41, accuracy: 30 } };
      const bad = await call('POST', '/api/cod/order', { body: { ...order, otp: otp === '000000' ? '111111' : '000000' } });
      assert.equal(bad.json.code, 'BAD_OTP');
      const ok = await call('POST', '/api/cod/order', { body: { ...order, otp } });
      assert.equal(ok.status, 200, JSON.stringify(ok.json));
      assert.equal(ok.json.order.accessCode, undefined, 'code never goes to the customer');
      // OTP works once
      assert.equal((await call('POST', '/api/cod/order', { body: { ...order, otp } })).json.code, 'OTP_EXPIRED');

      const far = await call('GET', '/api/admin/accounts/orders?status=FAR', { admin: 'test-admin-key' });
      const o = far.json.orders.find(x => x.id === ok.json.order.id);
      assert.ok(o && o.location.status === 'FAR' && o.location.distanceKm > 100);
      assert.equal((await call('POST', `/api/admin/accounts/orders/${o.id}/location-ok`, { admin: 'test-admin-key', body: {} })).status, 200);

      assert.equal((await call('POST', '/api/cod/redeem', { body: { code: o.accessCode } })).status, 401);
      const carol = await signUp('Carol', '01944444444');
      const wrong = await call('POST', '/api/cod/redeem', { cookie: carol, body: { code: 'AAAA-BBBB' } });
      assert.equal(wrong.json.code, 'BAD_CODE');
      const used = await call('POST', '/api/cod/redeem', { cookie: carol, body: { code: o.accessCode.toLowerCase().replace('-', '') } });
      assert.equal(used.status, 200, JSON.stringify(used.json));
      assert.equal(used.json.user.tier, 'NORMAL');
      assert.equal(used.json.user.premium, true);
      assert.equal(used.json.user.canPrint, false);
      assert.equal((await call('POST', '/api/cod/redeem', { cookie: carol, body: { code: o.accessCode } })).json.code, 'CODE_USED');
      const list = await call('GET', '/api/admin/accounts/orders?status=DELIVERED', { admin: 'test-admin-key' });
      assert.ok(list.json.orders.some(x => x.id === o.id && x.redeemedUser.phone === '01944444444'));
    });

    await test('weekly live exam is created by itself; free accounts may sit 2, then need a plan', async () => {
      const w = await call('GET', '/api/live/weekly');
      assert.equal(w.status, 200, JSON.stringify(w.json));
      assert.ok(w.json.exam && w.json.exam.weekly, 'weekly exam exists');
      const start = new Date(w.json.exam.startAt);
      assert.equal(start.getUTCDay(), 5); // Friday
      assert.equal(start.getUTCHours(), 15); // 9 PM in Dhaka
      assert.equal(w.json.access.freeLimit, 2);
      // Same exam (same count, same start) for a second visitor
      const w2 = await call('GET', '/api/live/weekly', { cookie: bob });
      assert.equal(w2.json.exam.id, w.json.exam.id);
      assert.equal(w2.json.access.left, 2);

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
      assert.equal((await call('GET', `/api/live/exams/${ids[0]}/paper?token=${anon.json.candidate.token}`)).json.code, 'LOGIN_REQUIRED');
      assert.equal((await sit(ids[0], carol, '01933333333')).status, 200);
      assert.equal((await sit(ids[1], carol, '01933333333')).status, 200);
      const third = await sit(ids[2], carol, '01933333333');
      assert.equal(third.json.code, 'PREMIUM_REQUIRED');
      // Opening an exam already started again does not count twice
      assert.equal((await sit(ids[0], carol, '01933333333')).status, 200);
      const left = await call('GET', '/api/live/weekly', { cookie: carol });
      assert.equal(left.json.access.left, 0);

      const users = await call('GET', '/api/admin/accounts/users?q=01933333333', { admin: 'test-admin-key' });
      const u = (users.json.users || []).find(x => x.phone === '01933333333');
      assert.equal((await call('POST', `/api/admin/accounts/users/${u.id}/grant`, { admin: 'test-admin-key', body: { days: 30 } })).status, 200);
      assert.equal((await sit(ids[2], carol, '01933333333')).status, 200);
    });

    await test('admin can move the weekly exam; it follows while nobody has registered', async () => {
      const r = await call('POST', '/api/live/admin/weekly', { admin: 'test-admin-key', body: { weekday: 6, hour: 20, minute: 30, targetCount: 2000 } });
      assert.equal(r.status, 200, JSON.stringify(r.json));
      const start = new Date(r.json.next.startAt);
      assert.equal(start.getUTCDay(), 6);
      assert.equal(`${start.getUTCHours()}:${start.getUTCMinutes()}`, '14:30');
      const w = await call('GET', '/api/live/weekly');
      assert.equal(w.json.exam.id, r.json.next.id);
      assert.equal(w.json.targetCount, 2000);
      assert.equal((await call('POST', '/api/live/admin/weekly', { admin: 'test-admin-key', body: { hour: 99 } })).status, 400);
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

// No SMS company set: orders are taken without OTP and confirmed on WhatsApp
async function noOtpTests() {
  const { base, child, dir } = await startServer({ SMS_PROVIDER: '' });
  const call = async (method, url, { body, admin } = {}) => {
    const res = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(admin ? { 'X-Admin-Key': admin } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, json: await res.json().catch(() => null) };
  };
  try {
    await test('without SMS, orders skip OTP and are confirmed on WhatsApp', async () => {
      const set = await call('POST', '/api/admin/accounts/settings', { admin: 'test-admin-key', body: { codWhatsapp: '+81 090 9726 1452' } });
      assert.equal(set.status, 200, JSON.stringify(set.json));
      const cfg = (await call('GET', '/api/cod/config')).json;
      assert.equal(cfg.otpReady, false);
      assert.equal(cfg.noOtp, true);
      const plan = cfg.plans[0];
      // The order says which exam's question set: required, one of the listed exams
      assert.ok(cfg.exams.some(x => x.id === 'ADMISSION_MED') && cfg.exams.some(x => x.id === 'BCS'));
      const noExam = await call('POST', '/api/cod/order', { body: { planId: plan.id, name: 'Rahim', phone: '01955555555', districtId: 'dhaka', area: 'Mirpur', address: 'House 1' } });
      assert.equal(noExam.json.code, 'BAD_EXAM');
      const ok = await call('POST', '/api/cod/order', { body: { planId: plan.id, exam: 'ADMISSION_MED', name: 'Rahim', phone: '01955555555', districtId: 'dhaka', area: 'Mirpur', address: 'House 1', geo: { lat: 23.81, lng: 90.41, accuracy: 30 } } });
      assert.equal(ok.status, 200, JSON.stringify(ok.json));
      assert.ok(ok.json.whatsappUrl.startsWith('https://wa.me/819097261452?text='), ok.json.whatsappUrl);
      assert.equal(ok.json.order.examBn, 'মেডিকেল ও ডেন্টাল ভর্তি');
      assert.ok(decodeURIComponent(ok.json.whatsappUrl).includes('মেডিকেল ও ডেন্টাল ভর্তি'));
      const byExam = await call('GET', '/api/admin/accounts/orders?status=ALL&exam=ADMISSION_MED', { admin: 'test-admin-key' });
      assert.ok(byExam.json.orders.length && byExam.json.orders.every(x => x.exam === 'ADMISSION_MED'));
      const otherExam = await call('GET', '/api/admin/accounts/orders?status=ALL&exam=NURSING', { admin: 'test-admin-key' });
      assert.ok(!otherExam.json.orders.some(x => x.id === ok.json.order.id));
      const pending = await call('GET', '/api/admin/accounts/orders?status=FAR', { admin: 'test-admin-key' });
      const o = pending.json.orders.find(x => x.id === ok.json.order.id);
      assert.ok(o && !o.phoneVerifiedAt && o.verifyBy === 'WHATSAPP');
      assert.equal((await call('POST', `/api/admin/accounts/orders/${o.id}/location-ok`, { admin: 'test-admin-key', body: {} })).status, 200);
      const after = await call('GET', '/api/admin/accounts/orders?status=FAR', { admin: 'test-admin-key' });
      assert.ok(!after.json.orders.some(x => x.id === o.id));
      // Without a WhatsApp number either, orders stay closed
      await call('POST', '/api/admin/accounts/settings', { admin: 'test-admin-key', body: { codWhatsapp: '' } });
      assert.equal((await call('GET', '/api/cod/config')).json.noOtp, false);
    });
  } finally {
    child.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

(async () => {
  await coreTests();
  await serverTests();
  await noOtpTests();
  const failed = results.filter(ok => !ok).length;
  console.log(`\n${results.length - failed}/${results.length} app tests passed`);
  if (failed) process.exit(1);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

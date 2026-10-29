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

async function startServer() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sh-test-'));
  const port = await freePort();
  const env = {
    ...process.env,
    PORT: String(port),
    ADMIN_KEY: 'test-admin-key',
    ACCOUNTS_DATA_FILE: path.join(dir, 'accounts.json'),
    LIVE_DATA_FILE: path.join(dir, 'live.json'),
    REPORTS_DATA_FILE: path.join(dir, 'reports.json'),
    PROGRESS_DATA_DIR: path.join(dir, 'progress')
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
      if (r.ok) return { base, child, dir };
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 100));
  }
  child.kill();
  throw new Error(`server did not start:\n${log}`);
}

async function serverTests() {
  console.log('\n--- SERVER ---');
  const { base, child, dir } = await startServer();
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

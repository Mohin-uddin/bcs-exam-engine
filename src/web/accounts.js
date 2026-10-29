/**
 * ============================================================================
 * Accounts, Premium Access & Manual bKash / Nagad / Rocket Payments
 * ============================================================================
 * - Users sign up with phone + password (same API for website and Android app)
 * - Session: random token in an HttpOnly cookie (website) or "Authorization: Bearer" (API)
 * - Payment (manual, phase 1): user sends money to the admin's bKash/Nagad/Rocket number,
 *   then submits sender number + TrxID. Admin checks the statement and approves in /admin.
 *   Approval extends premiumUntil by the plan's days.
 * - A TrxID can be used only once (pending or approved)
 * - Locked content never reaches the browser: /seed-data.js is built per request,
 *   free users get only the questions of the free sets
 * - Online payment (SSLCommerz / AamarPay, see payment-gateways.js): /api/payment/initiate
 *   creates the checkout, the gateway's success / IPN callback is verified with the
 *   gateway's validation API (status, amount, currency, tran_id) and then activatePayment()
 *   unlocks the account. Manual TrxID stays as a fallback that admin can switch off.
 * - State is saved to a JSON file, or Postgres (app_state table) when DATABASE_URL is set
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const gateways = require('./payment-gateways');
const { isAdmin } = require('./admin-auth');

const DATA_FILE = process.env.ACCOUNTS_DATA_FILE || path.join(__dirname, '..', '..', 'data', 'accounts.json');
const STORE_KEY = 'accounts';
const COOKIE = 'sh_sid';
const SESSION_DAYS = 60;
const DAY = 86400000;
// The Android app must not take payments for digital content (Play policy)
const APP_UA = /SonarHorinApp\//;

const DEFAULT_SETTINGS = {
  plans: [
    { id: 'monthly', nameBn: '১ মাস', price: 299, days: 30 },
    { id: 'half_year', nameBn: '৬ মাস', price: 999, days: 180 },
    { id: 'yearly', nameBn: '১ বছর', price: 1499, days: 365 }
  ],
  methods: [
    { id: 'bkash', nameBn: 'বিকাশ', number: '01XXXXXXXXX', accountType: 'Personal', enabled: true },
    { id: 'nagad', nameBn: 'নগদ', number: '01XXXXXXXXX', accountType: 'Personal', enabled: true },
    { id: 'rocket', nameBn: 'রকেট', number: '01XXXXXXXXXX', accountType: 'Personal', enabled: true }
  ],
  // In every exam type: this many model sets, past papers and subject sets stay free
  freePerGroup: 2,
  // Manual "Send Money + TrxID" option (admin approves). Online gateway is set with env variables.
  manualEnabled: true,
  noticeBn: 'টাকা পাঠানোর পর TrxID দিন। সাধারণত ১-৬ ঘণ্টার মধ্যে যাচাই করে প্রিমিয়াম চালু করা হয়।'
};

function createAccountsEngine({ store = null, seed, seedFile }) {
  let state = { users: [], sessions: [], payments: [], settings: null };
  let writeChain = Promise.resolve();

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------
  function normalizeState(s) {
    const out = s && typeof s === 'object' ? s : {};
    for (const k of ['users', 'sessions', 'payments']) if (!Array.isArray(out[k])) out[k] = [];
    out.settings = { ...DEFAULT_SETTINGS, ...(out.settings || {}) };
    return out;
  }

  if (!store) {
    try {
      if (fs.existsSync(DATA_FILE)) state = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
      console.error(`[accounts] Could not read ${DATA_FILE}: ${e.message}`);
    }
  }
  state = normalizeState(state);

  function saveNow() {
    const snapshot = JSON.parse(JSON.stringify(state));
    if (store) {
      writeChain = writeChain.then(() => store.set(STORE_KEY, snapshot))
        .catch(e => console.error(`[accounts] Could not save to database: ${e.message}`));
      return writeChain;
    }
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(snapshot));
    fs.renameSync(tmp, DATA_FILE);
    return Promise.resolve();
  }

  async function ready() {
    if (store) state = normalizeState(await store.get(STORE_KEY));
    rebuildBundles();
  }

  const flush = () => writeChain;

  // ---------------------------------------------------------------------------
  // Free / locked exam sets and the two seed-data bundles
  // ---------------------------------------------------------------------------
  const exams = seed.availableExams || [];
  const examIds = new Set(exams.map(e => e.id));
  let lockedExamIds = new Set();
  let bundles = { full: null, free: null, version: 0 };

  function groupOf(e) {
    if (/^SUPER_HOT_/.test(e.id)) return 'hot';
    if (/^SUBJ_/.test(e.id)) return 'subject';
    if (/(PRACTICE|MODEL)(_SET)?_\d+$/.test(e.id)) return 'model';
    return 'past';
  }

  function computeLocked() {
    const n = Math.max(0, Math.floor(Number(state.settings.freePerGroup) || 0));
    const seen = {};
    const locked = new Set();
    exams.forEach(e => {
      const g = groupOf(e);
      const key = `${e.examTrack}|${g}`;
      seen[key] = (seen[key] || 0) + 1;
      if (g === 'hot' || seen[key] > n) locked.add(e.id);
    });
    return locked;
  }

  // Exam ids used by the page code: 'BCS_46_SET', archive code 'BCS_46', 'NTRCA_MODEL_1_SET' ...
  function resolveExamId(id) {
    if (!id) return null;
    if (examIds.has(id)) return id;
    const base = String(id).replace(/_SET$/, '');
    if (examIds.has(base)) return base;
    if (examIds.has(`${base}_SET`)) return `${base}_SET`;
    return null;
  }

  function rebuildBundles() {
    lockedExamIds = computeLocked();
    const freeQ = new Set();
    exams.forEach(e => {
      if (!lockedExamIds.has(e.id)) (e.questionIds || []).forEach(id => freeQ.add(id));
    });
    const parts = ['/* Free bundle: questions of locked sets are only sent to premium accounts. */', '(function (global) {'];
    for (const [key, value] of Object.entries(seed)) {
      const v = key === 'sampleQuestions' ? value.filter(q => freeQ.has(q.id)) : value;
      parts.push(`  global.${key} = ${JSON.stringify(v)};`);
    }
    parts.push('})(window);');
    const version = bundles.version + 1;
    const lockedList = JSON.stringify([...lockedExamIds]);
    const access = premium => `\n;window.APP_ACCESS = ${JSON.stringify({ premium })};window.APP_ACCESS.lockedExamIds = ${lockedList};\n`;
    const full = Buffer.concat([fs.readFileSync(seedFile), Buffer.from(access(true))]);
    const free = Buffer.from(parts.join('\n') + access(false));
    bundles = {
      version,
      full,
      free,
      // ~5 MB of questions shrinks to ~0.7 MB: compress once here, not on every request
      fullGz: zlib.gzipSync(full, { level: 9 }),
      freeGz: zlib.gzipSync(free, { level: 9 }),
      // Content hashes for the versioned /seed-data.js?v=... URL (stay the same across restarts)
      fullHash: crypto.createHash('sha1').update(full).digest('hex').slice(0, 12),
      freeHash: crypto.createHash('sha1').update(free).digest('hex').slice(0, 12),
      freeQuestionIds: freeQ
    };
  }

  function seedVersion(req) {
    return isPremium(currentUser(req)) ? `full-${bundles.fullHash}` : `free-${bundles.freeHash}`;
  }

  function serveSeedBundle(req, res) {
    const premium = isPremium(currentUser(req));
    const gzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    let body = premium ? bundles.full : bundles.free;
    const etag = `"seed-${premium ? 'full' : 'free'}-${premium ? bundles.fullHash : bundles.freeHash}"`;
    // Pages link /seed-data.js?v=<seedVersion>, which changes with the content and the account's tier,
    // so such a URL can be kept by the browser without asking again.
    const versioned = new URL(req.url, 'http://x').searchParams.get('v') === seedVersion(req);
    const headers = {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': versioned ? 'private, max-age=31536000, immutable' : 'private, no-cache',
      Vary: 'Cookie, Authorization, Accept-Encoding',
      ETag: etag
    };
    if (gzip) {
      body = premium ? bundles.fullGz : bundles.freeGz;
      headers['Content-Encoding'] = 'gzip';
    }
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      return res.end();
    }
    res.writeHead(200, headers);
    res.end(body);
  }

  // For /api/exam/questions
  function visibleQuestions(req, all) {
    return isPremium(currentUser(req)) ? all : all.filter(q => bundles.freeQuestionIds.has(q.id));
  }

  // ---------------------------------------------------------------------------
  // Users & sessions
  // ---------------------------------------------------------------------------
  const newId = prefix => `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
  const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

  function normalizePhone(raw) {
    let p = String(raw || '').replace(/[^\d]/g, '');
    if (p.startsWith('880')) p = p.slice(2);
    return /^01[3-9]\d{8}$/.test(p) ? p : null;
  }

  function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
    return { salt, hash };
  }

  function checkPassword(user, password) {
    const { hash } = hashPassword(password, user.passSalt);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.passHash, 'hex'));
  }

  function parseCookies(req) {
    const out = {};
    String(req.headers.cookie || '').split(';').forEach(part => {
      const i = part.indexOf('=');
      if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    });
    return out;
  }

  function tokenOf(req) {
    const auth = String(req.headers.authorization || '');
    if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
    return parseCookies(req)[COOKIE] || null;
  }

  function currentUser(req) {
    const token = tokenOf(req);
    if (!token) return null;
    const h = sha256(token);
    const s = state.sessions.find(x => x.tokenHash === h);
    if (!s || Date.parse(s.expiresAt) < Date.now()) return null;
    return state.users.find(u => u.id === s.userId && !u.disabled) || null;
  }

  const isPremium = user => Boolean(user && user.premiumUntil && Date.parse(user.premiumUntil) > Date.now());

  function createSession(res, req, user) {
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    state.sessions = state.sessions.filter(s => Date.parse(s.expiresAt) > now);
    state.sessions.push({
      tokenHash: sha256(token),
      userId: user.id,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + SESSION_DAYS * DAY).toISOString()
    });
    setCookie(res, req, token, SESSION_DAYS * 86400);
    return token;
  }

  function setCookie(res, req, value, maxAge) {
    const secure = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
  }

  function publicUser(user) {
    if (!user) return null;
    const pending = state.payments.filter(p => p.userId === user.id && p.status === 'PENDING');
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      premium: isPremium(user),
      premiumUntil: user.premiumUntil || null,
      pendingPayments: pending.length,
      createdAt: user.createdAt
    };
  }

  // Simple brute-force guard for login: 10 tries per 15 min per phone and per IP
  const attempts = new Map();
  function tooManyAttempts(key, max = 10) {
    const now = Date.now();
    const list = (attempts.get(key) || []).filter(t => now - t < 15 * 60000);
    if (list.length) attempts.set(key, list);
    else attempts.delete(key);
    return list.length >= max;
  }
  // Forget old entries so the map does not grow forever
  setInterval(() => { [...attempts.keys()].forEach(k => tooManyAttempts(k)); }, 15 * 60000).unref();
  const noteAttempt = key => attempts.set(key, [...(attempts.get(key) || []), Date.now()]);
  // Nginx sets X-Real-IP. Otherwise the LAST X-Forwarded-For entry (added by our own proxy);
  // the first one can be typed by the client to dodge the limit.
  const clientIp = req => String(req.headers['x-real-ip'] || String(req.headers['x-forwarded-for'] || '').split(',').pop() || req.socket.remoteAddress || '').trim();

  // ---------------------------------------------------------------------------
  // Payments
  // ---------------------------------------------------------------------------
  const normalizeTrx = raw => String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  function publicPayment(p, withUser = false) {
    const out = {
      id: p.id,
      provider: p.provider,
      tranId: p.tranId || null,
      gatewayTxnId: p.gatewayTxnId || null,
      cardType: p.cardType || '',
      method: p.method,
      senderNumber: p.senderNumber,
      trxId: p.trxId,
      planId: p.planId,
      planNameBn: p.planNameBn,
      amount: p.amount,
      days: p.days,
      status: p.status,
      createdAt: p.createdAt,
      reviewedAt: p.reviewedAt || null,
      noteBn: p.noteBn || ''
    };
    if (withUser) {
      const u = state.users.find(x => x.id === p.userId);
      out.user = u ? { id: u.id, name: u.name, phone: u.phone, premiumUntil: u.premiumUntil || null } : null;
      out.duplicateSender = state.payments.filter(x => x.senderNumber === p.senderNumber && x.id !== p.id).length;
    }
    return out;
  }

  function extendPremium(user, days) {
    const base = Math.max(Date.now(), Date.parse(user.premiumUntil || 0) || 0);
    user.premiumUntil = new Date(base + days * DAY).toISOString();
  }

  // Shared by manual approval now and by a gateway IPN later
  function activatePayment(payment, reviewer = 'admin') {
    if (payment.status === 'APPROVED') return;
    const user = state.users.find(u => u.id === payment.userId);
    if (!user) throw new Error('User not found');
    payment.status = 'APPROVED';
    payment.reviewedAt = new Date().toISOString();
    payment.reviewedBy = reviewer;
    extendPremium(user, payment.days);
  }

  // ---------------------------------------------------------------------------
  // Online gateway
  // ---------------------------------------------------------------------------
  function baseUrl(req) {
    if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, '');
    const proto = String(req.headers['x-forwarded-proto'] || (req.socket.encrypted ? 'https' : 'http')).split(',')[0];
    return `${proto}://${req.headers.host}`;
  }

  // Verify with the gateway's own API and unlock. Safe to call many times (success + IPN).
  async function confirmGatewayPayment(cfg, payment, body) {
    if (payment.status === 'APPROVED') return true;
    const v = await gateways.verify(cfg, payment, body || {});
    payment.lastCheckAt = new Date().toISOString();
    payment.lastCheck = v.raw || { reason: v.reason };
    const amountOk = Number.isFinite(v.amount) && v.amount + 0.01 >= payment.amount;
    const currencyOk = !v.currency || String(v.currency).toUpperCase() === 'BDT';
    if (v.paid && amountOk && currencyOk) {
      payment.gatewayTxnId = v.gatewayTxnId || '';
      payment.cardType = v.cardType || '';
      payment.trxId = payment.gatewayTxnId || payment.tranId;
      if (payment.status === 'APPROVED') return true; // another callback finished first
      activatePayment(payment, 'gateway');
      await saveNow();
      return true;
    }
    if (v.paid && !amountOk) payment.noteBn = `টাকার পরিমাণ মেলেনি (পেয়েছি ৳${v.amount})`;
    await saveNow();
    return false;
  }

  function safeReturn(path) {
    const p = String(path || '/');
    return p.startsWith('/') && !p.startsWith('//') ? p.slice(0, 200) : '/';
  }

  function redirectAfterPayment(res, payment, result) {
    const ret = safeReturn(payment && payment.returnTo);
    const [pathPart, hash = ''] = ret.split('#');
    const sep = pathPart.includes('?') ? '&' : '?';
    res.writeHead(303, { Location: `${pathPart}${sep}payment=${result}${hash ? `#${hash}` : ''}`, 'Cache-Control': 'no-store' });
    res.end();
    return true;
  }

  // ---------------------------------------------------------------------------
  // HTTP plumbing
  // ---------------------------------------------------------------------------
  function send(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  }
  const fail = (res, status, code, messageBn) => (send(res, status, { status: 'ERROR', code, messageBn }), true);

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 1e5) req.destroy();
      });
      req.on('end', () => {
        try {
          if (!body) return resolve({});
          if (/application\/x-www-form-urlencoded/.test(req.headers['content-type'] || '')) {
            return resolve(Object.fromEntries(new URLSearchParams(body)));
          }
          resolve(JSON.parse(body));
        } catch (e) { reject(e); }
      });
    });
  }

  function publicConfig() {
    const s = state.settings;
    const gw = gateways.gatewayConfig();
    return {
      gateway: gw && !gw.error ? { provider: gw.provider, sandbox: gw.sandbox } : null,
      manualEnabled: s.manualEnabled !== false,
      plans: s.plans,
      methods: s.methods.filter(m => m.enabled !== false).map(m => ({ id: m.id, nameBn: m.nameBn, number: m.number, accountType: m.accountType })),
      noticeBn: s.noticeBn,
      freePerGroup: s.freePerGroup
    };
  }

  // ---------------------------------------------------------------------------
  // Routes: /api/auth/*, /api/payment/*, /api/admin/accounts/*
  // Returns true when it handled the request.
  // ---------------------------------------------------------------------------
  async function handle(req, res, pathname, searchParams) {
    if (!/^\/api\/(auth|payment|admin\/accounts)\//.test(pathname)) return false;
    const method = req.method;
    let body = {};
    if (method === 'POST') {
      try { body = await readBody(req); } catch { return fail(res, 400, 'BAD_JSON', 'অনুরোধটি সঠিক নয়।'); }
    }
    const user = currentUser(req);

    // ---------------- Auth ----------------
    if (pathname === '/api/auth/register' && method === 'POST') {
      const ip = clientIp(req);
      if (tooManyAttempts(`r:${ip}`, 30)) return fail(res, 429, 'TOO_MANY', 'অনেকবার চেষ্টা হয়েছে। ১৫ মিনিট পর আবার চেষ্টা করুন।');
      noteAttempt(`r:${ip}`);
      const name = String(body.name || '').trim().slice(0, 80);
      const phone = normalizePhone(body.phone);
      const password = String(body.password || '');
      if (name.length < 2) return fail(res, 400, 'BAD_NAME', 'আপনার নাম লিখুন।');
      if (!phone) return fail(res, 400, 'BAD_PHONE', 'সঠিক মোবাইল নম্বর দিন (যেমন ০১৭XXXXXXXX)।');
      if (password.length < 6) return fail(res, 400, 'BAD_PASSWORD', 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের দিন।');
      if (state.users.some(u => u.phone === phone)) return fail(res, 409, 'PHONE_TAKEN', 'এই নম্বরে আগেই অ্যাকাউন্ট আছে। লগইন করুন।');
      const { salt, hash } = hashPassword(password);
      const u = { id: newId('usr'), name, phone, passSalt: salt, passHash: hash, premiumUntil: null, createdAt: new Date().toISOString() };
      state.users.push(u);
      const token = createSession(res, req, u);
      await saveNow();
      send(res, 200, { status: 'SUCCESS', token, user: publicUser(u) });
      return true;
    }

    if (pathname === '/api/auth/login' && method === 'POST') {
      const phone = normalizePhone(body.phone);
      const ip = clientIp(req);
      if (tooManyAttempts(`p:${phone}`) || tooManyAttempts(`i:${ip}`)) {
        return fail(res, 429, 'TOO_MANY', 'অনেকবার ভুল চেষ্টা হয়েছে। ১৫ মিনিট পর আবার চেষ্টা করুন।');
      }
      const u = phone && state.users.find(x => x.phone === phone);
      if (!u || u.disabled || !checkPassword(u, body.password || '')) {
        noteAttempt(`p:${phone}`);
        noteAttempt(`i:${ip}`);
        return fail(res, 401, 'BAD_LOGIN', 'মোবাইল নম্বর বা পাসওয়ার্ড সঠিক নয়।');
      }
      const token = createSession(res, req, u);
      await saveNow();
      send(res, 200, { status: 'SUCCESS', token, user: publicUser(u) });
      return true;
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
      const token = tokenOf(req);
      if (token) {
        const h = sha256(token);
        state.sessions = state.sessions.filter(s => s.tokenHash !== h);
        await saveNow();
      }
      setCookie(res, req, '', 0);
      send(res, 200, { status: 'SUCCESS' });
      return true;
    }

    if (pathname === '/api/auth/me' && method === 'GET') {
      send(res, 200, { status: 'SUCCESS', user: publicUser(user), lockedExamIds: [...lockedExamIds] });
      return true;
    }

    // ---------------- Payment (user) ----------------
    if (pathname === '/api/payment/config' && method === 'GET') {
      send(res, 200, { status: 'SUCCESS', ...publicConfig() });
      return true;
    }

    if (pathname === '/api/payment/mine' && method === 'GET') {
      if (!user) return fail(res, 401, 'LOGIN_REQUIRED', 'আগে লগইন করুন।');
      send(res, 200, {
        status: 'SUCCESS',
        user: publicUser(user),
        payments: state.payments.filter(p => p.userId === user.id).map(p => publicPayment(p)).reverse()
      });
      return true;
    }

    // Online gateway checkout: returns the gateway page URL for the browser
    if (pathname === '/api/payment/initiate' && method === 'POST') {
      if (APP_UA.test(req.headers['user-agent'] || '')) {
        return fail(res, 403, 'USE_WEBSITE', 'অ্যাপে পেমেন্ট নেওয়া হয় না। ওয়েবসাইটে লগইন করে আনলক করুন।');
      }
      if (!user) return fail(res, 401, 'LOGIN_REQUIRED', 'আগে লগইন করুন।');
      const cfg = gateways.gatewayConfig();
      if (!cfg) return fail(res, 503, 'NO_GATEWAY', 'অনলাইন পেমেন্ট এখনো চালু হয়নি।');
      if (cfg.error) {
        console.error(`[payment] ${cfg.error}`);
        return fail(res, 503, 'GATEWAY_CONFIG', 'অনলাইন পেমেন্ট এখন বন্ধ আছে, একটু পরে চেষ্টা করুন।');
      }
      const plan = state.settings.plans.find(p => p.id === body.planId);
      if (!plan) return fail(res, 400, 'BAD_PLAN', 'প্যাকেজ বাছাই করুন।');
      const payment = {
        id: newId('pay'),
        provider: cfg.provider.toUpperCase(),
        sandbox: cfg.sandbox,
        tranId: `SH${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        userId: user.id,
        method: 'online',
        senderNumber: user.phone,
        trxId: '',
        planId: plan.id,
        planNameBn: plan.nameBn,
        amount: plan.price,
        days: plan.days,
        status: 'INITIATED',
        returnTo: safeReturn(body.returnTo),
        createdAt: new Date().toISOString()
      };
      const base = baseUrl(req);
      const cb = `${base}/api/payment/gw/${cfg.provider}`;
      try {
        const session = await gateways.init(cfg, payment, user, {
          success: `${cb}/success`, fail: `${cb}/fail`, cancel: `${cb}/cancel`, ipn: `${cb}/ipn`
        });
        payment.sessionKey = session.sessionKey;
        state.payments.push(payment);
        await saveNow();
        send(res, 200, { status: 'SUCCESS', url: session.url, tranId: payment.tranId });
      } catch (e) {
        console.error('[payment] gateway init failed:', e.message);
        fail(res, 502, 'GATEWAY_ERROR', 'পেমেন্ট গেটওয়ের সাথে যোগাযোগ করা যায়নি। একটু পরে আবার চেষ্টা করুন।');
      }
      return true;
    }

    // Gateway callbacks: browser redirect (success / fail / cancel) and server-to-server IPN
    const gwm = pathname.match(/^\/api\/payment\/gw\/(sslcommerz|aamarpay)\/(success|fail|cancel|ipn)$/);
    if (gwm && (method === 'POST' || method === 'GET')) {
      const [, provider, kind] = gwm;
      const data = method === 'POST' ? body : Object.fromEntries(searchParams);
      const cfg = gateways.gatewayConfig();
      const tranId = gateways.tranIdOf(provider, data);
      const payment = tranId && state.payments.find(p => p.tranId === tranId && p.provider === provider.toUpperCase());
      if (!cfg || cfg.error || cfg.provider !== provider || !payment) {
        if (kind === 'ipn') return fail(res, 400, 'UNKNOWN', 'Unknown transaction');
        return redirectAfterPayment(res, payment, 'failed');
      }
      if (kind === 'success' || kind === 'ipn') {
        let ok = false;
        try {
          ok = await confirmGatewayPayment(cfg, payment, data);
        } catch (e) {
          console.error('[payment] verify failed:', e.message);
        }
        if (kind === 'ipn') {
          send(res, 200, { status: ok ? 'OK' : 'NOT_VALID' });
          return true;
        }
        // Validation API can lag a moment behind the redirect; the page keeps checking
        return redirectAfterPayment(res, payment, ok ? 'success' : 'success_pending');
      }
      if (payment.status === 'INITIATED') {
        payment.status = kind === 'cancel' ? 'CANCELLED' : 'FAILED';
        payment.reviewedAt = new Date().toISOString();
        await saveNow();
      }
      return redirectAfterPayment(res, payment, kind === 'cancel' ? 'cancelled' : 'failed');
    }

    if (pathname === '/api/payment/submit' && method === 'POST') {
      if (state.settings.manualEnabled === false) return fail(res, 403, 'MANUAL_OFF', 'এখন শুধু অনলাইনে পেমেন্ট নেওয়া হয়।');
      if (APP_UA.test(req.headers['user-agent'] || '')) {
        return fail(res, 403, 'USE_WEBSITE', 'অ্যাপে পেমেন্ট নেওয়া হয় না। ওয়েবসাইটে লগইন করে আনলক করুন।');
      }
      if (!user) return fail(res, 401, 'LOGIN_REQUIRED', 'আগে লগইন করুন।');
      const s = state.settings;
      const plan = s.plans.find(p => p.id === body.planId);
      const m = s.methods.find(x => x.id === body.method && x.enabled !== false);
      const sender = normalizePhone(body.senderNumber) || String(body.senderNumber || '').replace(/[^\d]/g, '');
      const trxId = normalizeTrx(body.trxId);
      if (!plan) return fail(res, 400, 'BAD_PLAN', 'প্যাকেজ বাছাই করুন।');
      if (!m) return fail(res, 400, 'BAD_METHOD', 'বিকাশ / নগদ / রকেট বাছাই করুন।');
      if (!/^\d{11,12}$/.test(sender)) return fail(res, 400, 'BAD_SENDER', 'যে নম্বর থেকে টাকা পাঠিয়েছেন সেটি দিন (১১ ডিজিট)।');
      if (!/^[A-Z0-9]{6,20}$/.test(trxId)) return fail(res, 400, 'BAD_TRX', 'সঠিক TrxID দিন (SMS এ পাবেন, যেমন 9F7A2BC4XD)।');
      if (state.payments.some(p => p.trxId === trxId && p.status !== 'REJECTED')) {
        return fail(res, 409, 'TRX_USED', 'এই TrxID দিয়ে আগেই পেমেন্ট জমা হয়েছে।');
      }
      if (state.payments.filter(p => p.userId === user.id && p.status === 'PENDING').length >= 3) {
        return fail(res, 429, 'TOO_MANY_PENDING', 'আপনার ৩টি পেমেন্ট যাচাইয়ের অপেক্ষায় আছে। একটু অপেক্ষা করুন।');
      }
      const payment = {
        id: newId('pay'),
        provider: 'MANUAL',
        userId: user.id,
        method: m.id,
        toNumber: m.number,
        senderNumber: sender,
        trxId,
        planId: plan.id,
        planNameBn: plan.nameBn,
        amount: plan.price,
        days: plan.days,
        status: 'PENDING',
        createdAt: new Date().toISOString()
      };
      state.payments.push(payment);
      await saveNow();
      send(res, 200, { status: 'SUCCESS', payment: publicPayment(payment), user: publicUser(user) });
      return true;
    }

    // ---------------- Admin ----------------
    if (pathname.startsWith('/api/admin/accounts/')) {
      if (!isAdmin(req)) return fail(res, 401, 'ADMIN_ONLY', 'অ্যাডমিন কী সঠিক নয়।');

      if (pathname === '/api/admin/accounts/payments' && method === 'GET') {
        const status = searchParams.get('status') || 'PENDING';
        const list = state.payments.filter(p => status === 'ALL' || p.status === status).slice(-300).reverse();
        send(res, 200, {
          status: 'SUCCESS',
          counts: {
            PENDING: state.payments.filter(p => p.status === 'PENDING').length,
            APPROVED: state.payments.filter(p => p.status === 'APPROVED').length,
            REJECTED: state.payments.filter(p => p.status === 'REJECTED').length,
            ONLINE: state.payments.filter(p => p.provider !== 'MANUAL' && p.status === 'APPROVED').length
          },
          payments: list.map(p => publicPayment(p, true))
        });
        return true;
      }

      let mm = pathname.match(/^\/api\/admin\/accounts\/payments\/([\w-]+)\/recheck$/);
      if (mm && method === 'POST') {
        const p = state.payments.find(x => x.id === mm[1]);
        const cfg = gateways.gatewayConfig();
        if (!p || p.provider === 'MANUAL') return fail(res, 404, 'NOT_FOUND', 'অনলাইন পেমেন্ট পাওয়া যায়নি।');
        if (!cfg || cfg.error || cfg.provider.toUpperCase() !== p.provider) return fail(res, 400, 'NO_GATEWAY', 'এই গেটওয়ে এখন চালু নেই।');
        try {
          await confirmGatewayPayment(cfg, p, {});
        } catch (e) {
          return fail(res, 502, 'GATEWAY_ERROR', `গেটওয়ে থেকে উত্তর পাওয়া যায়নি: ${e.message}`);
        }
        send(res, 200, { status: 'SUCCESS', payment: publicPayment(p, true) });
        return true;
      }

      mm = pathname.match(/^\/api\/admin\/accounts\/payments\/([\w-]+)\/(approve|reject)$/);
      if (mm && method === 'POST') {
        const p = state.payments.find(x => x.id === mm[1]);
        if (!p) return fail(res, 404, 'NOT_FOUND', 'পেমেন্ট পাওয়া যায়নি।');
        if (p.status !== 'PENDING' || p.provider !== 'MANUAL') return fail(res, 409, 'NOT_PENDING', 'এই পেমেন্ট আগেই যাচাই করা হয়েছে।');
        if (mm[2] === 'approve') {
          activatePayment(p);
        } else {
          p.status = 'REJECTED';
          p.reviewedAt = new Date().toISOString();
          p.noteBn = String(body.noteBn || 'TrxID বা টাকার পরিমাণ মেলেনি।').slice(0, 300);
        }
        await saveNow();
        send(res, 200, { status: 'SUCCESS', payment: publicPayment(p, true) });
        return true;
      }

      if (pathname === '/api/admin/accounts/users' && method === 'GET') {
        const q = String(searchParams.get('q') || '').trim();
        const list = state.users
          .filter(u => !q || u.phone.includes(q.replace(/[^\d]/g, '') || '#') || u.name.toLowerCase().includes(q.toLowerCase()))
          .slice(-200).reverse();
        send(res, 200, { status: 'SUCCESS', totalUsers: state.users.length, premiumUsers: state.users.filter(isPremium).length, users: list.map(publicUser) });
        return true;
      }

      // Forgotten password: admin sets a new one (the user's other logins are signed out)
      mm = pathname.match(/^\/api\/admin\/accounts\/users\/([\w-]+)\/password$/);
      if (mm && method === 'POST') {
        const u = state.users.find(x => x.id === mm[1]);
        if (!u) return fail(res, 404, 'NOT_FOUND', 'ইউজার পাওয়া যায়নি।');
        const password = String(body.password || '');
        if (password.length < 6) return fail(res, 400, 'BAD_PASSWORD', 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের দিন।');
        const { salt, hash } = hashPassword(password);
        u.passSalt = salt;
        u.passHash = hash;
        state.sessions = state.sessions.filter(s => s.userId !== u.id);
        await saveNow();
        send(res, 200, { status: 'SUCCESS', user: publicUser(u) });
        return true;
      }

      mm = pathname.match(/^\/api\/admin\/accounts\/users\/([\w-]+)\/(grant|revoke)$/);
      if (mm && method === 'POST') {
        const u = state.users.find(x => x.id === mm[1]);
        if (!u) return fail(res, 404, 'NOT_FOUND', 'ইউজার পাওয়া যায়নি।');
        if (mm[2] === 'grant') {
          const days = Math.round(Number(body.days) || 0);
          if (days < 1 || days > 3650) return fail(res, 400, 'BAD_DAYS', '১ থেকে ৩৬৫০ দিনের মধ্যে দিন।');
          extendPremium(u, days);
        } else {
          u.premiumUntil = null;
        }
        await saveNow();
        send(res, 200, { status: 'SUCCESS', user: publicUser(u) });
        return true;
      }

      if (pathname === '/api/admin/accounts/settings' && method === 'GET') {
        const gw = gateways.gatewayConfig();
        send(res, 200, {
          status: 'SUCCESS', settings: state.settings, lockedCount: lockedExamIds.size, totalExams: exams.length,
          gateway: gw ? { provider: gw.provider, sandbox: gw.sandbox, error: gw.error || null } : null
        });
        return true;
      }

      if (pathname === '/api/admin/accounts/settings' && method === 'POST') {
        const s = state.settings;
        if (Array.isArray(body.plans)) {
          const plans = body.plans.map(p => ({
            id: String(p.id || '').replace(/[^\w-]/g, '').slice(0, 30),
            nameBn: String(p.nameBn || '').trim().slice(0, 40),
            price: Math.round(Number(p.price)),
            days: Math.round(Number(p.days))
          }));
          if (!plans.length || plans.some(p => !p.id || !p.nameBn || !(p.price > 0) || !(p.days > 0))) {
            return fail(res, 400, 'BAD_PLANS', 'প্রতিটি প্যাকেজের নাম, দাম ও দিন সঠিকভাবে দিন।');
          }
          s.plans = plans;
        }
        if (Array.isArray(body.methods)) {
          s.methods = s.methods.map(m => {
            const n = body.methods.find(x => x.id === m.id) || {};
            return {
              ...m,
              number: n.number !== undefined ? String(n.number).replace(/[^\dX]/gi, '').slice(0, 14) : m.number,
              accountType: ['Personal', 'Agent', 'Merchant'].includes(n.accountType) ? n.accountType : m.accountType,
              enabled: n.enabled !== undefined ? Boolean(n.enabled) : m.enabled
            };
          });
        }
        if (body.freePerGroup !== undefined) {
          const n = Math.round(Number(body.freePerGroup));
          if (!(n >= 0 && n <= 20)) return fail(res, 400, 'BAD_FREE', 'ফ্রি সেট সংখ্যা ০ থেকে ২০ এর মধ্যে দিন।');
          s.freePerGroup = n;
        }
        if (body.noticeBn !== undefined) s.noticeBn = String(body.noticeBn).slice(0, 500);
        if (body.manualEnabled !== undefined) s.manualEnabled = Boolean(body.manualEnabled);
        rebuildBundles();
        await saveNow();
        send(res, 200, { status: 'SUCCESS', settings: s, lockedCount: lockedExamIds.size, totalExams: exams.length });
        return true;
      }

      return fail(res, 404, 'NOT_FOUND', 'রুট পাওয়া যায়নি।');
    }

    return fail(res, 404, 'NOT_FOUND', 'রুট পাওয়া যায়নি।');
  }

  return {
    handle,
    ready,
    flush,
    serveSeedBundle,
    seedVersion,
    visibleQuestions,
    currentUser,
    isPremium,
    resolveExamId,
    activatePayment,
    isLocked: id => lockedExamIds.has(resolveExamId(id)),
    _state: () => state
  };
}

module.exports = { createAccountsEngine, DEFAULT_SETTINGS };

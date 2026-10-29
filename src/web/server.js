#!/usr/bin/env node
/**
 * ============================================================================
 * সোনার হরিণ (Sonar Horin) - BCS & BD Competitive Exam Prep - Web Application Server
 * ============================================================================
 * - Question data (/seed-data.js): free sets for everyone, all sets for premium accounts
 * - Accounts, premium lock & payments (accounts.js, payment-gateways.js)
 * - Live scheduled exams with merit list (live-exam.js)
 * - Study progress sync: Mistake Vault, bookmarks, SM-2 flashcards, exam history (progress.js)
 * - Question reports for the admin (reports.js)
 * Practice exams, OMR photo reading and SM-2 scheduling run in the browser.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const {
  sampleQuestions,
  availableExams,
  bcs20YearsArchive,
  primaryExamsArchive,
  primaryPracticeSets,
  ntrcaExamsArchive,
  bankExamsArchive,
  ministryExamsArchive,
  nonCadreExamsArchive
} = require('./seed-data');
const { createLiveExamEngine } = require('./live-exam');
const { createStateStore } = require('./state-store');
const { createAccountsEngine } = require('./accounts');
const { createProgressEngine } = require('./progress');
const { createReportsEngine } = require('./reports');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const stateStore = createStateStore();

// Accounts, premium lock & manual bKash / Nagad / Rocket payments (admin approves in /admin)
const accounts = createAccountsEngine({
  store: stateStore,
  seed: require('./seed-data'),
  seedFile: path.join(__dirname, 'seed-data.js')
});

// Live scheduled exams & merit list (admin announces, candidates join at the set time)
const liveExams = createLiveExamEngine({
  availableExams,
  sampleQuestions,
  store: stateStore,
  currentUser: accounts.currentUser
});

// Study progress sync (Mistake Vault, bookmarks, flashcards, exam history) per account
const progress = createProgressEngine({ store: stateStore, currentUser: accounts.currentUser });

// Question reports (ভুল রিপোর্ট) -> admin panel
const reports = createReportsEngine({
  store: stateStore,
  questionById: new Map(sampleQuestions.map(q => [q.id, q])),
  currentUser: accounts.currentUser
});

// Helper: Send JSON Response
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

// Helper: Serve Static File (gzip-compressed copies are kept in memory until the file changes)
const staticCache = new Map();
function serveStatic(req, res, filePath, contentType) {
  fs.stat(filePath, (statErr, st) => {
    if (statErr) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('File Not Found');
    }
    let hit = staticCache.get(filePath);
    if (!hit || hit.mtime !== st.mtimeMs) {
      const raw = fs.readFileSync(filePath);
      hit = { mtime: st.mtimeMs, raw, gz: zlib.gzipSync(raw, { level: 9 }), etag: `"${st.size.toString(36)}-${Math.round(st.mtimeMs).toString(36)}"` };
      staticCache.set(filePath, hit);
    }
    // Pages link files as /app.js?v=<etag>: such a URL changes whenever the file does, so it can be kept for good
    const versioned = new URL(req.url, 'http://x').searchParams.get('v') === hit.etag.slice(1, -1);
    const cache = versioned ? 'public, max-age=31536000, immutable' : 'no-cache';
    const headers = { 'Content-Type': contentType, 'Cache-Control': cache, ETag: hit.etag, Vary: 'Accept-Encoding' };
    if (req.headers['if-none-match'] === hit.etag) {
      res.writeHead(304, headers);
      return res.end();
    }
    const gzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    if (gzip) headers['Content-Encoding'] = 'gzip';
    res.writeHead(200, headers);
    res.end(gzip ? hit.gz : hit.raw);
  });
}

// Version tag of a public file (its ETag without quotes), for the ?v= links in pages
function assetVersion(name) {
  const filePath = path.join(PUBLIC_DIR, name);
  try {
    const st = fs.statSync(filePath);
    return `${st.size.toString(36)}-${Math.round(st.mtimeMs).toString(36)}`;
  } catch {
    return null;
  }
}

// Helper: Serve an HTML page with ?v= added to its own scripts, styles and the seed bundle,
// so the browser loads them from its cache on later visits instead of asking the server each time
function servePage(req, res, filePath) {
  fs.readFile(filePath, 'utf8', (err, html) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('File Not Found');
    }
    const out = Buffer.from(html.replace(/(src|href)="\/([\w.-]+\.(?:js|css|svg))"/g, (m, attr, name) => {
      const v = name === 'seed-data.js' ? accounts.seedVersion(req) : PUBLIC_FILES[`/${name}`] && assetVersion(name);
      return v ? `${attr}="/${name}?v=${v}"` : m;
    }));
    const etag = `"p-${crypto.createHash('sha1').update(out).digest('hex').slice(0, 16)}"`;
    const headers = {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
      ETag: etag,
      Vary: 'Accept-Encoding, Cookie, Authorization'
    };
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      return res.end();
    }
    const gzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    if (gzip) headers['Content-Encoding'] = 'gzip';
    res.writeHead(200, headers);
    res.end(gzip ? zlib.gzipSync(out) : out);
  });
}

// Files in public/ that are served as they are
const PUBLIC_FILES = {
  '/app.css': 'text/css; charset=utf-8',
  '/exam-hall.css': 'text/css; charset=utf-8',
  '/live.css': 'text/css; charset=utf-8',
  '/app.js': 'application/javascript; charset=utf-8',
  '/study.js': 'application/javascript; charset=utf-8',
  '/progress-core.js': 'application/javascript; charset=utf-8',
  '/exam-hall.js': 'application/javascript; charset=utf-8',
  '/live.js': 'application/javascript; charset=utf-8',
  '/admin.js': 'application/javascript; charset=utf-8',
  '/admin-reports.js': 'application/javascript; charset=utf-8',
  '/account.js': 'application/javascript; charset=utf-8',
  '/admin-payments.js': 'application/javascript; charset=utf-8',
  '/native-app.js': 'application/javascript; charset=utf-8',
  '/logo.svg': 'image/svg+xml'
};
const PAGES = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/dashboard': 'index.html',
  '/exam-hall': 'exam-hall.html',
  '/live': 'live.html',
  '/admin': 'admin.html',
  '/omr-printable': 'omr-sheet.html'
};

// Create HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Browser hardening for every response
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // ---------------------------------------------------------------------------
  // API ROUTING
  // ---------------------------------------------------------------------------

  // 0. Live scheduled exams, results & merit list (/api/live/...)
  if (pathname.startsWith('/api/live/')) {
    try {
      if (await liveExams.handle(req, res, pathname, parsedUrl.searchParams)) return;
    } catch (e) {
      console.error('[live-exam]', e);
      return sendJson(res, 500, { status: 'ERROR', messageBn: 'সার্ভারে সমস্যা হয়েছে, আবার চেষ্টা করুন।' });
    }
  }

  // 0b. Accounts, premium access & payments (/api/auth/..., /api/payment/..., /api/admin/accounts/...)
  if (/^\/api\/(auth|payment|admin\/accounts)\//.test(pathname)) {
    try {
      if (await accounts.handle(req, res, pathname, parsedUrl.searchParams)) return;
    } catch (e) {
      console.error('[accounts]', e);
      return sendJson(res, 500, { status: 'ERROR', messageBn: 'সার্ভারে সমস্যা হয়েছে, আবার চেষ্টা করুন।' });
    }
  }

  // 0c. Study progress sync and question reports
  if (pathname === '/api/progress' || pathname === '/api/reports' || pathname.startsWith('/api/admin/reports')) {
    try {
      if (await progress.handle(req, res, pathname)) return;
      if (await reports.handle(req, res, pathname, parsedUrl.searchParams)) return;
    } catch (e) {
      console.error('[progress/reports]', e);
      return sendJson(res, 500, { status: 'ERROR', messageBn: 'সার্ভারে সমস্যা হয়েছে, আবার চেষ্টা করুন।' });
    }
  }

  // 1. Get Exam Questions (free accounts get only the free sets' questions)
  if (pathname === '/api/exam/questions' && method === 'GET') {
    const visible = accounts.visibleQuestions(req, sampleQuestions);
    return sendJson(res, 200, {
      status: 'SUCCESS',
      totalQuestions: visible.length,
      questions: visible
    });
  }

  // 1b. Get Available Exam Packs (Year-wise / Category-wise)
  if (pathname === '/api/exams' && method === 'GET') {
    return sendJson(res, 200, {
      status: 'SUCCESS',
      totalExams: (availableExams || []).length,
      exams: availableExams || []
    });
  }

  // 1c. Get 20-Year BCS Exam History Archive
  if (pathname === '/api/bcs/archives' && method === 'GET') {
    return sendJson(res, 200, {
      status: 'SUCCESS',
      totalArchives: (bcs20YearsArchive || []).length,
      archives: bcs20YearsArchive || []
    });
  }

  // 1d. Get Primary School Assistant Teacher Exam Archive & Practice Sets
  if (pathname === '/api/primary/archives' && method === 'GET') {
    return sendJson(res, 200, {
      status: 'SUCCESS',
      totalArchives: (primaryExamsArchive || []).length,
      archives: primaryExamsArchive || [],
      practiceSets: primaryPracticeSets || []
    });
  }

  // 1e. Get All Other Mega Govt Exam Sector Archives (NTRCA, Bank, Ministry, Non-Cadre)
  if (pathname === '/api/sectors/archives' && method === 'GET') {
    return sendJson(res, 200, {
      status: 'SUCCESS',
      ntrca: ntrcaExamsArchive || [],
      bank: bankExamsArchive || [],
      ministry: ministryExamsArchive || [],
      nonCadre: nonCadreExamsArchive || []
    });
  }

  // 2. OMR scan: photos are read in the browser (app.js omrReadSheet); never return made-up scores
  if (pathname === '/api/omr/scan' && method === 'POST') {
    return sendJson(res, 400, {
      status: 'ERROR',
      message: 'উত্তরপত্রের ছবি অ্যাপের "উত্তরপত্র স্ক্যান করে ফলাফল" অংশে দিন। ছবি ছাড়া ফলাফল দেওয়া হয় না।'
    });
  }

  // ---------------------------------------------------------------------------
  // STATIC ASSETS & HTML VIEWS
  // ---------------------------------------------------------------------------
  if (method === 'GET' && PAGES[pathname]) {
    return servePage(req, res, path.join(PUBLIC_DIR, PAGES[pathname]));
  }

  if (method === 'GET' && PUBLIC_FILES[pathname]) {
    return serveStatic(req, res, path.join(PUBLIC_DIR, pathname.slice(1)), PUBLIC_FILES[pathname]);
  }

  // Privacy policy (needed for the Play Store listing). Contact email comes from CONTACT_EMAIL.
  if (pathname === '/privacy') {
    return fs.readFile(path.join(PUBLIC_DIR, 'privacy.html'), 'utf8', (err, html) => {
      if (err) return sendJson(res, 500, { status: 'ERROR', message: 'Privacy page missing' });
      const email = (process.env.CONTACT_EMAIL || 'support@example.com').replace(/[<>"&]/g, '');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html.replaceAll('{{CONTACT_EMAIL}}', email));
    });
  }

  // Question data: full for premium accounts, free sets only for everyone else
  if (pathname === '/seed-data.js') {
    return accounts.serveSeedBundle(req, res);
  }

  // Fallback 404
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Route Not Found');
});

// Start Server (after saved data is loaded from the database, if any)
Promise.all([liveExams.ready(), accounts.ready(), reports.ready()]).then(() => server.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`সোনার হরিণ - BCS & BD Competitive Exam Prep`);
  console.log(`Web App running locally at: http://localhost:${PORT}`);
  console.log(`Printable 2-Column Booklet & OMR: http://localhost:${PORT}/omr-printable`);
  console.log(`Live Exams & Merit List: http://localhost:${PORT}/live  (Admin: /admin)`);
  console.log(`================================================================`);
}), err => {
  console.error(`Could not load saved data from the database: ${err.message}`);
  process.exit(1);
});

// Hosting stops the server with SIGTERM on every deploy: save pending data first
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    Promise.all([liveExams.flush(), accounts.flush(), reports.flush()]).finally(() => process.exit(0));
  });
}

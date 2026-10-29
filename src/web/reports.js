/**
 * ============================================================================
 * Question reports (ভুল রিপোর্ট): candidates flag a wrong answer, typo or outdated fact,
 * the admin sees them in /admin and marks them done.
 * ============================================================================
 * - POST /api/reports                         { questionId, reason, comment }
 * - GET  /api/admin/reports?status=OPEN|DONE|ALL   (X-Admin-Key)
 * - POST /api/admin/reports/<id>/done         (X-Admin-Key)
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { isAdmin } = require('./admin-auth');

const DATA_FILE = process.env.REPORTS_DATA_FILE || path.join(__dirname, '..', '..', 'data', 'question-reports.json');
const STORE_KEY = 'question-reports';
const MAX_REPORTS = 3000;
const REASONS = { PSC_CONFLICT: 'উত্তরে মতভেদ', WRONG_ANSWER: 'উত্তর ভুল', TYPO: 'বানান / টাইপিং ভুল', OUTDATED_DATA: 'তথ্য পুরোনো', WRONG_EXPLANATION: 'ব্যাখ্যায় ভুল' };

function createReportsEngine({ store = null, questionById, currentUser = () => null }) {
  let reports = [];
  let writeChain = Promise.resolve();
  const recent = new Map(); // ip -> timestamps, max 20 reports per hour

  if (!store) {
    try {
      if (fs.existsSync(DATA_FILE)) reports = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) || [];
    } catch (e) {
      console.error(`[reports] Could not read ${DATA_FILE}: ${e.message}`);
    }
  }

  async function ready() {
    if (store) reports = (await store.get(STORE_KEY)) || [];
    if (!Array.isArray(reports)) reports = [];
  }

  function saveNow() {
    const snapshot = reports.slice(-MAX_REPORTS);
    reports = snapshot;
    if (store) {
      writeChain = writeChain.then(() => store.set(STORE_KEY, snapshot)).catch(e => console.error(`[reports] ${e.message}`));
      return writeChain;
    }
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(`${DATA_FILE}.tmp`, JSON.stringify(snapshot));
    fs.renameSync(`${DATA_FILE}.tmp`, DATA_FILE);
    return Promise.resolve();
  }

  const flush = () => writeChain;

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 2e4) req.destroy();
      });
      req.on('end', () => {
        try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); }
      });
      req.on('error', reject);
    });
  }

  function send(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
    return true;
  }

  const ipOf = req => String(req.headers['x-real-ip'] || String(req.headers['x-forwarded-for'] || '').split(',').pop() || req.socket.remoteAddress || '').trim();

  async function handle(req, res, pathname, searchParams) {
    if (pathname === '/api/reports' && req.method === 'POST') {
      let body;
      try { body = await readBody(req); } catch { return send(res, 400, { status: 'ERROR', messageBn: 'অনুরোধটি সঠিক নয়।' }); }
      const q = questionById.get(String(body.questionId || ''));
      if (!q) return send(res, 400, { status: 'ERROR', messageBn: 'প্রশ্নটি খুঁজে পাওয়া যায়নি।' });
      const ip = ipOf(req);
      const now = Date.now();
      const list = (recent.get(ip) || []).filter(t => now - t < 3600000);
      if (list.length >= 20) return send(res, 429, { status: 'ERROR', messageBn: 'অনেকগুলো রিপোর্ট পাঠিয়েছেন, এক ঘণ্টা পর আবার চেষ্টা করুন।' });
      recent.set(ip, [...list, now]);
      const user = currentUser(req);
      reports.push({
        id: `rep_${crypto.randomBytes(5).toString('hex')}`,
        questionId: q.id,
        reason: REASONS[body.reason] ? body.reason : 'PSC_CONFLICT',
        comment: String(body.comment || '').trim().slice(0, 1000),
        user: user ? { id: user.id, name: user.name, phone: user.phone } : null,
        status: 'OPEN',
        createdAt: new Date(now).toISOString()
      });
      await saveNow();
      return send(res, 200, { status: 'SUCCESS' });
    }

    if (!pathname.startsWith('/api/admin/reports')) return false;
    if (!isAdmin(req)) return send(res, 401, { status: 'ERROR', messageBn: 'অ্যাডমিন কী সঠিক নয়।' });

    if (pathname === '/api/admin/reports' && req.method === 'GET') {
      const status = searchParams.get('status') || 'OPEN';
      const list = reports.filter(r => status === 'ALL' || r.status === status).slice(-300).reverse().map(r => {
        const q = questionById.get(r.questionId);
        return {
          ...r,
          reasonBn: REASONS[r.reason] || r.reason,
          question: q ? { id: q.id, stemBn: q.stemBn, options: q.options, correctOption: q.correctOption, examTitle: q.examTitle || q.bcsArchiveTitle || '' } : null
        };
      });
      // Same question reported by many people = check it first
      const counts = {};
      reports.filter(r => r.status === 'OPEN').forEach(r => { counts[r.questionId] = (counts[r.questionId] || 0) + 1; });
      return send(res, 200, { status: 'SUCCESS', openCount: reports.filter(r => r.status === 'OPEN').length, sameQuestion: counts, reports: list });
    }

    const m = pathname.match(/^\/api\/admin\/reports\/([\w-]+)\/done$/);
    if (m && req.method === 'POST') {
      const r = reports.find(x => x.id === m[1]);
      if (!r) return send(res, 404, { status: 'ERROR', messageBn: 'রিপোর্ট পাওয়া যায়নি।' });
      r.status = 'DONE';
      r.doneAt = new Date().toISOString();
      await saveNow();
      return send(res, 200, { status: 'SUCCESS' });
    }

    return send(res, 404, { status: 'ERROR', messageBn: 'রুট পাওয়া যায়নি।' });
  }

  return { handle, ready, flush };
}

module.exports = { createReportsEngine };

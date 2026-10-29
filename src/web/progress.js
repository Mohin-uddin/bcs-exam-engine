/**
 * ============================================================================
 * Study progress sync (Mistake Vault, bookmarks, flashcards, exam history, streak)
 * ============================================================================
 * - GET  /api/progress   -> this account's saved progress
 * - POST /api/progress   -> { progress } merged with what is saved, the merged copy comes back
 * The browser keeps working offline in localStorage and syncs when logged in.
 * Merge rules live in public/progress-core.js (same code in the browser).
 * Storage: one row per user in app_state ("progress:<userId>") when DATABASE_URL is set,
 * otherwise one JSON file per user in data/progress/.
 */
const fs = require('node:fs');
const path = require('node:path');
const core = require('./public/progress-core');

const DATA_DIR = process.env.PROGRESS_DATA_DIR || path.join(__dirname, '..', '..', 'data', 'progress');
const MAX_BODY = 1.5e6;

function createProgressEngine({ store = null, currentUser }) {
  // Writes for one user run one after another, so two quick syncs cannot cross
  const chains = new Map();

  const fileOf = userId => path.join(DATA_DIR, `${userId.replace(/[^\w-]/g, '')}.json`);

  async function load(userId) {
    if (store) return core.sanitize(await store.get(`progress:${userId}`));
    try {
      return core.sanitize(JSON.parse(fs.readFileSync(fileOf(userId), 'utf8')));
    } catch {
      return core.empty();
    }
  }

  async function save(userId, data) {
    if (store) return store.set(`progress:${userId}`, data);
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const file = fileOf(userId);
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(data));
    fs.renameSync(`${file}.tmp`, file);
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      let tooBig = false;
      req.on('data', chunk => {
        body += chunk;
        if (body.length > MAX_BODY) {
          tooBig = true;
          req.destroy();
        }
      });
      req.on('end', () => {
        if (tooBig) return reject(new Error('too big'));
        try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); }
      });
      req.on('error', reject);
    });
  }

  function send(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  }

  async function handle(req, res, pathname) {
    if (pathname !== '/api/progress') return false;
    const user = currentUser(req);
    if (!user) {
      send(res, 401, { status: 'ERROR', code: 'LOGIN_REQUIRED', messageBn: 'অগ্রগতি সংরক্ষণ করতে লগইন করুন।' });
      return true;
    }

    if (req.method === 'GET') {
      send(res, 200, { status: 'SUCCESS', userId: user.id, progress: await load(user.id) });
      return true;
    }

    if (req.method === 'POST') {
      let body;
      try {
        body = await readBody(req);
      } catch {
        send(res, 400, { status: 'ERROR', code: 'BAD_BODY', messageBn: 'অনুরোধটি সঠিক নয়।' });
        return true;
      }
      const prev = chains.get(user.id) || Promise.resolve();
      const job = prev.catch(() => {}).then(async () => {
        const merged = core.merge(await load(user.id), body.progress);
        await save(user.id, merged);
        return merged;
      });
      chains.set(user.id, job);
      job.finally(() => { if (chains.get(user.id) === job) chains.delete(user.id); }).catch(() => {});
      try {
        send(res, 200, { status: 'SUCCESS', userId: user.id, progress: await job });
      } catch (e) {
        console.error('[progress]', e.message);
        send(res, 500, { status: 'ERROR', messageBn: 'সংরক্ষণ করা যায়নি, একটু পরে আবার চেষ্টা হবে।' });
      }
      return true;
    }

    send(res, 405, { status: 'ERROR', messageBn: 'Method not allowed' });
    return true;
  }

  return { handle };
}

module.exports = { createProgressEngine };

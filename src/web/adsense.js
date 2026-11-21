/**
 * Google AdSense: publisher id and ad unit ids, typed in /admin (saved in the database).
 * Nothing is shown and no Google script is loaded until a publisher id is saved.
 *
 * - GET  /ads.txt                         the line Google asks for (from the saved publisher id)
 * - GET  /api/admin/adsense   (X-Admin-Key) current settings
 * - POST /api/admin/adsense   (X-Admin-Key) { client, slots: { home, list, result } }
 * - headHtml()                             <meta> + <script> tags added to index.html's <head>
 *
 * ADSENSE_CLIENT in .env works too (the /admin value wins when set).
 * Ads never go on the exam hall, live exams, the print page or /admin: only index.html gets the
 * script, and ads.js hides every ad while a timed exam is running.
 */
const fs = require('node:fs');
const path = require('node:path');
const { isAdmin } = require('./admin-auth');

const STORE_KEY = 'adsense';
const DATA_FILE = process.env.ADSENSE_DATA_FILE || path.join(__dirname, '..', '..', 'data', 'adsense.json');
const SLOTS = ['home', 'list', 'result'];
const EMPTY = { client: '', slots: { home: '', list: '', result: '' } };

// "pub-123", "ca-pub-123" or the whole <script ...client=ca-pub-123> line -> "ca-pub-123"
function cleanClient(v) {
  const m = String(v || '').match(/(?:ca-)?pub-(\d{10,20})/);
  return m ? `ca-pub-${m[1]}` : '';
}
// Ad unit id ("data-ad-slot" in the code Google gives): digits only
function cleanSlot(v) {
  const m = String(v || '').match(/(\d{6,20})/);
  return m ? m[1] : '';
}

function createAdsense({ store = null } = {}) {
  let state = JSON.parse(JSON.stringify(EMPTY));
  if (!store) {
    try {
      if (fs.existsSync(DATA_FILE)) state = { ...state, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
    } catch (e) {
      console.error(`[adsense] Could not read ${DATA_FILE}: ${e.message}`);
    }
  }

  async function ready() {
    if (store) state = { ...state, ...((await store.get(STORE_KEY)) || {}) };
    state.slots = { ...EMPTY.slots, ...(state.slots || {}) };
  }

  async function save() {
    if (store) return store.set(STORE_KEY, state);
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(state));
  }

  function config() {
    const client = state.client || cleanClient(process.env.ADSENSE_CLIENT);
    return { client, slots: { ...state.slots } };
  }

  // Added to index.html's <head>. Empty until a publisher id is saved.
  function headHtml() {
    const { client, slots } = config();
    if (!client) return '';
    const cfg = JSON.stringify({ client, slots }).replace(/</g, '\\u003c');
    return `<meta name="google-adsense-account" content="${client}">\n  ` +
      `<script>window.SH_ADS=${cfg};</script>\n  ` +
      `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}" crossorigin="anonymous"></script>\n  `;
  }

  function adsTxt() {
    const { client } = config();
    if (!client) return '# Google AdSense publisher id is not set yet (/admin -> Google AdSense).\n';
    return `google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`;
  }

  function readBody(req) {
    return new Promise(resolve => {
      let body = '';
      req.on('data', c => { body += c; if (body.length > 5000) { body = ''; req.destroy(); } });
      req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); } });
      req.on('error', () => resolve({}));
    });
  }
  const send = (res, code, data) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  };

  async function handle(req, res, pathname) {
    if (pathname === '/ads.txt' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
      res.end(adsTxt());
      return true;
    }
    if (pathname !== '/api/admin/adsense') return false;
    if (!isAdmin(req)) return send(res, 401, { status: 'ERROR', code: 'ADMIN_ONLY', messageBn: 'অ্যাডমিন কী সঠিক নয়।' }), true;
    if (req.method === 'POST') {
      const body = await readBody(req);
      const raw = String(body.client || '').trim();
      const client = cleanClient(raw);
      if (raw && !client) return send(res, 400, { status: 'ERROR', messageBn: 'Publisher ID ঠিক নেই। এরকম হবে: ca-pub-1234567890123456' }), true;
      const slots = {};
      SLOTS.forEach(k => { slots[k] = cleanSlot(body.slots && body.slots[k]); });
      state = { client, slots };
      await save();
    }
    send(res, 200, { status: 'SUCCESS', adsense: config(), fromEnv: !state.client && Boolean(config().client) });
    return true;
  }

  return { ready, handle, headHtml, adsTxt, config };
}

module.exports = { createAdsense, cleanClient, cleanSlot };

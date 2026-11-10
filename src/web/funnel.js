/**
 * ============================================================================
 * "ইউজার কোথায় থামছে": a small first-party funnel (no outside analytics company)
 * ============================================================================
 * - POST /api/ev        { vid, sid, ev, track?, tab?, src?, ref?, li? }  (navigator.sendBeacon from funnel.js)
 *   vid = random id kept in the visitor's browser. No name, phone, account id or IP is ever stored.
 * - GET  /api/admin/funnel?days=7&track=BCS   (X-Admin-Key): steps reached, drop-off, last screen before
 *   leaving, sources (Facebook / Google / direct ...), daily visitors.
 * - Stored per day: for each visitor the steps reached, their exam, source and last screen. Kept 35 days.
 *   Bots (by user agent) are ignored; events are size- and rate-limited.
 */
const fs = require('node:fs');
const path = require('node:path');
const { isAdmin } = require('./admin-auth');

const DATA_FILE = process.env.FUNNEL_DATA_FILE || path.join(__dirname, '..', '..', 'data', 'funnel.json');
const STORE_KEY = 'funnel';
const KEEP_DAYS = 35;
const DHAKA_OFFSET_MS = 6 * 3600000;
const MAX_VISITORS_PER_DAY = 20000;
const MAX_EVENTS_PER_VISITOR_DAY = 400;

// The steps, in the order a new visitor normally goes through them
const STEPS = [
  { key: 'landing', labelBn: 'সাইটে এসেছেন (পাতা সত্যি দেখেছেন)', group: 'main' },
  { key: 'home_view', labelBn: 'প্রথম স্ক্রিনে প্রশ্নসেট দেখেছেন', group: 'main' },
  { key: 'engaged', labelBn: 'কিছু চেপেছেন বা স্ক্রল করেছেন', group: 'main' },
  { key: 'tab_past-bank', labelBn: 'বিগত সালের প্রশ্ন খুলেছেন', group: 'main' },
  { key: 'past_set_open', labelBn: 'কোনো সাল / প্রশ্নসেট বেছেছেন', group: 'main' },
  { key: 'signup_prompt_shown', labelBn: 'নিবন্ধন / লগইনের বক্স দেখেছেন', group: 'main' },
  { key: 'account', labelBn: 'নিবন্ধন বা লগইন করেছেন', group: 'main' },
  { key: 'exam_start', labelBn: 'পরীক্ষা শুরু করেছেন', group: 'main' },
  { key: 'exam_submit', labelBn: 'পরীক্ষা জমা দিয়েছেন', group: 'main' },
  { key: 'locked_click', labelBn: 'লক করা সেটে চাপ দিয়েছেন', group: 'buy' },
  { key: 'plans_open', labelBn: 'প্যাকেজ দেখেছেন', group: 'buy' },
  { key: 'order_form_open', labelBn: 'অর্ডার ফর্ম খুলেছেন', group: 'buy' },
  { key: 'order_placed', labelBn: 'অর্ডার দিয়েছেন', group: 'buy' },
  { key: 'track_chosen', labelBn: 'নিজে পরীক্ষা বেছেছেন / বদলেছেন', group: 'other' },
  { key: 'track_from_link', labelBn: 'পরীক্ষার লিংক থেকে সরাসরি এসেছেন (/bcs, /medical ...)', group: 'other' },
  { key: 'try_answer', labelBn: '"একটা প্রশ্ন দিয়ে দেখুন"-এ উত্তর দিয়েছেন', group: 'other' },
  { key: 'tab_exam', labelBn: 'মডেল টেস্ট পাতা খুলেছেন', group: 'other' },
  { key: 'tab_mistakes', labelBn: 'ভুল খাতা খুলেছেন', group: 'other' },
  { key: 'live_register', labelBn: 'লাইভ পরীক্ষায় নিবন্ধন করেছেন', group: 'other' },
  { key: 'picker_shown', labelBn: '(আগের) "কিসের প্রস্তুতি?" পাতা দেখেছেন', group: 'other' }
];
const EVENTS = new Set(['landing', 'home_view', 'engaged', 'try_answer', 'picker_shown', 'track_chosen', 'track_from_link', 'screen', 'leave', 'past_set_open', 'exam_start', 'exam_submit',
  'signup_prompt_shown', 'signup_done', 'login_done', 'locked_click', 'plans_open', 'order_form_open', 'order_placed', 'live_register']);
const TRACKS = new Set(['BCS', 'PRIMARY', 'NTRCA', 'BANK', 'MINISTRY', 'NON_CADRE', 'NURSING', 'ADMISSION_UNI', 'ADMISSION_MED']);
const SCREEN_BN = {
  home: 'হোম (আজকের পড়া)', 'past-bank': 'বিগত সালের প্রশ্ন', exam: 'মডেল টেস্ট / পরীক্ষা', 'custom-quiz': 'নিজের মতো অনুশীলন',
  mistakes: 'ভুল খাতা', flashcards: 'ফ্ল্যাশকার্ড', bookmarks: 'বুকমার্ক', analytics: 'ফলাফল ও দুর্বলতা', picker: '"কিসের প্রস্তুতি?" পাতা',
  'signup-box': 'নিবন্ধন / লগইনের বক্স', plans: 'প্যাকেজের বক্স', 'order-form': 'অর্ডার ফর্ম', 'order-done': 'অর্ডার শেষ', live: 'লাইভ পরীক্ষার পাতা',
  'exam-hall': 'পরীক্ষার হল', result: 'পরীক্ষার ফলাফল', tour: 'গাইড (ট্যুর)'
};
const SOURCE_BN = { facebook: 'Facebook (বিজ্ঞাপন / পোস্ট)', google: 'Google', youtube: 'YouTube', whatsapp: 'WhatsApp', direct: 'সরাসরি / বুকমার্ক', other: 'অন্য সাইট' };
const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|facebot|meta-externalagent|facebookcatalog|preview|headless|lighthouse|curl|wget|python|axios|node-fetch/i;
// Link previews and pages loaded ahead of time are not visits
const isPrefetch = h => /prefetch|prerender|preview/i.test(`${h.purpose || ''} ${h['sec-purpose'] || ''} ${h['x-purpose'] || ''} ${h['x-moz'] || ''}`);

const dayOf = ms => new Date(ms + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
const clean = (v, re, max) => {
  const s = String(v ?? '').toLowerCase().slice(0, max);
  return re.test(s) ? s : '';
};

function sourceOf(src, ref) {
  const s = `${src || ''} ${ref || ''}`;
  if (/facebook|fb|fbclid|instagram|messenger/.test(s)) return 'facebook';
  if (/google/.test(s)) return 'google';
  if (/youtube|youtu\.be/.test(s)) return 'youtube';
  if (/whatsapp|wa\.me/.test(s)) return 'whatsapp';
  if (!src && !ref) return 'direct';
  return 'other';
}

function createFunnelEngine({ store = null, now = () => Date.now() } = {}) {
  let state = { days: {} };
  let saveTimer = null;
  let writeChain = Promise.resolve();
  const perIp = new Map(); // ip -> [count, windowStart]; in memory only, never saved

  if (!store) {
    try {
      if (fs.existsSync(DATA_FILE)) state = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) || { days: {} };
    } catch (e) {
      console.error(`[funnel] Could not read ${DATA_FILE}: ${e.message}`);
    }
  }
  if (!state.days) state.days = {};

  async function ready() {
    if (store) state = (await store.get(STORE_KEY)) || { days: {} };
    if (!state.days) state.days = {};
  }

  function prune() {
    const oldest = dayOf(now() - KEEP_DAYS * 86400000);
    Object.keys(state.days).forEach(d => { if (d < oldest) delete state.days[d]; });
  }

  function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    prune();
    if (store) {
      const snapshot = JSON.parse(JSON.stringify(state));
      writeChain = writeChain.then(() => store.set(STORE_KEY, snapshot)).catch(e => console.error(`[funnel] ${e.message}`));
      return writeChain;
    }
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(`${DATA_FILE}.tmp`, JSON.stringify(state));
    fs.renameSync(`${DATA_FILE}.tmp`, DATA_FILE);
    return Promise.resolve();
  }
  const save = () => { if (!saveTimer) saveTimer = setTimeout(saveNow, 5000); };
  async function flush() {
    if (saveTimer) saveNow();
    await writeChain;
  }

  // One event -> the visitor's record for today. Returns false when the event is not accepted.
  function record(body, ua, headers = {}) {
    if (BOT_UA.test(String(ua || '')) || isPrefetch(headers)) return false;
    const vid = clean(body.vid, /^[a-z0-9]{8,32}$/, 32);
    const ev = String(body.ev || '');
    if (!vid || !EVENTS.has(ev)) return false;
    const t = now();
    const day = dayOf(t);
    const days = state.days[day] || (state.days[day] = { visitors: {} });
    let v = days.visitors[vid];
    if (!v) {
      if (Object.keys(days.visitors).length >= MAX_VISITORS_PER_DAY) return false;
      // A visitor seen on an earlier day counts as returning
      const returning = Object.entries(state.days).some(([d, x]) => d < day && x.visitors[vid]);
      v = days.visitors[vid] = { s: {}, n: 0, ret: returning ? 1 : 0, first: t };
    }
    if (v.n >= MAX_EVENTS_PER_VISITOR_DAY) return false;
    v.n += 1;
    const track = TRACKS.has(body.track) ? body.track : '';
    if (track) { v.track = track; v.s.has_track = 1; }
    if (body.li) v.s.account = 1;
    const tab = clean(body.tab, /^[a-z0-9-]{1,30}$/, 30);
    if (ev === 'landing') {
      v.s.landing = 1;
      if (!v.src) v.src = sourceOf(clean(body.src, /^[a-z0-9._-]{0,40}$/, 40), clean(body.ref, /^[a-z0-9.-]{0,60}$/, 60));
    } else if (ev === 'track_chosen') { v.s.has_track = 1; v.s.track_chosen = 1; }
    else if (ev === 'track_from_link') { v.s.has_track = 1; v.s.track_from_link = 1; }
    else if (ev === 'signup_done' || ev === 'login_done') v.s.account = 1;
    else if (ev === 'screen' && tab) v.s[`tab_${tab}`] = 1;
    else if (ev !== 'leave') v.s[ev] = 1;
    if ((ev === 'screen' || ev === 'leave') && tab) v.last = tab;
    else if (ev === 'signup_prompt_shown') v.last = 'signup-box';
    else if (ev === 'picker_shown') v.last = 'picker';
    else if (ev === 'plans_open') v.last = 'plans';
    else if (ev === 'order_form_open') v.last = 'order-form';
    else if (ev === 'order_placed') v.last = 'order-done';
    else if (ev === 'exam_submit') v.last = 'result';
    v.at = t;
    save();
    return true;
  }

  function report(daysBack, trackFilter) {
    const from = dayOf(now() - (Math.max(1, daysBack) - 1) * 86400000);
    const rows = [];
    const daily = [];
    Object.keys(state.days).sort().forEach(d => {
      if (d < from) return;
      const list = Object.values(state.days[d].visitors).filter(v => !trackFilter || v.track === trackFilter);
      rows.push(...list);
      daily.push({ day: d, visitors: list.length, newVisitors: list.filter(v => !v.ret).length });
    });
    const count = key => rows.filter(v => v.s[key]).length;
    const total = rows.length;
    const steps = STEPS.map(st => ({ key: st.key, labelBn: st.labelBn, group: st.group, count: count(st.key), pct: total ? Math.round((count(st.key) / total) * 100) : 0 }));
    // Last screen of visitors who have been gone at least 30 minutes
    const gone = rows.filter(v => v.last && now() - v.at > 30 * 60000);
    const last = {};
    gone.forEach(v => { last[v.last] = (last[v.last] || 0) + 1; });
    const src = {};
    rows.forEach(v => { const k = v.src || 'direct'; src[k] = (src[k] || 0) + 1; });
    const tracks = {};
    rows.forEach(v => { const k = v.track || '-'; tracks[k] = (tracks[k] || 0) + 1; });
    return {
      from, to: dayOf(now()), visitors: total, newVisitors: rows.filter(v => !v.ret).length, steps,
      lastScreens: Object.entries(last).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ screen: k, labelBn: SCREEN_BN[k] || k, count: n })),
      sources: Object.entries(src).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ source: k, labelBn: SOURCE_BN[k] || k, count: n })),
      tracks: Object.entries(tracks).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ track: k, count: n })),
      daily
    };
  }

  const send = (res, status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
    return true;
  };
  const ipOf = req => String(req.headers['x-real-ip'] || String(req.headers['x-forwarded-for'] || '').split(',').pop() || req.socket.remoteAddress || '').trim();

  function readBody(req) {
    return new Promise(resolve => {
      let body = '';
      req.on('data', c => { body += c; if (body.length > 2000) { body = ''; req.destroy(); } });
      req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); } });
      req.on('error', () => resolve({}));
    });
  }

  async function handle(req, res, pathname, searchParams) {
    if (pathname === '/api/ev' && req.method === 'POST') {
      // 300 events per 10 minutes per connection (the address is only kept in memory for this count)
      const ip = ipOf(req);
      const w = perIp.get(ip);
      const t = now();
      if (!w || t - w[1] > 600000) perIp.set(ip, [1, t]);
      else if (++w[0] > 300) return send(res, 429, { status: 'ERROR' });
      if (perIp.size > 50000) perIp.clear();
      const body = await readBody(req);
      record(body, req.headers['user-agent'], req.headers);
      // Always 204: the page never waits for or reacts to this
      res.writeHead(204, { 'Cache-Control': 'no-store' });
      res.end();
      return true;
    }
    if (pathname === '/api/admin/funnel' && req.method === 'GET') {
      if (!isAdmin(req)) return send(res, 401, { status: 'ERROR', code: 'ADMIN_ONLY', messageBn: 'অ্যাডমিন কী সঠিক নয়।' });
      const days = Math.min(KEEP_DAYS, Math.max(1, parseInt(searchParams.get('days'), 10) || 7));
      const track = TRACKS.has(searchParams.get('track')) ? searchParams.get('track') : '';
      return send(res, 200, { status: 'SUCCESS', ...report(days, track) });
    }
    return false;
  }

  return { handle, ready, flush, record, report, _state: () => state };
}

module.exports = { createFunnelEngine, STEPS };

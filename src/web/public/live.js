/**
 * Live Exam Lobby: upcoming / live / finished exams, registration, result & merit list
 */
(function () {
  const bn = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TZ = 'Asia/Dhaka';

  let clockOffsetMs = 0; // serverNow - clientNow
  let exams = [];
  let regExamId = null;
  let meritRows = [];

  const now = () => Date.now() + clockOffsetMs;

  function syncClock(serverNow) {
    if (serverNow) clockOffsetMs = Date.parse(serverNow) - Date.now();
  }

  function store(examId, value) {
    try {
      if (value === undefined) return JSON.parse(localStorage.getItem(`liveExam:${examId}`) || 'null');
      localStorage.setItem(`liveExam:${examId}`, JSON.stringify(value));
    } catch { return null; }
    return value;
  }

  function fmtDateTime(iso) {
    return new Date(iso).toLocaleString('bn-BD', {
      timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  }

  function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString('bn-BD', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
  }

  function fmtCountdown(ms) {
    if (ms <= 0) return '০০:০০:০০';
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const hms = [h, m, sec].map(v => String(v).padStart(2, '0')).join(':');
    return bn(d > 0 ? `${d} দিন ${hms}` : hms);
  }

  function fmtDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return bn(`${m}:${String(s).padStart(2, '0')}`);
  }

  function phaseNow(e) {
    const t = now();
    if (t < Date.parse(e.startAt)) return 'UPCOMING';
    if (t < Date.parse(e.endAt)) return 'LIVE';
    return 'ENDED';
  }

  async function api(url, opts = {}) {
    const res = await fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }
    });
    const data = await res.json().catch(() => ({}));
    syncClock(data.serverNow);
    if (!res.ok) {
      const err = new Error(data.messageBn || 'সার্ভারের সাথে যোগাযোগ করা যায়নি।');
      err.code = data.code;
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { el.hidden = true; }, 3500);
  }

  // ---------------------------------------------------------------------------
  // Exam list
  // ---------------------------------------------------------------------------
  async function loadExams() {
    try {
      const data = await api('/api/live/exams');
      exams = data.exams;
      renderLists();
    } catch (e) {
      ['listLive', 'listUpcoming', 'listEnded'].forEach(id => {
        document.getElementById(id).innerHTML = `<div class="empty">${esc(e.message)}</div>`;
      });
    }
  }

  function cardHtml(e) {
    const phase = phaseNow(e);
    const reg = store(e.id);
    const badge = { LIVE: 'চলছে', UPCOMING: 'আসন্ন', ENDED: 'সমাপ্ত' }[phase];
    let timerHtml = '';
    if (phase === 'UPCOMING') timerHtml = `<div class="countdown" data-countdown="${e.startAt}" data-label="শুরু হতে বাকি">শুরু হতে বাকি ${fmtCountdown(Date.parse(e.startAt) - now())}</div>`;
    if (phase === 'LIVE') timerHtml = `<div class="countdown" data-countdown="${e.endAt}" data-label="শেষ হতে বাকি">শেষ হতে বাকি ${fmtCountdown(Date.parse(e.endAt) - now())}</div>`;

    const hallUrl = `/exam-hall?live=${encodeURIComponent(e.id)}`;
    const buttons = [];
    if (phase !== 'ENDED' && !reg) buttons.push(`<button class="btn primary" data-register="${e.id}">নিবন্ধন করুন</button>`);
    if (phase === 'LIVE' && reg) buttons.push(`<a class="btn danger" href="${hallUrl}">পরীক্ষার হলে প্রবেশ করুন →</a>`);
    if (phase === 'UPCOMING' && reg) buttons.push(`<a class="btn ghost" href="${hallUrl}">পরীক্ষার হল (অপেক্ষা করুন)</a>`);
    if (phase === 'ENDED') {
      buttons.push(`<button class="btn primary" data-merit="${e.id}">${reg ? 'আমার ফলাফল ও মেধা তালিকা' : 'মেধা তালিকা দেখুন'}</button>`);
      if (reg) buttons.push(`<a class="btn ghost" href="${hallUrl}">উত্তর মিলিয়ে দেখুন</a>`);
    }

    return `
      <article class="exam-card ${phase === 'LIVE' ? 'is-live' : ''}">
        <span class="badge ${phase}">${badge}</span>
        <div>
          <h3>${esc(e.title)}</h3>
          <div class="exam-org">${esc(e.orgBn)} • ${esc(e.trackLabelBn)}</div>
        </div>
        <div class="meta">
          <div>📅 <b>${fmtDateTime(e.startAt)}</b></div>
          <div>⏱️ সময়: <b>${bn(e.durationMin)} মিনিট</b></div>
          <div>📝 প্রশ্ন: <b>${bn(e.totalQuestions)}টি</b></div>
          <div>➖ ভুলে কাটা: <b>${bn(e.negativeMark.toFixed(2))}</b></div>
          <div>👥 নিবন্ধিত: <b>${bn(e.registeredCount)} জন</b></div>
          ${phase !== 'UPCOMING' ? `<div>✅ জমা দিয়েছেন: <b>${bn(e.submittedCount)} জন</b></div>` : ''}
        </div>
        ${e.noticeBn ? `<div class="notice">📢 ${esc(e.noticeBn)}</div>` : ''}
        ${reg ? `<div class="reg-note">আপনি নিবন্ধিত • ${esc(reg.name)} • রোল: <b>${bn(reg.roll)}</b></div>` : ''}
        ${timerHtml}
        <div class="actions">${buttons.join('')}</div>
      </article>`;
  }

  function renderLists() {
    const groups = { LIVE: [], UPCOMING: [], ENDED: [] };
    exams.forEach(e => groups[phaseNow(e)].push(e));
    groups.ENDED.reverse();
    const empty = {
      LIVE: 'এই মুহূর্তে কোনো পরীক্ষা চলছে না।',
      UPCOMING: 'এখনো নতুন কোনো পরীক্ষার ঘোষণা হয়নি। শীঘ্রই ঘোষণা আসবে।',
      ENDED: 'এখনো কোনো পরীক্ষা সমাপ্ত হয়নি।'
    };
    const ids = { LIVE: 'listLive', UPCOMING: 'listUpcoming', ENDED: 'listEnded' };
    Object.keys(groups).forEach(p => {
      document.getElementById(ids[p]).innerHTML = groups[p].length
        ? groups[p].map(cardHtml).join('')
        : `<div class="empty">${empty[p]}</div>`;
    });
    renderLists.lastPhases = exams.map(phaseNow).join(',');
  }

  function tick() {
    document.getElementById('clock').textContent = new Date(now()).toLocaleString('bn-BD', {
      timeZone: TZ, hour: 'numeric', minute: '2-digit', second: '2-digit', day: 'numeric', month: 'short'
    });
    // A phase change (exam started / ended) needs a full re-render
    if (exams.length && exams.map(phaseNow).join(',') !== renderLists.lastPhases) {
      loadExams();
      return;
    }
    document.querySelectorAll('[data-countdown]').forEach(el => {
      el.textContent = `${el.dataset.label} ${fmtCountdown(Date.parse(el.dataset.countdown) - now())}`;
    });
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------
  function openRegister(examId) {
    const e = exams.find(x => x.id === examId);
    if (!e) return;
    regExamId = examId;
    document.getElementById('regExamTitle').textContent = `${e.title} • ${fmtDateTime(e.startAt)}`;
    document.getElementById('regError').textContent = '';
    document.getElementById('regOverlay').hidden = false;
    document.getElementById('regName').focus();
  }

  async function submitRegister(ev) {
    ev.preventDefault();
    const btn = document.getElementById('regSubmit');
    const errEl = document.getElementById('regError');
    errEl.textContent = '';
    btn.disabled = true;
    try {
      const phone = document.getElementById('regPhone').value.replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
      const data = await api(`/api/live/exams/${regExamId}/register`, {
        method: 'POST',
        body: JSON.stringify({ name: document.getElementById('regName').value, phone })
      });
      store(regExamId, data.candidate);
      document.getElementById('regOverlay').hidden = true;
      toast(`নিবন্ধন সম্পন্ন! আপনার রোল নম্বর ${bn(data.candidate.roll)}`);
      if (data.exam.phase === 'ENDED') openMerit(regExamId);
      await loadExams();
    } catch (e) {
      errEl.textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Result + merit list
  // ---------------------------------------------------------------------------
  async function openMerit(examId) {
    const e = exams.find(x => x.id === examId);
    let reg = store(examId);
    if (!reg) {
      // The merit list is visible to registered candidates; ask once for name + phone
      openRegister(examId);
      document.getElementById('regExamTitle').textContent = `${e ? e.title : ''} • মেধা তালিকা দেখতে আপনার নাম ও মোবাইল নম্বর দিন`;
      return;
    }
    try {
      const [meritData, meData] = await Promise.all([
        api(`/api/live/exams/${examId}/merit?token=${encodeURIComponent(reg.token)}`),
        api(`/api/live/exams/${examId}/me?token=${encodeURIComponent(reg.token)}`)
      ]);
      meritRows = meritData.merit;
      const ex = meritData.exam;
      document.getElementById('meritExamTitle').textContent = `${ex.title} • ${fmtDateTime(ex.startAt)}`;
      document.getElementById('meritSummary').textContent =
        `মোট পরীক্ষার্থী: ${bn(meritRows.length)} জন • অনুপস্থিত: ${bn(meritData.absentCount)} জন • সর্বোচ্চ নম্বর: ${bn(meritRows[0] ? meritRows[0].netScore.toFixed(2) : '০')}`;

      const me = meData.me;
      document.getElementById('myResult').innerHTML = me.result ? `
        <div class="my-result">
          <div class="stat rank"><div class="v">${bn(me.rank)}</div><div class="k">আপনার মেধাক্রম (${bn(me.totalExaminees)} জনের মধ্যে)</div></div>
          <div class="stat"><div class="v">${bn(me.result.netScore.toFixed(2))}</div><div class="k">নিট নম্বর (${bn(me.result.totalQuestions)}-এ)</div></div>
          <div class="stat"><div class="v">${bn(me.result.correct)} / ${bn(me.result.wrong)}</div><div class="k">সঠিক / ভুল (−${bn(me.result.penalty.toFixed(2))})</div></div>
          <div class="stat"><div class="v">${fmtDuration(me.result.timeTakenSec)}</div><div class="k">সময় লেগেছে (মিনিট)</div></div>
        </div>` : `<div class="empty" style="margin-bottom:14px">আপনি (রোল ${bn(me.roll)}) এই পরীক্ষায় অংশ নেননি।</div>`;

      document.getElementById('meritSearch').value = '';
      renderMeritRows();
      document.getElementById('meritOverlay').hidden = false;
    } catch (err) {
      if (err.code === 'NOT_REGISTERED') {
        store(examId, null);
        openMerit(examId);
      } else {
        toast(err.message);
      }
    }
  }

  function renderMeritRows() {
    const q = document.getElementById('meritSearch').value.trim().toLowerCase();
    const qAscii = q.replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
    const rows = meritRows.filter(r => !q || r.name.toLowerCase().includes(q) || String(r.roll).includes(qAscii));
    document.getElementById('meritBody').innerHTML = rows.length ? rows.map(r => `
      <tr class="${r.isMe ? 'me' : ''} ${r.rank <= 3 ? 'top1' : ''}">
        <td>${r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] + ' ' : ''}${bn(r.rank)}</td>
        <td>${bn(r.roll)}</td>
        <td>${esc(r.name)}${r.isMe ? ' (আপনি)' : ''}</td>
        <td class="num">${bn(r.correct)}</td>
        <td class="num">${bn(r.wrong)}</td>
        <td class="num"><b>${bn(r.netScore.toFixed(2))}</b></td>
        <td class="num">${fmtDuration(r.timeTakenSec)}</td>
      </tr>`).join('') : `<tr><td colspan="7" style="text-align:center;color:#64748b">কোনো ফলাফল পাওয়া যায়নি।</td></tr>`;
  }

  // ---------------------------------------------------------------------------
  // Wiring
  // ---------------------------------------------------------------------------
  document.addEventListener('click', ev => {
    const t = ev.target.closest('[data-register],[data-merit],[data-close]');
    if (!t) return;
    if (t.dataset.register) openRegister(t.dataset.register);
    else if (t.dataset.merit) openMerit(t.dataset.merit);
    else t.closest('.overlay').hidden = true;
  });
  document.getElementById('regForm').addEventListener('submit', submitRegister);
  document.getElementById('meritSearch').addEventListener('input', renderMeritRows);
  document.getElementById('btnPrintMerit').addEventListener('click', () => window.print());

  (async function init() {
    await loadExams();
    const params = new URLSearchParams(location.search);
    const target = params.get('exam');
    if (target && exams.some(e => e.id === target)) {
      const e = exams.find(x => x.id === target);
      if (phaseNow(e) === 'ENDED') openMerit(target);
      else if (!store(target)) openRegister(target);
    }
    setInterval(tick, 1000);
    setInterval(loadExams, 20000);
    tick();
  })();
})();

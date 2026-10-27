/**
 * Admin console: announce scheduled exams, watch registrations, view merit list
 */
(function () {
  const bn = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TZ = 'Asia/Dhaka';
  const PHASE_BN = { LIVE: 'চলছে', UPCOMING: 'আসন্ন', ENDED: 'সমাপ্ত' };

  let adminKey = '';
  let catalog = { tracks: [], sets: [] };
  let detail = null;

  try { adminKey = sessionStorage.getItem('liveAdminKey') || ''; } catch { /* storage blocked */ }

  const fmt = iso => new Date(iso).toLocaleString('bn-BD', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const fmtDuration = sec => bn(`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);

  async function api(url, opts = {}) {
    const res = await fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey, ...(opts.headers || {}) }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.messageBn || 'সার্ভারের সাথে যোগাযোগ করা যায়নি।');
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

  async function login(key) {
    adminKey = key;
    try {
      catalog = await api('/api/live/admin/catalog');
      try { sessionStorage.setItem('liveAdminKey', key); } catch { /* storage blocked */ }
      document.getElementById('loginPanel').hidden = true;
      document.getElementById('adminArea').hidden = false;
      setupCreateForm();
      loadExams();
      document.dispatchEvent(new CustomEvent('admin:login', { detail: { key } }));
    } catch (e) {
      document.getElementById('loginError').textContent = e.message;
    }
  }

  // ---------------------------------------------------------------------------
  // Create exam
  // ---------------------------------------------------------------------------
  function setupCreateForm() {
    const cTrack = document.getElementById('cTrack');
    cTrack.innerHTML = catalog.tracks
      .filter(t => catalog.sets.some(s => s.track === t.id))
      .map(t => `<option value="${t.id}">${esc(t.labelBn)}</option>`).join('');
    cTrack.onchange = fillSets;
    document.getElementById('cSet').onchange = applySet;

    // Default start: next full hour, local time
    const d = new Date(Date.now() + 3600000);
    d.setMinutes(0, 0, 0);
    const pad = n => String(n).padStart(2, '0');
    document.getElementById('cStart').value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
    fillSets();
  }

  function fillSets() {
    const track = document.getElementById('cTrack').value;
    document.getElementById('cSet').innerHTML = catalog.sets
      .filter(s => s.track === track)
      .map(s => `<option value="${s.id}">${esc(s.title)}</option>`).join('');
    applySet();
  }

  function applySet() {
    const set = catalog.sets.find(s => s.id === document.getElementById('cSet').value);
    if (!set) return;
    document.getElementById('cTitle').value = set.title.replace(/\s*\(.*\)\s*$/, '');
    document.getElementById('cDuration').value = set.durationMin;
    document.getElementById('cNegative').value = String(set.negativeMark === 0.5 ? 0.5 : set.negativeMark === 0 ? 0 : 0.25);
    document.getElementById('cCount').textContent = `${bn(set.totalQuestions)}টি প্রশ্ন • সেট কোড: ${set.setCode}`;
  }

  async function createExam(ev) {
    ev.preventDefault();
    const errEl = document.getElementById('createError');
    const btn = document.getElementById('cSubmit');
    errEl.textContent = '';
    const startLocal = document.getElementById('cStart').value;
    const startAt = new Date(startLocal);
    if (startAt.getTime() < Date.now() - 60000 && !confirm('শুরুর সময় ইতিমধ্যে পার হয়ে গেছে। তবুও ঘোষণা করবেন? (পরীক্ষা সাথে সাথে চালু হবে)')) return;
    btn.disabled = true;
    try {
      await api('/api/live/admin/exams', {
        method: 'POST',
        body: JSON.stringify({
          setId: document.getElementById('cSet').value,
          title: document.getElementById('cTitle').value,
          startAt: startAt.toISOString(),
          durationMin: Number(document.getElementById('cDuration').value),
          negativeMark: Number(document.getElementById('cNegative').value),
          noticeBn: document.getElementById('cNotice').value
        })
      });
      toast('পরীক্ষা ঘোষণা করা হয়েছে। শিক্ষার্থীরা এখন /live পেজে দেখতে পাবে।');
      document.getElementById('cNotice').value = '';
      loadExams();
    } catch (e) {
      errEl.textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Exam list + detail
  // ---------------------------------------------------------------------------
  async function loadExams() {
    try {
      const { exams } = await api('/api/live/admin/exams');
      document.getElementById('examRows').innerHTML = exams.length ? exams.map(e => `
        <tr>
          <td><b>${esc(e.title)}</b><br><small>${esc(e.trackLabelBn)} • ${bn(e.totalQuestions)} প্রশ্ন • ভুলে −${bn(e.negativeMark.toFixed(2))}</small></td>
          <td>${fmt(e.startAt)}<br><small>${bn(e.durationMin)} মিনিট</small></td>
          <td><span class="badge ${e.phase}">${PHASE_BN[e.phase] || e.phase}</span></td>
          <td>${bn(e.registeredCount)} / ${bn(e.submittedCount)}</td>
          <td style="white-space:nowrap">
            <button class="btn ghost sm" data-detail="${e.id}">বিস্তারিত</button>
            <button class="btn ghost sm" data-copy="${e.id}">লিংক কপি</button>
            ${e.phase !== 'ENDED' ? `<button class="btn ghost sm" data-cancel="${e.id}">বাতিল</button>` : ''}
          </td>
        </tr>`).join('') : `<tr><td colspan="5" style="text-align:center;color:#64748b">এখনো কোনো পরীক্ষা ঘোষণা করা হয়নি।</td></tr>`;
    } catch (e) {
      toast(e.message);
    }
  }

  async function openDetail(id) {
    try {
      detail = await api(`/api/live/admin/exams/${id}`);
      const e = detail.exam;
      document.getElementById('dTitle').textContent = e.title;
      document.getElementById('dSub').textContent = `${fmt(e.startAt)} • ${bn(e.durationMin)} মিনিট • ${PHASE_BN[e.phase]} • নিবন্ধিত ${bn(e.registeredCount)} জন, জমা ${bn(e.submittedCount)} জন`;
      document.getElementById('dMerit').innerHTML = detail.merit.length ? detail.merit.map(r => `
        <tr><td>${bn(r.rank)}</td><td>${bn(r.roll)}</td><td>${esc(r.name)}</td><td>${esc(detail.candidates.find(c => c.roll === r.roll)?.phone || '')}</td>
        <td class="num">${bn(r.correct)}</td><td class="num">${bn(r.wrong)}</td><td class="num"><b>${bn(r.netScore.toFixed(2))}</b></td><td class="num">${fmtDuration(r.timeTakenSec)}</td></tr>`).join('')
        : `<tr><td colspan="8" style="text-align:center;color:#64748b">এখনো কেউ উত্তরপত্র জমা দেয়নি।</td></tr>`;
      document.getElementById('dCandidates').innerHTML = detail.candidates.length ? detail.candidates.map(c => `
        <tr><td>${bn(c.roll)}</td><td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td>${fmt(c.registeredAt)}</td>
        <td>${c.submittedAt ? '✅ জমা দিয়েছেন' : c.startedAt ? '✍️ পরীক্ষা দিচ্ছেন' : '⏳ অপেক্ষমাণ'}</td></tr>`).join('')
        : `<tr><td colspan="5" style="text-align:center;color:#64748b">এখনো কেউ নিবন্ধন করেনি।</td></tr>`;
      document.getElementById('detailOverlay').hidden = false;
    } catch (err) {
      toast(err.message);
    }
  }

  function downloadCsv() {
    if (!detail) return;
    const lines = [['Rank', 'Roll', 'Name', 'Phone', 'Correct', 'Wrong', 'Blank', 'Penalty', 'NetScore', 'TimeTakenSec']];
    detail.merit.forEach(r => {
      const phone = detail.candidates.find(c => c.roll === r.roll)?.phone || '';
      lines.push([r.rank, r.roll, r.name, phone, r.correct, r.wrong, r.blank, r.penalty, r.netScore, r.timeTakenSec]);
    });
    const csv = lines.map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `merit-list-${detail.exam.id}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  document.addEventListener('click', async ev => {
    const t = ev.target.closest('[data-detail],[data-cancel],[data-copy],[data-close]');
    if (!t) return;
    if (t.dataset.detail) openDetail(t.dataset.detail);
    else if (t.dataset.copy) {
      const url = `${location.origin}/live?exam=${t.dataset.copy}`;
      try { await navigator.clipboard.writeText(url); toast('লিংক কপি হয়েছে: ' + url); } catch { prompt('এই লিংকটি শিক্ষার্থীদের পাঠান:', url); }
    } else if (t.dataset.cancel) {
      if (!confirm('এই পরীক্ষাটি বাতিল করবেন? শিক্ষার্থীরা আর এটি দেখতে পাবে না।')) return;
      try { await api(`/api/live/admin/exams/${t.dataset.cancel}/cancel`, { method: 'POST' }); loadExams(); } catch (e) { toast(e.message); }
    } else t.closest('.overlay').hidden = true;
  });

  document.getElementById('loginForm').addEventListener('submit', ev => {
    ev.preventDefault();
    login(document.getElementById('adminKey').value);
  });
  document.getElementById('createForm').addEventListener('submit', createExam);
  document.getElementById('dCsv').addEventListener('click', downloadCsv);

  if (adminKey) login(adminKey);
  setInterval(() => { if (!document.getElementById('adminArea').hidden) loadExams(); }, 20000);
})();

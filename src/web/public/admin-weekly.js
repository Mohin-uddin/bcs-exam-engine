/**
 * Admin: every exam type's weekly live exam (day, time, length, on/off, move this week's exam),
 * with the registration count (only the admin sees counts), and the free-account limit.
 * Uses the same admin key as the live-exam console (admin.js fires 'admin:login').
 */
(function () {
  const bn = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = id => document.getElementById(id);
  let adminKey = '';

  async function api(url, body) {
    const res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.messageBn || 'সার্ভারের সাথে যোগাযোগ করা যায়নি।');
    return data;
  }

  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { el.hidden = true; }, 3500);
  }

  // Bangladesh time in the admin's form, whatever the computer's own time zone is
  const dhakaInput = iso => new Date(Date.parse(iso) + 6 * 3600000).toISOString().slice(0, 16);
  const fromDhakaInput = v => new Date(Date.parse(`${v}:00Z`) - 6 * 3600000).toISOString();
  const DAY_BN = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
  const when = iso => new Date(iso).toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
  let data = null;

  function fillForm(id) {
    const t = data.tracks.find(x => x.id === id) || data.tracks[0];
    $('wTrack').value = t.id;
    $('wEnabled').value = t.enabled ? '1' : '0';
    $('wDay').value = String(t.weekday);
    $('wTime').value = `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
    $('wDuration').value = t.durationMin;
    $('wDefaultMin').textContent = bn(t.defaultDurationMin);
    $('wMoveAt').value = t.next ? dhakaInput(t.next.startAt) : '';
  }

  function render(d, keep) {
    data = d;
    $('weeklyRows').innerHTML = d.tracks.map(t => `<tr>
      <td><b>${esc(t.labelBn)}</b></td>
      <td>${t.enabled ? `প্রতি ${DAY_BN[t.weekday]} ${bn(`${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`)}` : '<span style="color:#b91c1c">বন্ধ</span>'}</td>
      <td>${t.next ? `${esc(when(t.next.startAt))}${t.next.phase === 'LIVE' ? ' <b style="color:#dc2626">🔴 চলছে</b>' : ''}` : '—'}</td>
      <td>${t.next ? `${bn(t.next.totalQuestions)} / ${bn(t.next.durationMin)}` : '—'}</td>
      <td>${t.next ? `<b>${bn(t.next.registeredCount)}</b> জন` : '—'}</td>
      <td><button class="btn ghost sm" type="button" data-wedit="${esc(t.id)}">সময় বদলান</button></td></tr>`).join('');
    $('wTrack').innerHTML = d.tracks.map(t => `<option value="${esc(t.id)}">${esc(t.labelBn)}</option>`).join('');
    fillForm(keep || $('wTrack').dataset.last || d.tracks[0].id);
    $('wFree').value = d.weekly.freeLimit;
  }

  document.addEventListener('admin:login', async ev => {
    adminKey = ev.detail.key;
    try { render(await api('/api/live/admin/weekly')); } catch (e) { toast(e.message); }
  });

  $('wTrack').addEventListener('change', () => { $('wTrack').dataset.last = $('wTrack').value; fillForm($('wTrack').value); });
  $('weeklyRows').addEventListener('click', ev => {
    const b = ev.target.closest('[data-wedit]');
    if (!b) return;
    $('wTrack').dataset.last = b.dataset.wedit;
    fillForm(b.dataset.wedit);
    $('weeklyForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  $('weeklyForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    const [hour, minute] = $('wTime').value.split(':').map(Number);
    const track = $('wTrack').value;
    try {
      render(await api('/api/live/admin/weekly', {
        track, enabled: $('wEnabled').value === '1', weekday: Number($('wDay').value), hour, minute,
        durationMin: Number($('wDuration').value) || 0
      }), track);
      toast('সাপ্তাহিক সময় সংরক্ষণ হয়েছে। ব্যবহারকারীরা নতুন সময় দেখবেন।');
    } catch (e) { toast(e.message); }
  });

  $('wMoveBtn').addEventListener('click', async () => {
    const track = $('wTrack').value;
    if (!$('wMoveAt').value) return toast('নতুন তারিখ ও সময় দিন।');
    try {
      render(await api('/api/live/admin/weekly', { track, startAt: fromDhakaInput($('wMoveAt').value) }), track);
      toast('এই সপ্তাহের পরীক্ষা নতুন সময়ে সরানো হয়েছে।');
    } catch (e) { toast(e.message); }
  });

  $('weeklySharedForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    try {
      render(await api('/api/live/admin/weekly', { freeLimit: Number($('wFree').value) || 0 }), $('wTrack').value);
      toast('সংরক্ষণ হয়েছে।');
    } catch (e) { toast(e.message); }
  });
})();

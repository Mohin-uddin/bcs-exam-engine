/**
 * Admin: schedule of the weekly live exam (day, time, track, free limit, goal shown on the home page).
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

  function render({ weekly: w, next }, tracks) {
    if (tracks) $('wTrack').innerHTML = tracks.map(t => `<option value="${esc(t.id)}">${esc(t.labelBn)}</option>`).join('');
    $('wEnabled').value = w.enabled ? '1' : '0';
    $('wTrack').value = w.track;
    $('wDay').value = String(w.weekday);
    $('wTime').value = `${String(w.hour).padStart(2, '0')}:${String(w.minute).padStart(2, '0')}`;
    $('wDuration').value = w.durationMin;
    $('wFree').value = w.freeLimit;
    $('wTarget').value = w.targetCount;
    $('weeklyNext').innerHTML = next
      ? `পরের পরীক্ষা: <b>${esc(next.title)}</b> • ${new Date(next.startAt).toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })} • নিবন্ধন: <b>${bn(next.registeredCount)} জন</b>`
      : w.enabled ? 'এই ধরনের কোনো প্রশ্নসেট পাওয়া যায়নি।' : 'সাপ্তাহিক পরীক্ষা বন্ধ আছে।';
  }

  document.addEventListener('admin:login', async ev => {
    adminKey = ev.detail.key;
    try {
      const [data, catalog] = await Promise.all([api('/api/live/admin/weekly'), api('/api/live/admin/catalog')]);
      render(data, catalog.tracks);
    } catch (e) {
      toast(e.message);
    }
  });

  $('weeklyForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    const [hour, minute] = $('wTime').value.split(':').map(Number);
    try {
      const data = await api('/api/live/admin/weekly', {
        enabled: $('wEnabled').value === '1',
        track: $('wTrack').value,
        weekday: Number($('wDay').value),
        hour, minute,
        durationMin: Number($('wDuration').value) || 0,
        freeLimit: Number($('wFree').value) || 0,
        targetCount: Number($('wTarget').value) || 0
      });
      render(data);
      toast('সাপ্তাহিক পরীক্ষার সেটিংস সংরক্ষণ হয়েছে।');
    } catch (e) {
      toast(e.message);
    }
  });
})();

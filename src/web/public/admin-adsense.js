/**
 * Admin: Google AdSense publisher id and ad unit ids (GET/POST /api/admin/adsense, server: adsense.js).
 * Uses the admin key from admin.js (the "admin:login" event).
 */
(function () {
  const $ = id => document.getElementById(id);
  let key = '';

  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { el.hidden = true; }, 3500);
  }

  async function call(body) {
    const res = await fetch('/api/admin/adsense', {
      method: body ? 'POST' : 'GET',
      headers: { 'X-Admin-Key': key, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.messageBn || 'সংরক্ষণ করা যায়নি।');
    return data;
  }

  function show(d) {
    const a = d.adsense || { client: '', slots: {} };
    $('adsClient').value = a.client || '';
    $('adsHome').value = a.slots.home || '';
    $('adsList').value = a.slots.list || '';
    $('adsResult').value = a.slots.result || '';
    const units = ['home', 'list', 'result'].filter(k => a.slots[k]).length;
    const badge = $('adsBadge');
    badge.className = `badge ${a.client ? (units ? 'LIVE' : 'UPCOMING') : 'ENDED'}`;
    badge.textContent = !a.client ? 'বন্ধ' : units ? `চালু • ${units}টি জায়গায় বিজ্ঞাপন` : 'কোড বসানো • ad unit বাকি';
  }

  document.addEventListener('admin:login', async ev => {
    key = ev.detail.key;
    try { show(await call()); } catch (e) { toast(e.message); }
  });

  $('adsForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    try {
      const d = await call({
        client: $('adsClient').value,
        slots: { home: $('adsHome').value, list: $('adsList').value, result: $('adsResult').value }
      });
      show(d);
      toast(d.adsense.client ? 'AdSense সেটিংস সংরক্ষণ হয়েছে। সাইটে এখনই চালু।' : 'AdSense বন্ধ করা হয়েছে।');
    } catch (e) { toast(e.message); }
  });
})();

/**
 * Admin: Cash on Delivery orders of the printed question sets.
 * - Order list with status (new -> confirmed -> shipped -> delivered / cancelled)
 * - Location check: orders placed far from the delivery district (or without location)
 *   are flagged "call and verify" until the admin marks them as checked
 * - Access code of each order + a printable slip to put inside the packet
 * - COD prices, delivery charge and distance limit
 * Adds its own panel at the top after the admin logs in (admin.js fires "admin:login").
 */
(function () {
  const bn = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = iso => (iso ? new Date(iso).toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');
  const STATUS_BN = { OPEN: 'চলমান', FAR: '📍 লোকেশন যাচাই বাকি', NEW: 'নতুন', CONFIRMED: 'ফোনে নিশ্চিত', SHIPPED: 'পাঠানো হয়েছে', DELIVERED: 'ডেলিভারি হয়েছে', CANCELLED: 'বাতিল', ALL: 'সব' };
  const STATUS_COLOR = { NEW: '#fef3c7;color:#92400e', CONFIRMED: '#dbeafe;color:#1e40af', SHIPPED: '#e0e7ff;color:#3730a3', DELIVERED: '#dcfce7;color:#166534', CANCELLED: '#fee2e2;color:#991b1b' };
  const TIER_BN = { NORMAL: 'সাধারণ (শুধু দেখা)', PREMIUM: '⭐ প্রিমিয়াম (ডাউনলোড + প্রিন্ট)' };
  let key = '';
  let filter = 'OPEN';
  let orders = [];
  let settings = null;
  const $ = id => document.getElementById(id);

  async function api(url, body) {
    const res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key },
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

  function mount() {
    if ($('ordersArea')) return;
    const area = $('adminArea');
    const section = document.createElement('section');
    section.className = 'panel';
    section.id = 'ordersArea';
    section.innerHTML = `
      <h2>🚚 ক্যাশ অন ডেলিভারি অর্ডার <span class="badge UPCOMING" id="ordBadge" hidden></span></h2>
      <p style="color:#475569;font-size:14px;margin-bottom:10px">প্রতিটি অর্ডারের ফোন নম্বর OTP দিয়ে যাচাই করা। <b style="color:#b91c1c">লাল "লোকেশন দূরে"</b> চিহ্ন থাকলে অর্ডারের সময় ফোনের লোকেশন ঠিকানার জেলা থেকে অনেক দূরে ছিল (বা লোকেশন দেয়নি) — পাঠানোর আগে ফোন করে ঠিকানা যাচাই করুন, তারপর "যাচাই করেছি" চাপুন। <b>অ্যাক্সেস কোড</b> প্রিন্ট করে প্রশ্নসেটের প্যাকেটে দিন; ইউজার কোডটি ওয়েবসাইটে দিলে প্যাকেজ চালু হবে এবং অর্ডার নিজে থেকেই "ডেলিভারি হয়েছে" হবে।</p>
      <div class="actions" style="margin-bottom:10px" id="ordFilters">${['OPEN', 'FAR', 'NEW', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'ALL']
        .map(s => `<button class="btn ${s === filter ? 'primary' : 'ghost'} sm" type="button" data-ofilter="${s}">${STATUS_BN[s]}</button>`).join('')}</div>
      <form id="ordSearchForm" class="row2" style="margin-bottom:8px">
        <label class="field">অর্ডার নম্বর, কোড, নাম বা মোবাইল দিয়ে খুঁজুন<input id="ordSearch" placeholder="যেমন SH1001 বা 017..."></label>
        <div class="field" style="justify-content:flex-end"><button class="btn ghost" type="submit">খুঁজুন</button></div>
      </form>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>অর্ডার</th><th>গ্রাহক</th><th>ঠিকানা</th><th>লোকেশন</th><th>প্যাকেজ / টাকা</th><th>অ্যাক্সেস কোড</th><th>অবস্থা</th></tr></thead>
          <tbody id="ordRows"></tbody>
        </table>
      </div>
      <details style="margin-top:14px">
        <summary style="cursor:pointer;font-weight:700">⚙️ ক্যাশ অন ডেলিভারি সেটিংস (দাম, ডেলিভারি চার্জ)</summary>
        <form id="codSettingsForm" style="margin-top:10px">
          <div class="row2">
            <label class="field">ক্যাশ অন ডেলিভারি<select id="codOn"><option value="1">চালু</option><option value="0">বন্ধ</option></select></label>
            <label class="field">কত কিমি দূরে হলে "লোকেশন দূরে" দেখাবে<input id="codFar" type="number" min="5" max="500"></label>
          </div>
          <div class="row2">
            <label class="field">ডেলিভারি চার্জ — ঢাকা (৳)<input id="codDhaka" type="number" min="0"></label>
            <label class="field">ডেলিভারি চার্জ — ঢাকার বাইরে (৳)<input id="codOutside" type="number" min="0"></label>
          </div>
          <div class="row2">
            <label class="field">লক করা সেটে ফ্রিতে কয়টি প্রশ্ন দেখা যাবে (প্রিভিউ)<input id="codPreview" type="number" min="0" max="20"></label>
            <div></div>
          </div>
          <div id="codPlans"></div>
          <div id="codSmsInfo" style="font-size:13px;color:#475569;margin:6px 0 10px"></div>
          <button class="btn primary" type="submit">সংরক্ষণ করুন</button>
        </form>
      </details>`;
    area.insertBefore(section, area.firstElementChild);

    section.addEventListener('click', onClick);
    $('ordSearchForm').addEventListener('submit', ev => { ev.preventDefault(); load(); });
    $('codSettingsForm').addEventListener('submit', saveSettings);
  }

  function locationCell(o) {
    const l = o.location || {};
    const map = o.geo ? ` <a href="https://www.google.com/maps?q=${o.geo.lat},${o.geo.lng}" target="_blank" rel="noopener">ম্যাপে দেখুন</a>` : '';
    if (l.status === 'OK') return `<span class="badge" style="background:#dcfce7;color:#166534">✅ ঠিকানার কাছে</span><br><small>${bn(l.distanceKm)} কিমি${map}</small>`;
    const checked = o.locationVerifiedAt
      ? `<br><span class="badge" style="background:#dcfce7;color:#166534">☎️ যাচাই করা হয়েছে</span>`
      : (['NEW', 'CONFIRMED', 'SHIPPED'].includes(o.status) ? `<br><button class="btn ghost sm" data-locok="${o.id}" style="margin-top:4px">☎️ যাচাই করেছি</button>` : '');
    return `<span class="badge" style="background:#fee2e2;color:#991b1b">⚠️ ${l.status === 'FAR' ? 'লোকেশন দূরে' : 'লোকেশন নেই'}</span><br><small>${esc(l.status === 'FAR' ? `প্রায় ${bn(l.distanceKm)} কিমি দূরে` : (o.geoErrorBn || l.reasonBn || ''))}${map}</small>${checked}`;
  }

  function render() {
    $('ordRows').innerHTML = orders.length ? orders.map(o => `
      <tr>
        <td><b>${esc(o.orderNo)}</b><br><small>${fmt(o.createdAt)}</small></td>
        <td><b>${esc(o.name)}</b><br><a href="tel:${esc(o.phone)}">${esc(o.phone)}</a> <small title="OTP দিয়ে যাচাই করা">✔️ OTP</small>${o.samePhoneOrders ? `<br><small>এই নম্বরে আরও ${bn(o.samePhoneOrders)}টি অর্ডার</small>` : ''}</td>
        <td><b>${esc(o.districtBn)}</b>, ${esc(o.area)}<br><small>${esc(o.address)}</small>${o.noteBn ? `<br><small>📝 ${esc(o.noteBn)}</small>` : ''}</td>
        <td>${locationCell(o)}</td>
        <td>${esc(TIER_BN[o.tier] || o.planNameBn)}<br><b>৳${bn(o.total)}</b> <small>(${bn(o.price)} + ডেলিভারি ${bn(o.deliveryCharge)})</small></td>
        <td><code style="font-size:15px;font-weight:700;letter-spacing:1px">${esc(o.accessCode)}</code><br>
          ${o.redeemedAt ? `<small>✅ চালু হয়েছে ${fmt(o.redeemedAt)}${o.redeemedUser ? ` • ${esc(o.redeemedUser.name)} (${esc(o.redeemedUser.phone)})` : ''}</small>` : `<button class="btn ghost sm" data-slip="${o.id}" style="margin-top:4px">🖨️ কোড স্লিপ</button>`}</td>
        <td><span class="badge" style="background:${STATUS_COLOR[o.status] || '#e2e8f0'}">${STATUS_BN[o.status] || o.status}</span><br>
          ${o.status === 'CANCELLED' || o.redeemedAt ? '' : `<select data-ostatus="${o.id}" style="margin-top:4px;max-width:150px">
            <option value="">অবস্থা বদলান...</option>
            ${['NEW', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'].filter(s => s !== o.status).map(s => `<option value="${s}">${STATUS_BN[s]}</option>`).join('')}
          </select>`}${o.adminNoteBn ? `<br><small>${esc(o.adminNoteBn)}</small>` : ''}</td>
      </tr>`).join('') : `<tr><td colspan="7" style="text-align:center;color:#64748b">কোনো অর্ডার নেই।</td></tr>`;
  }

  async function load() {
    try {
      const q = $('ordSearch') ? $('ordSearch').value.trim() : '';
      const data = await api(`/api/admin/accounts/orders?status=${filter}&q=${encodeURIComponent(q)}`);
      orders = data.orders;
      document.querySelectorAll('[data-ofilter]').forEach(b => {
        const s = b.dataset.ofilter;
        b.classList.toggle('primary', s === filter);
        b.classList.toggle('ghost', s !== filter);
        b.textContent = `${STATUS_BN[s]}${data.counts[s] !== undefined ? ` (${bn(data.counts[s])})` : ''}`;
      });
      const badge = $('ordBadge');
      badge.hidden = !data.counts.NEW;
      badge.textContent = data.counts.NEW ? `${bn(data.counts.NEW)} নতুন` : '';
      render();
    } catch (e) {
      toast(e.message);
    }
  }

  // Small slip with the code and how to use it, to put inside the packet
  function printSlip(o) {
    const site = location.origin;
    const w = window.open('', '_blank');
    if (!w) return toast('পপ-আপ ব্লক হয়েছে। ব্রাউজারে পপ-আপ চালু করুন।');
    w.document.write(`<!DOCTYPE html><html lang="bn"><head><meta charset="utf-8"><title>${esc(o.orderNo)} কোড স্লিপ</title>
      <style>body{font-family:'Noto Sans Bengali',sans-serif;margin:20px}.slip{border:2px dashed #334155;border-radius:12px;padding:18px;max-width:420px}
      h2{margin:0 0 6px;font-size:18px}.code{font:700 30px monospace;letter-spacing:4px;border:2px solid #0f172a;border-radius:8px;padding:8px;text-align:center;margin:10px 0}
      ol{padding-left:18px;margin:6px 0;font-size:14px}small{color:#475569}</style></head><body>
      <div class="slip"><h2>সোনার হরিণ • আপনার অ্যাক্সেস কোড</h2>
      <small>অর্ডার ${esc(o.orderNo)} • ${esc(o.name)} • ${esc(TIER_BN[o.tier] || o.planNameBn)}</small>
      <div class="code">${esc(o.accessCode)}</div>
      <ol><li>${esc(site)} ওয়েবসাইটে যান।</li><li>লগইন করুন (অ্যাকাউন্ট না থাকলে মোবাইল নম্বর দিয়ে নতুন অ্যাকাউন্ট খুলুন)।</li>
      <li>উপরে "👤" বাটন চাপুন → "প্রশ্নসেটের সাথে পাওয়া কোড দিন" → কোডটি লিখুন।</li></ol>
      <small>একটি কোড একবারই ব্যবহার করা যায়। কোডটি কাউকে দেবেন না।</small></div>
      <script>window.onload=function(){window.print()}<\/script></body></html>`);
    w.document.close();
  }

  async function onClick(ev) {
    const f = ev.target.closest('[data-ofilter]');
    if (f) { filter = f.dataset.ofilter; return load(); }
    const s = ev.target.closest('[data-slip]');
    if (s) return printSlip(orders.find(o => o.id === s.dataset.slip));
    const l = ev.target.closest('[data-locok]');
    if (l) {
      if (!confirm('গ্রাহককে ফোন করে ঠিকানা যাচাই করেছেন?')) return;
      try { await api(`/api/admin/accounts/orders/${l.dataset.locok}/location-ok`, {}); toast('লোকেশন যাচাই হিসেবে চিহ্নিত হয়েছে।'); load(); } catch (e) { toast(e.message); }
    }
  }

  document.addEventListener('change', async ev => {
    const sel = ev.target.closest('[data-ostatus]');
    if (!sel || !sel.value) return;
    const status = sel.value;
    let noteBn = '';
    if (status === 'CANCELLED') {
      noteBn = prompt('বাতিলের কারণ (শুধু আপনি দেখবেন):', 'ফোনে পাওয়া যায়নি / ভুয়া অর্ডার');
      if (noteBn === null) { sel.value = ''; return; }
    }
    try {
      await api(`/api/admin/accounts/orders/${sel.dataset.ostatus}/status`, { status, noteBn });
      toast(`অর্ডারের অবস্থা: ${STATUS_BN[status]}`);
      load();
    } catch (e) {
      toast(e.message);
      sel.value = '';
    }
  });

  // ---------------------------------------------------------------------------
  // COD settings
  // ---------------------------------------------------------------------------
  async function loadSettings() {
    try {
      const data = await api('/api/admin/accounts/settings');
      settings = data.settings;
      $('codOn').value = settings.codEnabled === false ? '0' : '1';
      $('codFar').value = settings.codFarKm;
      $('codDhaka').value = settings.codDelivery.insideDhaka;
      $('codOutside').value = settings.codDelivery.outsideDhaka;
      $('codPreview').value = settings.previewPerSet;
      $('codPlans').innerHTML = settings.codPlans.map((p, i) => `
        <fieldset data-codplan="${i}" style="border:1px solid #e2e8f0;border-radius:10px;padding:10px;margin-bottom:10px">
          <legend style="font-weight:700">${esc(TIER_BN[p.tier] || p.tier)}</legend>
          <input type="hidden" data-cid value="${esc(p.id)}"><input type="hidden" data-ctier value="${esc(p.tier)}">
          <div class="row2">
            <label class="field">নাম<input data-cname value="${esc(p.nameBn)}" maxlength="40"></label>
            <div class="row2">
              <label class="field">দাম (৳)<input data-cprice type="number" min="1" value="${p.price}"></label>
              <label class="field">অনলাইনে মেয়াদ (দিন)<input data-cdays type="number" min="1" value="${p.days}"></label>
            </div>
          </div>
          <label class="field">কী কী পাবে (ইউজার দেখবে)<input data-cfeat value="${esc(p.featuresBn || '')}" maxlength="200"></label>
        </fieldset>`).join('');
      const sms = data.sms;
      $('codSmsInfo').innerHTML = sms && sms.ready
        ? `✅ OTP SMS চালু: <b>${esc(sms.provider)}</b>`
        : `⚠️ OTP SMS চালু নেই${sms && sms.error ? ` (${esc(sms.error)})` : ''}। সার্ভারে SMS_PROVIDER ও SMS_API_KEY সেট না করা পর্যন্ত ইউজার অর্ডার দিতে পারবে না।`;
    } catch (e) {
      toast(e.message);
    }
  }

  async function saveSettings(ev) {
    ev.preventDefault();
    try {
      await api('/api/admin/accounts/settings', {
        codEnabled: $('codOn').value === '1',
        codFarKm: Number($('codFar').value),
        previewPerSet: Number($('codPreview').value),
        codDelivery: { insideDhaka: Number($('codDhaka').value), outsideDhaka: Number($('codOutside').value) },
        codPlans: [...document.querySelectorAll('[data-codplan]')].map(f => ({
          id: f.querySelector('[data-cid]').value,
          tier: f.querySelector('[data-ctier]').value,
          nameBn: f.querySelector('[data-cname]').value,
          price: Number(f.querySelector('[data-cprice]').value),
          days: Number(f.querySelector('[data-cdays]').value),
          featuresBn: f.querySelector('[data-cfeat]').value
        }))
      });
      toast('ক্যাশ অন ডেলিভারি সেটিংস সংরক্ষণ হয়েছে।');
      loadSettings();
    } catch (e) {
      toast(e.message);
    }
  }

  document.addEventListener('admin:login', ev => {
    key = ev.detail.key;
    mount();
    load();
    loadSettings();
  });
  setInterval(() => { if (key && document.visibilityState === 'visible') load(); }, 60000);
})();

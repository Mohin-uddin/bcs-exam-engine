/**
 * Admin: approve bKash / Nagad / Rocket payments, manage premium users and payment settings.
 * Uses the same admin key as the live-exam console (admin.js fires 'admin:login').
 */
(function () {
  const bn = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = iso => iso ? new Date(iso).toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
  const METHOD_BN = { bkash: 'বিকাশ', nagad: 'নগদ', rocket: 'রকেট' };
  const STATUS_BN = { PENDING: 'যাচাই বাকি', APPROVED: 'অনুমোদিত', REJECTED: 'বাতিল', INITIATED: 'অসম্পূর্ণ', FAILED: 'ব্যর্থ', CANCELLED: 'ইউজার বাতিল করেছে' };
  const GW_NAME = { SSLCOMMERZ: 'SSLCommerz', AAMARPAY: 'aamarPay' };

  let adminKey = '';
  let statusFilter = 'PENDING';
  let settings = null;
  const $ = id => document.getElementById(id);

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

  // ---------------------------------------------------------------------------
  // Payments
  // ---------------------------------------------------------------------------
  async function loadPayments() {
    try {
      const { payments, counts } = await api(`/api/admin/accounts/payments?status=${statusFilter}`);
      document.querySelectorAll('[data-pstatus]').forEach(b => {
        b.classList.toggle('primary', b.dataset.pstatus === statusFilter);
        b.classList.toggle('ghost', b.dataset.pstatus !== statusFilter);
        const c = counts[b.dataset.pstatus];
        b.textContent = `${STATUS_BN[b.dataset.pstatus] || 'সব'}${c !== undefined ? ` (${bn(c)})` : ''}`;
      });
      $('payPendingBadge').textContent = counts.PENDING ? bn(counts.PENDING) : '';
      $('payPendingBadge').hidden = !counts.PENDING;
      $('payRows').innerHTML = payments.length ? payments.map(p => `
        <tr>
          <td>${fmt(p.createdAt)}</td>
          <td><b>${esc(p.user ? p.user.name : '?')}</b><br><small>${esc(p.user ? p.user.phone : '')}</small></td>
          <td>${p.provider === 'MANUAL'
            ? `<b>${esc(METHOD_BN[p.method] || p.method)}</b> (TrxID)<br><small>প্রেরক: ${esc(p.senderNumber)}${p.duplicateSender ? ` • এই নম্বরে আরও ${bn(p.duplicateSender)}টি` : ''}</small>`
            : `<b>অনলাইন • ${esc(GW_NAME[p.provider] || p.provider)}</b><br><small>${esc(p.cardType || 'স্বয়ংক্রিয় যাচাই')}</small>`}</td>
          <td><code style="font-size:14px;font-weight:700">${esc(p.provider === 'MANUAL' ? p.trxId : p.tranId)}</code>${p.gatewayTxnId ? `<br><small>ব্যাংক/MFS: ${esc(p.gatewayTxnId)}</small>` : ''}</td>
          <td><b>৳${bn(p.amount)}</b><br><small>${esc(p.planNameBn)} (${bn(p.days)} দিন)</small></td>
          <td>${p.status === 'PENDING' && p.provider === 'MANUAL'
            ? `<button class="btn primary sm" data-approve="${p.id}">✅ অনুমোদন</button> <button class="btn ghost sm" data-reject="${p.id}">✕ বাতিল</button>`
            : p.provider !== 'MANUAL' && p.status !== 'APPROVED'
            ? `<span class="badge ENDED">${STATUS_BN[p.status] || p.status}</span><br><button class="btn ghost sm" data-recheck="${p.id}" style="margin-top:4px">🔄 গেটওয়েতে আবার যাচাই</button>`
            : `<span class="badge${p.status === 'APPROVED' ? '" style="background:#dcfce7;color:#166534' : ' ENDED'}">${STATUS_BN[p.status]}</span><br><small>${fmt(p.reviewedAt)}${p.noteBn ? ` • ${esc(p.noteBn)}` : ''}</small>`}</td>
        </tr>`).join('') : `<tr><td colspan="6" style="text-align:center;color:#64748b">কোনো পেমেন্ট নেই।</td></tr>`;
    } catch (e) {
      toast(e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------
  async function loadUsers() {
    try {
      const q = $('userSearch').value.trim();
      const { users, totalUsers, premiumUsers } = await api(`/api/admin/accounts/users?q=${encodeURIComponent(q)}`);
      $('userStats').textContent = `মোট ${bn(totalUsers)} জন • প্রিমিয়াম ${bn(premiumUsers)} জন`;
      $('userRows').innerHTML = users.length ? users.map(u => `
        <tr>
          <td><b>${esc(u.name)}</b><br><small>${esc(u.phone)}</small></td>
          <td>${fmt(u.createdAt)}</td>
          <td>${u.premium ? `<span class="badge" style="background:#dcfce7;color:#166534">⭐ প্রিমিয়াম</span><br><small>${fmt(u.premiumUntil)} পর্যন্ত</small>` : '<span class="badge ENDED">ফ্রি</span>'}</td>
          <td style="white-space:nowrap">
            <button class="btn ghost sm" data-grant="${u.id}">+ দিন যোগ</button>
            ${u.premium ? `<button class="btn ghost sm" data-revoke="${u.id}">প্রিমিয়াম বন্ধ</button>` : ''}
          </td>
        </tr>`).join('') : `<tr><td colspan="4" style="text-align:center;color:#64748b">কোনো ইউজার পাওয়া যায়নি।</td></tr>`;
    } catch (e) {
      toast(e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // Settings: payment numbers, prices, free sets
  // ---------------------------------------------------------------------------
  async function loadSettings() {
    try {
      const data = await api('/api/admin/accounts/settings');
      settings = data.settings;
      renderSettings(data);
    } catch (e) {
      toast(e.message);
    }
  }

  function renderSettings(data) {
    const s = settings;
    const placeholder = s.methods.some(m => m.enabled !== false && /X/i.test(m.number));
    $('setWarn').hidden = !placeholder || s.manualEnabled === false;
    $('setMethods').innerHTML = s.methods.map(m => `
      <div class="row2" style="align-items:end">
        <label class="field">${esc(m.nameBn)} নম্বর
          <input data-mnum="${m.id}" value="${esc(m.number)}" inputmode="numeric" maxlength="14">
        </label>
        <div class="row2">
          <label class="field">ধরন
            <select data-mtype="${m.id}">${['Personal', 'Agent', 'Merchant'].map(t => `<option ${t === m.accountType ? 'selected' : ''}>${t}</option>`).join('')}</select>
          </label>
          <label class="field">চালু?<select data-mon="${m.id}"><option value="1" ${m.enabled !== false ? 'selected' : ''}>হ্যাঁ</option><option value="0" ${m.enabled === false ? 'selected' : ''}>না</option></select></label>
        </div>
      </div>`).join('');
    $('setPlans').innerHTML = s.plans.map((p, i) => `
      <div class="row2" data-plan="${i}">
        <label class="field">প্যাকেজের নাম<input data-pname value="${esc(p.nameBn)}" maxlength="40"><input type="hidden" data-pid value="${esc(p.id)}"></label>
        <div class="row2">
          <label class="field">দাম (৳)<input data-pprice type="number" min="1" value="${p.price}"></label>
          <label class="field">মেয়াদ (দিন)<input data-pdays type="number" min="1" value="${p.days}"></label>
        </div>
      </div>`).join('');
    $('setFree').value = s.freePerGroup;
    $('setManual').value = s.manualEnabled === false ? '0' : '1';
    const gw = data.gateway;
    $('setGateway').innerHTML = !gw
      ? '❌ অনলাইন গেটওয়ে চালু নেই। সার্ভারে PAYMENT_GATEWAY ও স্টোর আইডি সেট করুন (README দেখুন)।'
      : gw.error
      ? `⚠️ ${esc(GW_NAME[gw.provider.toUpperCase()] || gw.provider)}: ${esc(gw.error)}`
      : `✅ অনলাইন পেমেন্ট চালু: <b>${esc(GW_NAME[gw.provider.toUpperCase()] || gw.provider)}</b> ${gw.sandbox ? '(🧪 টেস্ট / Sandbox মোড — আসল টাকা আসবে না)' : '(লাইভ)'}`;
    $('setNotice').value = s.noticeBn || '';
    $('setLockInfo').textContent = `এখন ${bn(data.totalExams)}টি সেটের মধ্যে ${bn(data.lockedCount)}টি লক (প্রিমিয়াম), বাকি ${bn(data.totalExams - data.lockedCount)}টি ফ্রি।`;
  }

  async function saveSettings(ev) {
    ev.preventDefault();
    const btn = $('setSave');
    btn.disabled = true;
    try {
      const data = await api('/api/admin/accounts/settings', {
        methods: settings.methods.map(m => ({
          id: m.id,
          number: document.querySelector(`[data-mnum="${m.id}"]`).value,
          accountType: document.querySelector(`[data-mtype="${m.id}"]`).value,
          enabled: document.querySelector(`[data-mon="${m.id}"]`).value === '1'
        })),
        plans: [...document.querySelectorAll('[data-plan]')].map(row => ({
          id: row.querySelector('[data-pid]').value,
          nameBn: row.querySelector('[data-pname]').value,
          price: Number(row.querySelector('[data-pprice]').value),
          days: Number(row.querySelector('[data-pdays]').value)
        })),
        freePerGroup: Number($('setFree').value),
        manualEnabled: $('setManual').value === '1',
        noticeBn: $('setNotice').value
      });
      settings = data.settings;
      renderSettings(data);
      toast('সেটিংস সংরক্ষণ হয়েছে।');
    } catch (e) {
      toast(e.message);
    } finally {
      btn.disabled = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------
  document.addEventListener('click', async ev => {
    const t = ev.target.closest('[data-pstatus],[data-approve],[data-reject],[data-grant],[data-revoke],[data-recheck]');
    if (!t || !adminKey) return;
    try {
      if (t.dataset.pstatus) {
        statusFilter = t.dataset.pstatus;
        return loadPayments();
      }
      if (t.dataset.approve) {
        const row = t.closest('tr');
        if (!confirm(`নিশ্চিত? ${row.querySelector('code').textContent} TrxID টি আপনার স্টেটমেন্টে সঠিক টাকাসহ এসেছে?`)) return;
        await api(`/api/admin/accounts/payments/${t.dataset.approve}/approve`, {});
        toast('অনুমোদিত। ইউজারের প্রিমিয়াম চালু হয়েছে।');
      }
      if (t.dataset.reject) {
        const note = prompt('বাতিলের কারণ (ইউজার দেখবে):', 'TrxID বা টাকার পরিমাণ মেলেনি।');
        if (note === null) return;
        await api(`/api/admin/accounts/payments/${t.dataset.reject}/reject`, { noteBn: note });
        toast('পেমেন্ট বাতিল করা হয়েছে।');
      }
      if (t.dataset.recheck) {
        const { payment } = await api(`/api/admin/accounts/payments/${t.dataset.recheck}/recheck`, {});
        toast(payment.status === 'APPROVED' ? 'গেটওয়েতে পেমেন্ট সফল পাওয়া গেছে, প্রিমিয়াম চালু হয়েছে।' : 'গেটওয়েতে এই পেমেন্ট সফল হিসেবে পাওয়া যায়নি।');
      }
      if (t.dataset.grant) {
        const days = prompt('কত দিনের প্রিমিয়াম যোগ করবেন?', '30');
        if (!days) return;
        await api(`/api/admin/accounts/users/${t.dataset.grant}/grant`, { days: Number(days) });
        toast('প্রিমিয়াম যোগ হয়েছে।');
      }
      if (t.dataset.revoke) {
        if (!confirm('এই ইউজারের প্রিমিয়াম এখনই বন্ধ করবেন?')) return;
        await api(`/api/admin/accounts/users/${t.dataset.revoke}/revoke`, {});
        toast('প্রিমিয়াম বন্ধ করা হয়েছে।');
      }
      loadPayments();
      loadUsers();
    } catch (e) {
      toast(e.message);
    }
  });

  document.addEventListener('admin:login', ev => {
    adminKey = ev.detail.key;
    $('paymentArea').hidden = false;
    loadPayments();
    loadUsers();
    loadSettings();
  });

  $('userSearchForm').addEventListener('submit', ev => { ev.preventDefault(); loadUsers(); });
  $('settingsForm').addEventListener('submit', saveSettings);
  setInterval(() => { if (adminKey && statusFilter === 'PENDING') loadPayments(); }, 30000);
})();

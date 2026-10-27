/**
 * Account, premium lock & bKash / Nagad / Rocket payment UI (website + Android app)
 * - Load after /native-app.js and /seed-data.js (seed-data sets window.APP_ACCESS)
 * - Account.allow(examId): true when the set is free or the user is premium,
 *   otherwise opens the unlock dialog and returns false
 * - Locked <option>s and set buttons get a 🔒 automatically
 * - Inside the Android app the payment part is hidden (data-payment); the app only logs in
 */
(function () {
  const bn = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const access = window.APP_ACCESS || { premium: false, lockedExamIds: [] };
  const locked = new Set(access.lockedExamIds || []);
  const examIds = new Set((window.availableExams || []).map(e => e.id));
  const fmtDate = iso => new Date(iso).toLocaleDateString('bn-BD', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'long', year: 'numeric' });

  let me = null;
  let config = null;
  let pollId = null;

  function resolve(id) {
    if (!id) return null;
    if (examIds.has(id)) return id;
    const base = String(id).replace(/_SET$/, '');
    if (examIds.has(base)) return base;
    if (examIds.has(`${base}_SET`)) return `${base}_SET`;
    return null;
  }

  const isLocked = id => !access.premium && locked.has(resolve(id));

  // Premium questions come with /seed-data.js, so a reload fetches them.
  // Guarded so a page that still gets the free data can never reload in a loop.
  function reloadForPremium() {
    let last = 0;
    try { last = Number(sessionStorage.getItem('accReloadAt')) || 0; } catch { /* storage blocked */ }
    if (Date.now() - last < 30000) return false;
    try { sessionStorage.setItem('accReloadAt', String(Date.now())); } catch { /* storage blocked */ }
    toast('প্রিমিয়াম চালু আছে, সব সেট খোলা হচ্ছে...');
    setTimeout(() => location.reload(), 700);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Styles (pages use different CSS frameworks, so this is self-contained)
  // ---------------------------------------------------------------------------
  const css = `
  .acc-pill{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;border:1px solid #cbd5e1;background:#fff;color:#0f172a;font:600 13px/1.2 'Noto Sans Bengali',system-ui,sans-serif;cursor:pointer;white-space:nowrap}
  .acc-pill:hover{border-color:#006a4e}
  .acc-pill.premium{background:#fef3c7;border-color:#f59e0b;color:#92400e}
  .acc-floating{position:fixed;right:14px;bottom:14px;z-index:9000;box-shadow:0 4px 14px rgba(0,0,0,.15)}
  .acc-overlay{position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.55);display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow-y:auto}
  .acc-overlay[hidden]{display:none}
  .acc-modal{background:#fff;color:#0f172a;border-radius:16px;width:100%;max-width:460px;padding:20px;font:400 14px/1.55 'Noto Sans Bengali',system-ui,sans-serif;box-shadow:0 20px 50px rgba(0,0,0,.3);position:relative}
  .acc-modal h3{font-size:18px;font-weight:700;margin:0 0 4px}
  .acc-modal .acc-sub{color:#475569;font-size:13px;margin-bottom:14px}
  .acc-x{position:absolute;top:10px;right:12px;border:0;background:none;font-size:20px;cursor:pointer;color:#64748b}
  .acc-tabs{display:flex;gap:6px;margin-bottom:14px}
  .acc-tabs button{flex:1;padding:8px;border-radius:10px;border:1px solid #e2e8f0;background:#f8fafc;font:600 14px 'Noto Sans Bengali',sans-serif;cursor:pointer}
  .acc-tabs button.on{background:#006a4e;color:#fff;border-color:#006a4e}
  .acc-field{display:block;margin-bottom:10px;font-weight:600;font-size:13px}
  .acc-field input,.acc-field select{display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;font:400 15px 'Noto Sans Bengali',sans-serif}
  .acc-btn{display:block;width:100%;padding:11px;border:0;border-radius:10px;background:#006a4e;color:#fff;font:700 15px 'Noto Sans Bengali',sans-serif;cursor:pointer;margin-top:6px}
  .acc-btn:disabled{opacity:.6;cursor:wait}
  .acc-btn.ghost{background:#f1f5f9;color:#0f172a}
  .acc-err{color:#b91c1c;font-size:13px;min-height:18px;margin:4px 0}
  .acc-ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;border-radius:10px;padding:10px 12px;font-size:13px;margin-bottom:10px}
  .acc-warn{background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:10px;padding:10px 12px;font-size:13px;margin-bottom:10px}
  .acc-plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:12px}
  .acc-plan{border:2px solid #e2e8f0;border-radius:12px;padding:10px;text-align:center;cursor:pointer}
  .acc-plan input{display:none}
  .acc-plan.on{border-color:#006a4e;background:#ecfdf5}
  .acc-plan b{display:block;font-size:18px}
  .acc-methods{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}
  .acc-methods label{flex:1;min-width:90px;border:2px solid #e2e8f0;border-radius:10px;padding:8px;text-align:center;font-weight:700;cursor:pointer}
  .acc-methods label.on{border-color:#e2136e;background:#fdf2f8}
  .acc-methods input{display:none}
  .acc-steps{background:#f8fafc;border:1px dashed #94a3b8;border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:13px}
  .acc-steps ol{margin:4px 0 0 18px;padding:0}
  .acc-num{font:700 17px monospace;letter-spacing:1px;color:#0f172a;user-select:all}
  .acc-copy{margin-left:6px;padding:2px 8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;cursor:pointer;font-size:12px}
  .acc-list{list-style:none;margin:0;padding:0;font-size:13px}
  .acc-list li{border-top:1px solid #e2e8f0;padding:6px 0}
  .acc-badge{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:700}
  .acc-badge.INITIATED,.acc-badge.FAILED,.acc-badge.CANCELLED{background:#f1f5f9;color:#475569}.acc-badge.PENDING{background:#fef3c7;color:#92400e}.acc-badge.APPROVED{background:#dcfce7;color:#166534}.acc-badge.REJECTED{background:#fee2e2;color:#991b1b}
  .acc-lockcard{background:#fff;border:2px dashed #f59e0b;border-radius:16px;padding:28px 18px;text-align:center;font-family:'Noto Sans Bengali',sans-serif}
  .acc-lockcard .acc-btn{display:inline-block;width:auto;padding:10px 22px}
  .acc-locked-chip{opacity:.75}
  .app-unlock-note{display:none}
  .is-native-app .app-unlock-note{display:block!important}
  .is-native-app [data-payment]{display:none!important}
  .acc-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:10001;background:#0f172a;color:#fff;padding:10px 16px;border-radius:10px;font:500 14px 'Noto Sans Bengali',sans-serif;max-width:90vw}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ---------------------------------------------------------------------------
  // API
  // ---------------------------------------------------------------------------
  async function api(url, body) {
    const res = await fetch(url, body ? {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body)
    } : { credentials: 'same-origin', cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.messageBn || 'সার্ভারের সাথে যোগাযোগ করা যায়নি। আবার চেষ্টা করুন।');
    return data;
  }

  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'acc-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  // ---------------------------------------------------------------------------
  // Modal shell
  // ---------------------------------------------------------------------------
  let overlay = null;
  function modal(html) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'acc-overlay';
      overlay.addEventListener('click', ev => {
        if (ev.target === overlay || ev.target.closest('.acc-x')) close();
      });
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `<div class="acc-modal" role="dialog" aria-modal="true"><button type="button" class="acc-x" aria-label="বন্ধ করুন">✕</button>${html}</div>`;
    overlay.hidden = false;
    return overlay.querySelector('.acc-modal');
  }
  function close() { if (overlay) overlay.hidden = true; }

  // ---------------------------------------------------------------------------
  // Login / register
  // ---------------------------------------------------------------------------
  function openLogin(reasonBn, then) {
    let mode = 'login';
    const box = modal(`
      <h3>অ্যাকাউন্ট</h3>
      <div class="acc-sub">${esc(reasonBn || 'মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে লগইন করুন। ওয়েবসাইট ও অ্যাপে একই অ্যাকাউন্ট চলবে।')}</div>
      <div class="acc-tabs"><button type="button" data-mode="login" class="on">লগইন</button><button type="button" data-mode="register">নতুন অ্যাকাউন্ট</button></div>
      <form>
        <label class="acc-field" data-only="register" hidden>আপনার নাম<input name="name" autocomplete="name" maxlength="80"></label>
        <label class="acc-field">মোবাইল নম্বর<input name="phone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="01XXXXXXXXX" required></label>
        <label class="acc-field">পাসওয়ার্ড<input name="password" type="password" autocomplete="current-password" minlength="6" required></label>
        <div class="acc-err"></div>
        <button class="acc-btn" type="submit">লগইন করুন</button>
      </form>`);
    const form = box.querySelector('form');
    const setMode = m => {
      mode = m;
      box.querySelectorAll('.acc-tabs button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
      box.querySelector('[data-only="register"]').hidden = m !== 'register';
      form.name.required = m === 'register';
      form.password.autocomplete = m === 'register' ? 'new-password' : 'current-password';
      form.querySelector('.acc-btn').textContent = m === 'register' ? 'অ্যাকাউন্ট খুলুন' : 'লগইন করুন';
    };
    box.querySelectorAll('.acc-tabs button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const btn = form.querySelector('.acc-btn');
      const err = form.querySelector('.acc-err');
      err.textContent = '';
      btn.disabled = true;
      try {
        const data = await api(mode === 'register' ? '/api/auth/register' : '/api/auth/login', {
          name: form.name.value, phone: form.phone.value, password: form.password.value
        });
        me = data.user;
        renderPill();
        // Premium content comes with the page data, so reload once to get it
        if (me.premium && !access.premium && reloadForPremium()) return;
        close();
        toast(mode === 'register' ? 'অ্যাকাউন্ট খোলা হয়েছে।' : 'লগইন হয়েছে।');
        if (then) then();
      } catch (e) {
        err.textContent = e.message;
      } finally {
        btn.disabled = false;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Unlock (paywall) + payment form
  // ---------------------------------------------------------------------------
  async function openUnlock(examId) {
    const exam = (window.availableExams || []).find(e => e.id === resolve(examId));
    if (!me) {
      return openLogin(`${exam ? `"${exam.title}" ` : 'এই সেটটি '}প্রিমিয়াম। আনলক করতে আগে লগইন বা নতুন অ্যাকাউন্ট খুলুন।`, () => openUnlock(examId));
    }
    // Premium on the server but this page was loaded before: reload for the data
    if (me.premium && reloadForPremium()) return;
    const box = modal(`<h3>🔒 প্রিমিয়াম সেট</h3><div class="acc-sub">লোড হচ্ছে...</div>`);
    try {
      if (!config) config = await api('/api/payment/config');
    } catch (e) {
      box.querySelector('.acc-sub').textContent = e.message;
      return;
    }
    let mine = { payments: [] };
    try { mine = await api('/api/payment/mine'); } catch { /* shown as empty */ }
    const pending = mine.payments.filter(p => p.status === 'PENDING');
    const plan0 = config.plans[0];
    const m0 = config.methods[0];

    const gw = config.gateway;
    const manualForm = config.manualEnabled && config.methods.length ? `
        <form class="acc-manual">
          <div class="acc-methods">${config.methods.map(m => `
            <label class="${m.id === m0.id ? 'on' : ''}"><input type="radio" name="method" value="${esc(m.id)}" ${m.id === m0.id ? 'checked' : ''}>${esc(m.nameBn)}</label>`).join('')}
          </div>
          <div class="acc-steps"></div>
          <label class="acc-field">যে নম্বর থেকে টাকা পাঠিয়েছেন<input name="senderNumber" type="tel" inputmode="numeric" placeholder="01XXXXXXXXX" required></label>
          <label class="acc-field">TrxID (ট্রানজেকশন আইডি)<input name="trxId" autocomplete="off" placeholder="যেমন 9F7A2BC4XD" required style="text-transform:uppercase"></label>
          <div class="acc-err"></div>
          <button class="acc-btn${gw ? ' ghost' : ''}" type="submit">পেমেন্ট যাচাইয়ের জন্য জমা দিন</button>
          ${config.noticeBn ? `<div class="acc-sub" style="margin:8px 0 0">${esc(config.noticeBn)}</div>` : ''}
        </form>` : '';

    const html = `
      <h3>🔒 ${exam ? esc(exam.title) : 'প্রিমিয়াম সেট'}</h3>
      <div class="acc-sub">ফ্রিতে প্রতিটি পরীক্ষার ধরনে ${bn(config.freePerGroup)}টি মডেল সেট ও ${bn(config.freePerGroup)}টি বিগত সালের প্রশ্ন খোলা। প্রিমিয়ামে সব মডেল টেস্ট, সব বিগত প্রশ্ন, সুপার-হট সেট ও প্রিন্ট/OMR সব খুলে যাবে।</div>
      ${pending.length ? `<div class="acc-ok">⏳ আপনার ${bn(pending.length)}টি পেমেন্ট যাচাই হচ্ছে (TrxID: ${pending.map(p => esc(p.trxId)).join(', ')})। অনুমোদন হলেই সব সেট খুলে যাবে, এই পেজ খোলা থাকলে নিজে থেকেই জানানো হবে।</div>` : ''}
      <div class="app-unlock-note acc-warn">আনলক করতে ওয়েবসাইটে একই মোবাইল নম্বর দিয়ে লগইন করুন। পেমেন্টের পর অ্যাপেও সব সেট খুলে যাবে।</div>
      <div class="acc-pay" data-payment>
        <div class="acc-plans">${config.plans.map(p => `
          <label class="acc-plan ${p.id === plan0.id ? 'on' : ''}"><input type="radio" name="planId" value="${esc(p.id)}" ${p.id === plan0.id ? 'checked' : ''}>
            ${esc(p.nameBn)}<b>৳${bn(p.price)}</b></label>`).join('')}
        </div>
        ${gw ? `
          ${gw.sandbox ? '<div class="acc-warn">🧪 টেস্ট মোড (Sandbox): আসল টাকা কাটবে না।</div>' : ''}
          <button type="button" class="acc-btn acc-gw">💳 অনলাইনে পেমেন্ট করুন</button>
          <div class="acc-sub" style="text-align:center;margin:6px 0 0">বিকাশ • নগদ • রকেট • উপায় • ভিসা • মাস্টারকার্ড — পেমেন্ট সফল হলেই সাথে সাথে সব সেট খুলে যাবে।</div>
          <div class="acc-err acc-gw-err"></div>
          ${manualForm ? `<details style="margin-top:10px"><summary style="cursor:pointer;font-weight:600">অথবা নিজে Send Money করে TrxID দিন</summary>${manualForm}</details>` : ''}`
        : manualForm || '<div class="acc-warn">অনলাইন পেমেন্ট শিগগির চালু হবে।</div>'}
      </div>
      ${mine.payments.length ? `<details style="margin-top:12px"><summary style="cursor:pointer;font-weight:600">আমার পেমেন্ট (${bn(mine.payments.length)})</summary><ul class="acc-list">${mine.payments.map(paymentRow).join('')}</ul></details>` : ''}`;
    const b = modal(html);
    const planId = () => (b.querySelector('input[name=planId]:checked') || {}).value;
    b.querySelector('.acc-plans').addEventListener('change', () => {
      b.querySelectorAll('.acc-plan').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
      if (form) showSteps();
    });

    // Online gateway: our server creates the checkout, then the browser goes to the gateway page
    const gwBtn = b.querySelector('.acc-gw');
    if (gwBtn) {
      gwBtn.addEventListener('click', async () => {
        const err = b.querySelector('.acc-gw-err');
        err.textContent = '';
        gwBtn.disabled = true;
        gwBtn.textContent = 'পেমেন্ট পেজ খোলা হচ্ছে...';
        try {
          const data = await api('/api/payment/initiate', { planId: planId(), returnTo: location.pathname + location.hash });
          location.href = data.url;
        } catch (e) {
          err.textContent = e.message;
          gwBtn.disabled = false;
          gwBtn.textContent = '💳 অনলাইনে পেমেন্ট করুন';
        }
      });
    }

    const form = b.querySelector('form.acc-manual');
    if (!form) return;
    function showSteps() {
      const m = config.methods.find(x => x.id === form.method.value) || m0;
      const plan = config.plans.find(x => x.id === planId()) || plan0;
      const verb = m.accountType === 'Merchant' ? 'Payment' : m.accountType === 'Agent' ? 'Cash Out' : 'Send Money';
      b.querySelector('.acc-steps').innerHTML = `
        <b>${esc(m.nameBn)} (${esc(m.accountType)}) নম্বর:</b> <span class="acc-num">${esc(m.number)}</span><button type="button" class="acc-copy" data-copy="${esc(m.number)}">কপি</button>
        <ol>
          <li>${esc(m.nameBn)} অ্যাপ বা *২৪৭# থেকে <b>${verb}</b> করুন।</li>
          <li>ঠিক <b>৳${bn(plan.price)}</b> পাঠান (${esc(plan.nameBn)})।</li>
          <li>SMS এ পাওয়া <b>TrxID</b> আর আপনার নম্বর নিচে লিখে জমা দিন।</li>
        </ol>`;
      b.querySelectorAll('.acc-methods label').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
    }
    form.addEventListener('change', showSteps);
    b.addEventListener('click', async ev => {
      const c = ev.target.closest('[data-copy]');
      if (!c) return;
      try { await navigator.clipboard.writeText(c.dataset.copy); toast('নম্বর কপি হয়েছে'); } catch { /* user can select the number */ }
    });
    showSteps();
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const btn = form.querySelector('.acc-btn');
      const err = form.querySelector('.acc-err');
      err.textContent = '';
      btn.disabled = true;
      try {
        const data = await api('/api/payment/submit', {
          planId: planId(), method: form.method.value,
          senderNumber: form.senderNumber.value, trxId: form.trxId.value
        });
        me = data.user;
        renderPill();
        startPolling();
        modal(`<h3>✅ পেমেন্ট জমা হয়েছে</h3>
          <div class="acc-ok">TrxID <b>${esc(data.payment.trxId)}</b> • ৳${bn(data.payment.amount)} • ${esc(data.payment.planNameBn)}</div>
          <p>আমরা ${esc((config.methods.find(m => m.id === data.payment.method) || {}).nameBn || '')} স্টেটমেন্টে মিলিয়ে দেখে প্রিমিয়াম চালু করব। অনুমোদন হলে এই পেজে জানানো হবে, অথবা পরে লগইন করলেই সব সেট খোলা পাবেন।</p>
          <button type="button" class="acc-btn ghost acc-x" style="position:static">ঠিক আছে</button>`);
      } catch (e) {
        err.textContent = e.message;
      } finally {
        btn.disabled = false;
      }
    });
  }

  const STATUS_BN = { PENDING: 'যাচাই হচ্ছে', APPROVED: 'সফল', REJECTED: 'বাতিল', INITIATED: 'অসম্পূর্ণ', FAILED: 'ব্যর্থ', CANCELLED: 'বাতিল করেছেন' };
  function paymentRow(p) {
    return `<li><span class="acc-badge ${p.status}">${STATUS_BN[p.status] || p.status}</span>
      ${esc(p.provider === 'MANUAL' ? p.method : 'অনলাইন')} • ${esc(p.trxId || p.tranId)} • ৳${bn(p.amount)} • ${fmtDate(p.createdAt)}
      ${p.status === 'REJECTED' && p.noteBn ? `<br><small style="color:#991b1b">${esc(p.noteBn)}</small>` : ''}</li>`;
  }

  // ---------------------------------------------------------------------------
  // Account menu
  // ---------------------------------------------------------------------------
  async function openAccount() {
    if (!me) return openLogin();
    let mine = { payments: [] };
    try { mine = await api('/api/payment/mine'); me = mine.user || me; } catch { /* keep cached */ }
    const b = modal(`
      <h3>👤 ${esc(me.name)}</h3>
      <div class="acc-sub">${esc(me.phone)}</div>
      ${me.premium
        ? `<div class="acc-ok">⭐ প্রিমিয়াম চালু আছে — ${fmtDate(me.premiumUntil)} পর্যন্ত।</div>`
        : `<div class="acc-warn">ফ্রি অ্যাকাউন্ট। ${bn(locked.size)}টি প্রিমিয়াম সেট লক করা আছে।</div>
           <button type="button" class="acc-btn" data-act="unlock" data-payment>🔓 সব সেট আনলক করুন</button>
           <div class="app-unlock-note acc-sub">আনলক করতে ওয়েবসাইটে একই নম্বর দিয়ে লগইন করুন।</div>`}
      ${mine.payments.length ? `<details style="margin-top:12px" data-payment><summary style="cursor:pointer;font-weight:600">আমার পেমেন্ট (${bn(mine.payments.length)})</summary><ul class="acc-list">${mine.payments.map(paymentRow).join('')}</ul></details>` : ''}
      <button type="button" class="acc-btn ghost" data-act="logout" style="margin-top:12px">লগআউট</button>`);
    b.addEventListener('click', async ev => {
      const t = ev.target.closest('[data-act]');
      if (!t) return;
      if (t.dataset.act === 'unlock') openUnlock(null);
      if (t.dataset.act === 'logout') {
        try { await api('/api/auth/logout', {}); } catch { /* cookie cleared anyway */ }
        location.reload();
      }
    });
  }

  let pill = null;
  function renderPill() {
    if (!pill) {
      pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'acc-pill';
      pill.addEventListener('click', openAccount);
      const slot = document.getElementById('accountSlot');
      if (slot) slot.appendChild(pill);
      else { pill.classList.add('acc-floating'); document.body.appendChild(pill); }
    }
    pill.classList.toggle('premium', Boolean(me && me.premium));
    pill.innerHTML = !me ? '👤 লগইন' : me.premium ? `⭐ ${esc(me.name.split(' ')[0])}` : `👤 ${esc(me.name.split(' ')[0])}`;
  }

  // While a payment waits for approval, check every minute so the page can unlock itself
  function startPolling() {
    if (pollId || !me || me.premium || !me.pendingPayments) return;
    pollId = setInterval(async () => {
      try {
        const data = await api('/api/auth/me');
        me = data.user;
        renderPill();
        if (me && me.premium) {
          clearInterval(pollId);
          modal(`<h3>🎉 প্রিমিয়াম চালু হয়েছে</h3><div class="acc-ok">আপনার পেমেন্ট অনুমোদিত হয়েছে। সব সেট খোলার জন্য পেজটি আবার লোড করুন।</div>
            <button type="button" class="acc-btn" onclick="location.reload()">সব সেট খুলুন</button>`);
        } else if (!me || !me.pendingPayments) {
          clearInterval(pollId);
          pollId = null;
        }
      } catch { /* try again next minute */ }
    }, 60000);
  }

  // ---------------------------------------------------------------------------
  // 🔒 marks on locked set options / buttons
  // ---------------------------------------------------------------------------
  const ONCLICK_ID = /(?:selectQuickPracticeSet|launchExamFromPastBank)\(([^)]*)\)/;
  function decorate() {
    if (access.premium || !locked.size) return;
    document.querySelectorAll('option').forEach(o => {
      if (o.dataset.accDone || !o.value || !isLocked(o.value)) return;
      o.dataset.accDone = '1';
      o.textContent = `🔒 ${o.textContent}`;
    });
    document.querySelectorAll('[onclick]').forEach(el => {
      if (el.dataset.accDone) return;
      const m = el.getAttribute('onclick').match(ONCLICK_ID);
      if (!m) return;
      const args = m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
      const id = args[args.length - 1];
      el.dataset.accDone = '1';
      if (!isLocked(id)) return;
      el.classList.add('acc-locked-chip');
      el.insertAdjacentText('afterbegin', '🔒 ');
    });
  }
  let decorateQueued = false;
  const queueDecorate = () => {
    if (decorateQueued) return;
    decorateQueued = true;
    requestAnimationFrame(() => { decorateQueued = false; decorate(); });
  };

  // ---------------------------------------------------------------------------
  // Public API used by app.js / exam-hall.js / omr-sheet.html
  // ---------------------------------------------------------------------------
  window.Account = {
    get user() { return me; },
    isPremium: () => Boolean(access.premium),
    isLocked,
    allow(examId) {
      if (!isLocked(examId)) return true;
      openUnlock(examId);
      return false;
    },
    // First set in a <select> that this user may open (prefers `preferred`)
    firstAllowedOption(sel, preferred) {
      if (!sel) return null;
      const opts = [...sel.options].map(o => o.value).filter(Boolean);
      if (preferred && opts.includes(preferred) && !isLocked(preferred)) return preferred;
      return opts.find(v => !isLocked(v)) || null;
    },
    // Past-question browser: which exam a filter value stands for
    pastBankExamId(track, mode, value) {
      if (mode !== 'YEAR' || !value || value === 'ALL' || /^ARCHIVE_/.test(value)) return null;
      if (value === 'SUPER_HOT_10') return 'SUPER_HOT_200_SET';
      if (value === 'SUPER_HOT_5') return 'SUPER_HOT_100_SET';
      if (track === 'BCS') {
        const digits = String(value).replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d)).match(/\d+/);
        return digits ? resolve(`BCS_${digits[0]}_SET`) : null;
      }
      return resolve(value);
    },
    lockedCardHtml(examId) {
      const exam = (window.availableExams || []).find(e => e.id === resolve(examId));
      return `<div class="acc-lockcard">
        <div style="font-size:40px">🔒</div>
        <h3 style="font-size:18px;font-weight:700;margin:6px 0">${esc(exam ? exam.title : 'প্রিমিয়াম সেট')}</h3>
        <p style="color:#475569;margin-bottom:14px">এই প্রশ্নসেটটি প্রিমিয়াম। বিকাশ / নগদ / রকেটে পেমেন্ট করে সব সেট আনলক করুন।</p>
        <button type="button" class="acc-btn" onclick="Account.allow('${esc(examId)}')">🔓 আনলক করুন</button>
      </div>`;
    },
    openLogin: () => openLogin(),
    openUnlock
  };

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  // Back from the online gateway: /?payment=success|failed|cancelled
  async function showGatewayResult(result) {
    history.replaceState(null, '', location.pathname + location.hash);
    if (result !== 'success' && result !== 'success_pending') {
      modal(`<h3>${result === 'cancelled' ? 'পেমেন্ট বাতিল করেছেন' : '❌ পেমেন্ট সফল হয়নি'}</h3>
        <p>কোনো টাকা কাটা হলে তা স্বয়ংক্রিয়ভাবে ফেরত যাবে। আবার চেষ্টা করতে লক করা যেকোনো সেটে ক্লিক করুন।</p>
        <button type="button" class="acc-btn ghost acc-x" style="position:static">ঠিক আছে</button>`);
      return;
    }
    if (access.premium) {
      modal(`<h3>🎉 পেমেন্ট সফল, প্রিমিয়াম চালু হয়েছে</h3><div class="acc-ok">সব মডেল টেস্ট, বিগত প্রশ্ন ও সুপার-হট সেট এখন খোলা।${me && me.premiumUntil ? ` মেয়াদ: ${fmtDate(me.premiumUntil)} পর্যন্ত।` : ''}</div>
        <button type="button" class="acc-btn acc-x" style="position:static">শুরু করুন</button>`);
      return;
    }
    // Gateway said success but our server is still confirming (IPN may come a little later)
    modal(`<h3>⏳ পেমেন্ট যাচাই হচ্ছে</h3><p>গেটওয়ে থেকে নিশ্চিত হওয়ার অপেক্ষা করছি। সাধারণত কয়েক সেকেন্ড লাগে...</p>`);
    for (let i = 0; i < 12; i++) {
      await new Promise(r => setTimeout(r, 5000));
      try {
        const data = await api('/api/auth/me');
        me = data.user;
        if (me && me.premium) return reloadForPremium() || location.reload();
      } catch { /* retry */ }
    }
    modal(`<h3>⏳ পেমেন্ট এখনো নিশ্চিত হয়নি</h3><p>টাকা কেটে থাকলে কিছুক্ষণের মধ্যে প্রিমিয়াম চালু হবে। না হলে আমাদের জানান, আমরা যাচাই করে দেব।</p>
      <button type="button" class="acc-btn ghost acc-x" style="position:static">ঠিক আছে</button>`);
  }

  async function init() {
    renderPill();
    decorate();
    new MutationObserver(queueDecorate).observe(document.body, { childList: true, subtree: true });
    const gwResult = new URLSearchParams(location.search).get('payment');
    try {
      const data = await api('/api/auth/me');
      me = data.user;
      renderPill();
      if (gwResult) return showGatewayResult(gwResult);
      // Logged in elsewhere or approved since this page loaded
      if (me && me.premium && !access.premium) reloadForPremium();
      startPolling();
    } catch { /* offline: stay logged out */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

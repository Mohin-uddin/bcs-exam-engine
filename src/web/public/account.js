/**
 * Account, premium lock & bKash / Nagad / Rocket payment UI (website + Android app)
 * - Load after /native-app.js and /seed-data.js (seed-data sets window.APP_ACCESS)
 * - Account.allow(examId): true when the set is free or the user is premium,
 *   otherwise opens the unlock dialog and returns false
 * - Locked <option>s and set buttons get a 🔒 automatically
 * - Inside the Android app the payment part is hidden (data-payment); the app only logs in
 * - Plans: FREE (a few sets), NORMAL (all sets, view only), PREMIUM (all sets + download / print)
 * - Cash on Delivery: order form with SMS OTP + location check, then the access code that comes
 *   inside the printed question-set packet is typed in openRedeem()
 * - Account.allowPrint(): print / save-as-PDF only for PREMIUM; window.print and Ctrl+P are blocked otherwise
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
  .acc-plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px;margin-bottom:12px}
  .acc-plan{border:2px solid #e2e8f0;border-radius:12px;padding:10px;text-align:center;cursor:pointer}
  .acc-plan input{display:none}
  .acc-plan.on{border-color:#006a4e;background:#ecfdf5}
  .acc-plan b{display:block;font-size:18px}
  .acc-plan small{display:block;font-size:11px;color:#475569;line-height:1.4}
  .acc-plan small.acc-plan-cod{color:#92400e}
  .acc-field textarea{display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;font:400 15px 'Noto Sans Bengali',sans-serif;resize:vertical}
  .acc-address{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px 2px;margin:0 0 12px}
  .acc-address legend{font-weight:700;font-size:13px;padding:0 4px}
  .acc-row2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  @media (max-width:420px){.acc-row2{grid-template-columns:1fr}}
  .acc-cod{margin-top:10px}
  .acc-cod .acc-sub{margin:6px 0 0}
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
  .acc-cmp{width:100%;border-collapse:collapse;font-size:13px;margin:4px 0 12px}
  .acc-cmp th,.acc-cmp td{border:1px solid #e2e8f0;padding:6px 5px;text-align:center;vertical-align:middle}
  .acc-cmp th:first-child,.acc-cmp td:first-child{text-align:left}
  .acc-cmp thead th{background:#f8fafc}
  .acc-cmp .hl{background:#fffbeb}
  .acc-plancard{border:2px solid #e2e8f0;border-radius:14px;padding:12px;margin-bottom:10px}
  .acc-plancard.prem{border-color:#f59e0b;background:#fffbeb}
  .acc-plancard h4{margin:0;font-size:16px;font-weight:700;display:flex;justify-content:space-between;gap:8px}
  .acc-plancard p{margin:4px 0 8px;color:#475569;font-size:13px}
  .acc-link{background:none;border:0;color:#006a4e;font:600 14px 'Noto Sans Bengali',sans-serif;text-decoration:underline;cursor:pointer;padding:4px 0}
  .acc-row{display:flex;gap:8px;align-items:flex-end}
  .acc-row .acc-field{flex:1}
  .acc-row .acc-btn{width:auto;white-space:nowrap;padding:10px 12px;margin:0 0 10px}
  .acc-sum{background:#f8fafc;border-radius:10px;padding:8px 12px;font-size:13px;margin:6px 0 10px}
  .acc-sum div{display:flex;justify-content:space-between}
  .acc-sum .t{font-weight:700;font-size:15px;border-top:1px solid #cbd5e1;margin-top:4px;padding-top:4px}
  .acc-code{font:700 22px monospace;letter-spacing:3px;text-align:center;text-transform:uppercase}
  .acc-preview{max-height:300px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;margin-bottom:12px;font-size:13px}
  .acc-preview li{margin-bottom:8px}
  .acc-preview .o{color:#475569}
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
        announce();
        applyPrintLock();
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
  async function openOnlinePay(examId) {
    const exam = (window.availableExams || []).find(e => e.id === resolve(examId));
    if (!me) {
      return openLogin('অনলাইনে পেমেন্ট করতে আগে লগইন বা নতুন অ্যাকাউন্ট খুলুন।', () => openOnlinePay(examId));
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

    // Printed pack: home address (filled from the last order) and cash on delivery
    const lastAddr = (mine.payments.find(p => p.delivery) || {}).delivery || { name: me.name, phone: me.phone };
    const addressBox = config.plans.some(p => p.printPack) ? `
        <fieldset class="acc-address" hidden>
          <legend>📦 প্রিন্ট করা প্রশ্নের প্যাকেট কোথায় পাঠাব?</legend>
          <div class="acc-row2">
            <label class="acc-field">প্রাপকের নাম<input name="dName" autocomplete="name" maxlength="80" value="${esc(lastAddr.name)}"></label>
            <label class="acc-field">মোবাইল (কুরিয়ার ফোন করবে)<input name="dPhone" type="tel" inputmode="numeric" placeholder="01XXXXXXXXX" value="${esc(lastAddr.phone)}"></label>
          </div>
          <label class="acc-field">জেলা<input name="dDistrict" maxlength="40" placeholder="যেমন ঢাকা" value="${esc(lastAddr.district)}"></label>
          <label class="acc-field">পুরো ঠিকানা<textarea name="dAddress" rows="2" maxlength="300" placeholder="বাসা, রোড, এলাকা, থানা">${esc(lastAddr.address)}</textarea></label>
        </fieldset>` : '';
    const codBox = config.codEnabled ? `
        <div class="acc-cod" hidden>
          <button type="button" class="acc-btn ghost acc-cod-btn">🚚 ক্যাশ অন ডেলিভারি</button>
          <div class="acc-sub acc-cod-note"></div>
          <div class="acc-err acc-cod-err"></div>
        </div>` : '';

    const html = `
      <h3>🔒 ${exam ? esc(exam.title) : 'প্রিমিয়াম সেট'}</h3>
      <div class="acc-sub">ফ্রিতে প্রতিটি পরীক্ষার ধরনে ${bn(config.freePerGroup)}টি মডেল সেট ও ${bn(config.freePerGroup)}টি বিগত সালের প্রশ্ন খোলা। প্রিমিয়ামে সব মডেল টেস্ট, সব বিগত প্রশ্ন, সুপার-হট সেট ও প্রিন্ট করার সুবিধা সব খুলে যাবে।</div>
      ${pending.length ? `<div class="acc-ok">⏳ আপনার ${bn(pending.length)}টি পেমেন্ট যাচাই হচ্ছে (TrxID: ${pending.map(p => esc(p.trxId)).join(', ')})। অনুমোদন হলেই সব সেট খুলে যাবে, এই পেজ খোলা থাকলে নিজে থেকেই জানানো হবে।</div>` : ''}
      <div class="app-unlock-note acc-warn">আনলক করতে ওয়েবসাইটে একই মোবাইল নম্বর দিয়ে লগইন করুন। পেমেন্টের পর অ্যাপেও সব সেট খুলে যাবে।</div>
      <div class="acc-pay" data-payment>
        <div class="acc-plans">${config.plans.map(p => `
          <label class="acc-plan ${p.id === plan0.id ? 'on' : ''}"><input type="radio" name="planId" value="${esc(p.id)}" ${p.id === plan0.id ? 'checked' : ''}>
            ${esc(p.nameBn)}<b>৳${bn(p.price)}</b>
            <small>${p.printPack ? '📦 প্রিন্ট প্যাকেট বাসায়' : 'শুধু অনলাইন'}</small>
            ${p.codPrice && config.codEnabled ? `<small class="acc-plan-cod">ক্যাশ অন ডেলিভারি ৳${bn(p.codPrice)}</small>` : ''}</label>`).join('')}
        </div>
        ${addressBox}
        ${gw ? `
          ${gw.sandbox ? '<div class="acc-warn">🧪 টেস্ট মোড (Sandbox): আসল টাকা কাটবে না।</div>' : ''}
          <button type="button" class="acc-btn acc-gw">💳 অনলাইনে পেমেন্ট করুন</button>
          <div class="acc-sub" style="text-align:center;margin:6px 0 0">বিকাশ • নগদ • রকেট • উপায় • ভিসা • মাস্টারকার্ড — পেমেন্ট সফল হলেই সাথে সাথে সব সেট খুলে যাবে।</div>
          <div class="acc-err acc-gw-err"></div>
          ${codBox}
          ${manualForm ? `<details style="margin-top:10px"><summary style="cursor:pointer;font-weight:600">অথবা নিজে Send Money করে TrxID দিন</summary>${manualForm}</details>` : ''}`
        : (codBox + manualForm) || '<div class="acc-warn">অনলাইন পেমেন্ট শিগগির চালু হবে।</div>'}
      </div>
      ${mine.payments.length ? `<details style="margin-top:12px"><summary style="cursor:pointer;font-weight:600">আমার পেমেন্ট (${bn(mine.payments.length)})</summary><ul class="acc-list">${mine.payments.map(paymentRow).join('')}</ul></details>` : ''}`;
    const b = modal(html);
    const planId = () => (b.querySelector('input[name=planId]:checked') || {}).value;
    const curPlan = () => config.plans.find(x => x.id === planId()) || plan0;
    const addrEl = b.querySelector('.acc-address');
    const codEl = b.querySelector('.acc-cod');
    // Address only for plans with the printed pack; cash on delivery shows its own (higher) price
    function showPlan() {
      const plan = curPlan();
      b.querySelectorAll('.acc-plan').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
      if (addrEl) addrEl.hidden = !plan.printPack;
      if (codEl) {
        codEl.hidden = !plan.codPrice;
        if (plan.codPrice) {
          codEl.querySelector('.acc-cod-btn').textContent = `🚚 ক্যাশ অন ডেলিভারি • ৳${bn(plan.codPrice)}`;
          codEl.querySelector('.acc-cod-note').textContent = `প্যাকেট হাতে পেয়ে কুরিয়ারকে ৳${bn(plan.codPrice)} দেবেন (অনলাইনে দিলে ৳${bn(plan.codPrice - plan.price)} কম)। টাকা পৌঁছালে প্রিমিয়াম চালু হবে।`;
        }
      }
    }
    // null = address not needed; throws with a Bangla message when something is missing
    function delivery() {
      if (!curPlan().printPack || !addrEl) return null;
      const d = { name: addrEl.querySelector('[name=dName]').value, phone: addrEl.querySelector('[name=dPhone]').value, district: addrEl.querySelector('[name=dDistrict]').value, address: addrEl.querySelector('[name=dAddress]').value };
      if (!d.name.trim() || !d.phone.trim() || !d.district.trim() || d.address.trim().length < 10) {
        addrEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        throw new Error('প্রিন্ট প্যাকেট পাঠাতে নাম, মোবাইল, জেলা ও পুরো ঠিকানা লিখুন।');
      }
      return d;
    }
    b.querySelector('.acc-plans').addEventListener('change', () => {
      showPlan();
      if (form) showSteps();
    });
    showPlan();

    const codBtn = b.querySelector('.acc-cod-btn');
    if (codBtn) {
      codBtn.addEventListener('click', async () => {
        const err = b.querySelector('.acc-cod-err');
        err.textContent = '';
        codBtn.disabled = true;
        try {
          const data = await api('/api/payment/cod', { planId: planId(), delivery: delivery() });
          me = data.user;
          renderPill();
          startPolling();
          const d = data.payment.delivery;
          modal(`<h3>✅ অর্ডার নেওয়া হয়েছে</h3>
            <div class="acc-ok">${esc(data.payment.planNameBn)} • ক্যাশ অন ডেলিভারি <b>৳${bn(data.payment.amount)}</b></div>
            <p>প্রিন্ট করা প্রশ্নের প্যাকেট পাঠানো হবে:<br><b>${esc(d.name)}</b>, ${esc(d.phone)}<br>${esc(d.address)}, ${esc(d.district)}</p>
            <p>কুরিয়ার ফোন করে প্যাকেট দেবে, তখন টাকা দেবেন। টাকা আমাদের কাছে পৌঁছালেই প্রিমিয়াম চালু হবে।</p>
            <button type="button" class="acc-btn ghost acc-x" style="position:static">ঠিক আছে</button>`);
        } catch (e) {
          err.textContent = e.message;
        } finally {
          codBtn.disabled = false;
        }
      });
    }

    // Online gateway: our server creates the checkout, then the browser goes to the gateway page
    const gwBtn = b.querySelector('.acc-gw');
    if (gwBtn) {
      gwBtn.addEventListener('click', async () => {
        const err = b.querySelector('.acc-gw-err');
        err.textContent = '';
        gwBtn.disabled = true;
        gwBtn.textContent = 'পেমেন্ট পেজ খোলা হচ্ছে...';
        try {
          const data = await api('/api/payment/initiate', { planId: planId(), delivery: delivery(), returnTo: location.pathname + location.hash });
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
          senderNumber: form.senderNumber.value, trxId: form.trxId.value, delivery: delivery()
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


  // ---------------------------------------------------------------------------
  // Plans, Cash on Delivery order (OTP + location) and access code
  // ---------------------------------------------------------------------------
  let codConfig = null;
  async function loadCod() {
    if (!codConfig) codConfig = await api('/api/cod/config');
    return codConfig;
  }
  const TIER_BN = { FREE: 'ফ্রি', NORMAL: 'সাধারণ প্যাকেজ', PREMIUM: 'প্রিমিয়াম প্যাকেজ' };
  const tierOfMe = () => (me && me.tier) || (me && me.premium ? 'PREMIUM' : 'FREE');

  // A few questions of a locked set, so a visitor can see what is inside
  function previewHtml(examId) {
    const exam = (window.availableExams || []).find(e => e.id === resolve(examId));
    if (!exam || !access.previewPerSet) return '';
    const byId = new Map((window.sampleQuestions || []).map(q => [q.id, q]));
    const qs = (exam.questionIds || []).slice(0, access.previewPerSet).map(id => byId.get(id)).filter(Boolean);
    if (!qs.length) return '';
    const letters = { A: 'ক', B: 'খ', C: 'গ', D: 'ঘ' };
    return `<details class="acc-prev-wrap"><summary style="cursor:pointer;font-weight:600;margin-bottom:8px">👀 এই সেটের প্রথম ${bn(qs.length)}টি প্রশ্ন দেখুন (মোট ${bn(exam.questionCount || exam.questionIds.length)}টি)</summary>
      <ol class="acc-preview">${qs.map(q => `<li><b>${esc(q.stemBn || q.stem || '')}</b><div class="o">${Object.entries(q.options || {}).map(([k, v]) => `(${letters[k] || k}) ${esc(v)}`).join(' &nbsp; ')}</div></li>`).join('')}</ol></details>`;
  }

  async function hasOtherPayment() {
    try {
      if (!config) config = await api('/api/payment/config');
    } catch { return false; }
    const realNumber = config.methods.some(m => !/X/i.test(m.number));
    return Boolean(config.gateway || (config.manualEnabled && realNumber));
  }

  async function openPlans(opts = {}) {
    const exam = opts.examId ? (window.availableExams || []).find(e => e.id === resolve(opts.examId)) : null;
    const box = modal('<h3>আমাদের প্যাকেজ</h3><div class="acc-sub">লোড হচ্ছে...</div>');
    let cfg;
    try { cfg = await loadCod(); } catch (e) { box.querySelector('.acc-sub').textContent = e.message; return; }
    const other = await hasOtherPayment();
    const tier = tierOfMe();
    const plans = cfg.plans || [];
    const head = exam
      ? `<h3>🔒 ${esc(exam.title)}</h3><div class="acc-sub">এই প্রশ্নসেটটি ফ্রি নয়। নিচের যেকোনো প্যাকেজ নিলে সব সেট খুলে যাবে।</div>${previewHtml(exam.id)}`
      : `<h3>📦 আমাদের প্যাকেজ</h3><div class="acc-sub">${esc(opts.reasonBn || 'ফ্রিতে সব ফিচার ঘুরে দেখুন। সব প্রশ্নসেট খুলতে একটি প্যাকেজ নিন।')}</div>`;
    const html = `${head}
      ${tier !== 'FREE' ? `<div class="acc-ok">আপনার এখন <b>${TIER_BN[tier]}</b> চালু আছে${me && me.premiumUntil ? ` (${fmtDate(me.premiumUntil)} পর্যন্ত)` : ''}।</div>` : ''}
      <table class="acc-cmp">
        <thead><tr><th></th><th>ফ্রি</th><th>সাধারণ</th><th class="hl">প্রিমিয়াম</th></tr></thead>
        <tbody>
          <tr><td>সব ফিচার ঘুরে দেখা</td><td>✅</td><td>✅</td><td class="hl">✅</td></tr>
          <tr><td>প্রতি বিভাগে কয়েকটি ফ্রি সেট</td><td>✅</td><td>✅</td><td class="hl">✅</td></tr>
          <tr><td>সব মডেল টেস্ট ও বিগত প্রশ্ন</td><td>—</td><td>✅</td><td class="hl">✅</td></tr>
          <tr><td>ছাপানো প্রশ্নসেট বাসায়</td><td>—</td><td>✅</td><td class="hl">✅</td></tr>
          <tr><td>প্রশ্নসেট ডাউনলোড ও প্রিন্ট</td><td>—</td><td>—</td><td class="hl">✅</td></tr>
        </tbody>
      </table>
      <div class="app-unlock-note acc-warn">অর্ডার ও কোড দিতে ওয়েবসাইটে একই মোবাইল নম্বর দিয়ে লগইন করুন। কোড চালু হলে অ্যাপেও সব সেট খুলে যাবে।</div>
      <div data-payment>
        ${cfg.enabled ? plans.map(p => `
          <div class="acc-plancard ${p.tier === 'PREMIUM' ? 'prem' : ''}">
            <h4><span>${p.tier === 'PREMIUM' ? '⭐ ' : ''}${esc(p.nameBn)}</span><span>৳${bn(p.price)}</span></h4>
            <p>${esc(p.featuresBn || '')} • মেয়াদ ${bn(p.days)} দিন</p>
            <button type="button" class="acc-btn" data-cod="${esc(p.id)}">🚚 ক্যাশ অন ডেলিভারিতে অর্ডার করুন</button>
          </div>`).join('') : '<div class="acc-warn">ক্যাশ অন ডেলিভারি এখন বন্ধ আছে।</div>'}
        <div style="text-align:center;margin-top:4px">
          <button type="button" class="acc-link" data-act="redeem">🔑 প্রশ্নসেটের সাথে কোড পেয়েছেন? এখানে দিন</button>
          ${other ? `<br><button type="button" class="acc-link" data-act="online">💳 অনলাইনে / বিকাশে পেমেন্ট করতে চান?</button>` : ''}
        </div>
      </div>`;
    const b = modal(html);
    b.addEventListener('click', ev => {
      const c = ev.target.closest('[data-cod]');
      if (c) return openCodOrder(c.dataset.cod);
      const t = ev.target.closest('[data-act]');
      if (!t) return;
      if (t.dataset.act === 'redeem') openRedeem();
      if (t.dataset.act === 'online') openOnlinePay(opts.examId || null);
    });
  }

  function getLocation() {
    return new Promise(resolveGeo => {
      if (!navigator.geolocation) return resolveGeo({ error: 'ব্রাউজারে লোকেশন নেই' });
      navigator.geolocation.getCurrentPosition(
        p => resolveGeo({ geo: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy } }),
        e => resolveGeo({ error: e.code === 1 ? 'অনুমতি দেয়নি' : 'লোকেশন পাওয়া যায়নি' }),
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
      );
    });
  }

  async function openCodOrder(planId) {
    const cfg = await loadCod();
    const plans = cfg.plans || [];
    const sel = plans.find(p => p.id === planId) || plans[plans.length - 1];
    const b = modal(`
      <h3>🚚 ক্যাশ অন ডেলিভারি অর্ডার</h3>
      <div class="acc-sub">প্রশ্নসেট হাতে পেয়ে টাকা দেবেন। প্যাকেটের ভেতরে একটি অ্যাক্সেস কোড থাকবে, সেটি ওয়েবসাইটে দিলেই অনলাইনে সব সেট খুলে যাবে।</div>
      ${cfg.otpReady ? '' : '<div class="acc-warn">OTP পাঠানোর ব্যবস্থা এখনো চালু হয়নি, তাই এই মুহূর্তে অর্ডার নেওয়া যাচ্ছে না। একটু পরে চেষ্টা করুন।</div>'}
      <form class="acc-cod">
        <div class="acc-plans">${plans.map(p => `
          <label class="acc-plan ${p.id === sel.id ? 'on' : ''}"><input type="radio" name="planId" value="${esc(p.id)}" ${p.id === sel.id ? 'checked' : ''}>
            ${esc(p.nameBn)}<b>৳${bn(p.price)}</b></label>`).join('')}
        </div>
        <label class="acc-field">আপনার নাম<input name="name" autocomplete="name" maxlength="80" required value="${esc(me ? me.name : '')}"></label>
        <div class="acc-row">
          <label class="acc-field">মোবাইল নম্বর<input name="phone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="01XXXXXXXXX" required value="${esc(me ? me.phone : '')}"></label>
          <button type="button" class="acc-btn ghost" data-act="otp">OTP পাঠান</button>
        </div>
        <label class="acc-field" data-otp hidden>SMS এ আসা ৬ সংখ্যার OTP<input name="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••"></label>
        <label class="acc-field">জেলা<select name="districtId" required><option value="">জেলা বাছাই করুন</option>${cfg.districts.map(d => `<option value="${esc(d.id)}">${esc(d.nameBn)}</option>`).join('')}</select></label>
        <label class="acc-field">থানা / উপজেলা<input name="area" maxlength="100" required></label>
        <label class="acc-field">পুরো ঠিকানা (বাসা / গ্রাম / রোড)<input name="address" maxlength="300" required></label>
        <label class="acc-field">নোট (ঐচ্ছিক)<input name="note" maxlength="300" placeholder="যেমন: বিকেলে ফোন দেবেন"></label>
        <div class="acc-sum"></div>
        <div class="acc-sub" style="margin:0 0 8px">📍 অর্ডার নিশ্চিত করার সময় আপনার বর্তমান লোকেশন চাওয়া হবে। এটি শুধু ঠিকানা যাচাইয়ে ব্যবহার হয়, যাতে ভুয়া অর্ডার না হয়।</div>
        <div class="acc-err"></div>
        <button class="acc-btn" type="submit" ${cfg.otpReady ? '' : 'disabled'}>✅ অর্ডার নিশ্চিত করুন</button>
      </form>`);
    const form = b.querySelector('form');
    const err = form.querySelector('.acc-err');
    function summary() {
      const p = plans.find(x => x.id === (form.querySelector('input[name=planId]:checked') || {}).value) || sel;
      const d = form.districtId.value;
      const charge = d ? (d === 'dhaka' ? cfg.delivery.insideDhaka : cfg.delivery.outsideDhaka) : null;
      form.querySelector('.acc-sum').innerHTML = `<div><span>${esc(p.nameBn)}</span><span>৳${bn(p.price)}</span></div>
        <div><span>ডেলিভারি চার্জ ${d === 'dhaka' ? '(ঢাকা)' : d ? '(ঢাকার বাইরে)' : ''}</span><span>${charge === null ? 'জেলা বাছাই করুন' : `৳${bn(charge)}`}</span></div>
        <div class="t"><span>প্রশ্নসেট হাতে পেয়ে দেবেন</span><span>${charge === null ? '—' : `৳${bn(p.price + charge)}`}</span></div>`;
      form.querySelectorAll('.acc-plan').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
    }
    form.addEventListener('change', summary);
    summary();

    const otpBtn = form.querySelector('[data-act=otp]');
    let otpTimer = null;
    otpBtn.addEventListener('click', async () => {
      err.textContent = '';
      otpBtn.disabled = true;
      try {
        await api('/api/cod/otp', { phone: form.phone.value });
        form.querySelector('[data-otp]').hidden = false;
        form.otp.required = true;
        form.otp.focus();
        toast('OTP পাঠানো হয়েছে। SMS দেখুন।');
        let left = 60;
        otpTimer = setInterval(() => {
          left -= 1;
          otpBtn.textContent = left > 0 ? `আবার (${bn(left)})` : 'আবার OTP পাঠান';
          if (left <= 0) { clearInterval(otpTimer); otpBtn.disabled = false; }
        }, 1000);
      } catch (e) {
        err.textContent = e.message;
        otpBtn.disabled = false;
      }
    });

    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      err.textContent = '';
      if (form.querySelector('[data-otp]').hidden) {
        err.textContent = 'আগে "OTP পাঠান" চাপুন, তারপর SMS এর কোডটি দিন।';
        return;
      }
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.textContent = '📍 লোকেশন নেওয়া হচ্ছে...';
      const loc = await getLocation();
      btn.textContent = 'অর্ডার পাঠানো হচ্ছে...';
      try {
        const data = await api('/api/cod/order', {
          planId: (form.querySelector('input[name=planId]:checked') || {}).value,
          name: form.name.value, phone: form.phone.value, otp: form.otp.value,
          districtId: form.districtId.value, area: form.area.value, address: form.address.value, note: form.note.value,
          geo: loc.geo || null, geoError: loc.error || ''
        });
        clearInterval(otpTimer);
        const o = data.order;
        const done = modal(`<h3>🎉 অর্ডার নেওয়া হয়েছে</h3>
          <div class="acc-ok">অর্ডার নম্বর <b>${esc(o.orderNo)}</b> • ${esc(o.planNameBn)} • প্রশ্নসেট হাতে পেয়ে দেবেন <b>৳${bn(o.total)}</b></div>
          <p>আমরা শিগগির ফোন করে অর্ডার নিশ্চিত করব।</p>
          <div class="acc-warn">🔑 <b>আপনার অ্যাক্সেস কোড প্রশ্নসেটের সাথে প্যাকেটে আসবে।</b> প্রশ্নসেট হাতে পেলে এই ওয়েবসাইটে লগইন করে "কোড দিন" এ কোডটি লিখুন, সাথে সাথে অনলাইনে সব সেট খুলে যাবে।</div>
          <button type="button" class="acc-btn" data-act="redeem">কোড দেওয়ার জায়গা দেখুন</button>
          <button type="button" class="acc-btn ghost acc-x" style="position:static">ঠিক আছে</button>`);
        done.querySelector('[data-act=redeem]').addEventListener('click', () => openRedeem());
      } catch (e) {
        err.textContent = e.message;
        btn.disabled = false;
        btn.textContent = '✅ অর্ডার নিশ্চিত করুন';
      }
    });
  }

  function openRedeem() {
    if (!me) return openLogin('প্রশ্নসেটের সাথে পাওয়া কোড দিতে আগে লগইন করুন, অ্যাকাউন্ট না থাকলে "নতুন অ্যাকাউন্ট" খুলুন।', openRedeem);
    const b = modal(`
      <h3>🔑 অ্যাক্সেস কোড দিন</h3>
      <div class="acc-sub">ক্যাশ অন ডেলিভারিতে পাওয়া প্রশ্নসেটের প্যাকেটে ৮ অক্ষরের একটি কোড আছে (যেমন 7KQM-X2PD)। কোডটি নিচে লিখুন।</div>
      <form>
        <label class="acc-field">কোড<input name="code" class="acc-code" autocomplete="off" maxlength="12" placeholder="XXXX-XXXX" required></label>
        <div class="acc-err"></div>
        <button class="acc-btn" type="submit">কোড চালু করুন</button>
      </form>
      <div class="acc-sub" style="margin-top:8px">কোডটি এই অ্যাকাউন্টে (${esc(me.phone)}) চালু হবে। একটি কোড একবারই ব্যবহার করা যায়।</div>`);
    const form = b.querySelector('form');
    form.code.focus();
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const btn = form.querySelector('.acc-btn');
      const err = form.querySelector('.acc-err');
      err.textContent = '';
      btn.disabled = true;
      try {
        const data = await api('/api/cod/redeem', { code: form.code.value });
        me = data.user;
        renderPill();
        announce();
        applyPrintLock();
        modal(`<h3>🎉 প্যাকেজ চালু হয়েছে</h3><div class="acc-ok">${esc(data.messageBn)}</div>
          <button type="button" class="acc-btn" onclick="location.reload()">সব সেট খুলুন</button>`);
      } catch (e) {
        err.textContent = e.message;
        btn.disabled = false;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Download / print: PREMIUM only
  // ---------------------------------------------------------------------------
  const canPrint = () => Boolean(me && me.canPrint);
  function allowPrint() {
    if (canPrint()) return true;
    showPrintPlans();
    return false;
  }
  function showPrintPlans() {
    openPlans({ reasonBn: me && me.premium
      ? 'আপনার সাধারণ প্যাকেজে প্রশ্নসেট দেখা ও পরীক্ষা দেওয়া যায়। ডাউনলোড ও প্রিন্ট করতে প্রিমিয়াম প্যাকেজ নিন।'
      : 'প্রশ্নসেট ডাউনলোড ও প্রিন্ট শুধু প্রিমিয়াম প্যাকেজে পাওয়া যায়।' });
  }
  // Printing itself is blocked by content-guard.js (window.print, Ctrl+P, blank printout)
  const applyPrintLock = () => { if (window.ContentGuard) window.ContentGuard.refresh(); };

  const STATUS_BN = { PENDING: 'যাচাই হচ্ছে', APPROVED: 'সফল', REJECTED: 'বাতিল', INITIATED: 'অসম্পূর্ণ', FAILED: 'ব্যর্থ', CANCELLED: 'বাতিল করেছেন' };
  function paymentRow(p) {
    return `<li><span class="acc-badge ${p.status}">${STATUS_BN[p.status] || p.status}</span>
      ${esc(p.provider === 'MANUAL' ? p.method : p.provider === 'COD' ? 'ক্যাশ অন ডেলিভারি' : 'অনলাইন')}${p.trxId || p.tranId ? ` • ${esc(p.trxId || p.tranId)}` : ''} • ৳${bn(p.amount)} • ${fmtDate(p.createdAt)}
      ${p.delivery ? `<br><small>📦 ${p.shippedAt ? `প্যাকেট পাঠানো হয়েছে (${fmtDate(p.shippedAt)})` : 'প্যাকেট এখনো পাঠানো হয়নি'}</small>` : ''}
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
        ? `<div class="acc-ok">⭐ ${TIER_BN[tierOfMe()]} চালু আছে — ${fmtDate(me.premiumUntil)} পর্যন্ত।${me.canPrint ? ' ডাউনলোড ও প্রিন্টও খোলা।' : ' (ডাউনলোড / প্রিন্ট প্রিমিয়াম প্যাকেজে)'}</div>`
        : `<div class="acc-warn">ফ্রি অ্যাকাউন্ট। ${bn(locked.size)}টি সেট লক করা আছে।</div>
           <div class="app-unlock-note acc-sub">আনলক করতে ওয়েবসাইটে একই নম্বর দিয়ে লগইন করুন।</div>`}
      <div data-payment>
        ${tierOfMe() !== 'PREMIUM' ? '<button type="button" class="acc-btn" data-act="unlock">📦 প্যাকেজ দেখুন ও অর্ডার করুন</button>' : ''}
        <button type="button" class="acc-btn ghost" data-act="redeem">🔑 প্রশ্নসেটের সাথে পাওয়া কোড দিন</button>
      </div>
      ${window.Tour ? '<button type="button" class="acc-btn ghost" data-act="tour">🧭 ওয়েবসাইট গাইড আবার দেখুন</button>' : ''}
      ${mine.payments.length ? `<details style="margin-top:12px" data-payment><summary style="cursor:pointer;font-weight:600">আমার পেমেন্ট (${bn(mine.payments.length)})</summary><ul class="acc-list">${mine.payments.map(paymentRow).join('')}</ul></details>` : ''}
      <button type="button" class="acc-btn ghost" data-act="logout" style="margin-top:12px">লগআউট</button>`);
    b.addEventListener('click', async ev => {
      const t = ev.target.closest('[data-act]');
      if (!t) return;
      if (t.dataset.act === 'unlock') openPlans();
      if (t.dataset.act === 'redeem') openRedeem();
      if (t.dataset.act === 'tour') { close(); window.Tour.start(); }
      if (t.dataset.act === 'logout') {
        try { await api('/api/auth/logout', {}); } catch { /* cookie cleared anyway */ }
        location.reload();
      }
    });
  }

  // Lets other scripts (study progress sync) know who is logged in
  const announce = () => window.dispatchEvent(new CustomEvent('account:change', { detail: me }));

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
    canPrint,
    allowPrint,
    showPrintPlans,
    openPlans,
    openRedeem,
    openCodOrder,
    isLocked,
    allow(examId) {
      if (!isLocked(examId)) return true;
      openPlans({ examId });
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
        <p style="color:#475569;margin-bottom:14px">এই প্রশ্নসেটটি ফ্রি নয়। ক্যাশ অন ডেলিভারিতে প্যাকেজ নিয়ে সব সেট খুলুন। প্রথম কয়েকটি প্রশ্ন ফ্রিতে দেখতে পারবেন।</p>
        <button type="button" class="acc-btn" onclick="Account.allow('${esc(examId)}')">🔓 আনলক করুন</button>
      </div>`;
    },
    openLogin: () => openLogin(),
    openUnlock: examId => openPlans({ examId }),
    openOnlinePay
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
    // Sent here from the live exam hall: ?live=login | unlock
    const liveAsk = new URLSearchParams(location.search).get('live');
    if (liveAsk) history.replaceState(null, '', location.pathname + location.hash);
    try {
      const data = await api('/api/auth/me');
      me = data.user;
      renderPill();
      announce();
      applyPrintLock();
      if (gwResult) return showGatewayResult(gwResult);
      if (liveAsk && !me) openLogin('লাইভ পরীক্ষা দিতে লগইন করুন। অ্যাকাউন্ট না থাকলে "নতুন অ্যাকাউন্ট" খুলুন, ফ্রি অ্যাকাউন্টেও লাইভ পরীক্ষা দেওয়া যায়।', () => { location.href = '/live'; });
      else if (liveAsk === 'unlock' && !me.premium) openPlans({});
      // Logged in elsewhere or approved since this page loaded
      if (me && me.premium && !access.premium) reloadForPremium();
      startPolling();
    } catch { /* offline: stay logged out */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

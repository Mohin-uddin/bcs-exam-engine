/**
 * Admin: question reports from candidates (ভুল রিপোর্ট) + reset a user's forgotten password.
 * Adds its own panels after the admin logs in (admin.js fires "admin:login").
 */
(function () {
  const bn = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const OPT_BN = { A: 'ক', B: 'খ', C: 'গ', D: 'ঘ' };
  const fmt = iso => new Date(iso).toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  let key = '';
  let status = 'OPEN';

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

  function mount() {
    if (document.getElementById('reportsArea')) return;
    const area = document.getElementById('adminArea');
    const section = document.createElement('section');
    section.className = 'panel';
    section.id = 'reportsArea';
    section.innerHTML = `
      <h2>🚩 প্রশ্নের ভুল রিপোর্ট <span class="badge UPCOMING" id="repBadge"></span></h2>
      <p style="color:#475569;font-size:14px;margin-bottom:10px">শিক্ষার্থীরা কোনো প্রশ্নে ভুল উত্তর, বানান বা পুরোনো তথ্য পেলে এখানে জানায়। একই প্রশ্নে বেশি রিপোর্ট থাকলে আগে দেখুন। প্রশ্ন ঠিক করার পর "ঠিক করা হয়েছে" চাপুন।</p>
      <div class="actions" style="margin-bottom:10px">
        <button class="btn primary sm" type="button" data-rstatus="OPEN">দেখা বাকি</button>
        <button class="btn ghost sm" type="button" data-rstatus="DONE">ঠিক করা হয়েছে</button>
        <button class="btn ghost sm" type="button" data-rstatus="ALL">সব</button>
      </div>
      <div id="repList"></div>`;
    area.insertBefore(section, area.children[1] || null);
    section.addEventListener('click', async ev => {
      const s = ev.target.closest('[data-rstatus]');
      if (s) {
        status = s.dataset.rstatus;
        section.querySelectorAll('[data-rstatus]').forEach(b => { b.className = `btn ${b === s ? 'primary' : 'ghost'} sm`; });
        return load();
      }
      const done = ev.target.closest('[data-done]');
      if (done) {
        done.disabled = true;
        try {
          await api(`/api/admin/reports/${done.dataset.done}/done`, {});
          load();
        } catch (e) {
          alert(e.message);
          done.disabled = false;
        }
      }
    });
  }

  async function load() {
    const box = document.getElementById('repList');
    try {
      const data = await api(`/api/admin/reports?status=${status}`);
      document.getElementById('repBadge').textContent = data.openCount ? `${bn(data.openCount)}টি বাকি` : '';
      box.innerHTML = data.reports.length ? data.reports.map(r => {
        const q = r.question;
        const same = data.sameQuestion[r.questionId] || 0;
        return `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:13px;color:#475569">
            <span><b style="color:#be123c">${esc(r.reasonBn)}</b>${same > 1 ? ` • এই প্রশ্নে ${bn(same)}টি রিপোর্ট` : ''} • ${fmt(r.createdAt)}${r.user ? ` • ${esc(r.user.name)} (${esc(r.user.phone)})` : ''}</span>
            <span>আইডি: <code>${esc(r.questionId)}</code></span>
          </div>
          ${q ? `<div style="font-weight:600;margin:6px 0">${esc(q.stemBn)}</div>
            <div style="font-size:14px">${['A', 'B', 'C', 'D'].map(k => `<span style="margin-right:12px;${k === q.correctOption ? 'color:#15803d;font-weight:700' : ''}">(${OPT_BN[k]}) ${esc(q.options[k])}</span>`).join('')}</div>
            ${q.examTitle ? `<div style="font-size:12px;color:#64748b">${esc(q.examTitle)}</div>` : ''}` : '<div>প্রশ্নটি আর পাওয়া যাচ্ছে না।</div>'}
          ${r.comment ? `<div style="margin-top:6px;background:#f8fafc;padding:6px 8px;border-radius:6px;font-size:14px">💬 ${esc(r.comment)}</div>` : ''}
          ${r.status === 'OPEN' ? `<button class="btn ghost sm" type="button" data-done="${esc(r.id)}" style="margin-top:8px">✓ ঠিক করা হয়েছে</button>` : '<div style="color:#15803d;font-size:13px;margin-top:6px">✓ ঠিক করা হয়েছে</div>'}
        </div>`;
      }).join('') : '<p style="color:#64748b">কোনো রিপোর্ট নেই।</p>';
    } catch (e) {
      box.innerHTML = `<div class="error">${esc(e.message)}</div>`;
    }
  }

  // "পাসওয়ার্ড বদলান" button next to every user in the users table (admin-payments.js draws the rows)
  function addPasswordButtons() {
    document.querySelectorAll('#userRows tr').forEach(tr => {
      if (tr.dataset.pwDone) return;
      const grant = tr.querySelector('[data-grant],[data-revoke],[data-uid]');
      const uid = grant && (grant.dataset.grant || grant.dataset.revoke || grant.dataset.uid);
      if (!uid) return;
      tr.dataset.pwDone = '1';
      const cell = tr.lastElementChild;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn ghost sm';
      btn.textContent = '🔑 পাসওয়ার্ড বদলান';
      btn.style.marginTop = '4px';
      btn.addEventListener('click', async () => {
        const pw = prompt('এই ইউজারের নতুন পাসওয়ার্ড লিখুন (কমপক্ষে ৬ অক্ষর)। ইউজারকে নতুন পাসওয়ার্ডটি জানিয়ে দিন।');
        if (!pw) return;
        try {
          await api(`/api/admin/accounts/users/${encodeURIComponent(uid)}/password`, { password: pw });
          alert('পাসওয়ার্ড বদলানো হয়েছে। ইউজার নতুন পাসওয়ার্ড দিয়ে লগইন করবেন।');
        } catch (e) {
          alert(e.message);
        }
      });
      cell.appendChild(btn);
    });
  }

  document.addEventListener('admin:login', ev => {
    key = ev.detail.key;
    mount();
    load();
    const rows = document.getElementById('userRows');
    if (rows) {
      new MutationObserver(addPasswordButtons).observe(rows, { childList: true });
      addPasswordButtons();
    }
  });
})();

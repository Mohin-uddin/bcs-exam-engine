/**
 * University admission portal (/admission)
 * - Lists unit model tests, subject-wise sets, verified past papers and the university directory
 *   from window.admissionPortalData / admissionExamsArchive (seed-data.js)
 * - Tests run in the main app: /?set=<examId>#exam (same timer, explanations, ভুল খাতা, results)
 * - Locked sets get 🔒 from account.js (it looks for selectQuickPracticeSet('<id>') in onclick)
 */
(function () {
  const bn = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const data = window.admissionPortalData || { units: {}, groups: {}, universities: [], subjects: [] };
  const archive = window.admissionExamsArchive || [];
  const UNIT_ORDER = ['SCIENCE', 'HUMANITIES', 'BUSINESS', 'PRIVATE'];
  const STORE_KEY = 'admissionUnit';

  let unit = 'SCIENCE';
  let uniGroup = 'ALL';
  let uniQuery = '';
  try { if (UNIT_ORDER.includes(localStorage.getItem(STORE_KEY))) unit = localStorage.getItem(STORE_KEY); } catch { /* storage blocked */ }

  // Opens a set in the main app; account.js shows the unlock dialog for locked sets
  window.selectQuickPracticeSet = function (id) {
    if (window.Account && !Account.allow(id)) return;
    location.href = `/?set=${encodeURIComponent(id)}#exam`;
  };

  const models = archive.filter(a => !a.isVerifiedPast && !a.isSubjectDrill);
  const drills = archive.filter(a => a.isSubjectDrill);
  const past = archive.filter(a => a.isVerifiedPast);

  function card(a) {
    const tag = a.isVerifiedPast
      ? '<span class="tag-real">✅ আসল প্রশ্ন</span>'
      : '<span class="tag-practice">অনুশীলন প্রশ্ন</span>';
    return `<article class="card unit-${esc(a.unitType)}">
      <h3>${esc(a.title)}</h3>
      <div class="meta">
        <span>${bn(a.totalQuestions)} প্রশ্ন</span>
        <span>${bn(a.durationMin)} মিনিট</span>
        <span>ভুলে −${bn(Number(a.negativeMark).toFixed(2))}</span>
        ${tag}
      </div>
      ${a.isVerifiedPast && a.sourceBn ? `<p class="src">উৎস: ${esc(a.sourceBn)}</p>` : ''}
      <button type="button" class="go" onclick="selectQuickPracticeSet('${esc(a.id)}')">পরীক্ষা দাও →</button>
    </article>`;
  }

  function renderStats() {
    const qCount = (data.subjects || []).reduce((n, s) => n + s.count, 0);
    const box = document.getElementById('heroStats');
    box.innerHTML = [
      [bn(models.length), 'ইউনিট মডেল টেস্ট'],
      [bn(qCount), 'অনুশীলন প্রশ্ন'],
      [bn((data.universities || []).length), 'বিশ্ববিদ্যালয় ও গুচ্ছ'],
      [past.length ? bn(past.length) : 'শীঘ্রই', 'আসল প্রশ্নপত্র (যাচাইকৃত)']
    ].map(([b, s]) => `<div class="stat"><b>${b}</b><small>${s}</small></div>`).join('');
    const neg = document.getElementById('negMark');
    if (neg && typeof data.negativeMark === 'number') neg.textContent = bn(data.negativeMark.toFixed(2));

    const pick = document.getElementById('groupPick');
    pick.innerHTML = UNIT_ORDER.map(u => {
      const info = data.units[u] || {};
      return `<button type="button" data-unit="${u}">${info.icon || ''} ${esc(u === 'PRIVATE' ? 'প্রাইভেটে ভর্তি' : (info.nameBn || u).replace(' ইউনিট', ''))}</button>`;
    }).join('');
    pick.addEventListener('click', e => {
      const b = e.target.closest('button[data-unit]');
      if (!b) return;
      setUnit(b.dataset.unit);
      document.getElementById('unitSection').scrollIntoView({ behavior: 'smooth' });
    });
  }

  function setUnit(u) {
    unit = u;
    try { localStorage.setItem(STORE_KEY, u); } catch { /* storage blocked */ }
    renderUnits();
  }

  function renderUnits() {
    const tabs = document.getElementById('unitTabs');
    tabs.innerHTML = UNIT_ORDER.map(u => {
      const info = data.units[u] || {};
      return `<button type="button" role="tab" class="tab" aria-selected="${u === unit}" data-unit="${u}">${info.icon || ''} ${esc(info.nameBn || u)}</button>`;
    }).join('');
    const info = data.units[unit] || {};
    document.getElementById('unitDesc').textContent = info.descBn ? `বিষয়: ${info.descBn}` : '';
    const list = models.filter(a => a.unitType === unit);
    document.getElementById('modelCards').innerHTML = list.length
      ? list.map(card).join('')
      : '<p class="empty">এই ইউনিটের মডেল টেস্ট শীঘ্রই আসছে।</p>';
  }

  function renderDrills() {
    document.getElementById('drillCards').innerHTML = drills.map(card).join('');
  }

  function renderPast() {
    const section = document.getElementById('pastSection');
    section.hidden = !past.length;
    if (past.length) document.getElementById('pastCards').innerHTML = past.map(card).join('');
  }

  function renderUniversities() {
    const groups = data.groups || {};
    const used = [...new Set((data.universities || []).map(u => u.group))];
    document.getElementById('uniGroups').innerHTML = [['ALL', 'সব'], ...used.map(g => [g, groups[g] || g])]
      .map(([g, label]) => `<button type="button" class="chip ${g === uniGroup ? 'on' : ''}" data-group="${g}">${esc(label)}</button>`).join('');

    const q = uniQuery.trim().toLowerCase();
    const list = (data.universities || []).filter(u =>
      (uniGroup === 'ALL' || u.group === uniGroup) && (!q || `${u.nameBn} ${u.id}`.toLowerCase().includes(q)));
    document.getElementById('uniList').innerHTML = list.length ? list.map(u => `
      <article class="uni">
        <div class="uni-top"><h3>${esc(u.nameBn)}</h3><span class="grp">${esc(groups[u.group] || '')}</span></div>
        <p>${esc(u.noteBn)}</p>
        <div class="uni-units">${u.units.map(t => {
          const info = data.units[t] || {};
          return `<button type="button" data-unit="${t}">${info.icon || ''} ${esc(info.nameBn || t)} মডেল টেস্ট</button>`;
        }).join('')}</div>
        ${u.site ? `<a class="site" href="${esc(u.site)}" target="_blank" rel="noopener">অফিসিয়াল ওয়েবসাইট ↗</a>` : ''}
      </article>`).join('') : '<p class="empty">এই নামে কিছু পাওয়া যায়নি।</p>';
  }

  function init() {
    renderStats();
    renderUnits();
    renderPast();
    renderDrills();
    renderUniversities();

    document.getElementById('unitTabs').addEventListener('click', e => {
      const b = e.target.closest('button[data-unit]');
      if (b) setUnit(b.dataset.unit);
    });
    document.getElementById('uniGroups').addEventListener('click', e => {
      const b = e.target.closest('button[data-group]');
      if (!b) return;
      uniGroup = b.dataset.group;
      renderUniversities();
    });
    document.getElementById('uniSearch').addEventListener('input', e => {
      uniQuery = e.target.value;
      renderUniversities();
    });
    document.getElementById('uniList').addEventListener('click', e => {
      const b = e.target.closest('button[data-unit]');
      if (!b) return;
      setUnit(b.dataset.unit);
      document.getElementById('unitSection').scrollIntoView({ behavior: 'smooth' });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

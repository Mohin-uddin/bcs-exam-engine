/**
 * University admission: three dropdowns inside "বিগত পরীক্ষার ধাঁচে প্রশ্ন", like the BCS year list.
 *   বিশ্ববিদ্যালয় / পরীক্ষা  ->  বিভাগ / ইউনিট (hidden when there is only one, e.g. medical, National University)  ->  সাল
 * Same three choices for every university. Units with no questions of their own offer one
 * "মডেল টেস্ট (মানবণ্টন অনুযায়ী)" in the year list. The last choice is remembered (localStorage 'admissionPick').
 * app.js renderPastBankFilters() calls AdmPick.html() + AdmPick.bind() for the ADMISSION track.
 */
(function () {
  const bn = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KEY = 'admissionPick';
  const DEPT = { SCIENCE: 'বিজ্ঞান', BUSINESS: 'ব্যবসায় শিক্ষা', HUMANITIES: 'মানবিক' };
  const UNI_NAMES = {
    du: 'ঢাকা বিশ্ববিদ্যালয় (ঢাবি)', ju: 'জাহাঙ্গীরনগর বিশ্ববিদ্যালয় (জাবি)', ru: 'রাজশাহী বিশ্ববিদ্যালয় (রাবি)',
    cu: 'চট্টগ্রাম বিশ্ববিদ্যালয় (চবি)', bup: 'বাংলাদেশ ইউনিভার্সিটি অব প্রফেশনালস (বিইউপি)'
  };
  const GROUP_BN = { medical: '🩺 মেডিকেল ও ডেন্টাল', engineering: '⚙️ প্রকৌশল', cluster: '🤝 গুচ্ছ ভর্তি', university: '🏛️ বিশ্ববিদ্যালয়' };
  const ORDER = ['medical', 'engineering', 'cluster', 'university'];

  const entityOf = a => {
    if (a.uniId) return { key: a.uniId, name: a.uniNameBn || UNI_NAMES[a.uniId] || a.uniId.toUpperCase() };
    if (a.admType === 'cluster') return /^গুচ্ছ [ABC]/.test(a.unitBn) ? { key: 'gst', name: 'জিএসটি গুচ্ছ (সাধারণ ও বিজ্ঞান-প্রযুক্তি বিশ্ববিদ্যালয়)' } : { key: 'agri', name: 'কৃষি গুচ্ছ' };
    const name = a.uniNameBn || a.unitBn;
    return { key: name, name };
  };
  // "বিজ্ঞান • ক ইউনিট" (department first, then the unit name without the university)
  const unitLabel = (a, entity) => {
    let u = String(a.unitBn || '').replace(entity.name, '').replace(/^\s*•\s*/, '').replace(/^গুচ্ছ\s+/, '').trim();
    u = u.replace(/\s*\((বিজ্ঞান|মানবিক|ব্যবসায় শিক্ষা)\)$/, '');
    const letter = u.match(/[‘'](.+?)[’']\s*ইউনিট/);
    if (letter) u = `${letter[1]} ইউনিট`;
    else if (/অনুষদ|প্রোগ্রাম|স্কুল/.test(u) && !/^[A-Z]{2,5}\b/.test(u)) u = '';
    const dept = DEPT[a.unitType] || '';
    return u ? `${dept} • ${u}` : (dept || 'পরীক্ষা');
  };
  const yearText = a => a.isPatternModel ? 'মডেল টেস্ট (মানবণ্টন অনুযায়ী)'
    : `${a.sessionBn}${a.olderSessionsBn ? ` (${a.olderSessionsBn})` : ''}`;

  let entities = null;
  function build() {
    if (entities) return entities;
    entities = [];
    (window.admissionExamsArchive || []).filter(a => a.isPastStyle && a.admType).forEach(a => {
      const e = entityOf(a);
      let ent = entities.find(x => x.key === e.key);
      if (!ent) entities.push(ent = { ...e, type: a.admType, units: [] });
      let unit = ent.units.find(u => u.key === a.unitBn);
      if (!unit) ent.units.push(unit = { key: a.unitBn, label: unitLabel(a, e), sets: [] });
      unit.sets.push(a);
    });
    const own = e => (e.units.some(u => u.sets.some(a => !a.isPatternModel)) ? 1 : 0);
    entities.sort((x, y) => ORDER.indexOf(x.type) - ORDER.indexOf(y.type) || own(y) - own(x));
    const rank = a => (a.isPatternModel ? 2 : a.olderSessionsBn ? 1 : 0);
    entities.forEach(e => e.units.forEach(u => u.sets.sort((x, y) => rank(x) - rank(y))));
    return entities;
  }

  let pick = {};
  try { pick = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { pick = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(pick)); } catch { /* storage blocked */ } };

  // Where a set code sits (university, unit)
  function locate(code) {
    for (const ent of build()) for (const unit of ent.units) {
      const set = unit.sets.find(a => a.code === code || a.id === code);
      if (set) return { ent, unit, set };
    }
    return null;
  }
  // The chosen set right now (from a code, else the remembered choice, else the first one)
  function resolve(code) {
    const found = code && locate(code);
    if (found) return found;
    const list = build();
    if (!list.length) return null;
    const ent = list.find(e => e.key === pick.uni) || list[0];
    const unit = ent.units.find(u => u.key === pick.unit) || ent.units[0];
    const set = unit.sets.find(a => a.id === pick.set) || unit.sets[0];
    return { ent, unit, set };
  }
  const isYearSet = code => !!locate(code);
  const current = () => { const r = resolve(); return r ? r.set.code : null; };

  function html(code) {
    const r = resolve(code);
    if (!r) return '<p class="text-sm text-slate-500">এখনো কোনো ভর্তি পরীক্ষার প্রশ্ন নেই।</p>';
    const { ent, unit, set } = r;
    pick = { uni: ent.key, unit: unit.key, set: set.id };
    save();
    const uniOpts = ORDER.map(t => {
      const list = build().filter(e => e.type === t);
      return list.length ? `<optgroup label="${GROUP_BN[t]}">${list.map(e => `<option value="${esc(e.key)}" ${e === ent ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</optgroup>` : '';
    }).join('');
    return `<div class="adm-pick">
      <label class="adm-field adm-uni"><span>বিশ্ববিদ্যালয় / পরীক্ষা</span><select data-adm="uni">${uniOpts}</select></label>
      ${ent.units.length > 1 ? `<label class="adm-field"><span>বিভাগ / ইউনিট</span><select data-adm="unit">${ent.units.map(u => `<option value="${esc(u.key)}" ${u === unit ? 'selected' : ''}>${esc(u.label)}</option>`).join('')}</select></label>` : ''}
      <label class="adm-field adm-year"><span>সাল</span><select data-adm="year">${unit.sets.map(a => `<option value="${esc(a.code)}" ${a === set ? 'selected' : ''}>${esc(yearText(a))}</option>`).join('')}</select></label>
      <div class="adm-info"><b>${esc(ent.name)}${ent.units.length > 1 ? ` • ${esc(unit.label)}` : ''} • ${esc(yearText(set))}</b>
        <span>${bn(set.totalQuestions)} প্রশ্ন • ${bn(set.durationMin || set.durationMinutes)} মিনিট • ভুলে −${bn(Number(set.negativeMark).toFixed(2))}${set.patternBn ? ` • মানবণ্টন: ${esc(set.patternBn)}` : ''}</span></div>
      <button type="button" class="adm-start" onclick="launchExamFromPastBank('ADMISSION','${esc(set.id)}')">▶ এই সালের পরীক্ষা দিন</button>
    </div>`;
  }

  // Dropdown changes: next level resets to its first item, then onPick(code) redraws the page
  function bind(root, onPick) {
    root.querySelectorAll('select[data-adm]').forEach(sel => sel.addEventListener('change', () => {
      const list = build();
      if (sel.dataset.adm === 'uni') {
        const ent = list.find(e => e.key === sel.value);
        onPick(ent.units[0].sets[0].code);
      } else if (sel.dataset.adm === 'unit') {
        const ent = list.find(e => e.key === pick.uni);
        const unit = ent.units.find(u => u.key === sel.value);
        onPick(unit.sets[0].code);
      } else {
        onPick(sel.value);
      }
    }));
  }

  const css = `
    .adm-pick{display:grid;gap:10px;width:100%;grid-template-columns:1fr}
    .adm-field{display:flex;flex-direction:column;gap:4px;min-width:0;font-size:13px;font-weight:700;color:#334155}
    .adm-field select{width:100%;min-width:0;padding:11px 12px;border-radius:12px;border:1.5px solid #cbd5e1;background:#fff;font:600 15px 'Noto Sans Bengali',system-ui,sans-serif;color:#0f172a}
    .adm-field select:focus{outline:none;border-color:#047857;box-shadow:0 0 0 3px rgba(4,120,87,.15)}
    .adm-info{grid-column:1/-1;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:10px 12px;font-size:13.5px;color:#065f46;display:flex;flex-direction:column;gap:2px}
    .adm-info b{font-size:14.5px;color:#064e3b}
    .adm-start{grid-column:1/-1;padding:13px;border:0;border-radius:12px;background:#006a4e;color:#fff;font:800 16px 'Noto Sans Bengali',sans-serif;cursor:pointer}
    .adm-start:hover{background:#004d38}
    @media (min-width:760px){.adm-pick{grid-template-columns:2fr 1.5fr 1fr}.adm-start{grid-column:auto / span 1;justify-self:start;padding:12px 28px}}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // Start on the first university of a kind (the "কিসের প্রস্তুতি?" screen has a medical and a university card)
  function preset(type) {
    const e = build().find(x => x.type === type);
    if (e) { pick = { uni: e.key }; save(); }
  }

  window.AdmPick = { html, bind, current, isYearSet, locate, preset };
})();

/**
 * Admin: "ইউজার কোথায় থামছে" (GET /api/admin/funnel?days=&track=, server: funnel.js).
 * Steps reached with the share of all visitors and the drop from the step before, the last screen
 * before leaving, where visitors came from, and visitors per day. Uses the admin key from admin.js.
 */
(function () {
  const bn = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = id => document.getElementById(id);
  const TRACK_BN = { BCS: 'বিসিএস', PRIMARY: 'প্রাথমিক', NTRCA: 'শিক্ষক নিবন্ধন', BANK: 'ব্যাংক', MINISTRY: 'মন্ত্রণালয়', NON_CADRE: 'নন-ক্যাডার', NURSING: 'নার্সিং', ADMISSION_UNI: 'বিশ্ববিদ্যালয় ভর্তি', ADMISSION_MED: 'মেডিকেল ভর্তি', '-': 'এখনো বাছেননি' };
  let key = '';
  const style = document.createElement('style');
  style.textContent = '@media (max-width:600px){#funnelArea .f-bar{display:none}#funnelArea .admin-table td,#funnelArea .admin-table th{padding:8px 6px;font-size:13px}}';
  document.head.appendChild(style);

  const bar = (n, max, color) => `<div style="background:#f1f5f9;border-radius:6px;height:10px;min-width:80px"><div style="width:${max ? Math.max(2, Math.round((n / max) * 100)) : 0}%;height:10px;border-radius:6px;background:${color}"></div></div>`;

  function render(d) {
    if (!d.visitors) {
      $('funnelBody').innerHTML = '<p style="color:#64748b">এই সময়ে এখনো কোনো ভিজিট নেই।</p>';
      return;
    }
    const top = d.steps[0].count || d.visitors;
    const GROUP_BN = { main: '🚶 মূল পথ', buy: '🛒 কেনার পথ', other: '➕ অন্যান্য' };
    const rowsOf = group => {
      let prev = null;
      return d.steps.filter(s => s.group === group).map(s => {
        // Drop from the step before, only along a path (other actions stand on their own)
        const drop = group !== 'other' && prev && prev.count ? Math.round(((prev.count - s.count) / prev.count) * 100) : null;
        prev = s;
        const warn = drop !== null && drop >= 50;
        return `<tr><td>${esc(s.labelBn)}</td><td><b>${bn(s.count)}</b> জন</td><td>${bn(s.pct)}%</td>
          <td class="f-bar" style="width:30%">${bar(s.count, top, '#047857')}</td>
          <td style="color:${warn ? '#b91c1c' : '#64748b'};font-weight:${warn ? 700 : 400}">${drop !== null && drop > 0 ? `${warn ? '⚠️ ' : ''}${bn(drop)}% থামলেন` : ''}</td></tr>`;
      }).join('');
    };
    const rows = ['main', 'buy', 'other'].map(g => `<tr><td colspan="5" style="background:#f8fafc;font-weight:700">${GROUP_BN[g]}</td></tr>${rowsOf(g)}`).join('');
    const maxLast = Math.max(1, ...d.lastScreens.map(x => x.count));
    const maxDay = Math.max(1, ...d.daily.map(x => x.visitors));
    $('funnelBody').innerHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        <div class="badge" style="font-size:14px;padding:8px 12px">মোট ভিজিটর: <b>${bn(d.visitors)}</b></div>
        <div class="badge" style="font-size:14px;padding:8px 12px">নতুন: <b>${bn(d.newVisitors)}</b> • ফিরে এসেছেন: <b>${bn(d.visitors - d.newVisitors)}</b></div>
      </div>
      <h3 style="font-size:16px;margin:6px 0">ধাপগুলো (কতজন পৌঁছেছেন)</h3>
      <div class="table-wrap"><table class="admin-table"><thead><tr><th>ধাপ</th><th>মানুষ</th><th>সবার মধ্যে</th><th class="f-bar"></th><th>আগের ধাপ থেকে</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-top:14px">
        <div><h3 style="font-size:16px;margin:6px 0">🚪 চলে যাওয়ার আগে শেষ কোন পাতায় ছিলেন</h3>
          ${d.lastScreens.length ? d.lastScreens.map(x => `<div style="display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center;margin:4px 0"><span>${esc(x.labelBn)}</span><b>${bn(x.count)}</b></div>${bar(x.count, maxLast, '#dc2626')}`).join('') : '<p style="color:#64748b">এখনো নেই (৩০ মিনিট পর দেখায়)।</p>'}</div>
        <div><h3 style="font-size:16px;margin:6px 0">📣 কোথা থেকে এসেছেন</h3>
          ${d.sources.map(x => `<div style="display:flex;justify-content:space-between;margin:4px 0"><span>${esc(x.labelBn)}</span><b>${bn(x.count)}</b></div>`).join('')}
          <h3 style="font-size:16px;margin:12px 0 6px">🎯 কোন পরীক্ষার</h3>
          ${d.tracks.map(x => `<div style="display:flex;justify-content:space-between;margin:4px 0"><span>${esc(TRACK_BN[x.track] || x.track)}</span><b>${bn(x.count)}</b></div>`).join('')}</div>
        <div><h3 style="font-size:16px;margin:6px 0">📅 প্রতিদিন</h3>
          ${d.daily.map(x => `<div style="display:grid;grid-template-columns:90px 1fr auto;gap:8px;align-items:center;margin:4px 0"><span>${bn(x.day.slice(5))}</span>${bar(x.visitors, maxDay, '#2563eb')}<span>${bn(x.visitors)} (নতুন ${bn(x.newVisitors)})</span></div>`).join('')}</div>
      </div>`;
  }

  async function load() {
    if (!key) return;
    try {
      const res = await fetch(`/api/admin/funnel?days=${$('fDays').value}&track=${encodeURIComponent($('fTrack').value)}`, { headers: { 'X-Admin-Key': key } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.messageBn || 'লোড করা যায়নি।');
      render(data);
    } catch (e) {
      $('funnelBody').innerHTML = `<p class="error">${esc(e.message)}</p>`;
    }
  }

  document.addEventListener('admin:login', ev => { key = ev.detail.key; load(); });
  $('fDays').addEventListener('change', load);
  $('fTrack').addEventListener('change', load);
})();

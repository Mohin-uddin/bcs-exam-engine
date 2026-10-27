/**
 * Authentic BPSC 2-Column Question Booklet + Real OMR Answer Sheet Controller
 */
(function () {
  const bn = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
  const optBn = { A: 'ক', B: 'খ', C: 'গ', D: 'ঘ' };

  let currentTrack = 'BCS'; // 'BCS' | 'PRIMARY'
  let currentSetId = 'PRACTICE_SET_1';
  let setCode = 'ক';
  let showSubjectHeadings = false;
  let strictOmr = true;
  let examRunning = false;
  let reviewMode = false;
  let remainingSec = 7200;
  let negativeRate = 0.5;
  let timerId = null;

  let activeQuestions = [];
  // omrState[q.id] = Set of filled letters ('A','B','C','D')
  let omrState = {};
  // draftState[q.id] = letter ticked on paper
  let draftState = {};

  // Live scheduled exam mode (/exam-hall?live=<examId>)
  const liveExamId = new URLSearchParams(location.search).get('live');
  let liveReg = null;
  let liveExam = null;
  let liveClockOffset = 0;
  let liveSubmitting = false;
  let liveWaitId = null;
  let liveSaveId = null;
  let livePublishId = null;

  document.addEventListener('DOMContentLoaded', () => {
    initControls();
    if (liveExamId) {
      initLive();
      return;
    }
    populateTrackSets();
    loadSet(currentSetId);
  });

  function getArchiveList(track) {
    if (track === 'PRIMARY') return window.primaryExamsArchive || [];
    if (track === 'NTRCA') return window.ntrcaExamsArchive || [];
    if (track === 'BANK') return window.bankExamsArchive || [];
    if (track === 'MINISTRY') return window.ministryExamsArchive || [];
    if (track === 'NON_CADRE') return window.nonCadreExamsArchive || [];
    return [];
  }

  function populateTrackSets() {
    const selSet = document.getElementById('selSet');
    const selCode = document.getElementById('selCode');
    const exams = window.availableExams || [];
    if (currentTrack === 'PRIMARY') {
      const priPractice = exams.filter(e => e.examTrack === 'PRIMARY' && e.id.startsWith('PRI_PRACTICE_'));
      const priPast = exams.filter(e => e.examTrack === 'PRIMARY' && !e.id.startsWith('PRI_PRACTICE_'));
      selSet.innerHTML = `
        <optgroup label="🌟 প্রাইমারি পূর্ণাঙ্গ মডেল সেট (৮০ প্রশ্ন)">
          ${priPractice.map(e => `<option value="${e.id}">${e.title}</option>`).join('')}
        </optgroup>
        <optgroup label="🏫 বিগত সালের প্রাইমারি প্রশ্নসেট (২০১২-২০২৪)">
          ${priPast.map(e => `<option value="${e.id}">${e.title}</option>`).join('')}
        </optgroup>
      `;
      selCode.innerHTML = `
        <option value="পদ্মা">পদ্মা</option>
        <option value="মেঘনা">মেঘনা</option>
        <option value="যমুনা">যমুনা</option>
        <option value="সুরমা">সুরমা</option>
      `;
      currentSetId = 'PRI_PRACTICE_1';
    } else if (currentTrack !== 'BCS') {
      const sectorSets = exams.filter(e => e.examTrack === currentTrack);
      const groupTitle = {
        NTRCA: '🎓 বেসরকারি শিক্ষক নিবন্ধন ও প্রত্যয়ন (NTRCA)',
        BANK: '🏦 বাংলাদেশ ব্যাংক AD ও সমন্বিত ব্যাংক নিয়োগ (BSC)',
        MINISTRY: '🏢 খাদ্য অধিদপ্তর, অডিটর, রেলওয়ে, সমাজসেবা ও LGED',
        NON_CADRE: '⚖️ পিএসসি নন-ক্যাডার (৯ম-১০ম গ্রেড) ও দুদক'
      }[currentTrack] || 'সরকারি নিয়োগ প্রশ্নসেট';
      selSet.innerHTML = `
        <optgroup label="${groupTitle}">
          ${sectorSets.map(e => `<option value="${e.id}">${e.title}</option>`).join('')}
        </optgroup>
      `;
      selCode.innerHTML = `
        <option value="ক">ক</option>
        <option value="খ">খ</option>
        <option value="গ">গ</option>
        <option value="ঘ">ঘ</option>
      `;
      currentSetId = sectorSets[0] ? sectorSets[0].id : 'PRACTICE_SET_1';
    } else {
      const bcsPractice = exams.filter(e => e.examTrack === 'BCS' && e.id.startsWith('PRACTICE_SET_'));
      const bcsPast = exams.filter(e => e.examTrack === 'BCS' && e.id.startsWith('BCS_'));
      selSet.innerHTML = `
        <optgroup label="🌟 বিসিএস পূর্ণাঙ্গ অনুশীলন সেট (২০০ প্রশ্ন)">
          ${bcsPractice.map(e => `<option value="${e.id}">${e.title}</option>`).join('')}
        </optgroup>
        <optgroup label="🏛️ বিগত ২০ বিসিএস আর্কাইভ সেট">
          ${bcsPast.map(e => `<option value="${e.id}">${e.title}</option>`).join('')}
        </optgroup>
      `;
      selCode.innerHTML = `
        <option value="ক">ক</option>
        <option value="খ">খ</option>
        <option value="গ">গ</option>
        <option value="ঘ">ঘ</option>
      `;
      currentSetId = 'PRACTICE_SET_1';
    }
  }

  function initControls() {
    const selTrack = document.getElementById('selTrack');
    const selSet = document.getElementById('selSet');

    if (selTrack) {
      selTrack.addEventListener('change', () => {
        currentTrack = selTrack.value;
        populateTrackSets();
        loadSet(currentSetId);
      });
    }

    selSet.addEventListener('change', () => {
      currentSetId = selSet.value;
      loadSet(currentSetId);
    });

    const selCode = document.getElementById('selCode');
    selCode.addEventListener('change', () => {
      setCode = selCode.value;
      updateSetCodeUI();
    });

    document.getElementById('chkHeadings').addEventListener('change', e => {
      showSubjectHeadings = e.target.checked;
      renderPaper();
    });

    document.getElementById('chkStrict').addEventListener('change', e => {
      strictOmr = e.target.checked;
    });

    document.getElementById('btnStart').addEventListener('click', () => {
      if (liveExamId) {
        loadLivePaper();
        return;
      }
      const name = document.getElementById('inName').value.trim() || 'পরীক্ষার্থী';
      const roll = document.getElementById('inRoll').value.trim() || '৪৭১৯০২';
      document.getElementById('omrName').textContent = name;
      document.getElementById('omrRoll').textContent = bn(roll);
      document.getElementById('startOverlay').hidden = true;
      startExam();
    });

    document.getElementById('btnJustView').addEventListener('click', () => {
      document.getElementById('startOverlay').hidden = true;
      document.getElementById('btnSubmit').disabled = false;
      examRunning = true;
    });

    document.getElementById('btnSubmit').addEventListener('click', () => {
      if (liveExamId) submitLive(false);
      else submitExam();
    });

    document.getElementById('btnReview').addEventListener('click', () => {
      document.getElementById('resultOverlay').hidden = true;
      reviewMode = true;
      renderPaper();
    });

    document.getElementById('btnRetake').addEventListener('click', () => {
      document.getElementById('resultOverlay').hidden = true;
      loadSet(currentSetId);
      startExam();
    });

    document.getElementById('btnPrint').addEventListener('click', () => {
      document.getElementById('printDialog').hidden = false;
    });
    document.getElementById('btnCancelPrint').addEventListener('click', () => {
      document.getElementById('printDialog').hidden = true;
    });
    document.getElementById('btnDoPrint').addEventListener('click', () => {
      const prPaper = document.getElementById('prPaper').checked;
      const prOmr = document.getElementById('prOmr').checked;
      const prKey = document.getElementById('prKey').checked;
      document.body.classList.toggle('hide-paper', !prPaper);
      document.body.classList.toggle('show-omr', prOmr);
      document.body.classList.toggle('show-key', prKey);
      document.getElementById('printDialog').hidden = true;
      window.print();
    });
  }

  function loadSet(setId) {
    currentSetId = setId || 'PRACTICE_SET_1';
    const all = window.sampleQuestions || [];
    const byId = new Map(all.map(q => [q.id, q]));
    let title = '৪৭তম বিসিএস (প্রিলিমিনারি) টেস্ট — অনুশীলন সেট-১';

    if (currentTrack === 'PRIMARY') {
      negativeRate = 0.25;
      remainingSec = 3600;
      document.getElementById('pOrg').textContent = 'প্রাথমিক শিক্ষা অধিদপ্তর (DPE)';
      if (currentSetId.startsWith('PRI_PRACTICE_')) {
        const priSets = window.primaryPracticeSets || [];
        const found = priSets.find(p => p.id === currentSetId);
        activeQuestions = found ? (found.questionIds || []).map(id => byId.get(id)).filter(Boolean) : all.slice(0, 80);
        title = found ? found.title : 'প্রাথমিক সহকারী শিক্ষক নিয়োগ মডেল টেস্ট';
        setCode = (found && found.setCodeBn) || 'পদ্মা';
      } else {
        const rawCode = currentSetId.replace(/_SET$/, '');
        const priArch = (window.primaryExamsArchive || []).find(a => a.code === rawCode);
        activeQuestions = priArch ? (priArch.questionIds || []).map(id => byId.get(id)).filter(Boolean) : all.slice(0, 80);
        title = priArch ? `${priArch.title} (${priArch.examDate})` : 'প্রাথমিক সহকারী শিক্ষক নিয়োগ পরীক্ষা';
        setCode = 'পদ্মা';
      }
      document.getElementById('pTimeMeta').textContent = 'সময়: ১ ঘণ্টা (৬০ মিনিট)';
      document.getElementById('pMarksMeta').textContent = `পূর্ণমান: ${bn(activeQuestions.length)}`;
      document.getElementById('pIns').innerHTML = `<b>বিশেষ দ্রষ্টব্য:</b> প্রতিটি প্রশ্নের মান ১। প্রতিটি ভুল উত্তরের জন্য <b>০.২৫ নম্বর কাটা যাবে</b>। সঠিক উত্তরের জন্য উত্তরপত্রে (OMR) সংশ্লিষ্ট বৃত্তটি কালো বলপয়েন্ট কলম দিয়ে সম্পূর্ণ ভরাট করুন।`;
    } else if (currentTrack !== 'BCS') {
      const rawCode = currentSetId.replace(/_SET$/, '');
      const archList = getArchiveList(currentTrack);
      const foundArch = archList.find(a => a.code === rawCode) || archList[0];
      negativeRate = foundArch && typeof foundArch.negativeMark === 'number' ? foundArch.negativeMark : 0.25;
      remainingSec = (foundArch && foundArch.durationMinutes ? foundArch.durationMinutes : 60) * 60;
      document.getElementById('pOrg').textContent = (foundArch && foundArch.authorityBn) || 'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার';
      activeQuestions = foundArch ? (foundArch.questionIds || []).map(id => byId.get(id)).filter(Boolean) : all.slice(0, 100);
      title = foundArch ? `${foundArch.title} (${foundArch.examDate})` : 'সরকারি নিয়োগ পরীক্ষা';
      setCode = 'ক';
      document.getElementById('pTimeMeta').textContent = `সময়: ${bn(Math.round(remainingSec / 60))} মিনিট`;
      document.getElementById('pMarksMeta').textContent = `পূর্ণমান: ${bn(activeQuestions.length)}`;
      document.getElementById('pIns').innerHTML = `<b>বিশেষ দ্রষ্টব্য:</b> প্রতিটি প্রশ্নের মান ১। প্রতিটি ভুল উত্তরের জন্য <b>${bn(negativeRate.toFixed(2))} নম্বর কাটা যাবে</b>। সঠিক উত্তরের জন্য উত্তরপত্রে (OMR) সংশ্লিষ্ট বৃত্তটি কালো বলপয়েন্ট কলম দিয়ে সম্পূর্ণ ভরাট করুন।`;
    } else {
      negativeRate = 0.5;
      remainingSec = 7200;
      document.getElementById('pOrg').textContent = 'বাংলাদেশ সরকারি কর্ম কমিশন (BPSC)';
      const defaultCodes = ['ক', 'খ', 'গ', 'ঘ'];
      if (currentSetId.startsWith('PRACTICE_SET_')) {
        const setNo = parseInt(currentSetId.replace('PRACTICE_SET_', ''), 10) || 1;
        activeQuestions = all.filter(q => q.setNo === setNo);
        setCode = defaultCodes[(setNo - 1) % 4];
        title = `৪৭তম বিসিএস (প্রিলিমিনারি) টেস্ট — অনুশীলন সেট-${bn(setNo)}`;
      } else {
        const m = currentSetId.match(/BCS_(\d+)/);
        const bcsNo = m ? parseInt(m[1], 10) : 46;
        activeQuestions = all.filter(q => q.bcsExamNo === bcsNo);
        setCode = defaultCodes[bcsNo % 4];
        title = `${bn(bcsNo)}তম বিসিএস প্রিলিমিনারি পরীক্ষা`;
      }
      if (activeQuestions.length === 0) activeQuestions = all.slice(0, 200);
      document.getElementById('pTimeMeta').textContent = 'সময়: ২ ঘণ্টা';
      document.getElementById('pMarksMeta').textContent = `পূর্ণমান: ${bn(activeQuestions.length)}`;
      document.getElementById('pIns').innerHTML = `<b>বিশেষ দ্রষ্টব্য:</b> প্রতিটি প্রশ্নের মান ১। প্রতিটি ভুল উত্তরের জন্য <b>০.৫০ নম্বর কাটা যাবে</b>। সঠিক উত্তরের জন্য উত্তরপত্রে (OMR) সংশ্লিষ্ট বৃত্তটি কালো বলপয়েন্ট কলম দিয়ে সম্পূর্ণ ভরাট করুন।`;
    }

    document.getElementById('selCode').value = setCode;
    omrState = {};
    draftState = {};
    reviewMode = false;
    updateTimerUI();

    document.getElementById('pExam').textContent = title;
    document.getElementById('startSetTitle').textContent = `${title} • ${bn(activeQuestions.length)}টি প্রশ্ন`;

    updateSetCodeUI();
    renderPaper();
    renderOmr();
    renderPrintableExtras();
  }

  function updateSetCodeUI() {
    document.getElementById('pCode').textContent = setCode;
    document.querySelectorAll('.omr-setcode .sc').forEach(el => {
      el.classList.toggle('active', el.dataset.c === setCode);
    });
  }

  function startExam() {
    examRunning = true;
    document.getElementById('btnSubmit').disabled = false;
    if (timerId) clearInterval(timerId);
    timerId = setInterval(() => {
      remainingSec--;
      updateTimerUI();
      if (remainingSec <= 0) {
        clearInterval(timerId);
        submitExam();
      }
    }, 1000);
  }

  function updateTimerUI() {
    const h = Math.floor(remainingSec / 3600);
    const m = Math.floor((remainingSec % 3600) / 60);
    const s = remainingSec % 60;
    const str = `${bn(h)}:${bn(String(m).padStart(2, '0'))}:${bn(String(s).padStart(2, '0'))}`;
    document.getElementById('timer').textContent = str;
  }

  function renderPaper() {
    const container = document.getElementById('pQuestions');
    let lastSubj = null;
    const html = [];

    activeQuestions.forEach((q, idx) => {
      const qNum = idx + 1;
      if (showSubjectHeadings && q.subjectNameBn !== lastSubj) {
        lastSubj = q.subjectNameBn;
        html.push(`<div class="subj-banner">অংশ: ${q.subjectNameBn}</div>`);
      }

      const filledSet = omrState[q.id] || new Set();
      const draft = draftState[q.id];

      const optsHtml = ['A', 'B', 'C', 'D'].map(k => {
        let cls = 'q-opt';
        if (reviewMode) {
          if (k === q.correctOption) cls += ' correct-rev';
          else if (filledSet.has(k)) cls += ' wrong-rev';
        } else if (draft === k) {
          cls += ' draft';
        }
        return `<div class="${cls}" data-qid="${q.id}" data-opt="${k}">(${optBn[k]}) ${q.options[k]}</div>`;
      }).join('');

      const expHtml = reviewMode
        ? `<div class="q-exp"><b>সঠিক উত্তর: (${optBn[q.correctOption]})</b> — ${q.explanationBn || ''} ${q.shortcutFormula ? `<br><b>শর্টকাট:</b> ${q.shortcutFormula}` : ''}</div>`
        : '';

      html.push(`
        <div class="q-block" id="pq_${q.id}">
          <div class="q-stem">${bn(qNum)}. ${q.stemBn}</div>
          <div class="q-opts">${optsHtml}</div>
          ${expHtml}
        </div>
      `);
    });

    container.innerHTML = html.join('');

    container.querySelectorAll('.q-opt').forEach(el => {
      el.addEventListener('click', () => {
        if (reviewMode) return;
        const qid = el.dataset.qid;
        const opt = el.dataset.opt;
        draftState[qid] = draftState[qid] === opt ? null : opt;
        renderPaper();
      });
    });
  }

  function renderOmr() {
    const grid = document.getElementById('omrGrid');
    grid.innerHTML = activeQuestions.map((q, idx) => {
      const qNum = idx + 1;
      const filled = omrState[q.id] || new Set();
      const isMulti = filled.size > 1;
      const bubbles = ['A', 'B', 'C', 'D'].map(k => {
        let cls = 'omr-b';
        if (filled.has(k)) cls += isMulti ? ' multi' : ' filled';
        return `<span class="${cls}" data-qid="${q.id}" data-opt="${k}">${optBn[k]}</span>`;
      }).join('');
      return `
        <div class="omr-row" id="omr_${q.id}">
          <span class="omr-qno" data-qid="${q.id}">${bn(qNum)}.</span>
          <div class="omr-bubbles">${bubbles}</div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.omr-b').forEach(el => {
      el.addEventListener('click', () => {
        if (reviewMode) return;
        const qid = el.dataset.qid;
        const opt = el.dataset.opt;
        if (!omrState[qid]) omrState[qid] = new Set();
        if (omrState[qid].has(opt)) {
          if (!strictOmr) omrState[qid].delete(opt);
        } else {
          if (!strictOmr) omrState[qid].clear();
          omrState[qid].add(opt);
        }
        updateOmrCount();
        renderOmr();
        queueLiveSave();
      });
    });

    grid.querySelectorAll('.omr-qno').forEach(el => {
      el.addEventListener('click', () => {
        const target = document.getElementById(`pq_${el.dataset.qid}`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });

    updateOmrCount();
  }

  function updateOmrCount() {
    const count = Object.values(omrState).filter(s => s && s.size > 0).length;
    const total = activeQuestions.length;
    const text = `ভরাট: ${bn(count)} / ${bn(total)}`;
    document.getElementById('omrCount').textContent = text;
    const fab = document.getElementById('fabCount');
    if (fab) fab.textContent = `${bn(count)}/${bn(total)}`;
  }

  function submitExam() {
    if (liveExamId) return submitLive(true);
    showLocalResult();
  }

  function showLocalResult() {
    if (timerId) clearInterval(timerId);
    examRunning = false;

    let correct = 0;
    let wrong = 0;
    let blank = 0;
    const bySubj = {};

    activeQuestions.forEach(q => {
      if (!bySubj[q.subjectNameBn]) bySubj[q.subjectNameBn] = { total: 0, correct: 0, wrong: 0, blank: 0 };
      const st = bySubj[q.subjectNameBn];
      st.total++;

      const filled = omrState[q.id];
      if (!filled || filled.size === 0) {
        blank++;
        st.blank++;
      } else if (filled.size === 1 && filled.has(q.correctOption)) {
        correct++;
        st.correct++;
      } else {
        wrong++;
        st.wrong++;
      }
    });

    const penalty = wrong * negativeRate;
    const net = Math.max(0, correct - penalty);

    document.getElementById('resTitle').textContent = `${document.getElementById('pExam').textContent} (সেট কোড: ${setCode})`;
    document.getElementById('resSummary').innerHTML = `
      <div class="res-stat"><div class="v">${bn(correct)}</div><div>সঠিক উত্তর (+১)</div></div>
      <div class="res-stat"><div class="v" style="color:#b91c1c">${bn(wrong)}</div><div>ভুল উত্তর (-${bn(penalty.toFixed(2))})</div></div>
      <div class="res-stat"><div class="v" style="color:#475569">${bn(blank)}</div><div>অনুত্তরিত</div></div>
      <div class="res-stat"><div class="v">${bn(net.toFixed(2))}</div><div>প্রাপ্ত নিট নম্বর (${bn(activeQuestions.length)}-এ)</div></div>
    `;

    const rows = Object.entries(bySubj).map(([name, s]) => {
      const sNet = (s.correct - s.wrong * negativeRate).toFixed(2);
      return `<tr><td>${name}</td><td>${bn(s.total)}</td><td>${bn(s.correct)}</td><td>${bn(s.wrong)}</td><td><b>${bn(sNet)}</b></td></tr>`;
    }).join('');

    document.getElementById('resTable').innerHTML = `
      <thead><tr><th>বিষয়</th><th>পূর্ণমান</th><th>সঠিক</th><th>ভুল</th><th>নিট নম্বর</th></tr></thead>
      <tbody>${rows}</tbody>
    `;

    document.getElementById('resultOverlay').hidden = false;
  }

  function renderPrintableExtras() {
    const keyEl = document.getElementById('answerKey');
    if (keyEl) {
      keyEl.innerHTML = `
        <div class="p-head">
          <div class="p-org">উত্তরমালা — ${document.getElementById('pExam').textContent} (সেট: ${setCode})</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(10,1fr);gap:4px;font-size:11px;margin-top:10px;">
          ${activeQuestions.map((q, i) => `<div><b>${bn(i + 1)}.</b> ${optBn[q.correctOption]}</div>`).join('')}
        </div>
      `;
    }
  }

  // ===========================================================================
  // LIVE SCHEDULED EXAM MODE  (/exam-hall?live=<examId>)
  // Same question paper & OMR as practice; questions come from the server and
  // the answer key stays there until the exam ends.
  // ===========================================================================
  function liveStore() {
    try { return JSON.parse(localStorage.getItem(`liveExam:${liveExamId}`) || 'null'); } catch { return null; }
  }

  const liveNow = () => Date.now() + liveClockOffset;

  const liveTime = iso => new Date(iso).toLocaleString('bn-BD', {
    timeZone: 'Asia/Dhaka', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit'
  });

  async function liveApi(pathPart, opts = {}) {
    const res = await fetch(`/api/live/exams/${encodeURIComponent(liveExamId)}${pathPart}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json().catch(() => ({}));
    if (data.serverNow) liveClockOffset = Date.parse(data.serverNow) - Date.now();
    if (!res.ok) {
      const err = new Error(data.messageBn || 'সার্ভারের সাথে যোগাযোগ করা যায়নি।');
      err.code = data.code;
      throw err;
    }
    return data;
  }

  const liveTokenQs = () => `?token=${encodeURIComponent(liveReg.token)}`;

  function serializeOmr() {
    const out = {};
    Object.entries(omrState).forEach(([qid, s]) => { if (s && s.size) out[qid] = [...s]; });
    return out;
  }

  async function initLive() {
    liveReg = liveStore();
    if (!liveReg || !liveReg.token) {
      location.href = `/live?exam=${encodeURIComponent(liveExamId)}`;
      return;
    }

    // Practice-only controls are not part of a scheduled exam
    ['selTrack', 'selSet', 'selCode'].forEach(id => {
      const label = document.getElementById(id) && document.getElementById(id).closest('label');
      if (label) label.style.display = 'none';
    });
    document.getElementById('btnJustView').hidden = true;
    document.getElementById('btnRetake').hidden = true;
    const homeLink = document.querySelector('.tb-left a');
    if (homeLink) { homeLink.href = '/live'; homeLink.textContent = '← লাইভ পরীক্ষা'; }
    document.querySelector('.tb-title').textContent = 'লাইভ পরীক্ষার হল';
    document.querySelector('#startOverlay .card-head .p-org').textContent = 'লাইভ পরীক্ষা';
    const vaultLink = document.querySelector('#resultOverlay a[href*="mistakes"]');
    if (vaultLink) vaultLink.hidden = true;
    const prKey = document.getElementById('prKey');
    prKey.checked = false;
    prKey.disabled = true;

    const inName = document.getElementById('inName');
    const inRoll = document.getElementById('inRoll');
    inName.value = liveReg.name;
    inRoll.value = bn(liveReg.roll);
    inName.readOnly = true;
    inRoll.readOnly = true;
    if (inRoll.parentElement.firstChild.nodeType === Node.TEXT_NODE) inRoll.parentElement.firstChild.nodeValue = 'রোল নম্বর';
    document.getElementById('omrName').textContent = liveReg.name;
    document.getElementById('omrRoll').textContent = bn(liveReg.roll);

    activeQuestions = [];
    renderPaper();
    renderOmr();
    await refreshLive();
  }

  function applyLiveMeta(exam) {
    liveExam = exam;
    negativeRate = exam.negativeMark;
    setCode = exam.setCode || 'ক';
    const neg = bn(exam.negativeMark.toFixed(2));
    document.getElementById('pOrg').textContent = exam.orgBn;
    document.getElementById('pExam').textContent = exam.title;
    document.getElementById('pTimeMeta').textContent = `সময়: ${bn(exam.durationMin)} মিনিট`;
    document.getElementById('pMarksMeta').textContent = `পূর্ণমান: ${bn(exam.totalQuestions)}`;
    document.getElementById('pIns').innerHTML = `<b>বিশেষ দ্রষ্টব্য:</b> প্রতিটি প্রশ্নের মান ১। ${exam.negativeMark > 0 ? `প্রতিটি ভুল উত্তরের জন্য <b>${neg} নম্বর কাটা যাবে</b>।` : 'ভুল উত্তরের জন্য নম্বর কাটা যাবে না।'} সঠিক উত্তরের জন্য উত্তরপত্রে (OMR) সংশ্লিষ্ট বৃত্তটি কালো বলপয়েন্ট কলম দিয়ে সম্পূর্ণ ভরাট করুন। একটি প্রশ্নের একাধিক বৃত্ত ভরাট করলে উত্তরটি ভুল বলে গণ্য হবে।`;
    document.getElementById('startSetTitle').textContent = `${exam.title} • ${bn(exam.totalQuestions)}টি প্রশ্ন • ${liveTime(exam.startAt)}`;
    document.querySelector('#startOverlay .rules').innerHTML = `
      <li>মোট ${bn(exam.totalQuestions)}টি প্রশ্ন, সময় ${bn(exam.durationMin)} মিনিট। পরীক্ষা শেষ হবে <b>${liveTime(exam.endAt)}</b>; তখন উত্তরপত্র স্বয়ংক্রিয়ভাবে জমা হবে।</li>
      <li>উত্তর শুধু ডান পাশের <b>OMR উত্তরপত্রে</b> বৃত্ত ভরাট করে দিতে হবে। প্রতিটি ভরাট সাথে সাথে সার্ভারে সংরক্ষিত হয়।</li>
      <li>প্রশ্নপত্রের অপশনে ক্লিক করলে শুধু খসড়া টিক পড়বে, এটি নম্বরে গণ্য হবে না।</li>
      <li>${exam.negativeMark > 0 ? `প্রতিটি ভুল উত্তরে ${neg} নম্বর কাটা যাবে। ` : ''}একাধিক বৃত্ত ভরাট = ভুল। উত্তরপত্র একবারই জমা দেওয়া যাবে।</li>
      <li>পরীক্ষা শেষ হওয়ার সাথে সাথে ফলাফল ও মেধা তালিকা প্রকাশ হবে।</li>`;
    updateSetCodeUI();
  }

  async function refreshLive() {
    clearInterval(liveWaitId);
    let data;
    try {
      data = await liveApi(`/me${liveTokenQs()}`);
    } catch (e) {
      if (e.code === 'NOT_REGISTERED') {
        try { localStorage.removeItem(`liveExam:${liveExamId}`); } catch { /* storage blocked */ }
        location.href = `/live?exam=${encodeURIComponent(liveExamId)}`;
        return;
      }
      alert(e.message);
      return;
    }
    applyLiveMeta(data.exam);
    const me = data.me;
    const phase = data.exam.phase;

    if (phase === 'ENDED') return showLiveReview(me);
    if (me.submitted) return showLiveSubmitted(me.result, data.exam.endAt);

    const btnStart = document.getElementById('btnStart');
    document.getElementById('startOverlay').hidden = false;
    remainingSec = data.exam.durationMin * 60;
    updateTimerUI();

    if (phase === 'UPCOMING') {
      const startMs = Date.parse(data.exam.startAt);
      btnStart.disabled = true;
      const waitTick = () => {
        const left = Math.max(0, Math.round((startMs - liveNow()) / 1000));
        const h = Math.floor(left / 3600);
        const m = Math.floor((left % 3600) / 60);
        const s = left % 60;
        btnStart.textContent = `পরীক্ষা শুরু হতে বাকি ${bn(h)}:${bn(String(m).padStart(2, '0'))}:${bn(String(s).padStart(2, '0'))}`;
        if (left <= 0) {
          clearInterval(liveWaitId);
          btnStart.disabled = false;
          btnStart.textContent = 'পরীক্ষা শুরু করুন';
        }
      };
      waitTick();
      liveWaitId = setInterval(waitTick, 1000);
    } else {
      btnStart.disabled = false;
      btnStart.textContent = 'পরীক্ষা শুরু করুন';
    }
  }

  async function loadLivePaper() {
    const btnStart = document.getElementById('btnStart');
    btnStart.disabled = true;
    try {
      const data = await liveApi(`/paper${liveTokenQs()}`);
      applyLiveMeta(data.exam);
      activeQuestions = data.questions;
      omrState = {};
      Object.entries(data.draftAnswers || {}).forEach(([qid, arr]) => { omrState[qid] = new Set(arr); });
      draftState = {};
      reviewMode = false;
      renderPaper();
      renderOmr();
      document.getElementById('answerKey').innerHTML = '';
      document.getElementById('startOverlay').hidden = true;

      examRunning = true;
      document.getElementById('btnSubmit').disabled = false;
      const endMs = Date.parse(data.exam.endAt);
      const tickLive = () => {
        remainingSec = Math.max(0, Math.round((endMs - liveNow()) / 1000));
        updateTimerUI();
        if (remainingSec <= 0) {
          clearInterval(timerId);
          submitLive(true);
        }
      };
      if (timerId) clearInterval(timerId);
      tickLive();
      timerId = setInterval(tickLive, 1000);
    } catch (e) {
      btnStart.disabled = false;
      if (['ALREADY_SUBMITTED', 'ENDED', 'NOT_STARTED'].includes(e.code)) return refreshLive();
      alert(e.message);
    }
  }

  function queueLiveSave() {
    if (!liveExamId || !examRunning) return;
    clearTimeout(liveSaveId);
    liveSaveId = setTimeout(() => {
      liveApi('/answers', { method: 'POST', body: JSON.stringify({ token: liveReg.token, answers: serializeOmr() }) })
        .catch(() => { /* the final submit carries every answer anyway */ });
    }, 1200);
  }

  async function submitLive(auto) {
    if (liveSubmitting) return;
    if (!auto) {
      const filled = Object.values(omrState).filter(s => s && s.size > 0).length;
      const ok = confirm(`উত্তরপত্র জমা দিতে চান?\nভরাট করেছেন: ${bn(filled)} / ${bn(activeQuestions.length)}\nজমা দেওয়ার পর আর পরিবর্তন করা যাবে না।`);
      if (!ok) return;
    }
    liveSubmitting = true;
    clearTimeout(liveSaveId);
    if (timerId) clearInterval(timerId);
    examRunning = false;
    document.getElementById('btnSubmit').disabled = true;
    try {
      const data = await liveApi('/submit', { method: 'POST', body: JSON.stringify({ token: liveReg.token, answers: serializeOmr() }) });
      showLiveSubmitted(data.result, data.resultPublishAt);
    } catch (e) {
      liveSubmitting = false;
      if (['ALREADY_SUBMITTED', 'ENDED'].includes(e.code)) return refreshLive();
      if (auto) {
        setTimeout(() => submitLive(true), 4000); // keep retrying through the grace window
      } else {
        examRunning = true;
        document.getElementById('btnSubmit').disabled = false;
        alert(`${e.message} আবার চেষ্টা করুন।`);
      }
    }
  }

  function liveResultCard({ title, stats, note, showReview }) {
    document.getElementById('startOverlay').hidden = true;
    if (timerId) clearInterval(timerId);
    remainingSec = 0;
    updateTimerUI();
    document.getElementById('resTitle').textContent = title;
    document.getElementById('resSummary').innerHTML = stats
      .map(([v, k, color]) => `<div class="res-stat"><div class="v"${color ? ` style="color:${color}"` : ''}>${v}</div><div>${k}</div></div>`)
      .join('');
    document.getElementById('resTable').innerHTML = note ? `<tbody><tr><td style="text-align:center;padding:12px">${note}</td></tr></tbody>` : '';
    document.getElementById('btnReview').hidden = !showReview;
    addMeritButton();
    document.getElementById('resultOverlay').hidden = false;
  }

  function addMeritButton() {
    const actions = document.querySelector('#resultOverlay .card-actions');
    if (actions.querySelector('[data-live-merit]')) return;
    const a = document.createElement('a');
    a.className = 'tb-btn primary';
    a.dataset.liveMerit = '1';
    a.href = `/live?exam=${encodeURIComponent(liveExamId)}`;
    a.textContent = '🏆 মেধা তালিকা দেখুন';
    actions.prepend(a);
  }

  function showLiveSubmitted(result, publishAt) {
    examRunning = false;
    document.getElementById('btnSubmit').disabled = true;
    liveResultCard({
      title: `${liveExam.title} • রোল ${bn(liveReg.roll)} • উত্তরপত্র জমা হয়েছে ✅`,
      stats: [
        [bn(result.correct), 'সঠিক উত্তর (+১)'],
        [bn(result.wrong), `ভুল উত্তর (−${bn(result.penalty.toFixed(2))})`, '#b91c1c'],
        [bn(result.blank), 'অনুত্তরিত', '#475569'],
        [bn(result.netScore.toFixed(2)), `প্রাপ্ত নিট নম্বর (${bn(result.totalQuestions)}-এ)`]
      ],
      note: `মেধা তালিকা ও সঠিক উত্তর প্রকাশ হবে পরীক্ষা শেষে: <b>${liveTime(publishAt)}</b>। এই পেজ খোলা রাখলে নিজে থেকেই আপনার মেধাক্রম দেখাবে।`,
      showReview: false
    });
    const wait = Date.parse(publishAt) - liveNow() + 2000;
    clearTimeout(livePublishId);
    if (wait < 6 * 3600 * 1000) livePublishId = setTimeout(refreshLive, Math.max(1000, wait));
  }

  async function showLiveReview(me) {
    if (!me.submitted) {
      liveResultCard({
        title: `${liveExam.title} • রোল ${bn(liveReg.roll)}`,
        stats: [],
        note: 'পরীক্ষার সময় শেষ। আপনি এই পরীক্ষায় উত্তরপত্র জমা দেননি। মেধা তালিকা দেখতে নিচের বাটনে চাপুন।',
        showReview: false
      });
      return;
    }
    let data;
    try {
      data = await liveApi(`/review${liveTokenQs()}`);
    } catch (e) {
      alert(e.message);
      return;
    }
    activeQuestions = data.questions;
    omrState = {};
    Object.entries(data.answers || {}).forEach(([qid, arr]) => { omrState[qid] = new Set(arr); });
    draftState = {};
    reviewMode = false;
    document.getElementById('prKey').disabled = false;
    renderPaper();
    renderOmr();
    renderPrintableExtras();

    // Subject-wise breakdown comes from the regular result card
    showLocalResult();
    remainingSec = 0;
    updateTimerUI();
    document.getElementById('btnReview').hidden = false;
    document.getElementById('resTitle').textContent = `${liveExam.title} • রোল ${bn(liveReg.roll)} • সেট কোড: ${setCode}`;
    document.getElementById('resSummary').insertAdjacentHTML('afterbegin',
      `<div class="res-stat" style="grid-column:1/-1;background:#ecfdf5;border-color:#a7f3d0"><div class="v" style="color:#b91c1c">মেধাক্রম: ${bn(me.rank)} / ${bn(me.totalExaminees)}</div><div>সময় লেগেছে ${bn(Math.floor(me.result.timeTakenSec / 60))} মিনিট ${bn(me.result.timeTakenSec % 60)} সেকেন্ড • পার্সেন্টাইল ${bn(me.percentile)}</div></div>`);
    addMeritButton();
  }
})();

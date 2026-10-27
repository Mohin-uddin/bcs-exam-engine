/**
 * Comprehensive Client Controller for BCS & BD Competitive Exam Prep Engine
 * Features:
 * - Past Question Bank Browser (Year-wise & Subject-wise modes)
 * - Custom Quiz Creator with Dynamic Negative Penalties
 * - 1-vs-1 Gamified Quiz Battle
 * - Primary Assistant Teacher 100-Mark Merit Calculator
 * - Smart Weakness Tracker & Negative Penalty Loss Warning
 * - Feynman AI Doubt Explainer & Bengali Mnemonics
 * - Bookmarking & PSC Conflict Reporting
 * - SuperMemo SM-2 Spaced Repetition & Mistake Vault (Cuotiben)
 * - Computer Vision OMR Simulator & Redis Live Leaderboard
 */

// State
let questions = [];
let availableExamPacks = [];
let currentCategory = 'BCS_PRELI';
let userAnswers = {};
let examStartTime = null;
let timerInterval = null;
let remainingSeconds = 7200; // 120 minutes full BCS
let totalExamSeconds = 7200;

let currentFlashcardIndex = 0;
let userMistakes = [];
let activeMistakeFilter = 'ALL';

// Bookmarks & Reports
let bookmarkedIds = new Set(['bcs_q_1', 'bcs_q_7']);
let activeReportingQuestion = null;

// Past Bank State
let pastBankMode = 'YEAR'; // 'YEAR' or 'TOPIC'
let pastBankFilterValue = '৪৬তম'; // open the latest BCS paper first instead of all 1,200 questions at once

// BCS has 1,200+ past questions; opening all of them in one page is very long, so start with one paper / one subject
function defaultPastBankFilter() {
  if (typeof pastBankTrack !== 'undefined' && pastBankTrack !== 'BCS') return 'ALL';
  return pastBankMode === 'TOPIC' ? 'BANGLA' : '৪৬তম';
}

// Battle State
let battleQuestions = [];
let battleCurrentIdx = 0;
let battleUserScore = 0;
let battleOppScore = 0;
let battleTimerInterval = null;
let battleRemainingSeconds = 90;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadDatabase();
  changeExamCategory(); // Loads full 200 BCS questions and 120-minute timer
  initVirtualOmr();
  initFlashcardDeck();
  initPastBank();
  calculatePrimaryMerit();
  updateAnalyticsDashboard();
  updateBookmarkBadges();
  refreshLeaderboard();

  // Open the section named in the address bar (e.g. /#past-bank), so refresh and shared links keep their place
  const startTab = location.hash.replace('#', '');
  switchTab(startTab && document.getElementById(`pane-${startTab}`) ? startTab : 'exam', { keepScroll: true });
});

// Load Questions and Exam Packs
async function loadDatabase() {
  if (typeof window !== 'undefined' && window.sampleQuestions && window.sampleQuestions.length > 0) {
    questions = window.sampleQuestions;
  } else {
    try {
      const res = await fetch('/api/exam/questions');
      const data = await res.json();
      questions = data.questions || [];
      if (typeof window !== 'undefined') window.sampleQuestions = questions;
    } catch (e) {
      console.warn('API questions fetch failed:', e);
    }
  }

  if (typeof window !== 'undefined' && window.availableExams && window.availableExams.length > 0) {
    availableExamPacks = window.availableExams;
  } else {
    try {
      const res = await fetch('/api/exams');
      const data = await res.json();
      availableExamPacks = data.exams || [];
      if (typeof window !== 'undefined') window.availableExams = availableExamPacks;
    } catch (e) {
      console.warn('API exams fetch failed:', e);
    }
  }

  populateExamDropdown();
}

function toBnDigits(n) {
  return String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
}

let paperDisplayMode = 'BOOKLET'; // 'BOOKLET' (2-col real BPSC/DPE paper) or 'CARD'
let activeExamTrack = 'BCS'; // 'BCS' | 'PRIMARY' | 'NTRCA' | 'BANK' | 'MINISTRY' | 'NON_CADRE'
let pastBankTrack = 'BCS'; // 'BCS' | 'PRIMARY' | 'NTRCA' | 'BANK' | 'MINISTRY' | 'NON_CADRE'
let currentExamTitleBn = 'বিসিএস প্রিলিমিনারি পূর্ণাঙ্গ অনুশীলন সেট-১';
let currentSetCodeBn = 'ক';
let currentOrgHeaderBn = 'বাংলাদেশ সরকারি কর্ম কমিশন (BPSC)';
let currentPostLabelBn = 'বিষয় কোড: ১০০ (সাধারণ)';
let currentNegativeRate = 0.50;

function selectExamTrack(track) {
  activeExamTrack = track;

  // Update Track Switcher button styles across all 7 sectors
  const tracks = ['BCS', 'PRIMARY', 'NTRCA', 'BANK', 'MINISTRY', 'NON_CADRE', 'NURSING'];
  tracks.forEach(t => {
    const btn = document.getElementById(`btnTrack${t}`);
    if (!btn) return;
    if (t === track) {
      btn.className = 'chip chip-active';
    } else {
      btn.className = 'chip';
    }
  });

  // Update banner text & quick practice buttons for this track
  const badge = document.getElementById('examTrackBadge');
  const heading = document.getElementById('examTrackHeading');
  const dropLabel = document.getElementById('examDropdownLabel');
  const quickContainer = document.getElementById('quickPracticeButtonsContainer');

  if (track === 'BCS') {
    if (badge) badge.textContent = 'বিসিএস স্ট্যান্ডার্ড • ১,৫৪০টি ১০০% ইউনিক প্রশ্ন (BPSC • ৬টি সম্পূর্ণ স্বতন্ত্র ২০০-মার্কস সেট + ৪টি ক্যাডার স্পেশাল চ্যালেঞ্জ সেট = ১০টি বিসিএস পূর্ণাঙ্গ মডেল সেট)';
    if (heading) heading.textContent = 'বাংলাদেশ সরকারি কর্ম কমিশন (BPSC) হুবহু প্রশ্নপত্র ও OMR অনুশীলন কেন্দ্র';
    if (dropLabel) dropLabel.textContent = 'বিসিএস ১০টি পূর্ণাঙ্গ মডেল সেট, ১০টি বিষয়ভিত্তিক মাস্টার সেট ও বিগত ২০ বিসিএস নির্বাচন করুন:';
    if (quickContainer) {
      quickContainer.innerHTML = `
        <button onclick="selectQuickPracticeSet('PRACTICE_SET_1')" id="btnQuickSet1" class="chip">
          সেট-১ (সেট-ক)
        </button>
        <button onclick="selectQuickPracticeSet('PRACTICE_SET_2')" id="btnQuickSet2" class="chip">
          সেট-২ (সেট-খ)
        </button>
        <button onclick="selectQuickPracticeSet('PRACTICE_SET_3')" id="btnQuickSet3" class="chip">
          সেট-৩ (সেট-গ)
        </button>
        <button onclick="selectQuickPracticeSet('PRACTICE_SET_4')" id="btnQuickSet4" class="chip">
          সেট-৪ (সেট-ঘ)
        </button>
        <button onclick="selectQuickPracticeSet('PRACTICE_SET_5')" id="btnQuickSet5" class="chip">
          সেট-৫ (সেট-ঙ)
        </button>
        <button onclick="selectQuickPracticeSet('PRACTICE_SET_6')" id="btnQuickSet6" class="chip">
          সেট-৬ (সেট-চ)
        </button>
        <button onclick="selectQuickPracticeSet('PRACTICE_SET_7')" id="btnQuickSet7" class="chip chip-hot">
          সেট-৭ (ক্যাডার স্পেশাল ২০০)
        </button>
        <button onclick="selectQuickPracticeSet('PRACTICE_SET_8')" id="btnQuickSet8" class="chip chip-hot">
          সেট-৮ (ব্রেইন-টিজার ২০০)
        </button>
      `;
    }
  } else if (track === 'PRIMARY') {
    if (badge) badge.textContent = 'প্রাথমিক শিক্ষা অধিদপ্তর (DPE) • ১০টি নতুন মডেল সেট (পদ্মা–চিত্রা) + বিগত সালের ১৬টি ধাপের প্রশ্নব্যাংক';
    if (heading) heading.textContent = 'সরকারি প্রাথমিক বিদ্যালয় সহকারী শিক্ষক নিয়োগ পরীক্ষা (হুবহু DPE প্রশ্নপত্র ও OMR)';
    if (dropLabel) dropLabel.textContent = 'প্রাথমিক বিদ্যালয় শিক্ষক নিয়োগ ১০টি মডেল সেট ও বিগত সালের সকল ধাপ নির্বাচন করুন:';
    if (quickContainer) {
      quickContainer.innerHTML = `
        <button onclick="selectQuickPracticeSet('PRI_PRACTICE_1')" id="btnQuickPri1" class="chip">
          🏫 সেট-১ (পদ্মা • ৮০)
        </button>
        <button onclick="selectQuickPracticeSet('PRI_PRACTICE_2')" id="btnQuickPri2" class="chip">
          🏫 সেট-২ (মেঘনা • ৮০)
        </button>
        <button onclick="selectQuickPracticeSet('PRI_PRACTICE_3')" id="btnQuickPri3" class="chip">
          🏫 সেট-৩ (যমুনা • ৮০)
        </button>
        <button onclick="selectQuickPracticeSet('PRI_PRACTICE_4')" id="btnQuickPri4" class="chip">
          🏫 সেট-৪ (সুরমা • ৮০)
        </button>
        <button onclick="selectQuickPracticeSet('PRI_PRACTICE_5')" id="btnQuickPri5" class="chip chip-hot">
          সেট-৫ (কর্ণফুলী Hard/Medium)
        </button>
        <button onclick="selectQuickPracticeSet('PRI_PRACTICE_7')" id="btnQuickPri7" class="chip chip-hot">
          সেট-৭ (ব্রহ্মপুত্র Hard)
        </button>
        <button onclick="selectQuickPracticeSet('PRI_PRACTICE_10')" id="btnQuickPri10" class="chip">
          🌟 সেট-১০ (চিত্রা Final)
        </button>
      `;
    }
  } else if (track === 'NTRCA') {
    if (badge) badge.textContent = 'বেসরকারি শিক্ষক নিবন্ধন ও প্রত্যয়ন কর্তৃপক্ষ (NTRCA) • ১০টি স্পেশাল মডেল সেট + বিগত সালের সেট';
    if (heading) heading.textContent = 'এনটিআরসিএ (NTRCA) স্কুল ও কলেজ পর্যায় প্রিলিমিনারি প্রশ্নপত্র ও OMR (১০০ নম্বর • পাস মার্ক ৪০)';
    if (dropLabel) dropLabel.textContent = 'শিক্ষক নিবন্ধন ১০টি নতুন মডেল টেস্ট (Hard & Medium) ও ১৪তম–১৮তম নিবন্ধন সেট নির্বাচন করুন:';
    if (quickContainer) {
      quickContainer.innerHTML = `
        <button onclick="selectQuickPracticeSet('NTRCA_MODEL_1')" class="chip">
          🌟 ১৯তম নিবন্ধন মডেল-১ (স্কুল)
        </button>
        <button onclick="selectQuickPracticeSet('NTRCA_MODEL_2')" class="chip">
          🌟 ১৯তম নিবন্ধন মডেল-২ (কলেজ)
        </button>
        <button onclick="selectQuickPracticeSet('NTRCA_MODEL_3')" class="chip chip-hot">
          হার্ড চ্যালেঞ্জ সেট-৩
        </button>
        <button onclick="selectQuickPracticeSet('NTRCA_MODEL_5')" class="chip chip-hot">
          এক্সট্রিম হার্ড সেট-৫
        </button>
        <button onclick="selectQuickPracticeSet('NTRCA_MODEL_9')" class="chip chip-hot">
          অ্যানালিটিক্যাল সেট-৯
        </button>
        <button onclick="selectQuickPracticeSet('NTRCA_MODEL_10')" class="chip">
          🌟 গ্র্যান্ড ফাইনাল সেট-১০
        </button>
      `;
    }
  } else if (track === 'BANK') {
    if (badge) badge.textContent = 'বাংলাদেশ ব্যাংক ও ব্যাংকার্স সিলেকশন কমিটি (BSC) • ১০টি স্পেশাল মডেল সেট + বিগত সালের সেট';
    if (heading) heading.textContent = 'বাংলাদেশ ব্যাংক AD এবং সমন্বিত ৮/৯/১০ ব্যাংক অফিসার (জেনারেল ও ক্যাশ) প্রশ্নপত্র ও OMR';
    if (dropLabel) dropLabel.textContent = 'ব্যাংক নিয়োগ ১০টি নতুন মডেল টেস্ট (Hard & Analytical) ও বিগত সালের প্রশ্নসেট নির্বাচন করুন:';
    if (quickContainer) {
      quickContainer.innerHTML = `
        <button onclick="selectQuickPracticeSet('BANK_MODEL_1')" class="chip">
          🌟 বাংলাদেশ ব্যাংক AD মডেল-১
        </button>
        <button onclick="selectQuickPracticeSet('BANK_MODEL_2')" class="chip">
          🌟 সমন্বিত SO মডেল-২
        </button>
        <button onclick="selectQuickPracticeSet('BANK_MODEL_3')" class="chip chip-hot">
          ব্যাংক ম্যাথ ও ইংলিশ হার্ড সেট-৩
        </button>
        <button onclick="selectQuickPracticeSet('BANK_MODEL_5')" class="chip chip-hot">
          BB অফিসার হার্ড সেট-৫
        </button>
        <button onclick="selectQuickPracticeSet('BANK_MODEL_9')" class="chip chip-hot">
          অ্যানালিটিক্যাল সেট-৯
        </button>
        <button onclick="selectQuickPracticeSet('BANK_MODEL_10')" class="chip">
          🌟 গ্র্যান্ড ফাইনাল সেট-১০
        </button>
      `;
    }
  } else if (track === 'MINISTRY') {
    if (badge) badge.textContent = 'খাদ্য অধিদপ্তর, অডিটর (CGA), রেলওয়ে, সমাজসেবা ও এলজিইডি • ১০টি নতুন মডেল সেট + বিগত সালের সেট';
    if (heading) heading.textContent = 'মন্ত্রণালয় ও অধিদপ্তরের মেগা নিয়োগ পরীক্ষা (হুবহু প্রশ্নপত্র ও OMR সেন্টার)';
    if (dropLabel) dropLabel.textContent = 'খাদ্য অধিদপ্তর, অডিটর, রেলওয়ে ও অন্যান্য অধিদপ্তর ১০টি নতুন মডেল ও বিগত প্রশ্নসেট নির্বাচন করুন:';
    if (quickContainer) {
      quickContainer.innerHTML = `
        <button onclick="selectQuickPracticeSet('MINISTRY_MODEL_1')" class="chip">
          🌾 খাদ্য অধিদপ্তর মডেল-১
        </button>
        <button onclick="selectQuickPracticeSet('MINISTRY_MODEL_2')" class="chip">
          📊 সিজিএ অডিটর মডেল-২
        </button>
        <button onclick="selectQuickPracticeSet('MINISTRY_MODEL_3')" class="chip">
          🚂 রেলওয়ে স্পেশাল মডেল-৩
        </button>
        <button onclick="selectQuickPracticeSet('MINISTRY_MODEL_5')" class="chip chip-hot">
          মন্ত্রণালয় হার্ড সেট-৫
        </button>
        <button onclick="selectQuickPracticeSet('MINISTRY_MODEL_9')" class="chip chip-hot">
          ক্রিটিক্যাল সেট-৯
        </button>
        <button onclick="selectQuickPracticeSet('MINISTRY_MODEL_10')" class="chip">
          🌟 গ্র্যান্ড ফাইনাল সেট-১০
        </button>
      `;
    }
  } else if (track === 'NON_CADRE') {
    if (badge) badge.textContent = 'পিএসসি নন-ক্যাডার (৯ম–১০ম গ্রেড) ও দুদক • ১০টি নতুন মডেল সেট + বিগত সালের সেট';
    if (heading) heading.textContent = 'সিনিয়র স্টাফ নার্স, এটিইও (ATEO), সাব-রেজিস্ট্রার, তহশিলদার ও দুদক নিয়োগ পরীক্ষা';
    if (dropLabel) dropLabel.textContent = 'পিএসসি নন-ক্যাডার ও দুদক ১০টি নতুন মডেল টেস্ট (Hard & Medium) ও বিগত সেট নির্বাচন করুন:';
    if (quickContainer) {
      quickContainer.innerHTML = `
        <button onclick="selectQuickPracticeSet('NON_CADRE_MODEL_1')" class="chip">
          ⚕️ সিনিয়র স্টাফ নার্স মডেল-১
        </button>
        <button onclick="selectQuickPracticeSet('NON_CADRE_MODEL_2')" class="chip">
          🏛️ ATEO ও সাব-রেজিস্ট্রার মডেল-২
        </button>
        <button onclick="selectQuickPracticeSet('NON_CADRE_MODEL_3')" class="chip">
          ⚖️ দুদক AD হার্ড চ্যালেঞ্জ সেট-৩
        </button>
        <button onclick="selectQuickPracticeSet('NON_CADRE_MODEL_5')" class="chip chip-hot">
          ৯ম–১০ম গ্রেড হার্ড সেট-৫
        </button>
        <button onclick="selectQuickPracticeSet('NON_CADRE_MODEL_9')" class="chip chip-hot">
          অ্যানালিটিক্যাল সেট-৯
        </button>
        <button onclick="selectQuickPracticeSet('NON_CADRE_MODEL_10')" class="chip">
          🌟 গ্র্যান্ড ফাইনাল সেট-১০
        </button>
      `;
    }
  } else if (track === 'NURSING') {
    if (badge) badge.textContent = 'বাংলাদেশ সরকারি কর্ম কমিশন (BPSC) ও নার্সিং অধিদপ্তর • ১০টি স্পেশাল মডেল সেট + বিগত সালের প্রশ্নব্যাংক';
    if (heading) heading.textContent = 'সিনিয়র স্টাফ নার্স (১০ম গ্রেড) ও মিডওয়াইফারি নিয়োগ পরীক্ষা (৬০ প্রফেশনাল বিজ্ঞান + ৪০ সাধারণ • BPSC OMR)';
    if (dropLabel) dropLabel.textContent = 'সিনিয়র স্টাফ নার্স ও মিডওয়াইফ ১০টি মডেল টেস্ট (Clinical & Midwifery) ও বিগত সালের সেট নির্বাচন করুন:';
    if (quickContainer) {
      quickContainer.innerHTML = `
        <button onclick="selectQuickPracticeSet('NURSE_MODEL_1')" class="chip">
          🩺 নার্সিং মডেল-১ (ক)
        </button>
        <button onclick="selectQuickPracticeSet('NURSE_MODEL_2')" class="chip">
          🩺 নার্সিং মডেল-২ (খ)
        </button>
        <button onclick="selectQuickPracticeSet('NURSE_MODEL_3')" class="chip">
          🩺 নার্স ও মিডওয়াইফ-৩ (গ)
        </button>
        <button onclick="selectQuickPracticeSet('NURSE_MODEL_5')" class="chip chip-hot">
          ক্লিনিক্যাল হার্ড সেট-৫
        </button>
        <button onclick="selectQuickPracticeSet('NURSE_MODEL_7')" class="chip chip-hot">
          পেডিয়াট্রিক স্পেশাল-৭
        </button>
        <button onclick="selectQuickPracticeSet('NURSE_MODEL_10')" class="chip">
          🌟 গ্র্যান্ড সিলেকশন-১০
        </button>
        <button onclick="selectQuickPracticeSet('BPSC_NURSE_2023_SET')" class="chip">
          📜 নার্স (২০২৩)
        </button>
      `;
    }
  }

  populateExamDropdown();
  changeExamCategory();
}

function populateExamDropdown() {
  const sel = document.getElementById('examCategorySelect');
  if (!sel || !availableExamPacks || availableExamPacks.length === 0) return;

  let html = '';

  if (activeExamTrack === 'BCS') {
    const practiceModels = availableExamPacks.filter(e => e.examTrack === 'BCS' && e.id.startsWith('PRACTICE_SET_'));
    const subjectMaster = availableExamPacks.filter(e => e.examTrack === 'BCS' && e.id.startsWith('SUBJ_'));
    const superHotSets = availableExamPacks.filter(e => e.id === 'SUPER_HOT_200_SET' || e.id === 'SUPER_HOT_100_SET');
    const bcsSets = availableExamPacks.filter(e => e.examTrack === 'BCS' && e.id.startsWith('BCS_'));
    if (practiceModels.length > 0 || superHotSets.length > 0) {
      html += `<optgroup label="🌟 বিসিএস পূর্ণাঙ্গ ২০০-মার্কস অনুশীলন সেট (সেট ১–৮) ও সুপার-হট কমন">`;
      html += [...practiceModels, ...superHotSets].map(e => `<option value="${e.id}">${e.title}</option>`).join('');
      html += `</optgroup>`;
    }
    if (subjectMaster.length > 0) {
      html += `<optgroup label="🔥 বিষয়ভিত্তিক হার্ড ও মিডিয়াম চ্যালেঞ্জ সেট (১০০ প্রশ্ন করে)">`;
      html += subjectMaster.map(e => `<option value="${e.id}">${e.title}</option>`).join('');
      html += `</optgroup>`;
    }
    if (bcsSets.length > 0) {
      html += `<optgroup label="🏛️ বিগত ২০ বিসিএস আর্কাইভ সেট (৪৬তম - ২৭তম)">`;
      html += bcsSets.map(e => `<option value="${e.id}">${e.title}</option>`).join('');
      html += `</optgroup>`;
    }
  } else if (activeExamTrack === 'PRIMARY') {
    const priPractice = availableExamPacks.filter(e => e.examTrack === 'PRIMARY' && e.id.startsWith('PRI_PRACTICE_'));
    const priPast = availableExamPacks.filter(e => e.examTrack === 'PRIMARY' && !e.id.startsWith('PRI_PRACTICE_'));
    if (priPractice.length > 0) {
      html += `<optgroup label="🌟 প্রাথমিক শিক্ষক নিয়োগ ৮টি পূর্ণাঙ্গ মডেল সেট (৮০ নম্বর • নদী সেট কোড • Hard & Medium)">`;
      html += priPractice.map(e => `<option value="${e.id}">${e.title}</option>`).join('');
      html += `</optgroup>`;
    }
    if (priPast.length > 0) {
      html += `<optgroup label="🏫 বিগত সালের প্রাথমিক শিক্ষক নিয়োগ প্রশ্নসেট (২০১২ – ২০২৪ সকল ধাপ)">`;
      html += priPast.map(e => `<option value="${e.id}">${e.title}</option>`).join('');
      html += `</optgroup>`;
    }
  } else if (activeExamTrack === 'NTRCA') {
    const ntrcaModels = availableExamPacks.filter(e => e.examTrack === 'NTRCA' && e.id.startsWith('NTRCA_MODEL_'));
    const ntrcaPast = availableExamPacks.filter(e => e.examTrack === 'NTRCA' && !e.id.startsWith('NTRCA_MODEL_'));
    if (ntrcaModels.length > 0) {
      html += `<optgroup label="🌟 এনটিআরসিএ স্পেশাল নতুন মডেল সেট (১০০ নম্বর • Hard & Medium Mix)">`;
      html += ntrcaModels.map(e => `<option value="${e.id}">${e.title}</option>`).join('');
      html += `</optgroup>`;
    }
    if (ntrcaPast.length > 0) {
      html += `<optgroup label="🎓 বিগত সালের শিক্ষক নিবন্ধন পরীক্ষা (১৪তম – ১৮তম স্কুল ও কলেজ পর্যায়)">`;
      html += ntrcaPast.map(e => `<option value="${e.id}">${e.title}</option>`).join('');
      html += `</optgroup>`;
    }
  } else if (activeExamTrack === 'BANK') {
    const bankModels = availableExamPacks.filter(e => e.examTrack === 'BANK' && e.id.startsWith('BANK_MODEL_'));
    const bankPast = availableExamPacks.filter(e => e.examTrack === 'BANK' && !e.id.startsWith('BANK_MODEL_'));
    if (bankModels.length > 0) {
      html += `<optgroup label="🌟 ব্যাংক জব নতুন মডেল সেট (১০০ নম্বর • Hard & Analytical Mix)">`;
      html += bankModels.map(e => `<option value="${e.id}">${e.title}</option>`).join('');
      html += `</optgroup>`;
    }
    if (bankPast.length > 0) {
      html += `<optgroup label="🏦 বিগত সালের বাংলাদেশ ব্যাংক AD ও সমন্বিত ব্যাংক নিয়োগ পরীক্ষা">`;
      html += bankPast.map(e => `<option value="${e.id}">${e.title}</option>`).join('');
      html += `</optgroup>`;
    }
  } else if (activeExamTrack === 'MINISTRY') {
    const minModels = availableExamPacks.filter(e => e.examTrack === 'MINISTRY' && e.id.startsWith('MINISTRY_MODEL_'));
    const minPast = availableExamPacks.filter(e => e.examTrack === 'MINISTRY' && !e.id.startsWith('MINISTRY_MODEL_'));
    if (minModels.length > 0) {
      html += `<optgroup label="🌟 মন্ত্রণালয় ও অধিদপ্তর নতুন মডেল সেট (খাদ্য, অডিটর, রেলওয়ে ও সমাজসেবা • Hard & Medium)">`;
      html += minModels.map(e => `<option value="${e.id}">${e.title}</option>`).join('');
      html += `</optgroup>`;
    }
    if (minPast.length > 0) {
      html += `<optgroup label="🏢 বিগত সালের খাদ্য অধিদপ্তর, অডিটর (CGA), রেলওয়ে, সমাজসেবা ও এলজিইডি সেট">`;
      html += minPast.map(e => `<option value="${e.id}">${e.title}</option>`).join('');
      html += `</optgroup>`;
    }
  } else if (activeExamTrack === 'NON_CADRE') {
    const ncModels = availableExamPacks.filter(e => e.examTrack === 'NON_CADRE' && e.id.startsWith('NON_CADRE_MODEL_'));
    const ncPast = availableExamPacks.filter(e => e.examTrack === 'NON_CADRE' && !e.id.startsWith('NON_CADRE_MODEL_'));
    if (ncModels.length > 0) {
      html += `<optgroup label="🌟 পিএসসি নন-ক্যাডার ও দুদক নতুন মডেল সেট (নার্স, ATEO, সাব-রেজিস্ট্রার ও দুদক • Hard & Medium)">`;
      html += ncModels.map(e => `<option value="${e.id}">${e.title}</option>`).join('');
      html += `</optgroup>`;
    }
    if (ncPast.length > 0) {
      html += `<optgroup label="🏛️ বিগত সালের পিএসসি নন-ক্যাডার ও দুদক নিয়োগ পরীক্ষা">`;
      html += ncPast.map(e => `<option value="${e.id}">${e.title}</option>`).join('');
      html += `</optgroup>`;
    }
  } else if (activeExamTrack === 'NURSING') {
    const nurseModels = availableExamPacks.filter(e => e.examTrack === 'NURSING' && e.id.startsWith('NURSE_MODEL_'));
    const nursePast = availableExamPacks.filter(e => e.examTrack === 'NURSING' && !e.id.startsWith('NURSE_MODEL_'));
    if (nurseModels.length > 0) {
      html += `<optgroup label="🩺 বিপিএসসি সিনিয়র স্টাফ নার্স ও মিডওয়াইফ নতুন মডেল সেট (১০০ প্রশ্ন • ৬০ প্রফেশনাল বিজ্ঞান + ৪০ সাধারণ)">`;
      html += nurseModels.map(e => `<option value="${e.id}">${e.title}</option>`).join('');
      html += `</optgroup>`;
    }
    if (nursePast.length > 0) {
      html += `<optgroup label="📜 বিগত সালের বিপিএসসি সিনিয়র স্টাফ নার্স ও মিডওয়াইফারি পরীক্ষা">`;
      html += nursePast.map(e => `<option value="${e.id}">${e.title}</option>`).join('');
      html += `</optgroup>`;
    }
  }

  sel.innerHTML = html;
  const firstTrackPack = availableExamPacks.find(
    e => e.examTrack === activeExamTrack && e.id !== 'SUPER_HOT_100_SET' && e.id !== 'SUPER_HOT_200_SET'
  ) || availableExamPacks.find(e => e.examTrack === activeExamTrack);
  if (firstTrackPack) {
    sel.value = firstTrackPack.id;
  }
}

function selectQuickPracticeSet(setId) {
  const sel = document.getElementById('examCategorySelect');
  if (sel) {
    sel.value = setId;
  }
  changeExamCategory();
}

function setPaperDisplayMode(mode) {
  paperDisplayMode = mode;
  const btnBooklet = document.getElementById('btnModeBooklet');
  const btnCard = document.getElementById('btnModeCard');
  if (btnBooklet && btnCard) {
    btnBooklet.className = mode === 'BOOKLET'
      ? 'px-3 py-1 rounded-md bg-emerald-600 text-white font-bold transition'
      : 'px-3 py-1 rounded-md text-slate-700 hover:text-slate-900 transition';
    btnCard.className = mode === 'CARD'
      ? 'px-3 py-1 rounded-md bg-emerald-600 text-white font-bold transition'
      : 'px-3 py-1 rounded-md text-slate-700 hover:text-slate-900 transition';
  }
  renderExamQuestions();
}

// Tab Switching
function switchTab(tabName, opts = {}) {
  const targetPane = document.getElementById(`pane-${tabName}`);
  if (!targetPane) tabName = 'exam';

  document.querySelectorAll('.tab-pane').forEach(el => el.classList.add('hidden'));
  document.getElementById(`pane-${tabName}`).classList.remove('hidden');

  // Sidebar + mobile bottom bar highlight
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.id === `tab-${tabName}`));
  document.querySelectorAll('.bottom-nav [data-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));

  const activeBtn = document.getElementById(`tab-${tabName}`);
  const titleEl = document.getElementById('currentSectionTitle');
  if (titleEl && activeBtn) titleEl.textContent = activeBtn.dataset.title || activeBtn.textContent.trim();

  toggleSideNav(false);
  // Always open a section from its top, otherwise long pages look like the click did nothing
  if (!opts.keepScroll) window.scrollTo({ top: 0, behavior: 'auto' });
  if (location.hash !== `#${tabName}`) history.replaceState(null, '', `#${tabName}`);

  // Tab specific lifecycle triggers
  if (tabName === 'mistakes') renderMistakeVault();
  else if (tabName === 'past-bank') renderPastBank();
  else if (tabName === 'confusing-hot') renderConfusingHotTab();
  else if (tabName === 'master-toolkit') renderMasterToolkitTab();
  else if (tabName === 'bookmarks') renderBookmarks();
  else if (tabName === 'analytics') updateAnalyticsDashboard();
  else if (tabName === 'leaderboard') refreshLeaderboard();
}

function toggleSideNav(open) {
  document.body.classList.toggle('nav-open', !!open);
}

window.addEventListener('hashchange', () => {
  const tab = location.hash.replace('#', '');
  if (tab && document.getElementById(`pane-${tab}`)) switchTab(tab);
});

window.addEventListener('scroll', () => {
  const btn = document.getElementById('backToTop');
  if (btn) btn.classList.toggle('show', window.scrollY > 600);
}, { passive: true });

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') toggleSideNav(false);
});

let guess5050Ids = new Set();

// -----------------------------------------------------------------------------
// 1. LIVE EXAM ENGINE & AUTHENTIC BPSC 2-COLUMN QUESTION BOOKLET + OMR
// -----------------------------------------------------------------------------
function changeExamCategory() {
  const sel = document.getElementById('examCategorySelect');
  const selectedExamId = sel ? sel.value : 'PRACTICE_SET_1';
  // Premium set: show the unlock dialog and stay on (or open) the nearest free set
  if (window.Account && Account.isLocked(selectedExamId)) {
    const back = Account.firstAllowedOption(sel, changeExamCategory.lastId);
    if (changeExamCategory.lastId || !back) Account.allow(selectedExamId);
    if (!back) return;
    sel.value = back;
    if (back === changeExamCategory.lastId) return;
    return changeExamCategory();
  }
  changeExamCategory.lastId = selectedExamId;
  userAnswers = {};
  guess5050Ids = new Set();

  const pack = availableExamPacks.find(p => p.id === selectedExamId) || availableExamPacks[0] || {
    questionCount: 200, durationMin: 120, category: 'BCS_PRELI', negativeMark: 0.50, title: 'বিসিএস প্রিলিমিনারি পূর্ণাঙ্গ অনুশীলন সেট-১'
  };

  const qCount = pack.questionCount || 200;
  const duration = pack.durationMin || 120;
  currentCategory = pack.category || 'BCS_PRELI';
  currentExamTitleBn = pack.title || 'বিসিএস প্রিলিমিনারি পূর্ণাঙ্গ অনুশীলন সেট';
  currentNegativeRate = typeof pack.negativeMark === 'number' ? pack.negativeMark : (currentCategory === 'BCS_PRELI' || currentCategory === 'NON_CADRE' ? 0.50 : 0.25);

  // Highlight the chosen set chip (works for every exam type)
  document.querySelectorAll('#quickPracticeButtonsContainer [onclick]').forEach(btn => {
    btn.classList.toggle('chip-active', btn.getAttribute('onclick').includes(`'${selectedExamId}'`));
  });

  // Load question pool
  const pool = (typeof window !== 'undefined' && window.sampleQuestions && window.sampleQuestions.length > 0)
    ? window.sampleQuestions
    : (typeof sampleQuestions !== 'undefined' ? sampleQuestions : questions);

  const byId = new Map(pool.map(q => [q.id, q]));
  const setCodes = ['ক', 'খ', 'গ', 'ঘ'];
  const riverSets = ['পদ্মা', 'মেঘনা', 'যমুনা', 'সুরমা', 'কর্ণফুলী', 'তিস্তা'];

  const allSectorArchives = [
    ...((typeof window !== 'undefined' && window.ntrcaExamsArchive) || []),
    ...((typeof window !== 'undefined' && window.bankExamsArchive) || []),
    ...((typeof window !== 'undefined' && window.ministryExamsArchive) || []),
    ...((typeof window !== 'undefined' && window.nonCadreExamsArchive) || [])
  ];

  currentOrgHeaderBn = 'বাংলাদেশ সরকারি কর্ম কমিশন (BPSC)';
  currentPostLabelBn = 'বিষয় কোড: ১০০ (সাধারণ)';

  if (selectedExamId === 'SUPER_HOT_200_SET') {
    currentOrgHeaderBn = 'বিসিএস • প্রাইমারি • NTRCA • ব্যাংক • মন্ত্রণালয় সমন্বিত বোর্ড';
    currentPostLabelBn = 'রাতের রিভিশন স্পেশাল: ১০+ বার আসা সুপার-হট কমন ২০০ প্রশ্ন';
    currentSetCodeBn = 'সুপার-২০০';
    const hot200Ids = (typeof window !== 'undefined' && window.superHot200QuestionIds) || pack.questionIds || [];
    questions = hot200Ids.map(id => byId.get(id)).filter(Boolean);
    if (questions.length === 0) questions = pool.filter(q => q.isSuperHot10 || q.isSuperHot).slice(0, 200);
  } else if (selectedExamId === 'SUPER_HOT_100_SET') {
    currentOrgHeaderBn = 'বিসিএস • প্রাইমারি • NTRCA • ব্যাংক • মন্ত্রণালয় সমন্বিত বোর্ড';
    currentPostLabelBn = 'বিশেষ সংকলন: ৫+ বার আসা সুপার-হট কমন ১০০ প্রশ্ন';
    currentSetCodeBn = 'কমন-১০০';
    const hotIds = (typeof window !== 'undefined' && window.superHotQuestionIds) || pack.questionIds || [];
    questions = hotIds.map(id => byId.get(id)).filter(Boolean);
    if (questions.length === 0) questions = pool.filter(q => q.isSuperHot).slice(0, 100);
  } else if (selectedExamId && selectedExamId.startsWith('SUBJ_')) {
    currentOrgHeaderBn = 'বাংলাদেশ সরকারি কর্ম কমিশন (BPSC • বিষয়ভিত্তিক মাস্টার ড্রিল)';
    currentPostLabelBn = pack.title || 'বিষয়ভিত্তিক হার্ড ও মিডিয়াম চ্যালেঞ্জ সেট';
    currentSetCodeBn = pack.setCodeBn || 'ক';
    if (Array.isArray(pack.questionIds) && pack.questionIds.length > 0) {
      questions = pack.questionIds.map(id => byId.get(id)).filter(Boolean);
    } else {
      questions = pool.slice(0, 100);
    }
  } else if (selectedExamId && selectedExamId.startsWith('PRACTICE_SET_')) {
    const setNum = parseInt(selectedExamId.replace('PRACTICE_SET_', ''), 10) || 1;
    currentSetCodeBn = pack.setCodeBn || setCodes[(setNum - 1) % 4];
    if (Array.isArray(pack.questionIds) && pack.questionIds.length > 0) {
      questions = pack.questionIds.map(id => byId.get(id)).filter(Boolean);
    } else {
      const setQuestions = pool.filter(q => q.setNo === setNum);
      questions = setQuestions.length > 0 ? setQuestions : pool.slice(0, 200);
    }
  } else if (selectedExamId && selectedExamId.startsWith('BCS_') && selectedExamId !== 'BCS_47_FULL') {
    const bcsNumMatch = selectedExamId.match(/BCS_(\d+)/);
    const bcsNum = bcsNumMatch ? parseInt(bcsNumMatch[1], 10) : null;
    currentSetCodeBn = setCodes[(bcsNum || 1) % 4];
    if (Array.isArray(pack.questionIds) && pack.questionIds.length > 0) {
      questions = pack.questionIds.map(id => byId.get(id)).filter(Boolean);
    } else {
      const bcsQuestions = bcsNum ? pool.filter(q => q.bcsExamNo === bcsNum) : [];
      questions = bcsQuestions.length > 0 ? bcsQuestions : pool.slice(0, Math.min(qCount, pool.length));
    }
  } else if (selectedExamId && selectedExamId.startsWith('PRI_PRACTICE_')) {
    currentOrgHeaderBn = 'প্রাথমিক শিক্ষা অধিদপ্তর (DPE)';
    currentPostLabelBn = 'পদ: সহকারী শিক্ষক (সরকারি প্রাথমিক বিদ্যালয়)';
    const priSets = (typeof window !== 'undefined' && window.primaryPracticeSets) || [];
    const found = priSets.find(p => p.id === selectedExamId);
    currentSetCodeBn = (found && found.setCodeBn) || pack.setCodeBn || 'পদ্মা';
    if (found && Array.isArray(found.questionIds) && found.questionIds.length > 0) {
      questions = found.questionIds.map(id => byId.get(id)).filter(Boolean);
    } else if (Array.isArray(pack.questionIds) && pack.questionIds.length > 0) {
      questions = pack.questionIds.map(id => byId.get(id)).filter(Boolean);
    } else {
      questions = pool.filter(q => q.examTrack === 'PRIMARY').slice(0, 80);
    }
  } else if (selectedExamId && selectedExamId.startsWith('PRI_')) {
    currentOrgHeaderBn = 'প্রাথমিক শিক্ষা অধিদপ্তর (DPE)';
    currentPostLabelBn = 'পদ: সহকারী শিক্ষক (সরকারি প্রাথমিক বিদ্যালয়)';
    const rawCode = selectedExamId.replace(/_SET$/, '');
    const priArchives = (typeof window !== 'undefined' && window.primaryExamsArchive) || [];
    const foundArch = priArchives.find(a => a.code === rawCode);
    currentSetCodeBn = pack.setCodeBn || (foundArch && (foundArch.setNameBn || '').replace(/^সেট:\s*/, '')) || 'সুরমা';
    if (foundArch && Array.isArray(foundArch.questionIds) && foundArch.questionIds.length > 0) {
      questions = foundArch.questionIds.map(id => byId.get(id)).filter(Boolean);
    } else if (Array.isArray(pack.questionIds) && pack.questionIds.length > 0) {
      questions = pack.questionIds.map(id => byId.get(id)).filter(Boolean);
    } else {
      questions = pool.slice(0, Math.min(qCount, pool.length));
    }
  } else {
    const rawCode = (selectedExamId || '').replace(/_SET$/, '');
    const foundSector = allSectorArchives.find(a => a.code === rawCode || a.id === selectedExamId);
    if (foundSector) {
      currentOrgHeaderBn = foundSector.orgNameBn || pack.orgNameBn || 'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার';
      currentPostLabelBn = foundSector.postLabelBn || pack.postLabelBn || 'নিয়োগ পরীক্ষা';
      currentSetCodeBn = (foundSector.setNameBn || pack.setCodeBn || 'ক').replace(/^সেট:\s*/, '');
      currentNegativeRate = typeof foundSector.negativeMark === 'number' ? foundSector.negativeMark : currentNegativeRate;
      if (Array.isArray(foundSector.questionIds) && foundSector.questionIds.length > 0) {
        questions = foundSector.questionIds.map(id => byId.get(id)).filter(Boolean);
      } else if (Array.isArray(pack.questionIds) && pack.questionIds.length > 0) {
        questions = pack.questionIds.map(id => byId.get(id)).filter(Boolean);
      } else {
        questions = pool.slice(0, Math.min(qCount, pool.length));
      }
    } else if (Array.isArray(pack.questionIds) && pack.questionIds.length > 0) {
      currentOrgHeaderBn = pack.orgNameBn || 'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার';
      currentPostLabelBn = pack.postLabelBn || 'নিয়োগ পরীক্ষা';
      currentSetCodeBn = (pack.setCodeBn || 'ক').replace(/^সেট:\s*/, '');
      questions = pack.questionIds.map(id => byId.get(id)).filter(Boolean);
    } else {
      currentSetCodeBn = 'ক';
      questions = pool.slice(0, Math.min(qCount, pool.length));
    }
  }

  // Update OMR sidebar authority & Set Code bubbles
  const omrAuthHead = document.getElementById('omrAuthorityHeading');
  const omrAuthSub = document.getElementById('omrAuthoritySub');
  const omrPenText = document.getElementById('omrPenaltyFooterText');
  const negBn = toBnDigits(currentNegativeRate.toFixed(2));
  if (currentCategory === 'PRIMARY') {
    if (omrAuthHead) omrAuthHead.textContent = 'প্রাথমিক শিক্ষা অধিদপ্তর (DPE)';
    if (omrAuthSub) omrAuthSub.textContent = 'DPE OMR ANSWER SHEET • সরকারি প্রাথমিক শিক্ষক নিয়োগ';
  } else if (currentCategory === 'NTRCA') {
    if (omrAuthHead) omrAuthHead.textContent = 'বেসরকারি শিক্ষক নিবন্ধন ও প্রত্যয়ন কর্তৃপক্ষ';
    if (omrAuthSub) omrAuthSub.textContent = 'NTRCA OMR ANSWER SHEET • স্কুল ও কলেজ পর্যায় (পাস ৪০%)';
  } else if (currentCategory === 'BANK') {
    if (omrAuthHead) omrAuthHead.textContent = 'বাংলাদেশ ব্যাংক / ব্যাংকার্স সিলেকশন কমিটি';
    if (omrAuthSub) omrAuthSub.textContent = 'BANK RECRUITMENT OMR ANSWER SHEET • ১০০ নম্বর';
  } else if (currentCategory === 'MINISTRY') {
    if (omrAuthHead) omrAuthHead.textContent = currentOrgHeaderBn.split('•').pop().trim();
    if (omrAuthSub) omrAuthSub.textContent = 'MINISTRY & DIRECTORATE OMR SHEET • সরকারি নিয়োগ';
  } else if (currentCategory === 'NON_CADRE') {
    if (omrAuthHead) omrAuthHead.textContent = 'পিএসসি নন-ক্যাডার ও দুদক নিয়োগ';
    if (omrAuthSub) omrAuthSub.textContent = 'BPSC NON-CADRE OMR SHEET • ৯ম ও ১০ম গ্রেড';
  } else {
    if (omrAuthHead) omrAuthHead.textContent = 'বাংলাদেশ সরকারি কর্ম কমিশন';
    if (omrAuthSub) omrAuthSub.textContent = 'BPSC OMR ANSWER SHEET • কালো বলপয়েন্ট বৃত্ত ভরাট';
  }
  if (omrPenText) omrPenText.textContent = `● সঠিক = +১.০০ | ভুল = -${negBn}`;

  const setBubbleContainer = document.getElementById('omrSidebarSetBubbles');
  if (setBubbleContainer) {
    if (currentCategory === 'PRIMARY') {
      const displaySet = riverSets.includes(currentSetCodeBn) ? currentSetCodeBn : currentSetCodeBn.split('/')[0].trim();
      setBubbleContainer.innerHTML = riverSets.map(c =>
        `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold border ${c === displaySet ? 'bg-slate-950 text-white border-slate-950' : 'bg-white text-rose-800 border-rose-400'}">${c}</span>`
      ).join('');
    } else {
      setBubbleContainer.innerHTML = setCodes.map(c =>
        `<span class="omr-circle ${c === currentSetCodeBn ? 'filled' : ''}">${c}</span>`
      ).join('');
    }
  }

  remainingSeconds = duration * 60;
  totalExamSeconds = remainingSeconds;

  renderExamQuestions();
  renderQuestionPalette();
  updateLiveSafetyMeter();
  startTimer();
}

function startTimer() {
  examStartTime = Date.now();
  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    remainingSeconds--;
    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      submitExam(true);
    }
    updateTimerDisplay();
  }, 1000);
  updateTimerDisplay();
}

function restartTimer() {
  if (currentCategory === 'BCS_PRELI') {
    remainingSeconds = 7200; // 120 mins
  } else {
    remainingSeconds = 3600; // 60 mins
  }
  totalExamSeconds = remainingSeconds;
  startTimer();
}

function updateTimerDisplay() {
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const display = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  const el = document.getElementById('examTimer');
  if (el) el.textContent = display;
}

function renderExamQuestions() {
  const container = document.getElementById('questionsContainer');
  if (!container) return;

  const negRate = toBnDigits((typeof currentNegativeRate === 'number' ? currentNegativeRate : 0.50).toFixed(2));
  const totalQBn = toBnDigits(questions.length);
  const durationMinBn = toBnDigits(Math.round(totalExamSeconds / 60));

  // Mode 1: Authentic BPSC 2-Column Printed Question Booklet
  if (paperDisplayMode === 'BOOKLET') {
    let lastSubject = null;
    const itemsHtml = questions.map((q, idx) => {
      const selected = userAnswers[q.id];
      const qNoBn = toBnDigits(idx + 1);
      let subjHeader = '';
      if (q.subjectNameBn && q.subjectNameBn !== lastSubject) {
        lastSubject = q.subjectNameBn;
        subjHeader = `<div class="bpsc-subj-header">বিষয়: ${q.subjectNameBn}</div>`;
      }

      const optsHtml = ['A', 'B', 'C', 'D'].map(optKey => {
        const isChecked = selected === optKey;
        const bnKey = { A: 'ক', B: 'খ', C: 'গ', D: 'ঘ' }[optKey];
        return `
          <div onclick="selectAnswer('${q.id}', '${optKey}')" class="bpsc-opt-btn ${isChecked ? 'selected' : ''}">
            <span class="font-bold">(${bnKey})</span>
            <span>${q.options[optKey]}</span>
          </div>
        `;
      }).join('');

      const is5050 = guess5050Ids.has(q.id);
      const repeatBadgeHtml = (q.crossExamRepeats && q.crossExamRepeats.length > 1)
        ? `<div class="text-[10.5px] font-semibold text-amber-950 bg-amber-100/80 border border-amber-400/70 rounded px-1.5 py-0.5 mb-1 leading-snug">
             [${q.crossExamRepeats.slice(0, 4).join(' • ')}${q.crossExamRepeats.length > 4 ? ` • +${toBnDigits(q.crossExamRepeats.length - 4)}` : ''}]
           </div>`
        : '';

      return `
        ${subjHeader}
        <div class="bpsc-q-item" id="q_card_${q.id}">
          <div class="flex items-start justify-between gap-2 font-bold text-[#0b0f17] mb-1">
            <span>${qNoBn}. ${q.stemBn}</span>
            <div class="flex items-center gap-1 shrink-0">
              <button onclick="toggleGuess5050('${q.id}')" title="২টি অপশন বাদ দিয়ে 50:50 অনুমান চিহ্নিত করুন" class="px-1.5 py-0.5 rounded text-[10px] font-bold border transition ${is5050 ? 'bg-amber-400 text-slate-950 border-slate-900' : 'bg-white/80 text-slate-700 border-slate-400 hover:bg-amber-100'}">🎲 50:50</button>
              <button onclick="toggleBookmark('${q.id}')" title="বুকমার্ক" class="text-xs opacity-60 hover:opacity-100 shrink-0">${bookmarkedIds.has(q.id) ? '⭐' : '☆'}</button>
            </div>
          </div>
          ${repeatBadgeHtml}
          <div class="grid grid-cols-2 gap-x-2 gap-y-0.5 pl-1">
            ${optsHtml}
          </div>
        </div>
      `;
    }).join('');

    const orgHeaderBn = currentOrgHeaderBn || 'বাংলাদেশ সরকারি কর্ম কমিশন (BPSC)';
    const codeLabelBn = currentPostLabelBn || 'বিষয় কোড: ১০০ (সাধারণ)';

    container.innerHTML = `
      <div class="bpsc-paper-sheet">
        <!-- Official BPSC / DPE Question Booklet Header -->
        <div class="text-center border-b-2 border-slate-900 pb-3 mb-3">
          <div class="text-xs font-bold tracking-wider text-slate-700">গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</div>
          <h2 class="text-xl sm:text-2xl font-extrabold text-slate-950 mt-0.5">${orgHeaderBn}</h2>
          <h3 class="text-sm sm:text-base font-bold text-[#006a4e] mt-0.5">${currentExamTitleBn}</h3>

          <div class="flex flex-wrap items-center justify-between border-t border-slate-800 mt-2.5 pt-2 text-xs sm:text-sm font-bold text-slate-900">
            <span>${codeLabelBn}</span>
            <span class="border-2 border-slate-950 px-3 py-0.5 bg-white text-slate-950 font-extrabold shadow-sm">
              সেট কোড : ${currentSetCodeBn}
            </span>
            <span>পূর্ণমান: ${totalQBn} | সময়: ${durationMinBn} মিনিট</span>
          </div>
        </div>

        <!-- Official Instructions Box -->
        <div class="bg-[#f5f1e3] border border-slate-700 px-3 py-2 mb-4 text-xs text-slate-900 leading-relaxed">
          <strong>[দ্রষ্টব্য:</strong> ডান পাশের <strong>OMR উত্তরপত্রে</strong> কালো বলপয়েন্ট কলমের বৃত্ত ভরাট করুন অথবা সরাসরি প্রশ্নের অপশনে ক্লিক করুন। প্রতিটি সঠিক উত্তরের জন্য <strong>১ (এক) নম্বর</strong> পাওয়া যাবে এবং প্রতিটি ভুল উত্তরের জন্য <strong>${negRate} নম্বর কাটা যাবে</strong>।<strong>]</strong>
        </div>

        <!-- 2-Column Question Body -->
        <div class="bpsc-two-col">
          ${itemsHtml}
        </div>

        <div class="mt-6 pt-3 border-t-2 border-slate-900 text-center text-xs font-bold text-slate-700">
          — সমাপ্ত — (মোট প্রশ্ন: ${totalQBn}টি • প্রামাণ্য উৎস হতে যাচাইকৃত ১০০% ইউনিক প্রশ্নপত্র)
        </div>
      </div>
    `;
    return;
  }

  // Mode 2: Card View
  container.innerHTML = questions.map((q, idx) => {
    const selected = userAnswers[q.id];
    const isBookmarked = bookmarkedIds.has(q.id);

    return `
      <div class="bg-white border border-slate-200 rounded-2xl p-5 space-y-3" id="q_card_${q.id}">
        <div class="flex flex-wrap items-center justify-between text-xs gap-2">
          <div class="flex items-center space-x-2">
            <span class="px-2.5 py-0.5 rounded-full bg-white text-emerald-700 font-mono border border-slate-200">
              প্রশ্ন ${toBnDigits(idx + 1)} • ${q.subjectNameBn}
            </span>
            <span class="px-2 py-0.5 rounded text-[10px] bg-slate-50 text-slate-700 border border-slate-200">
              ${q.examTitle || 'বিসিএস প্রিলিমিনারি'}
            </span>
            ${q.reference ? `<span class="px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">${q.reference}</span>` : ''}
          </div>

          <div class="flex items-center space-x-2 text-slate-500">
            <span class="font-mono">মান: ১.০০ | ভুল: -${negRate}</span>
            <button onclick="toggleBookmark('${q.id}')" title="বুকমার্ক করুন" class="text-sm p-1 hover:text-amber-700 transition">
              ${isBookmarked ? '⭐' : '☆'}
            </button>
            <button onclick="openReportModal('${q.id}')" title="ভুল রিপোর্ট করুন" class="text-sm p-1 hover:text-rose-700 transition">
              🚩
            </button>
          </div>
        </div>

        <h3 class="text-base font-semibold text-slate-900 leading-relaxed">
          ${toBnDigits(idx + 1)}. ${q.stemBn}
        </h3>

        <!-- Options (ক, খ, গ, ঘ) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-sans">
          ${['A', 'B', 'C', 'D'].map(optKey => {
            const isChecked = selected === optKey;
            const bengaliKey = { A: 'ক', B: 'খ', C: 'গ', D: 'ঘ' }[optKey];
            return `
              <label onclick="selectAnswer('${q.id}', '${optKey}')" class="flex items-center p-3 rounded-xl border cursor-pointer transition ${
                isChecked
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                  : 'bg-white border-slate-200 hover:bg-white text-slate-700'
              }">
                <span class="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs mr-3 ${
                  isChecked ? 'bg-emerald-500 text-slate-950' : 'bg-white text-slate-500'
                }">${bengaliKey}</span>
                <span class="text-sm">${q.options[optKey]}</span>
              </label>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function selectAnswer(questionId, optionKey) {
  if (userAnswers[questionId] === optionKey) {
    delete userAnswers[questionId];
  } else {
    userAnswers[questionId] = optionKey;
  }
  renderExamQuestions();
  renderQuestionPalette();
  updateLiveSafetyMeter();
}

function toggleGuess5050(questionId) {
  if (guess5050Ids.has(questionId)) {
    guess5050Ids.delete(questionId);
  } else {
    guess5050Ids.add(questionId);
  }
  renderExamQuestions();
  updateLiveSafetyMeter();
}

function updateLiveSafetyMeter() {
  const badge = document.getElementById('safetyZoneBadge');
  const bar = document.getElementById('safetyMeterBar');
  const targetEl = document.getElementById('safetyCutMarkTarget');
  const sureGuessEl = document.getElementById('safetySureVsGuess');
  const expEl = document.getElementById('safetyExpectedScore');
  const adviceEl = document.getElementById('safetyAdviceText');
  if (!badge || !bar) return;

  const totalQ = Math.max(1, questions.length || 200);
  const neg = typeof currentNegativeRate === 'number' ? currentNegativeRate : 0.50;
  let safeLow = Math.round(totalQ * 0.58);
  let safeHigh = Math.round(totalQ * 0.62);
  if (activeExamTrack === 'NTRCA') {
    safeLow = 40;
    safeHigh = 65;
  } else if (activeExamTrack === 'PRIMARY') {
    safeLow = Math.round(totalQ * 0.72);
    safeHigh = Math.round(totalQ * 0.78);
  }

  const answeredIds = Object.keys(userAnswers);
  const answeredCount = answeredIds.length;
  let guessCount = 0;
  answeredIds.forEach(id => {
    if (guess5050Ids.has(id)) guessCount++;
  });
  const sureCount = Math.max(0, answeredCount - guessCount);

  // Expected mathematical score: Sure answers ~92% accuracy, 50:50 guesses = 50% (+1) & 50% (-neg)
  const sureEV = sureCount * (0.92 * 1.0 - 0.08 * neg);
  const guessEV = guessCount * (0.50 * 1.0 - 0.50 * neg);
  const expectedNet = Math.max(0, sureEV + guessEV);

  if (targetEl) targetEl.textContent = `${toBnDigits(safeLow)}–${toBnDigits(safeHigh)}+`;
  if (sureGuessEl) sureGuessEl.textContent = `${toBnDigits(sureCount)} : ${toBnDigits(guessCount)}`;
  if (expEl) expEl.textContent = toBnDigits(expectedNet.toFixed(1));

  const pct = Math.min(100, Math.max(4, Math.round((expectedNet / safeHigh) * 100)));
  bar.style.width = `${pct}%`;

  if (guessCount > totalQ * 0.22) {
    badge.className = 'px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-500 text-[10px] font-bold';
    badge.textContent = '⚠️ Over-Guessing Risk!';
    bar.className = 'bg-amber-400 h-full transition-all duration-300';
    if (adviceEl) {
      adviceEl.innerHTML = `⚠️ <strong>সতর্কতা:</strong> আপনি <strong>${toBnDigits(guessCount)}টি</strong> প্রশ্নে 50:50 গেস করেছেন। অতিরিক্ত আন্দাজে দাগালে নেগেটিভ মার্কিংয়ে (-${toBnDigits(neg.toFixed(2))}) কাট-মার্ক নিচে নেমে যেতে পারে!`;
    }
  } else if (expectedNet >= safeLow) {
    badge.className = 'px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-500 text-[10px] font-bold';
    badge.textContent = '🟢 Safe Zone (নিরাপদ জোন)';
    bar.className = 'bg-emerald-500 h-full transition-all duration-300';
    if (adviceEl) {
      adviceEl.innerHTML = `✅ <strong>অভিনন্দন!</strong> আপনার প্রত্যাশিত স্কোর নিরাপদ কাট-মার্ক জোনে (${toBnDigits(safeLow)}+) পৌঁছেছে। এখন নিশ্চিত না হয়ে নতুন কোনো প্রশ্ন আন্দাজে দাগাবেন না!`;
    }
  } else if (expectedNet >= safeLow * 0.82) {
    badge.className = 'px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-bold';
    badge.textContent = '🟡 Borderline (সতর্ক জোন)';
    bar.className = 'bg-amber-500 h-full transition-all duration-300';
    if (adviceEl) {
      const needed = Math.max(1, Math.ceil(safeLow - expectedNet));
      adviceEl.innerHTML = `🎯 <strong>বর্ডারলাইন জোন:</strong> সেফ কাট-মার্কে যেতে আরও প্রায় <strong>${toBnDigits(needed)} নম্বর</strong> প্রয়োজন। যেসব প্রশ্নে ২টি অপশন বাদ দিতে পারছেন, শুধু সেগুলোতেই 50:50 গেস নিন।`;
    }
  } else {
    badge.className = 'px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold';
    badge.textContent = '🔴 Red Zone (আরও দাগান)';
    bar.className = 'bg-rose-500 h-full transition-all duration-300';
    if (adviceEl) {
      adviceEl.innerHTML = `💡 <strong>পরামর্শ:</strong> আগে শতভাগ নিশ্চিত প্রশ্নগুলো দাগান। কোনো প্রশ্নে ২টি অপশন বাদ দিতে পারলে <strong>🎲 50:50</strong> বাটন চেপে গাণিতিক সুবিধায় (+${toBnDigits((0.5 - 0.5 * neg).toFixed(2))} EV) উত্তর দিন।`;
    }
  }
}

function renderQuestionPalette() {
  const grid = document.getElementById('paletteGrid');
  const counter = document.getElementById('answeredCounter');
  if (!grid) return;

  const answeredCount = Object.keys(userAnswers).length;
  if (counter) counter.textContent = `${toBnDigits(answeredCount)}/${toBnDigits(questions.length)} ভরাটকৃত`;

  const bnOpt = { A: 'ক', B: 'খ', C: 'গ', D: 'ঘ' };

  grid.innerHTML = questions.map((q, idx) => {
    const chosen = userAnswers[q.id];
    const bubblesHtml = ['A', 'B', 'C', 'D'].map(optKey => {
      const isFilled = chosen === optKey;
      return `
        <span onclick="selectAnswer('${q.id}', '${optKey}')" class="omr-circle ${isFilled ? 'filled' : ''}" title="প্রশ্ন ${idx + 1} - অপশন ${bnOpt[optKey]}">
          ${bnOpt[optKey]}
        </span>
      `;
    }).join('');

    return `
      <div class="flex items-center justify-between py-1 px-1.5 rounded border-b border-rose-200/80 hover:bg-rose-100/50 transition">
        <button onclick="scrollToQuestion('${q.id}')" class="text-xs font-bold text-rose-900 hover:underline w-8 text-left">
          ${toBnDigits(idx + 1)}.
        </button>
        <div class="flex items-center space-x-1">
          ${bubblesHtml}
        </div>
      </div>
    `;
  }).join('');
}

function scrollToQuestion(id) {
  const el = document.getElementById(`q_card_${id}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// -----------------------------------------------------------------------------
// EXAM SUBMISSION, SCORECARD & WEAKNESS INTEGRATION
// -----------------------------------------------------------------------------
function submitExam(isAuto = false) {
  if (timerInterval) clearInterval(timerInterval);

  const negRate = currentCategory === 'BCS_PRELI' ? 0.50 : 0.25;
  let correct = 0;
  let wrong = 0;
  let blank = 0;

  const newMistakes = [];

  questions.forEach(q => {
    const chosen = userAnswers[q.id];
    if (!chosen) {
      blank++;
    } else if (chosen === q.correctOption) {
      correct++;
    } else {
      wrong++;
      newMistakes.push({
        id: `mv_${Date.now()}_${q.id}`,
        questionId: q.id,
        question: q,
        sourceExamTitle: currentCategory === 'BCS_PRELI' ? '৪৭তম বিসিএস মডেল টেস্ট' : 'প্রাথমিক সহকারী শিক্ষক পরীক্ষা',
        selectedOption: chosen,
        correctOption: q.correctOption,
        tag: determineInitialTag(q),
        userNotes: '',
        status: 'OPEN',
        errorCount: 1,
        sm2Quality: 1,
        easinessFactor: 2.5,
        intervalDays: 1,
        nextReviewDate: new Date(Date.now() + 86400000)
      });
    }
  });

  const rawScore = correct * 1.0;
  const penalty = Number((wrong * negRate).toFixed(2));
  const netScore = Math.max(0, Number((rawScore - penalty).toFixed(2)));

  // Tie-Breaking Ranking Formula: NetScore + (1 - (timeTaken / totalDuration))
  const timeTakenSec = Math.max(1, totalExamSeconds - remainingSeconds);
  const timeBonus = 1 - (timeTakenSec / totalExamSeconds);
  const tieBreakerScore = Number((netScore + timeBonus).toFixed(6));

  // Ingest into Mistake Vault
  newMistakes.forEach(m => {
    const existing = userMistakes.find(item => item.questionId === m.questionId);
    if (existing) {
      existing.errorCount += 1;
      existing.status = 'IN_REVIEW';
    } else {
      userMistakes.unshift(m);
    }
  });

  updateMistakeBadge();
  updateAnalyticsDashboard(penalty, correct, wrong);

  // Scorecard Modal
  document.getElementById('modalCorrect').textContent = correct;
  document.getElementById('modalWrong').textContent = `${wrong} (-${penalty})`;
  document.getElementById('modalNetScore').textContent = netScore.toFixed(2);
  document.getElementById('modalTieBreaker').textContent = `Composite: ${tieBreakerScore}`;
  document.getElementById('modalRankText').textContent = `ব্যয়িত সময়: ${Math.floor(timeTakenSec / 60)}মি. ${timeTakenSec % 60}সে. | মেধা স্থান: ১ম (শীর্ষ ৯৯.৯%)`;

  // 50:50 Elimination Guess Mathematical Profit/Loss Breakdown
  const guessSummaryEl = document.getElementById('modalGuessSummaryText');
  if (guessSummaryEl) {
    let gCorrect = 0;
    let gWrong = 0;
    questions.forEach(q => {
      if (guess5050Ids.has(q.id) && userAnswers[q.id]) {
        if (userAnswers[q.id] === q.correctOption) gCorrect++;
        else gWrong++;
      }
    });
    const gTotal = gCorrect + gWrong;
    if (gTotal > 0) {
      const gNet = Number((gCorrect * 1.0 - gWrong * negRate).toFixed(2));
      const sign = gNet >= 0 ? '+' : '';
      guessSummaryEl.innerHTML = `আপনি মোট <strong>${toBnDigits(gTotal)}টি</strong> প্রশ্নে 50:50 গেস নিয়েছেন: সঠিক <strong>${toBnDigits(gCorrect)}টি</strong>, ভুল <strong>${toBnDigits(gWrong)}টি</strong> ➔ গেসিং থেকে নিট ফলাফল: <strong class="${gNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${sign}${toBnDigits(gNet.toFixed(2))} নম্বর</strong> (${gNet >= 0 ? 'গাণিতিকভাবে লাভজনক সিদ্ধান্ত!' : 'নেগেটিভ ক্ষতি হয়েছে!'})।`;
    } else {
      guessSummaryEl.innerHTML = `এই পরীক্ষায় মোট সঠিক <strong>${toBnDigits(correct)}টি</strong> ও ভুল <strong>${toBnDigits(wrong)}টি</strong> (নেগেটিভ দণ্ড: <strong>-${toBnDigits(penalty.toFixed(2))}</strong>)। পরের বার ২টি অপশন বাদ দিয়ে অনুমান করলে প্রশ্নের পাশে <strong>🎲 50:50</strong> বাটন চাপুন।`;
    }
  }

  const modal = document.getElementById('scorecardModal');
  if (modal) modal.classList.remove('hidden');

  // Submit to Redis Live Leaderboard
  submitToLeaderboard({
    userId: 'usr_candidate_me',
    userName: 'ক্যান্ডিডেট #৪৭ (আপনি)',
    rawScore,
    penalty,
    netScore,
    timeTakenSec,
    totalDurationSec: totalExamSeconds,
    tieBreakerRankScore: tieBreakerScore
  });
}

function determineInitialTag(q) {
  if (q.difficulty === 'STANDARD') return 'SILLY_MISTAKE';
  if (q.stemBn.includes('নয়') || q.stemBn.includes('কোনটি সঠিক নয়')) return 'UNREAD_STEM';
  return 'CONCEPT_GAP';
}

function closeModal() {
  const modal = document.getElementById('scorecardModal');
  if (modal) modal.classList.add('hidden');
}

function viewMistakesAfterExam() {
  closeModal();
  switchTab('mistakes');
}

function updateMistakeBadge() {
  const badge = document.getElementById('mistakeBadge');
  if (badge) badge.textContent = userMistakes.length;
}

// -----------------------------------------------------------------------------
// 2. PAST YEAR QUESTION BANK BROWSER (বিসিএস ও প্রাইমারি সম্পূর্ণ আলাদা আর্কাইভ + হুবহু ২-কলাম প্রশ্নপত্র ও OMR)
// -----------------------------------------------------------------------------
let pastBankDisplayMode = 'BOOKLET'; // 'BOOKLET' (2-col real BPSC/DPE paper + OMR) or 'CARD'
let pastBankShowAnswers = false; // Toggle answer key & explanation in Past Bank booklet
let pastBankUserAnswers = {}; // Interactive practice answers inside Past Bank

function initPastBank() {
  renderPastBankFilters();
  renderPastBank();
}

function setPastBankDisplayMode(mode) {
  pastBankDisplayMode = mode;
  const btnBooklet = document.getElementById('btnPastDisplayBooklet');
  const btnCard = document.getElementById('btnPastDisplayCard');
  if (btnBooklet && btnCard) {
    btnBooklet.className = mode === 'BOOKLET'
      ? 'px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold transition'
      : 'px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-900 transition';
    btnCard.className = mode === 'CARD'
      ? 'px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold transition'
      : 'px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-900 transition';
  }
  renderPastBank();
}

function togglePastBankAnswerKey() {
  pastBankShowAnswers = !pastBankShowAnswers;
  const btn = document.getElementById('btnPastShowAnswers');
  if (btn) {
    btn.className = pastBankShowAnswers
      ? 'px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-extrabold shadow transition'
      : 'px-3 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400 text-amber-800 text-xs font-bold transition';
    btn.textContent = pastBankShowAnswers ? '🙈 উত্তর ও ব্যাখ্যা লুকান' : '👁️ উত্তর ও ব্যাখ্যা দেখান';
  }
  renderPastBank();
}

function selectPastBankAnswer(questionId, optionKey) {
  if (pastBankUserAnswers[questionId] === optionKey) {
    delete pastBankUserAnswers[questionId];
  } else {
    pastBankUserAnswers[questionId] = optionKey;
  }
  renderPastBank();
}

function clearPastBankAnswers() {
  pastBankUserAnswers = {};
  renderPastBank();
}

function getSectorArchiveList(track) {
  if (typeof window === 'undefined') return [];
  if (track === 'PRIMARY') return window.primaryExamsArchive || [];
  if (track === 'NTRCA') return window.ntrcaExamsArchive || [];
  if (track === 'BANK') return window.bankExamsArchive || [];
  if (track === 'MINISTRY') return window.ministryExamsArchive || [];
  if (track === 'NON_CADRE') return window.nonCadreExamsArchive || [];
  if (track === 'NURSING') return window.nursingExamsArchive || [];
  return [];
}

function setPastBankTrack(track) {
  pastBankTrack = track; // 'BCS' | 'PRIMARY' | 'NTRCA' | 'BANK' | 'MINISTRY' | 'NON_CADRE' | 'NURSING'
  pastBankFilterValue = defaultPastBankFilter();

  const allTracks = ['BCS', 'PRIMARY', 'NTRCA', 'BANK', 'MINISTRY', 'NON_CADRE', 'NURSING'];
  allTracks.forEach(t => {
    const btn = document.getElementById(`btnPastTrack${t}`);
    if (btn) {
      btn.className = track === t
        ? 'chip chip-active'
        : 'chip';
    }
  });

  const head = document.getElementById('pastBankMainHeading');
  const badge = document.getElementById('pastBankSubBadge');
  const desc = document.getElementById('pastBankDescText');
  if (track === 'PRIMARY') {
    if (head) head.textContent = '🏫 সরকারি প্রাথমিক বিদ্যালয় সহকারী শিক্ষক নিয়োগ প্রশ্নব্যাংক (DPE)';
    if (badge) badge.textContent = '২০১২ – ২০২৪ সকল ধাপ (১৬টি পূর্ণাঙ্গ সেট + ১০টি নদী মডেল সেট)';
    if (desc) desc.textContent = 'প্রাথমিক শিক্ষা অধিদপ্তরের (DPE) বিগত সালের সকল ধাপের প্রশ্নসেট সমাধান করুন অথবা এক ক্লিকে হুবহু ২-কলাম DPE প্রশ্নপত্রে লাইভ পরীক্ষা দিন।';
  } else if (track === 'NTRCA') {
    if (head) head.textContent = '🎓 বেসরকারি শিক্ষক নিবন্ধন ও প্রত্যয়ন কর্তৃপক্ষ (NTRCA) প্রশ্নব্যাংক';
    if (badge) badge.textContent = '১৪তম – ১৮তম শিক্ষক নিবন্ধন ও ১৯তম মডেল (স্কুল ও কলেজ পর্যায় • ১৮টি পূর্ণাঙ্গ সেট)';
    if (desc) desc.textContent = 'স্কুল, স্কুল-২ ও কলেজ পর্যায়ের বিগত নিবন্ধন ও স্পেশাল মডেল সেট হুবহু ২-কলাম বুকলেট ও OMR শিটে সমাধান করুন (পাশ নম্বর ৪০%, নেগেটিভ ০.২৫)।';
  } else if (track === 'BANK') {
    if (head) head.textContent = '🏦 বাংলাদেশ ব্যাংক AD ও সমন্বিত ব্যাংক নিয়োগ প্রশ্নব্যাংক (BSC)';
    if (badge) badge.textContent = 'BB AD, Combined 9/10 Banks Officer, SO & Cash (১৬টি পূর্ণাঙ্গ সেট)';
    if (desc) desc.textContent = 'বাংলাদেশ ব্যাংক সহকারী পরিচালক ও ব্যাংকার্স সিলেকশন কমিটির (BSC) সমন্বিত ব্যাংক নিয়োগ পরীক্ষার প্রশ্নপত্র ২-কলাম বুকলেটে অনুশীলন করুন।';
  } else if (track === 'MINISTRY') {
    if (head) head.textContent = '🏢 খাদ্য অধিদপ্তর, অডিটর, রেলওয়ে, সমাজসেবা ও মন্ত্রণালয় প্রশ্নব্যাংক';
    if (badge) badge.textContent = '১১তম – ২০তম গ্রেড মেগা নিয়োগ (খাদ্য ১৩.৭ লক্ষ • অডিটর • রেলওয়ে • LGED • ১৬টি পূর্ণাঙ্গ সেট)';
    if (desc) desc.textContent = 'খাদ্য অধিদপ্তর (DG Food), সিজিএ অডিটর, বাংলাদেশ রেলওয়ে, সমাজসেবা ও এলজিইডি-এর প্রশ্নপত্র হুবহু মুদ্রিত প্রশ্নপত্রে চর্চা করুন।';
  } else if (track === 'NON_CADRE') {
    if (head) head.textContent = '⚖️ পিএসসি নন-ক্যাডার (৯ম-১০ম গ্রেড) ও দুদক (ACC) প্রশ্নব্যাংক';
    if (badge) badge.textContent = 'এটিইও (ATEO) • সাব-রেজিস্ট্রার • তহশিলদার • দুদক (১৪টি পূর্ণাঙ্গ সেট)';
    if (desc) desc.textContent = 'পিএসসি নন-ক্যাডার ৯ম ও ১০ম গ্রেড এবং দুর্নীতি দমন কমিশনের (ACC) প্রশ্নপত্র ২-কলাম বুকলেট ও OMR শিটে সমাধান করুন।';
  } else if (track === 'NURSING') {
    if (head) head.textContent = '🩺 বিপিএসসি সিনিয়র স্টাফ নার্স ও মিডওয়াইফারি প্রশ্নব্যাংক (BPSC & DGNM)';
    if (badge) badge.textContent = '১০ম গ্রেড নার্সিং ও মিডওয়াইফারি (১৪টি পূর্ণাঙ্গ সেট • ৪টি বিগত পরীক্ষা + ১০টি প্রফেশনাল মডেল সেট)';
    if (desc) desc.textContent = 'বিপিএসসি সিনিয়র স্টাফ নার্স ও মিডওয়াইফারি নিয়োগের বিগত প্রশ্নপত্র ও প্রফেশনাল নার্সিং মডেল সেট (৬০ নার্সিং বিজ্ঞান + ৪০ সাধারণ) ২-কলাম বুকলেট ও OMR শিটে সমাধান করুন।';
  } else {
    if (head) head.textContent = '📚 বিগত ২০ বিসিএস প্রশ্নব্যাংক ও বোর্ড বই ড্রিল (BPSC)';
    if (badge) badge.textContent = '২৭তম - ৪৬তম বিসিএস • ১,২০০+ ইউনিক প্রশ্ন';
    if (desc) desc.textContent = 'বছরভিত্তিক পূর্ণাঙ্গ আর্কাইভ দেখুন অথবা সরাসরি হুবহু ২-কলাম প্রশ্নপত্রে পরীক্ষা দিন। প্রতিটি প্রশ্নে রয়েছে নির্ভুল ব্যাখ্যা ও শর্টকাট।';
  }

  renderPastBankFilters();
  renderPastBank();
}

function launchExamFromPastBank(track, examSetId) {
  if (window.Account && !Account.allow(examSetId)) return;
  selectExamTrack(track);
  const sel = document.getElementById('examCategorySelect');
  if (sel) sel.value = examSetId;
  changeExamCategory();
  switchTab('exam');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setPastBankMode(mode) {
  pastBankMode = mode;
  document.getElementById('btnModeYear').className = mode === 'YEAR'
    ? 'px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium'
    : 'px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-900';
  document.getElementById('btnModeTopic').className = mode === 'TOPIC'
    ? 'px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium'
    : 'px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-900';

  pastBankFilterValue = defaultPastBankFilter();
  renderPastBankFilters();
  renderPastBank();
}

function renderPastBankFilters() {
  const container = document.getElementById('pastBankFilters');
  if (!container) return;

  if (pastBankTrack !== 'BCS') {
    const sectorArchives = getSectorArchiveList(pastBankTrack);
    const archiveOverviewLabel = {
      PRIMARY: '🏫 সকল ধাপের তালিকা ও কাট-মার্ক (১৬টি সেট)',
      NTRCA: '🎓 সকল নিবন্ধন ও মডেল সেটের তালিকা (১২টি সেট)',
      BANK: '🏦 সকল ব্যাংক নিয়োগ ও মডেল সেটের তালিকা (১০টি সেট)',
      MINISTRY: '🏢 সকল মন্ত্রণালয় ও অধিদপ্তরের সেটের তালিকা (১০টি সেট)',
      NON_CADRE: '⚖️ সকল নন-ক্যাডার ও দুদক সেটের তালিকা (৮টি সেট)'
    }[pastBankTrack] || '📋 সকল সেটের তালিকা';

    const allQuestionsLabel = {
      PRIMARY: 'সকল প্রাইমারি প্রশ্ন (একত্রে)',
      NTRCA: 'সকল শিক্ষক নিবন্ধন প্রশ্ন (একত্রে)',
      BANK: 'সকল ব্যাংক নিয়োগ প্রশ্ন (একত্রে)',
      MINISTRY: 'সকল মন্ত্রণালয় ও অধিদপ্তর প্রশ্ন (একত্রে)',
      NON_CADRE: 'সকল নন-ক্যাডার প্রশ্ন (একত্রে)'
    }[pastBankTrack] || 'সকল প্রশ্ন';

    if (pastBankMode === 'YEAR') {
      const items = [
        { code: 'ARCHIVE_SECTOR', label: archiveOverviewLabel },
        { code: 'SUPER_HOT_10', label: '🔥 ১০+ বার আসা কমন প্রশ্ন (Super Hot 200)' },
        { code: 'SUPER_HOT_5', label: '🔥 ৫+ বার আসা সুপার-হট কমন প্রশ্ন' },
        { code: 'ALL', label: allQuestionsLabel },
        ...sectorArchives.map(a => ({
          code: a.code,
          label: pastBankTrack === 'PRIMARY'
            ? `${a.year} (${(a.phase || '').split(' ')[0]} • ${a.setNameBn})`
            : `${a.title.replace(/প্রিলিমিনারি|নিয়োগ পরীক্ষা/g, '').trim()}${a.year ? ` (${a.year})` : ''}`
        }))
      ];
      container.innerHTML = items.map(it => `
        <button onclick="filterPastBank('${it.code}')" class=\"chip ${
          pastBankFilterValue === it.code ? 'chip-active' : ''
        }">${it.label}</button>
      `).join('');
    } else {
      const sectorSubjects = [
        { code: 'ALL', name: 'সকল বিষয়' },
        { code: 'BANGLA', name: 'বাংলা ব্যাকরণ ও সাহিত্য' },
        { code: 'ENGLISH', name: 'English Language & Grammar' },
        { code: 'MATH', name: 'পাটিগণিত, বীজগণিত ও জ্যামিতি' },
        { code: 'BANGLADESH_AFFAIRS', name: 'বাংলাদেশ বিষয়াবলী ও সাধারণ জ্ঞান' },
        { code: 'INT_AFFAIRS', name: 'আন্তর্জাতিক ও সাম্প্রতিক' },
        { code: 'GENERAL_SCIENCE', name: 'সাধারণ বিজ্ঞান' },
        { code: 'COMPUTER_ICT', name: 'কম্পিউটার, আইসিটি ও ব্যাংকিং প্রযুক্তি' }
      ];
      container.innerHTML = sectorSubjects.map(s => `
        <button onclick="filterPastBank('${s.code}')" class=\"chip ${
          pastBankFilterValue === s.code ? 'chip-active' : ''
        }">${s.name}</button>
      `).join('');
    }
    return;
  }

  if (pastBankMode === 'YEAR') {
    const years = [
      'ARCHIVE_20',
      'SUPER_HOT_10',
      'SUPER_HOT_5',
      'ALL',
      '৪৬তম', '৪৫তম', '৪৪তম', '৪৩তম', '৪২তম',
      '৪১তম', '৪০তম', '৩৯তম', '৩৮তম', '৩৭তম',
      '৩৬তম', '৩৫তম', '৩৪তম', '৩৩তম', '৩২তম',
      '৩১তম', '৩০তম', '২৯তম', '২৮তম', '২৭তম'
    ];
    const labels = {
      ARCHIVE_20: '🏛️ ২০ বিসিএস ইতিহাস, কাট-মার্ক ও পূর্ণাঙ্গ সেট',
      SUPER_HOT_10: '🔥 ১০+ বার আসা কমন প্রশ্ন (Super Hot 200)',
      SUPER_HOT_5: '🔥 ৫+ বার আসা সুপার-হট কমন প্রশ্ন (Cross-Exam Repeat)',
      ALL: 'সকল বিগত বিসিএস (৮০০ ইউনিক বিসিএস প্রশ্ন)',
      '৪৬তম': '৪৬তম বিসিএস (২০২৪)',
      '৪৫তম': '৪৫তম বিসিএস (২০২৩)',
      '৪৪তম': '৪৪তম বিসিএস (২০২২)',
      '৪৩তম': '৪৩তম বিসিএস (২০২১)',
      '৪২তম': '৪২তম বিশেষ (২০২১)',
      '৪১তম': '৪১তম বিসিএস (২০২১)',
      '৪০তম': '৪০তম বিসিএস (২০১৯)',
      '৩৯তম': '৩৯তম বিশেষ (২০১৮)',
      '৩৮তম': '৩৮তম বিসিএস (২০১৭)',
      '৩৭তম': '৩৭তম বিসিএস (২০১৬)',
      '৩৬তম': '৩৬তম বিসিএস (২০১৬)',
      '৩৫তম': '৩৫তম বিসিএস (২০১৫)',
      '৩৪তম': '৩৪তম বিসিএস (২০১৩)',
      '৩৩তম': '৩৩তম বিশেষ (২০১২)',
      '৩২তম': '৩২তম বিশেষ (২০১১)',
      '৩১তম': '৩১তম বিসিএস (২০১১)',
      '৩০তম': '৩০তম বিসিএস (২০১০)',
      '২৯তম': '২৯তম বিসিএস (২০০৯)',
      '২৮তম': '২৮তম বিসিএস (২০০৮)',
      '২৭তম': '২৭তম বিসিএস (২০০৭)'
    };

    container.innerHTML = years.map(y => `
      <button onclick="filterPastBank('${y}')" class=\"chip ${
        pastBankFilterValue === y ? 'chip-active' : ''
      }">${labels[y] || y}</button>
    `).join('');
  } else {
    const subjects = [
      { code: 'ALL', name: 'সকল বিষয় (১,০৬০ প্রশ্ন)' },
      { code: 'BANGLA', name: 'বাংলা ভাষা ও সাহিত্য' },
      { code: 'ENGLISH', name: 'English Literature & Grammar' },
      { code: 'BANGLADESH_AFFAIRS', name: 'বাংলাদেশ বিষয়াবলী' },
      { code: 'INT_AFFAIRS', name: 'আন্তর্জাতিক বিষয়াবলী' },
      { code: 'MATH', name: 'গাণিতিক যুক্তি' },
      { code: 'MENTAL_ABILITY', name: 'মানসিক দক্ষতা' },
      { code: 'GENERAL_SCIENCE', name: 'সাধারণ বিজ্ঞান' },
      { code: 'COMPUTER_ICT', name: 'কম্পিউটার ও তথ্যপ্রযুক্তি' },
      { code: 'GEOGRAPHY', name: 'ভূগোল ও দুর্যোগ' },
      { code: 'ETHICS', name: 'নৈতিকতা ও সুশাসন' }
    ];

    container.innerHTML = subjects.map(s => `
      <button onclick="filterPastBank('${s.code}')" class=\"chip ${
        pastBankFilterValue === s.code ? 'chip-active' : ''
      }">${s.name}</button>
    `).join('');
  }
}

function filterPastBank(val) {
  pastBankFilterValue = val;
  renderPastBankFilters();
  renderPastBank();
}

function renderPastBank() {
  const feed = document.getElementById('pastBankFeed');
  if (!feed) return;

  // Premium paper: its questions are not in the free data, show the unlock card
  const lockedPastId = window.Account && Account.pastBankExamId(pastBankTrack, pastBankMode, pastBankFilterValue);
  if (lockedPastId && Account.isLocked(lockedPastId)) {
    feed.innerHTML = Account.lockedCardHtml(lockedPastId);
    return;
  }

  const allPool = (typeof window !== 'undefined' && window.sampleQuestions && window.sampleQuestions.length > 0)
    ? window.sampleQuestions
    : (typeof sampleQuestions !== 'undefined' ? sampleQuestions : questions);
  const byId = new Map(allPool.map(q => [q.id, q]));

  // NON-BCS SECTOR ARCHIVE OVERVIEW CARDS (PRIMARY, NTRCA, BANK, MINISTRY, NON_CADRE)
  if (pastBankTrack !== 'BCS' && (pastBankFilterValue === 'ARCHIVE_SECTOR' || pastBankFilterValue === 'ARCHIVE_PRI')) {
    const sectorArchives = getSectorArchiveList(pastBankTrack);
    feed.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${sectorArchives.map(a => `
          <div class="bg-white border border-slate-200 hover:border-emerald-500 rounded-2xl p-5 space-y-3 transition shadow-sm">
            <div class="flex justify-between items-center text-xs gap-2">
              <span class="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                ${a.title}
              </span>
              <span class="px-2 py-0.5 rounded bg-amber-400/20 text-amber-800 font-bold whitespace-nowrap">${a.setNameBn}</span>
            </div>

            <div class="grid grid-cols-3 gap-2 text-xs font-mono py-1">
              <div class="bg-white p-2 rounded-lg border border-slate-200">
                <span class="text-slate-500 block text-[10px]">তারিখ ও কর্তৃপক্ষ</span>
                <span class="text-slate-800 font-bold">${a.examDate}</span>
              </div>
              <div class="bg-white p-2 rounded-lg border border-slate-200">
                <span class="text-slate-500 block text-[10px]">পূর্ণমান ও নেগেটিভ</span>
                <span class="text-emerald-700 font-bold">${toBnDigits(a.totalQuestions)} নম্বর (-${toBnDigits(a.negativeMark || 0.25)})</span>
              </div>
              <div class="bg-white p-2 rounded-lg border border-slate-200">
                <span class="text-slate-500 block text-[10px]">সেফ কাট-মার্ক / পরীক্ষার্থী</span>
                <span class="text-emerald-700 font-bold">${a.safeScoreTrend}</span>
              </div>
            </div>

            <p class="text-xs text-slate-700 leading-relaxed">
              <strong class="text-amber-700">প্রশ্ন প্যাটার্ন: </strong>${a.notablePattern}
            </p>

            <div class="grid grid-cols-2 gap-2 pt-1">
              <button onclick="filterPastBank('${a.code}')" class="py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs transition">
                📖 ২-কলাম বুকলেটে প্রশ্ন দেখুন
              </button>
              <button onclick="launchExamFromPastBank('${pastBankTrack}', '${a.code}_SET')" class="py-2 rounded-xl bg-[#006a4e] hover:bg-emerald-600 text-white font-bold text-xs transition">
                📝 লাইভ টাইমারসহ পরীক্ষা দিন →
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    return;
  }

  // View Mode: 20 Years BCS Archive Overview
  if (pastBankTrack === 'BCS' && pastBankFilterValue === 'ARCHIVE_20') {
    const archives = (typeof bcs20YearsArchive !== 'undefined' && bcs20YearsArchive) || [];
    feed.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${archives.map((a) => `
          <div class="bg-white border border-slate-200 hover:border-emerald-500 rounded-2xl p-5 space-y-3 transition shadow-sm">
            <div class="flex justify-between items-center text-xs">
              <span class="px-2.5 py-1 rounded-lg bg-slate-50 text-slate-700 font-bold border border-slate-200">
                ${a.title}
              </span>
              <span class="text-slate-500 font-mono">${a.examDate || a.year}</span>
            </div>

            <div class="grid grid-cols-2 gap-2 text-xs font-mono py-1">
              <div class="bg-white p-2 rounded-lg border border-slate-200">
                <span class="text-slate-500 block text-[10px]">পরীক্ষার্থী সংখ্যা</span>
                <span class="text-emerald-700 font-bold">${a.applicantCount ? a.applicantCount.toLocaleString('bn-BD') : '৩ লক্ষ+'} জন</span>
              </div>
              <div class="bg-white p-2 rounded-lg border border-slate-200">
                <span class="text-slate-500 block text-[10px]">সেফ কাট-মার্ক জোন</span>
                <span class="text-emerald-700 font-bold">${a.safeScoreTrend} নম্বর</span>
              </div>
            </div>

            <p class="text-xs text-slate-700 leading-relaxed">
              <strong class="text-amber-700">প্রশ্ন প্যাটার্ন: </strong>${a.notablePattern}
            </p>

            <div class="grid grid-cols-2 gap-2 pt-1">
              <button onclick="filterPastBank('${a.title.split(' ')[0]}')" class="py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs transition">
                📖 প্রশ্ন ও ব্যাখ্যা দেখুন
              </button>
              <button onclick="launchExamFromPastBank('BCS', '${a.code}_SET')" class="py-2 rounded-xl bg-emerald-600 hover:bg-emerald-600 text-white font-bold text-xs transition">
                📝 ২-কলাম প্রশ্নপত্রে পরীক্ষা →
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    return;
  }

  let filtered = [];
  if (pastBankFilterValue === 'SUPER_HOT_10') {
    const hot200Ids = (typeof window !== 'undefined' && window.superHot200QuestionIds) || [];
    filtered = hot200Ids.map(id => byId.get(id)).filter(Boolean);
    if (filtered.length === 0) {
      filtered = allPool
        .filter(q => q.isSuperHot10 || (q.repeatCount && q.repeatCount >= 10))
        .sort((a, b) => (b.repeatCount || 0) - (a.repeatCount || 0))
        .slice(0, 200);
    }
  } else if (pastBankFilterValue === 'SUPER_HOT_5') {
    filtered = allPool
      .filter(q => q.isSuperHot || (q.repeatCount && q.repeatCount >= 5))
      .sort((a, b) => (b.repeatCount || 0) - (a.repeatCount || 0))
      .slice(0, 120);
  } else if (pastBankTrack !== 'BCS') {
    const sectorArchives = getSectorArchiveList(pastBankTrack);
    if (pastBankFilterValue !== 'ALL' && pastBankMode === 'YEAR') {
      const foundArch = sectorArchives.find(a => a.code === pastBankFilterValue);
      if (foundArch && Array.isArray(foundArch.questionIds)) {
        filtered = foundArch.questionIds.map(id => byId.get(id)).filter(Boolean);
      } else {
        filtered = allPool.filter(q => q.examTrack === pastBankTrack);
      }
    } else if (pastBankMode === 'TOPIC' && pastBankFilterValue !== 'ALL') {
      filtered = [
        ...allPool.filter(q => q.examTrack === pastBankTrack && q.subjectCode === pastBankFilterValue),
        ...allPool.filter(q => q.examTrack !== pastBankTrack && q.subjectCode === pastBankFilterValue)
      ];
    } else {
      const seenIds = new Set();
      const combined = [];
      allPool.filter(q => q.examTrack === pastBankTrack).forEach(q => {
        if (!seenIds.has(q.id)) {
          seenIds.add(q.id);
          combined.push(q);
        }
      });
      sectorArchives.forEach(arch => {
        (arch.questionIds || []).forEach(id => {
          const q = byId.get(id);
          if (q && !seenIds.has(q.id)) {
            seenIds.add(q.id);
            combined.push(q);
          }
        });
      });
      filtered = combined.slice(0, 150);
    }
  } else {
    filtered = allPool.filter(q => !q.examTrack || q.examTrack === 'BCS');
    if (pastBankFilterValue !== 'ALL') {
      if (pastBankMode === 'YEAR') {
        filtered = filtered.filter(q =>
          (q.examTitle && q.examTitle.includes(pastBankFilterValue)) ||
          (q.bcsArchiveTitle && q.bcsArchiveTitle.includes(pastBankFilterValue)) ||
          (q.bcsExamNo && `${toBnDigits(q.bcsExamNo)}তম`.includes(pastBankFilterValue)) ||
          (q.previousExams && q.previousExams.some(pe => pe.includes(pastBankFilterValue)))
        );
      } else {
        filtered = filtered.filter(q => q.subjectCode === pastBankFilterValue);
      }
    }
  }

  if (filtered.length === 0) {
    feed.innerHTML = `
      <div class="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
        কোনো প্রশ্ন পাওয়া যায়নি। ফিল্টার পরিবর্তন করে আবার চেষ্টা করুন।
      </div>
    `;
    return;
  }

  // MODE 1 (DEFAULT): AUTHENTIC 2-COLUMN PRINTED BPSC / DPE / NTRCA / BANK / MINISTRY QUESTION BOOKLET + OMR SHEET
  if (pastBankDisplayMode === 'BOOKLET') {
    const sectorDefaults = {
      BCS: {
        orgHeaderBn: 'বাংলাদেশ সরকারি কর্ম কমিশন (BPSC)',
        omrTitleBn: 'বাংলাদেশ সরকারি কর্ম কমিশন',
        omrSubBn: 'BPSC OMR ANSWER SHEET • কালো বলপয়েন্ট বৃত্ত ভরাট',
        negRateNum: 0.50,
        durationMinBn: '১২০',
        codeLabelBn: 'বিষয় কোড: ১০০ (সাধারণ ও পেশাগত)',
        paperTitleBn: 'বিসিএস প্রিলিমিনারি বিগত সালের প্রশ্নব্যাংক ও আর্কাইভ সেট',
        setCodeBn: 'ক'
      },
      PRIMARY: {
        orgHeaderBn: 'প্রাথমিক শিক্ষা অধিদপ্তর (DPE)',
        omrTitleBn: 'প্রাথমিক শিক্ষা অধিদপ্তর (DPE)',
        omrSubBn: 'DPE OMR ANSWER SHEET • সরকারি প্রাথমিক শিক্ষক নিয়োগ',
        negRateNum: 0.25,
        durationMinBn: '৬০',
        codeLabelBn: 'পদ: সহকারী শিক্ষক (সরকারি প্রাথমিক বিদ্যালয়)',
        paperTitleBn: 'সরকারি প্রাথমিক বিদ্যালয় সহকারী শিক্ষক নিয়োগ প্রশ্নব্যাংক (পূর্ণাঙ্গ সেট)',
        setCodeBn: 'পদ্মা'
      },
      NTRCA: {
        orgHeaderBn: 'বেসরকারি শিক্ষক নিবন্ধন ও প্রত্যয়ন কর্তৃপক্ষ (NTRCA)',
        omrTitleBn: 'বেসরকারি শিক্ষক নিবন্ধন কর্তৃপক্ষ (NTRCA)',
        omrSubBn: 'NTRCA OMR ANSWER SHEET • স্কুল ও কলেজ পর্যায় (পাশ নম্বর ৪০%)',
        negRateNum: 0.25,
        durationMinBn: '৬০',
        codeLabelBn: 'পর্যায়: স্কুল / স্কুল-২ ও কলেজ পর্যায় (প্রিলিমিনারি টেস্ট)',
        paperTitleBn: 'বেসরকারি শিক্ষক নিবন্ধন ও প্রত্যয়ন পরীক্ষা প্রশ্নব্যাংক',
        setCodeBn: 'ক'
      },
      BANK: {
        orgHeaderBn: 'বাংলাদেশ ব্যাংক • ব্যাংকার্স সিলেকশন কমিটি সচিবালয় (BSCS)',
        omrTitleBn: 'ব্যাংকার্স সিলেকশন কমিটি (BSCS)',
        omrSubBn: 'BANK RECRUITMENT OMR SHEET • BB AD / Officer / SO',
        negRateNum: 0.25,
        durationMinBn: '৬০',
        codeLabelBn: 'পদ: সহকারী পরিচালক (AD) ও সমন্বিত ব্যাংক অফিসার (৯ম-১০ম গ্রেড)',
        paperTitleBn: 'বাংলাদেশ ব্যাংক ও সমন্বিত ব্যাংক নিয়োগ প্রশ্নব্যাংক',
        setCodeBn: 'A'
      },
      MINISTRY: {
        orgHeaderBn: 'খাদ্য অধিদপ্তর • সিজিএ • বাংলাদেশ রেলওয়ে • সমাজসেবা অধিদপ্তর',
        omrTitleBn: 'মন্ত্রণালয় ও অধিদপ্তর নিয়োগ পরীক্ষা',
        omrSubBn: 'GOVT RECRUITMENT OMR SHEET • ১১তম - ২০তম গ্রেড',
        negRateNum: 0.25,
        durationMinBn: '৬০',
        codeLabelBn: 'পদ: উপ-খাদ্য পরিদর্শক / অডিটর / ইউনিয়ন সমাজকর্মী / কার্যসহকারী',
        paperTitleBn: 'মন্ত্রণালয় ও অধিদপ্তর মেগা নিয়োগ প্রশ্নব্যাংক',
        setCodeBn: 'ক'
      },
      NON_CADRE: {
        orgHeaderBn: 'বাংলাদেশ সরকারি কর্ম কমিশন (BPSC নন-ক্যাডার ও দুদক)',
        omrTitleBn: 'বাংলাদেশ সরকারি কর্ম কমিশন (নন-ক্যাডার)',
        omrSubBn: 'BPSC NON-CADRE OMR SHEET • ৯ম ও ১০ম গ্রেড',
        negRateNum: 0.50,
        durationMinBn: '৬০',
        codeLabelBn: 'পদ: সিনিয়র স্টাফ নার্স / এটিইও (ATEO) / সাব-রেজিস্ট্রার / দুদক সহকারী পরিচালক',
        paperTitleBn: 'পিএসসি নন-ক্যাডার (৯ম-১০ম গ্রেড) ও দুদক প্রশ্নব্যাংক',
        setCodeBn: 'ক'
      }
    };

    const meta = { ...(sectorDefaults[pastBankTrack] || sectorDefaults.BCS) };

    if (pastBankTrack !== 'BCS' && pastBankFilterValue !== 'ALL' && pastBankMode === 'YEAR') {
      const sectorArchives = getSectorArchiveList(pastBankTrack);
      const foundArch = sectorArchives.find(a => a.code === pastBankFilterValue);
      if (foundArch) {
        meta.paperTitleBn = `${foundArch.title} (${foundArch.examDate})`;
        meta.setCodeBn = (foundArch.setNameBn || meta.setCodeBn).replace(/^সেট:\s*/, '');
        if (foundArch.authorityBn) meta.orgHeaderBn = foundArch.authorityBn;
        if (foundArch.postNameBn) meta.codeLabelBn = `পদ: ${foundArch.postNameBn}`;
        if (typeof foundArch.negativeMark === 'number') meta.negRateNum = foundArch.negativeMark;
        if (foundArch.durationMinutes) meta.durationMinBn = toBnDigits(foundArch.durationMinutes);
      }
    } else if (pastBankTrack === 'BCS' && pastBankFilterValue !== 'ALL' && pastBankMode === 'YEAR') {
      meta.paperTitleBn = `${pastBankFilterValue} বিসিএস প্রিলিমিনারি পরীক্ষা প্রশ্নপত্র`;
    }

    const orgHeaderBn = meta.orgHeaderBn;
    const omrTitleBn = meta.omrTitleBn;
    const omrSubBn = meta.omrSubBn;
    const negRateNum = meta.negRateNum;
    const negRateBn = toBnDigits(negRateNum.toFixed(2));
    const durationMinBn = meta.durationMinBn;
    const codeLabelBn = meta.codeLabelBn;
    const paperTitleBn = meta.paperTitleBn;
    const setCodeBn = meta.setCodeBn;

    const totalQBn = toBnDigits(filtered.length);
    const bnOpt = { A: 'ক', B: 'খ', C: 'গ', D: 'ঘ' };

    // Calculate live score inside Past Bank Booklet
    let pbCorrect = 0;
    let pbWrong = 0;
    let pbAttempted = 0;
    filtered.forEach(q => {
      const chosen = pastBankUserAnswers[q.id];
      if (chosen) {
        pbAttempted++;
        if (chosen === q.correctOption) pbCorrect++;
        else pbWrong++;
      }
    });
    const pbNet = Math.max(0, pbCorrect - pbWrong * negRateNum).toFixed(2);

    let lastSubject = null;
    const bookletItemsHtml = filtered.map((q, idx) => {
      const qNoBn = toBnDigits(idx + 1);
      const chosen = pastBankUserAnswers[q.id];
      let subjHeader = '';
      if (q.subjectNameBn && q.subjectNameBn !== lastSubject) {
        lastSubject = q.subjectNameBn;
        subjHeader = `<div class="bpsc-subj-header">বিষয়: ${q.subjectNameBn}</div>`;
      }

      const optsHtml = ['A', 'B', 'C', 'D'].map(optKey => {
        const isChecked = chosen === optKey;
        const isCorrect = q.correctOption === optKey;
        let optClass = 'bpsc-opt-btn';
        if (pastBankShowAnswers) {
          if (isCorrect) optClass += ' correct-ans';
          else if (isChecked && !isCorrect) optClass += ' wrong-ans';
        } else if (isChecked) {
          optClass += ' selected';
        }
        return `
          <div onclick="selectPastBankAnswer('${q.id}', '${optKey}')" class="${optClass}">
            <span class="font-bold">(${bnOpt[optKey]})</span>
            <span>${q.options[optKey]}</span>
          </div>
        `;
      }).join('');

      const expHtml = (pastBankShowAnswers || chosen)
        ? `
          <div class="bpsc-exp-box">
            <div class="flex flex-wrap items-center justify-between gap-1">
              <span><strong class="text-emerald-800">✓ সঠিক উত্তর: (${bnOpt[q.correctOption]}) ${q.options[q.correctOption]}</strong> ${q.examTitle ? `<span class="text-[11px] text-slate-600">[${q.examTitle}]</span>` : ''}</span>
              <button onclick="openVivaBridgeForSubject()" class="px-1.5 py-0.5 rounded bg-teal-900 text-amber-200 text-[10px] font-bold hover:bg-teal-800">📝 লিখিত ও ভাইভা টিপস →</button>
            </div>
            ${q.explanationBn ? `<div class="mt-0.5 text-slate-800">${q.explanationBn}</div>` : ''}
            ${q.shortcutFormula ? `<div class="mt-0.5 font-mono text-xs text-teal-900 font-bold">⚡ শর্টকাট: ${q.shortcutFormula}</div>` : ''}
            ${q.mnemonicBn ? `<div class="mt-0.5 text-xs text-amber-900 font-semibold">🎶 ছন্দ: ${q.mnemonicBn}</div>` : ''}
          </div>
        `
        : '';

      const repeatBadgeHtml = (q.crossExamRepeats && q.crossExamRepeats.length > 1)
        ? `<div class="text-[11px] font-semibold text-amber-900 bg-amber-100/90 border border-amber-400/70 rounded px-1.5 py-0.5 mb-1 leading-snug">
             🔥 <strong>${toBnDigits(q.repeatCount || q.crossExamRepeats.length)} বার এসেছে:</strong> ${q.crossExamRepeats.slice(0, 4).join(' • ')}${q.crossExamRepeats.length > 4 ? ` ও আরও ${toBnDigits(q.crossExamRepeats.length - 4)}টি পরীক্ষায়` : ''}
           </div>`
        : '';

      return `
        ${subjHeader}
        <div class="bpsc-q-item" id="pb_q_${q.id}">
          <div class="flex items-start justify-between gap-2 font-bold text-[#0b0f17] mb-1">
            <span>${qNoBn}. ${q.stemBn}</span>
            <button onclick="toggleBookmark('${q.id}')" title="বুকমার্ক" class="text-xs opacity-60 hover:opacity-100 shrink-0">${bookmarkedIds.has(q.id) ? '⭐' : '☆'}</button>
          </div>
          ${repeatBadgeHtml}
          <div class="grid grid-cols-2 gap-x-2 gap-y-0.5 pl-1">
            ${optsHtml}
          </div>
          ${expHtml}
        </div>
      `;
    }).join('');

    const omrRowsHtml = filtered.map((q, idx) => {
      const chosen = pastBankUserAnswers[q.id];
      const bubblesHtml = ['A', 'B', 'C', 'D'].map(optKey => {
        const isFilled = chosen === optKey;
        const isCorrect = pastBankShowAnswers && q.correctOption === optKey;
        let extraStyle = '';
        if (isCorrect && !isFilled) {
          extraStyle = 'border-color:#16a34a;background:#dcfce7;color:#065f46;';
        }
        return `
          <span onclick="selectPastBankAnswer('${q.id}', '${optKey}')" class="omr-circle ${isFilled ? 'filled' : ''}" style="${extraStyle}" title="প্রশ্ন ${idx + 1} - অপশন ${bnOpt[optKey]}">
            ${bnOpt[optKey]}
          </span>
        `;
      }).join('');

      return `
        <div class="flex items-center justify-between py-1 px-1.5 rounded border-b border-rose-200/80 hover:bg-rose-100/50 transition">
          <button onclick="document.getElementById('pb_q_${q.id}')?.scrollIntoView({behavior:'smooth',block:'center'})" class="text-xs font-bold text-rose-900 hover:underline w-8 text-left">
            ${toBnDigits(idx + 1)}.
          </button>
          <div class="flex items-center space-x-1">
            ${bubblesHtml}
          </div>
        </div>
      `;
    }).join('');

    feed.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- Left 8 cols: Authentic 2-Column Printed BPSC/DPE Question Paper -->
        <div class="lg:col-span-8">
          <div class="bpsc-paper-sheet">
            <div class="text-center border-b-2 border-slate-900 pb-3 mb-3">
              <div class="text-xs font-bold tracking-wider text-slate-700">গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</div>
              <h2 class="text-xl sm:text-2xl font-extrabold text-slate-950 mt-0.5">${orgHeaderBn}</h2>
              <h3 class="text-sm sm:text-base font-bold text-[#006a4e] mt-0.5">${paperTitleBn}</h3>

              <div class="flex flex-wrap items-center justify-between border-t border-slate-800 mt-2.5 pt-2 text-xs sm:text-sm font-bold text-slate-900">
                <span>${codeLabelBn}</span>
                <span class="border-2 border-slate-950 px-3 py-0.5 bg-white text-slate-950 font-extrabold shadow-sm">
                  সেট কোড : ${setCodeBn}
                </span>
                <span>মোট প্রশ্ন: ${totalQBn}টি | সময়: ${durationMinBn} মিনিট</span>
              </div>
            </div>

            <div class="bg-[#f5f1e3] border border-slate-700 px-3 py-2 mb-4 text-xs text-slate-900 leading-relaxed flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong>[নির্দেশনা:</strong> প্রশ্নের অপশনে বা ডান পাশের <strong>OMR উত্তরপত্রে</strong> ক্লিক করে অনুশীলন করুন। প্রতিটি সঠিক উত্তরের মান <strong>+১.০০</strong> এবং ভুল উত্তরের নেগেটিভ <strong>-${negRateBn}</strong>।<strong>]</strong>
              </span>
              <button onclick="togglePastBankAnswerKey()" class="px-2.5 py-1 rounded bg-[#006a4e] text-white font-bold text-xs shrink-0">
                ${pastBankShowAnswers ? '🙈 সব উত্তর লুকান' : '👁️ সব উত্তর ও ব্যাখ্যা দেখুন'}
              </button>
            </div>

            <div class="bpsc-two-col">
              ${bookletItemsHtml}
            </div>

            <div class="mt-6 pt-3 border-t-2 border-slate-900 text-center text-xs font-bold text-slate-700">
              — সমাপ্ত — (বিগত সালের আসল প্রশ্নপত্র ফরম্যাট • মোট প্রশ্ন: ${totalQBn}টি)
            </div>
          </div>
        </div>

        <!-- Right 4 cols: Real Pink/Red BPSC/DPE OMR Answer Sheet -->
        <div class="lg:col-span-4 sticky top-28">
          <div class="bpsc-omr-sheet">
            <div class="bg-[#d94662] text-white px-4 py-2.5 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-bold tracking-wide">${omrTitleBn}</h3>
                <p class="text-[10px] opacity-90 font-mono">${omrSubBn}</p>
              </div>
              <span class="px-2.5 py-1 rounded-full bg-slate-950 text-amber-300 font-mono text-xs font-bold">
                ${toBnDigits(pbAttempted)}/${totalQBn}
              </span>
            </div>

            <div class="p-3 bg-[#fff0f3] border-b border-rose-200 flex items-center justify-between text-xs text-slate-800">
              <div>
                <span class="text-[10px] font-bold text-rose-800 block">তাৎক্ষণিক ফলাফল (LIVE SCORE):</span>
                <div class="font-bold text-slate-900 mt-0.5">
                  সঠিক: <span class="text-emerald-700">${toBnDigits(pbCorrect)}</span> |
                  ভুল: <span class="text-rose-700">${toBnDigits(pbWrong)}</span> |
                  নিট: <span class="px-1.5 py-0.5 rounded bg-emerald-700 text-white">${toBnDigits(pbNet)}</span>
                </div>
              </div>
              <button onclick="clearPastBankAnswers()" class="px-2 py-1 rounded border border-rose-400 bg-white hover:bg-rose-50 text-rose-800 font-bold text-[11px]">
                রিসেট
              </button>
            </div>

            <div class="p-3 grid grid-cols-2 gap-x-4 gap-y-1.5 max-h-[60vh] overflow-y-auto bg-[#fff9fa]">
              ${omrRowsHtml}
            </div>

            <div class="px-3 py-2 bg-[#fff0f3] border-t border-rose-200 flex items-center justify-between text-[11px] text-rose-900 font-semibold">
              <span>● সঠিক = +১.০০ | ভুল = -${negRateBn}</span>
              <button onclick="togglePastBankAnswerKey()" class="px-3 py-1 rounded bg-[#006a4e] text-white font-bold hover:bg-[#004d38] transition">
                ${pastBankShowAnswers ? 'উত্তর লুকান' : 'উত্তর মিলিয়ে দেখুন →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // MODE 2: CARD VIEW
  feed.innerHTML = filtered.map((q, idx) => {
    const isBookmarked = bookmarkedIds.has(q.id);
    return `
      <div class="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 text-xs">
          <div class="flex items-center space-x-2">
            <span class="px-2.5 py-0.5 rounded bg-slate-50 text-slate-700 font-semibold border border-slate-200">
              ${q.examTitle} (${q.examYear})
            </span>
            <span class="px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
              ${q.subjectNameBn} &bull; ${q.topicNameBn || ''}
            </span>
            ${q.isNctbStandard ? '<span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">NCTB রেফারেন্স</span>' : ''}
          </div>

          <div class="flex items-center space-x-2">
            <button onclick="toggleBookmark('${q.id}')" class="px-2 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-amber-800 text-xs flex items-center">
              <span>${isBookmarked ? '⭐ সেভ করা আছে' : '☆ সেভ করুন'}</span>
            </button>
            <button onclick="openReportModal('${q.id}')" class="px-2 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-rose-700 text-xs">
              🚩 রিপোর্ট
            </button>
          </div>
        </div>

        <h4 class="text-base font-semibold text-slate-900">${q.stemBn}</h4>

        <!-- Options Grid with Correct Highlighted -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-sans">
          ${['A', 'B', 'C', 'D'].map(opt => {
            const isCorrect = q.correctOption === opt;
            const bnLabel = { A: 'ক', B: 'খ', C: 'গ', D: 'ঘ' }[opt];
            return `
              <div class="p-2.5 rounded-xl border flex items-center ${
                isCorrect
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-semibold'
                  : 'bg-white border-slate-200 text-slate-700'
              }">
                <span class="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] mr-2.5 ${
                  isCorrect ? 'bg-emerald-500 text-slate-950' : 'bg-white text-slate-500'
                }">${bnLabel}</span>
                <span>${q.options[opt]}</span>
                ${isCorrect ? '<span class="ml-auto text-emerald-700 text-xs font-bold font-mono">✓ সঠিক</span>' : ''}
              </div>
            `;
          }).join('')}
        </div>

        <!-- Accordion: Feynman AI Explanation & Bengali Mnemonic -->
        <div class="space-y-2 pt-2">
          <!-- Mnemonic Box -->
          <div class="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-xs">
            <strong class="text-emerald-700 block mb-1">🎶 মনে রাখার বাংলা ছন্দ ও শর্টকাট:</strong>
            <p class="text-emerald-700 italic">${q.mnemonicBn || 'নিয়মিত মডেল টেস্টের মাধ্যমে আয়ত্তে রাখুন।'}</p>
          </div>

          <!-- Feynman AI Simplifier Toggle -->
          <div class="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1">
            <div class="flex items-center justify-between text-emerald-700 font-semibold cursor-pointer" onclick="toggleFeynman('${q.id}')">
              <span>💡 সহজ ভাষায় এআই দিয়ে বুঝুন (Feynman Technique):</span>
              <span id="feynman_icon_${q.id}" class="text-xs font-mono">▼ পড়ুন</span>
            </div>
            <div id="feynman_box_${q.id}" class="hidden pt-2 text-slate-700 text-xs leading-relaxed border-t border-slate-200">
              <p class="mb-2 italic text-emerald-700">${q.feynmanExplanation || q.explanationBn}</p>
              ${q.shortcutFormula ? `<div class="p-2 rounded bg-slate-50 border border-emerald-200 font-mono text-emerald-700 text-[11px]">সূত্র: ${q.shortcutFormula}</div>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function toggleFeynman(qId) {
  const box = document.getElementById(`feynman_box_${qId}`);
  const icon = document.getElementById(`feynman_icon_${qId}`);
  if (!box) return;
  box.classList.toggle('hidden');
  icon.textContent = box.classList.contains('hidden') ? '▼ পড়ুন' : '▲ বন্ধ';
}

// -----------------------------------------------------------------------------
// 3. CUSTOM QUIZ CREATOR (কাস্টম কুইজ ক্রিয়েটর)
// -----------------------------------------------------------------------------
function startCustomQuiz() {
  const subject = document.getElementById('customQuizSubject').value;
  const count = parseInt(document.getElementById('customQuizCount').value, 10);
  const duration = parseInt(document.getElementById('customQuizTime').value, 10);
  const negRadio = document.querySelector('input[name="customNegRate"]:checked');
  const negRate = negRadio ? parseFloat(negRadio.value) : 0.50;

  // Filter pool
  let pool = questions;
  if (subject !== 'ALL') {
    pool = pool.filter(q => q.subjectCode === subject);
  }

  // Slice questions
  const customSet = pool.slice(0, Math.min(count, pool.length));
  if (customSet.length === 0) {
    alert('এই বিষয়ে পর্যাপ্ত প্রশ্ন পাওয়া যায়নি।');
    return;
  }

  // Load into main exam state
  questions = customSet;
  userAnswers = {};
  remainingSeconds = duration * 60;
  totalExamSeconds = remainingSeconds;

  document.getElementById('modalExamSubtitle').textContent = `কাস্টম কুইজ (${count} প্রশ্ন • ${duration} মিনিট • নেগেটিভ -${negRate})`;

  switchTab('exam');
  renderExamQuestions();
  renderQuestionPalette();
  updateLiveSafetyMeter();
  startTimer();
}

// -----------------------------------------------------------------------------
// 4. 1-VS-1 GAMIFIED QUIZ BATTLE (কুইজ ব্যাটল)
// -----------------------------------------------------------------------------
function startBattleRound() {
  document.getElementById('battleLobby').classList.add('hidden');
  document.getElementById('battleArena').classList.remove('hidden');

  battleQuestions = questions.slice(0, 5);
  battleCurrentIdx = 0;
  battleUserScore = 0;
  battleOppScore = 0;
  battleRemainingSeconds = 90;

  document.getElementById('battleMyScore').textContent = 'আপনার স্কোর: 0';
  document.getElementById('battleOppScore').textContent = 'প্রতিপক্ষ স্কোর: 0';

  if (battleTimerInterval) clearInterval(battleTimerInterval);
  battleTimerInterval = setInterval(() => {
    battleRemainingSeconds--;
    const mins = Math.floor(battleRemainingSeconds / 60);
    const secs = battleRemainingSeconds % 60;
    document.getElementById('battleTimer').textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    // Opponent AI simulation (random increments)
    if (Math.random() > 0.65 && battleOppScore < 5) {
      battleOppScore += 1;
      document.getElementById('battleOppScore').textContent = `প্রতিপক্ষ স্কোর: ${battleOppScore}`;
    }

    if (battleRemainingSeconds <= 0 || battleCurrentIdx >= battleQuestions.length) {
      endBattle();
    }
  }, 1000);

  renderBattleQuestion();
}

function renderBattleQuestion() {
  const box = document.getElementById('battleQuestionBox');
  if (battleCurrentIdx >= battleQuestions.length) {
    endBattle();
    return;
  }

  const q = battleQuestions[battleCurrentIdx];
  box.innerHTML = `
    <div class="flex justify-between text-xs text-slate-500 font-mono">
      <span>রাউন্ড ${battleCurrentIdx + 1}/৫</span>
      <span>${q.subjectNameBn}</span>
    </div>
    <h4 class="text-sm font-bold text-slate-900">${q.stemBn}</h4>
    <div class="grid grid-cols-2 gap-2 pt-2">
      ${['A', 'B', 'C', 'D'].map(opt => `
        <button onclick="answerBattleQuestion('${opt}')" class="p-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-left transition">
          ${q.options[opt]}
        </button>
      `).join('')}
    </div>
  `;
}

function answerBattleQuestion(chosenOpt) {
  const q = battleQuestions[battleCurrentIdx];
  if (chosenOpt === q.correctOption) {
    battleUserScore += 1;
    document.getElementById('battleMyScore').textContent = `আপনার স্কোর: ${battleUserScore}`;
  }
  battleCurrentIdx++;
  renderBattleQuestion();
}

function endBattle() {
  if (battleTimerInterval) clearInterval(battleTimerInterval);
  const isWin = battleUserScore >= battleOppScore;
  const box = document.getElementById('battleQuestionBox');

  box.innerHTML = `
    <div class="text-center py-6 space-y-3">
      <span class="text-4xl">${isWin ? '🏆' : '🤝'}</span>
      <h3 class="text-lg font-bold text-slate-900">${isWin ? 'অভিনন্দন! আপনি জয়ী হয়েছেন!' : 'ম্যাচ সমাপ্ত হয়েছে! দারুণ লড়াই!'}</h3>
      <p class="text-xs text-slate-700">
        আপনার স্কোর: <strong>${battleUserScore}</strong> | প্রতিপক্ষের স্কোর: <strong>${battleOppScore}</strong>
      </p>
      <button onclick="resetBattle()" class="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs">
        আরেকটি ব্যাটল খেলুন ⚔️
      </button>
    </div>
  `;
}

function resetBattle() {
  document.getElementById('battleLobby').classList.remove('hidden');
  document.getElementById('battleArena').classList.add('hidden');
}

// -----------------------------------------------------------------------------
// 5. PRIMARY ASSISTANT TEACHER 100-MARK CALCULATOR
// -----------------------------------------------------------------------------
function calculatePrimaryMerit() {
  const written = parseFloat(document.getElementById('calcWrittenScore').value) || 0;
  const viva = parseFloat(document.getElementById('calcVivaScore').value) || 0;
  const ssc = parseFloat(document.getElementById('calcSscScore').value) || 0;
  const hsc = parseFloat(document.getElementById('calcHscScore').value) || 0;

  const total = Number((written + viva + ssc + hsc).toFixed(2));
  document.getElementById('calcTotalScore').textContent = total.toFixed(2);

  const badge = document.getElementById('calcSafeZoneBadge');
  const advice = document.getElementById('calcAdviceText');

  if (total >= 78) {
    badge.className = 'inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200';
    badge.textContent = '🟢 অত্যন্ত নিরাপদ স্কোর (চাকরি পাওয়ার সর্বোচ্চ সম্ভাবনা)';
    advice.textContent = `আপনার মোট স্কোর ${total}। বিগত নিয়োগগুলোর পরিসংখ্যান অনুযায়ী ৭৮+ স্কোর যেকোনো জেলায় চূড়ান্ত সুপারিশের জন্য নির্ভরযোগ্য।`;
  } else if (total >= 68) {
    badge.className = 'inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200';
    badge.textContent = '🟡 মাঝারি প্রতিদ্বন্দ্বিতাপূর্ণ স্কোর (কম্পিটিটিভ জোন)';
    advice.textContent = `আপনার মোট স্কোর ${total}। লিখিত পরীক্ষায় আরও ৪-৫ নম্বর বাড়ানো গেলে চাকরি নিশ্চিতের সম্ভাবনা অনেক বৃদ্ধি পাবে।`;
  } else {
    badge.className = 'inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200';
    badge.textContent = '🔴 ঝুঁকিপূর্ণ স্কোর (লিখিত পরীক্ষায় আরও বেশি জোর দেওয়া প্রয়োজন)';
    advice.textContent = `আপনার মোট স্কোর ${total}। প্রাইমারি পরীক্ষায় কাট-মার্ক সাধারণত ৬৫-৭০ এর কাছাকাছি থাকে, তাই মক টেস্টে ভুল কমিয়ে স্কোর বাড়ান।`;
  }
}

// -----------------------------------------------------------------------------
// 6. BOOKMARKS & QUESTIONS SAVED FOR NIGHT REVISION
// -----------------------------------------------------------------------------
function toggleBookmark(questionId) {
  if (bookmarkedIds.has(questionId)) {
    bookmarkedIds.delete(questionId);
  } else {
    bookmarkedIds.add(questionId);
  }
  updateBookmarkBadges();
  renderExamQuestions();
  renderPastBank();
  renderBookmarks();
}

function updateBookmarkBadges() {
  const count = bookmarkedIds.size;
  const el = document.getElementById('headerBookmarkCount');
  if (el) el.textContent = count;
}

function renderBookmarks() {
  const feed = document.getElementById('bookmarkItemsFeed');
  if (!feed) return;

  const saved = questions.filter(q => bookmarkedIds.has(q.id));
  if (saved.length === 0) {
    feed.innerHTML = `
      <div class="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 space-y-2">
        <span class="text-3xl">⭐</span>
        <h3 class="text-base font-bold text-slate-800">এখনো কোনো প্রশ্ন বুকমার্ক করা হয়নি!</h3>
        <p class="text-xs">যেসব প্রশ্ন কঠিন লাগে বা বারবার ভুল হয়, সেগুলো স্টার চিহ্নে ক্লিক করে এখানে সংরক্ষণ করুন।</p>
      </div>
    `;
    return;
  }

  feed.innerHTML = saved.map(q => `
    <div class="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
      <div class="flex justify-between items-center text-xs border-b border-slate-200 pb-2">
        <span class="text-amber-700 font-semibold font-mono">⭐ সেভ করা প্রশ্ন &bull; ${q.subjectNameBn}</span>
        <button onclick="toggleBookmark('${q.id}')" class="text-rose-700 hover:text-rose-700">রিমুভ করুন ✕</button>
      </div>
      <h4 class="text-base font-semibold text-slate-900">${q.stemBn}</h4>
      <div class="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-xs">
        <span class="text-emerald-700 font-bold block mb-1">✓ সঠিক উত্তর: ${q.correctOption} (${q.options[q.correctOption]})</span>
        <p class="text-emerald-700 italic">${q.mnemonicBn || ''}</p>
      </div>
    </div>
  `).join('');
}

// -----------------------------------------------------------------------------
// 7. REPORT QUESTION MODAL (পিএসসি মতভেদ ও ভুল প্রশ্ন রিপোর্টার)
// -----------------------------------------------------------------------------
function openReportModal(questionId) {
  const q = questions.find(item => item.id === questionId);
  if (!q) return;

  activeReportingQuestion = q;
  document.getElementById('reportQuestionStem').textContent = `প্রশ্ন: ${q.stemBn}`;
  document.getElementById('reportCommentInput').value = '';
  document.getElementById('reportModal').classList.remove('hidden');
}

function closeReportModal() {
  document.getElementById('reportModal').classList.add('hidden');
  activeReportingQuestion = null;
}

function submitQuestionReport() {
  const reason = document.getElementById('reportReasonSelect').value;
  const comment = document.getElementById('reportCommentInput').value;

  alert('ধন্যবাদ! আপনার রিপোর্টটি সফলভাবে গ্রহণ করা হয়েছে। প্রশ্ন প্রণেতা টিম এটি যাচাই করে আপডেট করবে।');
  closeReportModal();
}

// -----------------------------------------------------------------------------
// 8. SMART WEAKNESS TRACKER & ANALYTICS
// -----------------------------------------------------------------------------
function updateAnalyticsDashboard(lostPenalty = 3.50, correct = 12, wrong = 7) {
  const penaltyEl = document.getElementById('statNegativeLost');
  if (penaltyEl) penaltyEl.textContent = lostPenalty.toFixed(2);

  const container = document.getElementById('subjectAnalyticsBars');
  if (!container) return;

  const subjects = [
    { name: 'বাংলা ভাষা ও সাহিত্য', accuracy: 85, status: 'সবল' },
    { name: 'বাংলাদেশ বিষয়াবলী', accuracy: 80, status: 'সন্তোষজনক' },
    { name: 'English Language', accuracy: 65, status: 'মধ্যম' },
    { name: 'গাণিতিক যুক্তি ও মানসিক দক্ষতা', accuracy: 45, status: 'দুর্বল (মনোযোগ দিন)' },
    { name: 'সাধারণ বিজ্ঞান ও আইসিটি', accuracy: 75, status: 'সন্তোষজনক' },
    { name: 'আন্তর্জাতিক বিষয়াবলী', accuracy: 70, status: 'সন্তোষজনক' }
  ];

  container.innerHTML = subjects.map(s => `
    <div class="space-y-1">
      <div class="flex justify-between items-center text-slate-700">
        <span>${s.name}</span>
        <span class="font-mono font-bold ${s.accuracy < 50 ? 'text-rose-400' : 'text-emerald-400'}">${s.accuracy}% (${s.status})</span>
      </div>
      <div class="w-full bg-white rounded-full h-2.5 overflow-hidden">
        <div class="h-2.5 rounded-full ${s.accuracy < 50 ? 'bg-rose-500' : s.accuracy < 70 ? 'bg-amber-500' : 'bg-emerald-500'}" style="width: ${s.accuracy}%"></div>
      </div>
    </div>
  `).join('');
}

// -----------------------------------------------------------------------------
// 9. SCIENCE-BACKED MISTAKE VAULT (ভুল খাতা / Cuotiben)
// -----------------------------------------------------------------------------
function filterMistakes(tag) {
  activeMistakeFilter = tag;
  document.querySelectorAll('#mistakeFilterPills .filter-pill').forEach(btn => {
    btn.classList.remove('active', 'bg-rose-600', 'text-white');
    btn.classList.add('bg-slate-800', 'text-slate-300');
  });
  event.target.classList.add('active', 'bg-rose-600', 'text-white');
  event.target.classList.remove('bg-slate-800', 'text-slate-300');
  renderMistakeVault();
}

function renderMistakeVault() {
  const feed = document.getElementById('mistakeItemsFeed');
  if (!feed) return;

  let items = userMistakes;
  if (activeMistakeFilter !== 'ALL') {
    items = items.filter(i => i.tag === activeMistakeFilter);
  }

  if (items.length === 0) {
    feed.innerHTML = `
      <div class="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
        <span class="text-4xl">🎉</span>
        <h3 class="text-lg font-bold text-slate-800">এই ক্যাটাগরিতে কোনো ভুল জমা নেই!</h3>
        <p class="text-xs text-slate-500">মডেল টেস্ট সম্পন্ন করুন বা ওএমআর স্ক্যান করুন; ভুলগুলো স্বয়ংক্রিয়ভাবে এখানে তালিকাভুক্ত হবে।</p>
      </div>
    `;
    return;
  }

  feed.innerHTML = items.map(m => {
    const q = m.question;
    return `
      <div class="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div class="flex items-center space-x-2">
            <span class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              ভুল সংখ্যা: ${m.errorCount} বার
            </span>
            <span class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white text-slate-700 border border-slate-200">
              উৎস: ${m.sourceExamTitle}
            </span>
          </div>

          <div class="flex items-center space-x-2 text-xs">
            <span class="text-slate-500">ট্যাগ:</span>
            <select onchange="updateMistakeTag('${m.id}', this.value)" class="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-rose-700 focus:outline-none focus:border-rose-500">
              <option value="SILLY_MISTAKE" ${m.tag === 'SILLY_MISTAKE' ? 'selected' : ''}>সিলি মিস্টেক</option>
              <option value="CONCEPT_GAP" ${m.tag === 'CONCEPT_GAP' ? 'selected' : ''}>কনসেপ্ট গ্যাপ</option>
              <option value="TIME_PRESSURE" ${m.tag === 'TIME_PRESSURE' ? 'selected' : ''}>সময়ের স্বল্পতা</option>
              <option value="UNREAD_STEM" ${m.tag === 'UNREAD_STEM' ? 'selected' : ''}>প্রশ্ন না খেয়াল করা</option>
            </select>
          </div>
        </div>

        <h4 class="text-base font-semibold text-slate-900">${q.stemBn}</h4>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
          <div class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
            <span class="block text-rose-700 font-bold mb-1">❌ আপনার ভুল উত্তর:</span>
            <span>${m.selectedOption} - ${q.options[m.selectedOption] || 'অজানা'}</span>
          </div>
          <div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
            <span class="block text-emerald-700 font-bold mb-1">✓ সঠিক উত্তর:</span>
            <span>${m.correctOption} - ${q.options[m.correctOption]}</span>
          </div>
        </div>

        <div class="bg-white rounded-xl p-4 border border-slate-200 space-y-2 text-xs">
          <div class="text-emerald-700 font-semibold flex items-center">
            <span>🎶 মনে রাখার বাংলা ছন্দ ও টেকনিক:</span>
          </div>
          <p class="text-emerald-700 italic font-sans text-sm">${q.mnemonicBn || 'নিয়মিত রিভিশন করুন।'}</p>
          <div class="pt-2 text-slate-500 border-t border-slate-200 font-sans">
            <strong class="text-slate-700">ফাইনম্যান সহজ ব্যাখ্যা: </strong>${q.feynmanExplanation || q.explanationBn}
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
          <span class="text-xs font-mono text-slate-500">সুপারমেমো রিকল রেটিং দিন (SM-2):</span>
          <div class="flex space-x-2">
            <button onclick="retestMistake('${m.id}', 1)" class="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              ভুলে গেছি (q: 1)
            </button>
            <button onclick="retestMistake('${m.id}', 3)" class="px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              মনে পড়েছে (q: 3)
            </button>
            <button onclick="retestMistake('${m.id}', 5)" class="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
              আয়ত্তে এসেছে (q: 5)
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function updateMistakeTag(mistakeId, newTag) {
  const item = userMistakes.find(m => m.id === mistakeId);
  if (item) item.tag = newTag;
  renderMistakeVault();
}

function retestMistake(mistakeId, quality) {
  const item = userMistakes.find(m => m.id === mistakeId);
  if (!item) return;

  const q = Number(quality);
  if (q >= 4) {
    item.status = 'MASTERED';
    item.intervalDays = 6;
  } else if (q >= 3) {
    item.status = 'IN_REVIEW';
    item.intervalDays = 2;
  } else {
    item.status = 'OPEN';
    item.intervalDays = 1;
  }
  renderMistakeVault();
}

// -----------------------------------------------------------------------------
// 10. ACTIVE RECALL & SM-2 FLASHCARDS
// -----------------------------------------------------------------------------
function initFlashcardDeck() {
  if (questions.length === 0) return;
  displayCurrentCard();
}

function toggleCardFlip(cardElement) {
  cardElement.classList.toggle('flipped');
}

function displayCurrentCard() {
  const q = questions[currentFlashcardIndex];
  if (!q) return;

  const card = document.getElementById('mainFlashCard');
  if (card) card.classList.remove('flipped');

  document.getElementById('cardIndexDisplay').textContent = `${currentFlashcardIndex + 1}/${questions.length}`;
  document.getElementById('cardSubjectBadge').textContent = q.subjectNameBn;
  document.getElementById('cardStemFront').textContent = q.stemBn;
  document.getElementById('cardCorrectOption').textContent = `${q.correctOption} (${{ A: 'ক', B: 'খ', C: 'গ', D: 'ঘ' }[q.correctOption]})`;
  document.getElementById('cardMnemonicBack').textContent = q.mnemonicBn || 'নিয়মিত মডেল টেস্টের মাধ্যমে প্রস্তুতি নিশ্চিত করুন।';
  document.getElementById('cardExplanationBack').textContent = q.feynmanExplanation || q.explanationBn;

  const shortcutBox = document.getElementById('cardShortcutBox');
  const shortcutText = document.getElementById('cardShortcutBack');
  if (q.shortcutFormula) {
    shortcutBox.classList.remove('hidden');
    shortcutText.textContent = q.shortcutFormula;
  } else {
    shortcutBox.classList.add('hidden');
  }
}

function rateRecallQuality(quality) {
  const efEl = document.getElementById('cardEfDisplay');
  const repEl = document.getElementById('cardRepDisplay');

  let ef = parseFloat(efEl.textContent) || 2.5;
  const delta = 5 - quality;
  ef = ef + (0.1 - delta * (0.08 + delta * 0.02));
  ef = Math.max(1.3, Number(ef.toFixed(2)));
  efEl.textContent = ef.toFixed(2);

  let rep = parseInt(repEl.textContent) || 0;
  rep = quality >= 3 ? rep + 1 : 0;
  repEl.textContent = rep;

  currentFlashcardIndex = (currentFlashcardIndex + 1) % questions.length;
  displayCurrentCard();
}

// -----------------------------------------------------------------------------
// 11. ANSWER SHEET (OMR) PHOTO SCANNER
// Reads a real photo of the printed sheet from /omr-printable in the browser:
// finds the 4 black corner squares, maps the sheet geometry onto the photo and
// measures how dark each bubble is. Nothing is scored without a real image.
// -----------------------------------------------------------------------------

// Sheet geometry in mm. Must stay in sync with OMR_SHEET in omr-sheet.html.
const OMR_LAYOUT = {
  width: 198, height: 284,
  markers: [[8, 8], [190, 8], [190, 276], [8, 276]], // centers: TL, TR, BR, BL
  markerSize: 10,
  rowY0: 74, rowPitch: 3.9, rowsPerCol: 50,
  colX0: [16, 58, 100, 142],
  optDx: [12.5, 18.8, 25.1, 31.4],
  bubbleR: 1.75
};
const OMR_OPTS = ['A', 'B', 'C', 'D'];
const OMR_OPTS_BN = { A: 'ক', B: 'খ', C: 'গ', D: 'ঘ' };
const OMR_FILL_MIN = 0.35;

let omrSelectedFile = null;
let omrLastResult = null;

function omrBubbleCenterMm(qNo, optIdx) {
  const col = Math.floor((qNo - 1) / OMR_LAYOUT.rowsPerCol);
  const row = (qNo - 1) % OMR_LAYOUT.rowsPerCol;
  return [OMR_LAYOUT.colX0[col] + OMR_LAYOUT.optDx[optIdx], OMR_LAYOUT.rowY0 + row * OMR_LAYOUT.rowPitch];
}

function initVirtualOmr() {
  omrScanFillExams();
  const zone = document.getElementById('omrDropZone');
  if (zone && !zone.dataset.bound) {
    zone.dataset.bound = '1';
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('border-emerald-500'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('border-emerald-500'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('border-emerald-500');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) omrSetFile(f);
    });
  }
}

// Same exam list and question order as the printable booklet (/omr-printable)
function omrScanFillExams() {
  const track = (document.getElementById('omrScanTrack') || {}).value || 'BCS';
  const sel = document.getElementById('omrScanExam');
  if (!sel) return;
  const exams = window.availableExams || [];
  const groups = track === 'PRIMARY'
    ? [['প্রাথমিক মডেল সেট', exams.filter(e => e.examTrack === 'PRIMARY' && e.id.startsWith('PRI_PRACTICE_'))],
       ['বিগত সালের প্রাথমিক প্রশ্ন', exams.filter(e => e.examTrack === 'PRIMARY' && !e.id.startsWith('PRI_PRACTICE_'))]]
    : [['বিসিএস অনুশীলন সেট', exams.filter(e => e.examTrack === 'BCS' && e.id.startsWith('PRACTICE_SET_'))],
       ['বিগত বিসিএস প্রশ্ন', exams.filter(e => e.examTrack === 'BCS' && e.id.startsWith('BCS_'))]];
  sel.innerHTML = groups.map(([label, list]) =>
    `<optgroup label="${label}">${list.map(e => `<option value="${e.id}">${e.title}</option>`).join('')}</optgroup>`
  ).join('');
}

function omrScanExamQuestions(track, examId) {
  const pool = window.sampleQuestions || [];
  const byId = new Map(pool.map(q => [q.id, q]));
  let list = [];
  if (track === 'PRIMARY') {
    if (examId.startsWith('PRI_PRACTICE_')) {
      const found = (window.primaryPracticeSets || []).find(p => p.id === examId);
      list = found ? (found.questionIds || []).map(id => byId.get(id)).filter(Boolean) : [];
    } else {
      const arch = (window.primaryExamsArchive || []).find(a => a.code === examId.replace(/_SET$/, ''));
      list = arch ? (arch.questionIds || []).map(id => byId.get(id)).filter(Boolean) : [];
    }
  } else if (examId.startsWith('PRACTICE_SET_')) {
    const setNum = parseInt(examId.replace('PRACTICE_SET_', ''), 10) || 1;
    list = pool.filter(q => q.setNo === setNum);
  } else {
    const m = examId.match(/BCS_(\d+)/);
    list = m ? pool.filter(q => q.bcsExamNo === parseInt(m[1], 10)) : pool.slice(0, 200);
  }
  return list.slice(0, OMR_LAYOUT.colX0.length * OMR_LAYOUT.rowsPerCol);
}

function omrOnFileChosen(input) {
  const f = input.files && input.files[0];
  if (f) omrSetFile(f);
  input.value = '';
}

function omrSetFile(file) {
  omrShowError('');
  if (!file.type || !file.type.startsWith('image/')) {
    omrSelectedFile = null;
    omrShowError('এটি ছবি ফাইল নয়। উত্তরপত্রের একটি ছবি (JPG বা PNG) দিন।');
    return;
  }
  omrSelectedFile = file;
  const prev = document.getElementById('omrFilePreview');
  if (prev) {
    if (prev.dataset.url) URL.revokeObjectURL(prev.dataset.url);
    prev.dataset.url = URL.createObjectURL(file);
    prev.src = prev.dataset.url;
  }
  document.getElementById('omrFileName').textContent = `বাছাই করা ছবি: ${file.name}`;
  document.getElementById('omrNoFileHint').classList.add('hidden');
  document.getElementById('omrFilePreviewWrap').classList.remove('hidden');
}

function omrShowError(msg) {
  const box = document.getElementById('omrScanError');
  if (!box) return;
  box.innerHTML = msg;
  box.classList.toggle('hidden', !msg);
}

function omrResetResult() {
  omrLastResult = null;
  document.getElementById('omrResultsSummary').classList.add('hidden');
  document.getElementById('omrOverlayCanvas').classList.add('hidden');
  document.getElementById('omrAnswerListCard').classList.add('hidden');
  document.getElementById('omrScanPlaceholder').classList.remove('hidden');
}

async function omrScanSubmit() {
  omrShowError('');
  if (!omrSelectedFile) {
    omrResetResult();
    omrShowError('আগে উত্তরপত্রের ছবি দিন। ছবি ছাড়া ফলাফল দেখানো সম্ভব নয়। উপরের "ক্যামেরায় ছবি তুলুন" বা "গ্যালারি থেকে বেছে নিন" বাটন চাপুন।');
    return;
  }
  const track = document.getElementById('omrScanTrack').value;
  const examId = document.getElementById('omrScanExam').value;
  if (window.Account && !Account.allow(examId)) return;
  const examQs = omrScanExamQuestions(track, examId || '');
  if (!examQs.length) {
    omrShowError('এই প্রশ্নপত্রের উত্তরমালা পাওয়া যায়নি। অন্য একটি প্রশ্নপত্র বেছে নিন।');
    return;
  }

  const btn = document.getElementById('omrScanBtn');
  const oldLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'ছবি পড়া হচ্ছে...';
  try {
    const img = await omrLoadImage(omrSelectedFile);
    const scan = omrReadSheet(img, examQs.length);
    if (scan.error) {
      omrResetResult();
      omrShowError(scan.error);
      return;
    }
    const exam = (window.availableExams || []).find(e => e.id === examId) || {};
    const negRate = typeof exam.negativeMark === 'number' ? exam.negativeMark : (track === 'PRIMARY' ? 0.25 : 0.5);
    omrShowResult(img, scan, examQs, negRate, exam.title || '');
  } catch (err) {
    console.error(err);
    omrResetResult();
    omrShowError('ছবিটি খোলা যায়নি। অন্য একটি ছবি (JPG বা PNG) দিয়ে আবার চেষ্টা করুন।');
  } finally {
    btn.disabled = false;
    btn.textContent = oldLabel;
  }
}

function omrLoadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Core reader: returns { answers: [{fills, chosen}], H, scale } or { error }
function omrReadSheet(img, totalQuestions) {
  const MAX = 1800;
  const k = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const rgba = ctx.getImageData(0, 0, w, h).data;

  const gray = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < gray.length; i++, j += 4) {
    gray[i] = (rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000;
  }

  // Bradley adaptive threshold (handles shadows and uneven phone lighting)
  const integ = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += gray[y * w + x];
      integ[(y + 1) * (w + 1) + x + 1] = integ[y * (w + 1) + x + 1] + rowSum;
    }
  }
  const half = Math.max(8, Math.round(Math.max(w, h) / 32));
  const dark = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - half), y1 = Math.min(h, y + half + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - half), x1 = Math.min(w, x + half + 1);
      const sum = integ[y1 * (w + 1) + x1] - integ[y0 * (w + 1) + x1] - integ[y1 * (w + 1) + x0] + integ[y0 * (w + 1) + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      dark[y * w + x] = gray[y * w + x] < mean * 0.75 ? 1 : 0;
    }
  }

  const markers = omrFindMarkers(dark, w, h);
  if (!markers) {
    return { error: 'ছবিতে উত্তরপত্রের চার কোণার চারটি কালো বর্গ খুঁজে পাওয়া যায়নি।<br>• এই অ্যাপ থেকে প্রিন্ট করা উত্তরপত্র ব্যবহার করুন।<br>• পুরো পাতা যেন ছবিতে আসে, কোনো কোণা কাটা না যায়।<br>• আলো ভালো জায়গায়, ছায়া ছাড়া, উপর থেকে সোজা করে ছবি তুলুন।' };
  }

  const H = omrHomography(OMR_LAYOUT.markers, markers);
  const project = (mx, my) => {
    const d = H[6] * mx + H[7] * my + 1;
    return [(H[0] * mx + H[1] * my + H[2]) / d, (H[3] * mx + H[4] * my + H[5]) / d];
  };

  const answers = [];
  for (let q = 1; q <= totalQuestions; q++) {
    const fills = OMR_OPTS.map((_, oi) => {
      const [mx, my] = omrBubbleCenterMm(q, oi);
      const [cx, cy] = project(mx, my);
      const [ex, ey] = project(mx + 1, my);
      const pxPerMm = Math.hypot(ex - cx, ey - cy);
      const r = OMR_LAYOUT.bubbleR * 0.6 * pxPerMm;
      let n = 0, on = 0;
      for (let yy = Math.floor(cy - r); yy <= Math.ceil(cy + r); yy++) {
        for (let xx = Math.floor(cx - r); xx <= Math.ceil(cx + r); xx++) {
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          if ((xx - cx) ** 2 + (yy - cy) ** 2 > r * r) continue;
          n++;
          on += dark[yy * w + xx];
        }
      }
      return n ? on / n : 0;
    });
    const order = fills.map((f, i) => [f, i]).sort((a, b) => b[0] - a[0]);
    let chosen = null;
    if (order[0][0] >= OMR_FILL_MIN) {
      chosen = order[1][0] >= OMR_FILL_MIN ? 'DOUBLE' : OMR_OPTS[order[0][1]];
    }
    answers.push({ fills, chosen });
  }

  // A badly aligned photo reads as mostly multi-filled rows: don't score it
  const doubles = answers.filter(a => a.chosen === 'DOUBLE').length;
  if (doubles > Math.max(5, totalQuestions * 0.3)) {
    return { error: 'ছবিটি ঠিকমতো পড়া যায়নি (অনেক প্রশ্নে একসাথে একাধিক বৃত্ত ভরাট মনে হচ্ছে)। উত্তরপত্র সমতল রেখে, উপর থেকে সোজা ও আলোতে আবার ছবি তুলুন।' };
  }
  return { answers, project, scaleK: k };
}

// Finds the 4 solid corner squares; returns their centers [TL, TR, BR, BL] in px or null
function omrFindMarkers(dark, w, h) {
  const labels = new Int32Array(w * h);
  const blobs = [];
  const stack = new Int32Array(w * h);
  let next = 1;
  for (let start = 0; start < dark.length; start++) {
    if (!dark[start] || labels[start]) continue;
    let sp = 0, area = 0, sx = 0, sy = 0;
    let minX = w, minY = h, maxX = 0, maxY = 0;
    stack[sp++] = start;
    labels[start] = next;
    while (sp) {
      const p = stack[--sp];
      const x = p % w, y = (p - x) / w;
      area++; sx += x; sy += y;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (x > 0 && dark[p - 1] && !labels[p - 1]) { labels[p - 1] = next; stack[sp++] = p - 1; }
      if (x < w - 1 && dark[p + 1] && !labels[p + 1]) { labels[p + 1] = next; stack[sp++] = p + 1; }
      if (y > 0 && dark[p - w] && !labels[p - w]) { labels[p - w] = next; stack[sp++] = p - w; }
      if (y < h - 1 && dark[p + w] && !labels[p + w]) { labels[p + w] = next; stack[sp++] = p + w; }
    }
    next++;
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    const touchesEdge = minX === 0 || minY === 0 || maxX === w - 1 || maxY === h - 1;
    if (touchesEdge || area < 60) continue;
    if (Math.max(bw, bh) / Math.min(bw, bh) > 1.8) continue;
    if (area / (bw * bh) < 0.6) continue;
    blobs.push({ area, x: sx / area, y: sy / area });
  }
  if (blobs.length < 4) return null;

  blobs.sort((a, b) => b.area - a.area);
  const cand = blobs.slice(0, 10);
  const want = (OMR_LAYOUT.markers[1][0] - OMR_LAYOUT.markers[0][0]) / (OMR_LAYOUT.markers[3][1] - OMR_LAYOUT.markers[0][1]);
  let best = null;
  for (let a = 0; a < cand.length; a++)
    for (let b = a + 1; b < cand.length; b++)
      for (let c = b + 1; c < cand.length; c++)
        for (let d = c + 1; d < cand.length; d++) {
          const set = [cand[a], cand[b], cand[c], cand[d]];
          const areas = set.map(s => s.area);
          const areaRatio = Math.min(...areas) / Math.max(...areas);
          if (areaRatio < 0.35) continue;
          const tl = set.reduce((m, s) => (s.x + s.y < m.x + m.y ? s : m));
          const br = set.reduce((m, s) => (s.x + s.y > m.x + m.y ? s : m));
          const tr = set.reduce((m, s) => (s.x - s.y > m.x - m.y ? s : m));
          const bl = set.reduce((m, s) => (s.x - s.y < m.x - m.y ? s : m));
          if (new Set([tl, tr, br, bl]).size !== 4) continue;
          const top = Math.hypot(tr.x - tl.x, tr.y - tl.y), bottom = Math.hypot(br.x - bl.x, br.y - bl.y);
          const left = Math.hypot(bl.x - tl.x, bl.y - tl.y), right = Math.hypot(br.x - tr.x, br.y - tr.y);
          const ratio = ((top + bottom) / 2) / ((left + right) / 2);
          // marker size should match the distance between markers
          const expectedArea = ((top + bottom) / 2 / (OMR_LAYOUT.markers[1][0] - OMR_LAYOUT.markers[0][0]) * OMR_LAYOUT.markerSize) ** 2;
          const sizeFit = (areas.reduce((s, v) => s + v, 0) / 4) / expectedArea;
          if (sizeFit < 0.35 || sizeFit > 2.2) continue;
          const score = Math.abs(Math.log(ratio / want)) * 3 + Math.abs(Math.log(sizeFit)) + (1 - areaRatio)
            + Math.abs(Math.log(top / bottom)) + Math.abs(Math.log(left / right));
          if (!best || score < best.score) best = { score, pts: [tl, tr, br, bl] };
        }
  if (!best || best.score > 2.5) return null;
  return best.pts.map(p => [p.x, p.y]);
}

// Homography mapping 4 src points (mm) onto 4 dst points (px); returns [h0..h7]
function omrHomography(src, dst) {
  const A = [], bvec = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); bvec.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); bvec.push(v);
  }
  // Gaussian elimination with partial pivoting
  const n = 8;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [bvec[c], bvec[p]] = [bvec[p], bvec[c]];
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      bvec[r] -= f * bvec[c];
    }
  }
  const hv = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = bvec[r];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * hv[k];
    hv[r] = s / A[r][r];
  }
  return hv;
}

function omrShowResult(img, scan, examQs, negRate, examTitle) {
  let correct = 0, wrong = 0, blank = 0, doubles = 0;
  const wrongItems = [];
  examQs.forEach((q, i) => {
    const ch = scan.answers[i].chosen;
    if (ch === null) blank++;
    else if (ch === 'DOUBLE') doubles++;
    else if (ch === q.correctOption) correct++;
    else { wrong++; wrongItems.push({ q, chosen: ch }); }
  });
  const penalty = wrong * negRate;
  const net = correct - penalty;
  omrLastResult = { examTitle, wrongItems, exported: false };

  const bn = n => toBnDigits(n);
  const bnFix = n => toBnDigits(n.toFixed(2));
  document.getElementById('omrResultExamTitle').textContent = examTitle ? `প্রশ্নপত্র: ${examTitle}` : '';
  document.getElementById('omrTotalCount').textContent = `${bn(examQs.length)} টি`;
  document.getElementById('omrCorrectCount').textContent = `${bn(correct)} টি`;
  document.getElementById('omrWrongCount').textContent = `${bn(wrong)} টি`;
  document.getElementById('omrBlankCount').textContent = `${bn(blank)} টি`;
  document.getElementById('omrDoubleCount').textContent = `${bn(doubles)} টি`;
  document.getElementById('omrPenalty').textContent = `-${bnFix(penalty)}`;
  document.getElementById('omrNetScore').textContent = `${bnFix(net)} / ${bn(examQs.length)}`;
  const vaultBtn = document.getElementById('omrToVaultBtn');
  vaultBtn.disabled = wrongItems.length === 0;
  vaultBtn.classList.toggle('opacity-50', wrongItems.length === 0);
  vaultBtn.textContent = wrongItems.length ? `${bn(wrongItems.length)}টি ভুল "ভুল খাতা"য় পাঠান →` : 'কোনো ভুল নেই 🎉';
  document.getElementById('omrResultsSummary').classList.remove('hidden');

  // Photo with what was read drawn on top
  const canvas = document.getElementById('omrOverlayCanvas');
  const k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
  canvas.width = Math.round(img.naturalWidth * k);
  canvas.height = Math.round(img.naturalHeight * k);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const toCanvas = (mx, my) => { const [x, y] = scan.project(mx, my); return [x / scan.scaleK * k, y / scan.scaleK * k]; };
  const p0 = toCanvas(0, 0), p1 = toCanvas(1, 0);
  const rad = Math.max(3, Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * OMR_LAYOUT.bubbleR * 1.25);
  ctx.lineWidth = Math.max(2, rad / 3);
  examQs.forEach((q, i) => {
    const a = scan.answers[i];
    const ring = (opt, color) => {
      const [x, y] = toCanvas(...omrBubbleCenterMm(i + 1, OMR_OPTS.indexOf(opt)));
      ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.stroke();
    };
    if (a.chosen === 'DOUBLE') OMR_OPTS.forEach((o, oi) => { if (a.fills[oi] >= OMR_FILL_MIN) ring(o, '#f59e0b'); });
    else if (a.chosen === q.correctOption) ring(a.chosen, '#16a34a');
    else {
      if (a.chosen) ring(a.chosen, '#e11d48');
      ring(q.correctOption, '#2563eb');
    }
  });
  canvas.classList.remove('hidden');
  document.getElementById('omrScanPlaceholder').classList.add('hidden');

  // Per question list
  const grid = document.getElementById('virtualOmrGrid');
  grid.innerHTML = examQs.map((q, i) => {
    const ch = scan.answers[i].chosen;
    let status;
    if (ch === null) status = '<span class="text-slate-500">উত্তর দেননি</span>';
    else if (ch === 'DOUBLE') status = '<span class="text-amber-700">একাধিক ভরাট</span>';
    else if (ch === q.correctOption) status = `<span class="text-emerald-700">${OMR_OPTS_BN[ch]} ✓</span>`;
    else status = `<span class="text-rose-700">${OMR_OPTS_BN[ch]} ✗</span>`;
    const right = ch === q.correctOption ? '' : ` <span class="text-slate-500">(সঠিক: ${OMR_OPTS_BN[q.correctOption]})</span>`;
    return `<div class="flex items-center justify-between gap-1 px-2 py-1 rounded-lg border border-slate-200 text-xs"><span class="font-bold text-slate-700">${bn(i + 1)}.</span><span>${status}${right}</span></div>`;
  }).join('');
  document.getElementById('omrAnswerListCard').classList.remove('hidden');
}

function exportOmrMistakesToVault() {
  if (!omrLastResult || omrLastResult.exported || !omrLastResult.wrongItems.length) return;
  omrLastResult.wrongItems.forEach(({ q, chosen }) => {
    userMistakes.unshift({
      id: `mv_omr_${Date.now()}_${q.id}`,
      questionId: q.id,
      question: q,
      sourceExamTitle: `উত্তরপত্র স্ক্যান${omrLastResult.examTitle ? ` (${omrLastResult.examTitle})` : ''}`,
      selectedOption: chosen,
      correctOption: q.correctOption,
      tag: 'CONCEPT_GAP',
      userNotes: '',
      status: 'OPEN',
      errorCount: 1,
      sm2Quality: 1,
      easinessFactor: 2.5,
      intervalDays: 1,
      nextReviewDate: new Date()
    });
  });
  omrLastResult.exported = true;
  const btn = document.getElementById('omrToVaultBtn');
  btn.disabled = true;
  btn.textContent = 'ভুল খাতায় পাঠানো হয়েছে ✓';

  updateMistakeBadge();
  switchTab('mistakes');
}

// -----------------------------------------------------------------------------
// 12. REDIS LIVE LEADERBOARD
// -----------------------------------------------------------------------------
let simulatedLeaderboard = [
  { rank: 1, userName: 'মেহের নিগার', rawScore: 7.0, penalty: 0.0, netScore: 7.00, timeTakenSec: 185, tieBreakerRankScore: 7.743056, percentile: 99.8 },
  { rank: 2, userName: 'তানভীর আহমেদ', rawScore: 7.0, penalty: 0.0, netScore: 7.00, timeTakenSec: 240, tieBreakerRankScore: 7.666667, percentile: 98.5 },
  { rank: 3, userName: 'রাফি আল হাসান', rawScore: 6.5, penalty: 0.5, netScore: 6.00, timeTakenSec: 210, tieBreakerRankScore: 6.708333, percentile: 95.2 },
  { rank: 4, userName: 'নুসরাত জাহান', rawScore: 6.0, penalty: 0.5, netScore: 5.50, timeTakenSec: 290, tieBreakerRankScore: 6.097222, percentile: 91.0 },
  { rank: 5, userName: 'কাজী জামিল', rawScore: 5.5, penalty: 0.5, netScore: 5.00, timeTakenSec: 320, tieBreakerRankScore: 5.555556, percentile: 85.4 }
];

function submitToLeaderboard(candidateData) {
  simulatedLeaderboard.push(candidateData);
  simulatedLeaderboard.sort((a, b) => b.tieBreakerRankScore - a.tieBreakerRankScore);
  simulatedLeaderboard.forEach((item, idx) => {
    item.rank = idx + 1;
  });
  renderLeaderboard();
}

function refreshLeaderboard() {
  renderLeaderboard();
}

function renderLeaderboard() {
  const tbody = document.getElementById('leaderboardTbody');
  if (!tbody) return;

  tbody.innerHTML = simulatedLeaderboard.map(item => {
    const isMe = item.userId === 'usr_candidate_me';
    const rankBadge = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`;

    return `
      <tr class="${isMe ? 'bg-emerald-50 border-l-4 border-emerald-500 font-semibold' : 'hover:bg-slate-800/50'}">
        <td class="py-3 px-4 font-mono font-bold">${rankBadge}</td>
        <td class="py-3 px-4 flex items-center space-x-2">
          <span>${item.userName}</span>
          ${isMe ? '<span class="px-1.5 py-0.5 text-[10px] rounded bg-emerald-500 text-slate-950 font-bold">YOU</span>' : ''}
        </td>
        <td class="py-3 px-4 text-center font-mono">${item.rawScore.toFixed(1)}</td>
        <td class="py-3 px-4 text-center font-mono text-rose-700">-${item.penalty.toFixed(2)}</td>
        <td class="py-3 px-4 text-center font-mono font-bold text-emerald-700">${item.netScore.toFixed(2)}</td>
        <td class="py-3 px-4 text-center font-mono text-slate-500">${Math.floor(item.timeTakenSec / 60)}মি. ${item.timeTakenSec % 60}সে.</td>
        <td class="py-3 px-4 text-center font-mono text-emerald-700">${item.tieBreakerRankScore.toFixed(4)}</td>
        <td class="py-3 px-4 text-center font-mono text-emerald-700 font-semibold">${item.percentile || 95}%</td>
      </tr>
    `;
  }).join('');
}

// -----------------------------------------------------------------------------
// 13. GEMINI AI CURRENT AFFAIRS SYNTHESIZER
// -----------------------------------------------------------------------------
async function synthesizeWithAi() {
  document.getElementById('aiGeneratedStem').textContent = `বাংলাদেশ সরকারের সর্বশেষ অর্থনৈতিক সমীক্ষা ও রাজস্ব বাজেট অনুযায়ী সর্বোচ্চ খাতওয়ারী বরাদ্দ কোন খাতে দেওয়া হয়েছে?`;
  document.getElementById('aiGeneratedMnemonic').textContent = `"শিক্ষা প্রযুক্তি সবার আগে, দেশের বাজেট শীর্ষে জাগে"`;
  document.getElementById('aiGeneratedExplanation').textContent = `বিসিএস প্রিলিমিনারি বাংলাদেশ বিষয়াবলীতে বাজেট ও বার্ষিক উন্নয়ন কর্মসূচির (ADP) সর্বোচ্চ বরাদ্দপ্রাপ্ত খাত একটি স্থায়ী গুরুত্বপূর্ণ প্রশ্ন।`;

  const optContainer = document.getElementById('aiGeneratedOptions');
  optContainer.innerHTML = `
    <div class="p-2 rounded bg-white text-emerald-700 font-semibold border border-emerald-200">ক) শিক্ষা ও প্রযুক্তি খাত (সঠিক)</div>
    <div class="p-2 rounded bg-white text-slate-700">খ) পরিবহন ও যোগাযোগ অবকাঠামো খাত</div>
    <div class="p-2 rounded bg-white text-slate-700">গ) স্বাস্থ্য ও পরিবার কল্যাণ খাত</div>
    <div class="p-2 rounded bg-white text-slate-700">ঘ) কৃষি ও পল্লি উন্নয়ন খাত</div>
  `;
}

// -----------------------------------------------------------------------------
// 14. CONFUSING PAIR BUSTER & 5+ TIMES SUPER-HOT CROSS-EXAM COMMON TRACKER
// -----------------------------------------------------------------------------
let confusingHotSubView = 'PAIRS'; // 'PAIRS' or 'SUPER_HOT'
let confusingHotSubject = 'ALL';
let confusingTrapUserAnswers = {}; // { [pairId]: 'A'|'B'|'C'|'D' }
let superHotUserAnswers = {}; // { [qId]: 'A'|'B'|'C'|'D' }
let superHotShowAnswers = false;

function setConfusingHotSubView(view) {
  confusingHotSubView = view;
  const btnPairs = document.getElementById('btnSubViewPairs');
  const btnHot = document.getElementById('btnSubViewSuperHot');
  if (btnPairs && btnHot) {
    btnPairs.className = view === 'PAIRS'
      ? 'seg seg-active'
      : 'px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold bg-white hover:bg-white text-slate-900 border border-amber-400 transition';
    btnHot.className = view === 'SUPER_HOT'
      ? 'seg seg-active'
      : 'px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold bg-white hover:bg-white text-slate-900 border border-amber-400 transition';
  }
  renderConfusingHotTab();
}

function filterConfusingHotSubject(subj) {
  confusingHotSubject = subj;
  renderConfusingHotTab();
}

function answerConfusingTrapQuiz(pairId, optKey) {
  confusingTrapUserAnswers[pairId] = optKey;
  renderConfusingHotTab();
}

function selectSuperHotOmrAnswer(qId, optKey) {
  superHotUserAnswers[qId] = optKey;
  renderConfusingHotTab();
}

function toggleSuperHotShowAnswers() {
  superHotShowAnswers = !superHotShowAnswers;
  renderConfusingHotTab();
}

function clearSuperHotAnswers() {
  superHotUserAnswers = {};
  superHotShowAnswers = false;
  renderConfusingHotTab();
}

function launchSuperHot100Exam() {
  selectExamTrack('BCS');
  const sel = document.getElementById('examCategorySelect');
  if (sel) sel.value = 'SUPER_HOT_100_SET';
  changeExamCategory();
  switchTab('exam');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderConfusingHotTab() {
  const filterContainer = document.getElementById('confusingHotSubjectFilters');
  const statsLabel = document.getElementById('confusingHotStatsLabel');
  const feed = document.getElementById('confusingHotFeed');
  if (!feed) return;

  const subjects = [
    { code: 'ALL', label: 'সকল বিষয়' },
    { code: 'BANGLA', label: 'বাংলা সাহিত্য ও ব্যাকরণ' },
    { code: 'BANGLADESH_AFFAIRS', label: 'বাংলাদেশ ও সংবিধান' },
    { code: 'ENGLISH', label: 'English Grammar & Literature' },
    { code: 'GENERAL_SCIENCE', label: 'বিজ্ঞান ও আইসিটি' },
    { code: 'MATH', label: 'গণিত ও আন্তর্জাতিক' }
  ];

  if (filterContainer) {
    filterContainer.innerHTML = subjects.map(s => `
      <button onclick="filterConfusingHotSubject('${s.code}')" class="chip ${
        confusingHotSubject === s.code
          ? 'chip-active'
          : ''
      }">${s.label}</button>
    `).join('');
  }

  const bnOpt = { A: 'ক', B: 'খ', C: 'গ', D: 'ঘ' };

  // SUB-VIEW 1: CONFUSING PAIR BUSTER MASTER CHART & TRAP QUIZ
  if (confusingHotSubView === 'PAIRS') {
    const allPairs = (typeof window !== 'undefined' && window.confusingPairsData) || [];
    const pairs = confusingHotSubject === 'ALL'
      ? allPairs
      : allPairs.filter(p =>
          p.subjectCode === confusingHotSubject ||
          (confusingHotSubject === 'MATH' && (p.subjectCode === 'MATH' || p.subjectCode === 'INT_AFFAIRS')) ||
          (confusingHotSubject === 'GENERAL_SCIENCE' && (p.subjectCode === 'GENERAL_SCIENCE' || p.subjectCode === 'COMPUTER_ICT'))
        );

    if (statsLabel) {
      const answeredCount = Object.keys(confusingTrapUserAnswers).length;
      statsLabel.textContent = `মোট কনফিউজিং পেয়ার: ${toBnDigits(pairs.length)}টি | ট্র্যাপ কুইজ সমাধান: ${toBnDigits(answeredCount)}টি`;
    }

    feed.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        ${pairs.map((pair, idx) => {
          const chosen = confusingTrapUserAnswers[pair.id];
          const q = pair.trapQuiz;
          const isCorrect = chosen && q && chosen === q.correctOption;

          return `
            <div class="bg-white border-2 border-slate-200 hover:border-amber-400 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between transition">
              <!-- Card Header -->
              <div class="bg-white px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-extrabold text-xs">পেয়ার #${toBnDigits(idx + 1)}</span>
                  <span class="text-xs font-bold text-emerald-700">${pair.subjectNameBn}</span>
                </div>
                <span class="px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold">
                  ${pair.repeatBadge}
                </span>
              </div>

              <!-- Pair Title & Side-by-Side Comparison Table -->
              <div class="p-5 space-y-4 flex-1">
                <h3 class="text-base sm:text-lg font-extrabold text-amber-800 leading-snug">
                  ⚡ ${pair.titleBn}
                </h3>

                <div class="space-y-2.5">
                  ${(pair.items || []).map((it, i) => `
                    <div class="bg-slate-50 border-l-4 ${i === 0 ? 'border-emerald-500' : i === 1 ? 'border-amber-400' : 'border-cyan-400'} rounded-r-xl p-3">
                      <div class="flex flex-wrap items-center justify-between gap-1">
                        <span class="text-sm font-extrabold text-slate-900">${it.term}</span>
                        <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-amber-800 border border-slate-200">${it.exams}</span>
                      </div>
                      <p class="text-xs sm:text-sm text-slate-800 mt-1 leading-relaxed">
                        ➔ ${it.meaning}
                      </p>
                    </div>
                  `).join('')}
                </div>

                <!-- Memory Trick Box -->
                <div class="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-xs sm:text-sm text-emerald-700 leading-relaxed">
                  <strong class="text-amber-800">💡 মনে রাখার ম্যাজিক কৌশল: </strong>${pair.memoryTrickBn}
                </div>

                <!-- Interactive Trap Quiz -->
                ${q ? `
                  <div class="bg-[#fbf9f2] text-slate-950 rounded-xl p-3.5 border-2 border-slate-200 space-y-2">
                    <div class="flex items-center justify-between text-xs font-extrabold text-[#006a4e]">
                      <span>🎯 তাৎক্ষণিক ট্র্যাপ টেস্ট (নিজেকে যাচাই করুন):</span>
                      ${chosen ? `<span class="${isCorrect ? 'text-emerald-700' : 'text-rose-700'}">${isCorrect ? '✓ সঠিক উত্তর!' : '✗ ফাঁদে পড়েছেন!'}</span>` : '<span class="text-slate-400">অপশনে ক্লিক করুন</span>'}
                    </div>
                    <p class="text-sm font-bold text-slate-950">${q.stemBn}</p>
                    <div class="grid grid-cols-2 gap-1.5 pt-1">
                      ${['A', 'B', 'C', 'D'].map(optKey => {
                        let cls = 'px-2.5 py-1.5 rounded border text-xs font-bold text-left transition cursor-pointer';
                        if (!chosen) {
                          cls += 'bg-white hover:bg-amber-50 border-slate-300 text-slate-900';
                        } else if (optKey === q.correctOption) {
                          cls += 'bg-emerald-100 border-emerald-200 text-emerald-950';
                        } else if (chosen === optKey) {
                          cls += 'bg-rose-100 border-rose-200 text-rose-950 line-through';
                        } else {
                          cls += 'bg-white border-slate-300 text-slate-400';
                        }
                        return `
                          <button onclick="answerConfusingTrapQuiz('${pair.id}', '${optKey}')" class="${cls}">
                            (${bnOpt[optKey]}) ${q.options[optKey]}
                          </button>
                        `;
                      }).join('')}
                    </div>
                    ${chosen ? `
                      <div class="text-xs bg-emerald-50 border-l-4 border-emerald-200 p-2 text-slate-900 mt-1">
                        <strong>ব্যাখ্যা:</strong> ${q.explanationBn}
                      </div>
                    ` : ''}
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    return;
  }

  // SUB-VIEW 2: 5+ TIMES REPEATED SUPER-HOT COMMON QUESTIONS IN 2-COLUMN PRINTED BOOKLET + OMR
  const allPool = (typeof window !== 'undefined' && window.sampleQuestions && window.sampleQuestions.length > 0)
    ? window.sampleQuestions
    : questions;
  let hotList = allPool
    .filter(q => q.isSuperHot || (q.repeatCount && q.repeatCount >= 5))
    .sort((a, b) => (b.repeatCount || 0) - (a.repeatCount || 0));

  if (confusingHotSubject !== 'ALL') {
    hotList = hotList.filter(q =>
      q.subjectCode === confusingHotSubject ||
      (confusingHotSubject === 'MATH' && (q.subjectCode === 'MATH' || q.subjectCode === 'INT_AFFAIRS' || q.subjectCode === 'MENTAL_ABILITY')) ||
      (confusingHotSubject === 'GENERAL_SCIENCE' && (q.subjectCode === 'GENERAL_SCIENCE' || q.subjectCode === 'COMPUTER_ICT'))
    );
  }
  hotList = hotList.slice(0, 100);

  if (statsLabel) {
    statsLabel.textContent = `৫+ বার আসা সুপার-হট প্রশ্ন: ${toBnDigits(hotList.length)}টি (২-কলাম মুদ্রিত প্রশ্নপত্র ফরম্যাট)`;
  }

  let shCorrect = 0;
  let shWrong = 0;
  let shAttempted = 0;
  hotList.forEach(q => {
    const chosen = superHotUserAnswers[q.id];
    if (chosen) {
      shAttempted++;
      if (chosen === q.correctOption) shCorrect++;
      else shWrong++;
    }
  });
  const shNet = Math.max(0, shCorrect - shWrong * 0.25).toFixed(2);

  let lastSubj = null;
  const bookletItemsHtml = hotList.map((q, idx) => {
    const qNoBn = toBnDigits(idx + 1);
    const chosen = superHotUserAnswers[q.id];
    let subjHdr = '';
    if (q.subjectNameBn && q.subjectNameBn !== lastSubj) {
      lastSubj = q.subjectNameBn;
      subjHdr = `<div class="bpsc-subj-header">বিষয়: ${q.subjectNameBn}</div>`;
    }

    const optsHtml = ['A', 'B', 'C', 'D'].map(optKey => {
      const isChecked = chosen === optKey;
      const isCorrect = q.correctOption === optKey;
      let optClass = 'bpsc-opt-btn';
      if (superHotShowAnswers) {
        if (isCorrect) optClass += ' correct-ans';
        else if (isChecked && !isCorrect) optClass += ' wrong-ans';
      } else if (isChecked) {
        optClass += ' selected';
      }
      return `
        <div onclick="selectSuperHotOmrAnswer('${q.id}', '${optKey}')" class="${optClass}">
          <span class="font-bold">(${bnOpt[optKey]})</span>
          <span>${q.options[optKey]}</span>
        </div>
      `;
    }).join('');

    const repeatList = q.crossExamRepeats || [];
    const repeatBanner = repeatList.length > 0
      ? `<div class="text-[11px] font-semibold text-amber-950 bg-amber-100 border border-amber-400 rounded px-1.5 py-0.5 mb-1 leading-snug">
           🔥 <strong>${toBnDigits(q.repeatCount || repeatList.length)} বার এসেছে:</strong> ${repeatList.join(' • ')}
         </div>`
      : '';

    const expHtml = (superHotShowAnswers || chosen)
      ? `<div class="bpsc-exp-box">
           <div><strong class="text-emerald-800">✓ সঠিক উত্তর: (${bnOpt[q.correctOption]}) ${q.options[q.correctOption]}</strong></div>
           ${q.explanationBn ? `<div class="mt-0.5 text-slate-800">${q.explanationBn}</div>` : ''}
           ${q.shortcutFormula ? `<div class="mt-0.5 font-mono text-xs text-teal-900 font-bold">⚡ শর্টকাট: ${q.shortcutFormula}</div>` : ''}
           ${q.mnemonicBn ? `<div class="mt-0.5 text-xs text-amber-900 font-semibold">🎶 ছন্দ: ${q.mnemonicBn}</div>` : ''}
         </div>`
      : '';

    return `
      ${subjHdr}
      <div class="bpsc-q-item" id="sh_q_${q.id}">
        <div class="flex items-start justify-between gap-2 font-bold text-[#0b0f17] mb-1">
          <span>${qNoBn}. ${q.stemBn}</span>
          <button onclick="toggleBookmark('${q.id}')" title="বুকমার্ক" class="text-xs opacity-60 hover:opacity-100 shrink-0">${bookmarkedIds.has(q.id) ? '⭐' : '☆'}</button>
        </div>
        ${repeatBanner}
        <div class="grid grid-cols-2 gap-x-2 gap-y-0.5 pl-1">
          ${optsHtml}
        </div>
        ${expHtml}
      </div>
    `;
  }).join('');

  const omrRowsHtml = hotList.map((q, idx) => {
    const chosen = superHotUserAnswers[q.id];
    const bubblesHtml = ['A', 'B', 'C', 'D'].map(optKey => {
      const isFilled = chosen === optKey;
      const isCorrect = superHotShowAnswers && q.correctOption === optKey;
      let extraStyle = '';
      if (isCorrect && !isFilled) {
        extraStyle = 'border-color:#16a34a;background:#dcfce7;color:#065f46;';
      }
      return `
        <span onclick="selectSuperHotOmrAnswer('${q.id}', '${optKey}')" class="omr-circle ${isFilled ? 'filled' : ''}" style="${extraStyle}">
          ${bnOpt[optKey]}
        </span>
      `;
    }).join('');

    return `
      <div class="flex items-center justify-between py-1 px-1.5 rounded border-b border-rose-200/80 hover:bg-rose-100/50 transition">
        <button onclick="document.getElementById('sh_q_${q.id}')?.scrollIntoView({behavior:'smooth',block:'center'})" class="text-xs font-bold text-rose-900 hover:underline w-8 text-left">
          ${toBnDigits(idx + 1)}.
        </button>
        <div class="flex items-center space-x-1">
          ${bubblesHtml}
        </div>
      </div>
    `;
  }).join('');

  const totalQBn = toBnDigits(hotList.length);

  feed.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div class="lg:col-span-8">
        <div class="bpsc-paper-sheet">
          <div class="text-center border-b-2 border-slate-900 pb-3 mb-3">
            <div class="text-xs font-bold tracking-wider text-slate-700">গণপ্রজাতন্ত্রী বাংলাদেশ সরকার • সমন্বিত নিয়োগ পরীক্ষা আর্কাইভ</div>
            <h2 class="text-xl sm:text-2xl font-extrabold text-slate-950 mt-0.5">বিসিএস • প্রাইমারি (DPE) • শিক্ষক নিবন্ধন (NTRCA) • ব্যাংক • মন্ত্রণালয়</h2>
            <h3 class="text-sm sm:text-base font-bold text-[#006a4e] mt-0.5">🔥 ৫+ বার বিভিন্ন সরকারি পরীক্ষায় হুবহু রিপিট হওয়া সুপার-হট কমন প্রশ্নপত্র</h3>

            <div class="flex flex-wrap items-center justify-between border-t border-slate-800 mt-2.5 pt-2 text-xs sm:text-sm font-bold text-slate-900">
              <span>বিশেষ সংকলন: Cross-Exam Repeat Master Set</span>
              <span class="border-2 border-slate-950 px-3 py-0.5 bg-white text-slate-950 font-extrabold shadow-sm">
                সেট কোড : সুপার-হট ১০০
              </span>
              <span>মোট প্রশ্ন: ${totalQBn}টি | পূর্ণমান: ${totalQBn}</span>
            </div>
          </div>

          <div class="bg-[#f5f1e3] border border-slate-700 px-3 py-2 mb-4 text-xs text-slate-900 leading-relaxed flex flex-wrap items-center justify-between gap-2">
            <span>
              <strong>[নির্দেশনা:</strong> প্রতিটি প্রশ্নের নিচে <strong>কোন কোন পরীক্ষায় কতবার প্রশ্নটি এসেছে</strong> তা উল্লেখ করা আছে। ডান পাশের OMR শিটে বৃত্ত ভরাট করে অনুশীলন করুন।<strong>]</strong>
            </span>
            <button onclick="toggleSuperHotShowAnswers()" class="px-2.5 py-1 rounded bg-[#006a4e] text-white font-bold text-xs shrink-0">
              ${superHotShowAnswers ? '🙈 সব উত্তর লুকান' : '👁️ সব উত্তর ও ব্যাখ্যা দেখুন'}
            </button>
          </div>

          <div class="bpsc-two-col">
            ${bookletItemsHtml}
          </div>
        </div>
      </div>

      <div class="lg:col-span-4 sticky top-28">
        <div class="bpsc-omr-sheet">
          <div class="bg-[#d94662] text-white px-4 py-2.5 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-bold tracking-wide">সুপার-হট কমন OMR শিট</h3>
              <p class="text-[10px] opacity-90 font-mono">CROSS-EXAM REPEAT TRACKER • -০.২৫ নেগেটিভ</p>
            </div>
            <span class="px-2.5 py-1 rounded-full bg-slate-950 text-amber-300 font-mono text-xs font-bold">
              ${toBnDigits(shAttempted)}/${totalQBn}
            </span>
          </div>

          <div class="p-3 bg-[#fff0f3] border-b border-rose-200 flex items-center justify-between text-xs text-slate-800">
            <div>
              <span class="text-[10px] font-bold text-rose-800 block">তাৎক্ষণিক ফলাফল (LIVE SCORE):</span>
              <div class="font-bold text-slate-900 mt-0.5">
                সঠিক: <span class="text-emerald-700">${toBnDigits(shCorrect)}</span> |
                ভুল: <span class="text-rose-700">${toBnDigits(shWrong)}</span> |
                নিট: <span class="px-1.5 py-0.5 rounded bg-emerald-700 text-white">${toBnDigits(shNet)}</span>
              </div>
            </div>
            <button onclick="clearSuperHotAnswers()" class="px-2 py-1 rounded border border-rose-400 bg-white hover:bg-rose-50 text-rose-800 font-bold text-[11px]">
              রিসেট
            </button>
          </div>

          <div class="p-3 grid grid-cols-2 gap-x-4 gap-y-1.5 max-h-[60vh] overflow-y-auto bg-[#fff9fa]">
            ${omrRowsHtml}
          </div>

          <div class="px-3 py-2 bg-[#fff0f3] border-t border-rose-200 flex items-center justify-between text-[11px] text-rose-900 font-semibold">
            <span>● সঠিক = +১.০০ | ভুল = -০.২৫</span>
            <button onclick="toggleSuperHotShowAnswers()" class="px-3 py-1 rounded bg-[#006a4e] text-white font-bold hover:bg-[#004d38] transition">
              ${superHotShowAnswers ? 'উত্তর লুকান' : 'উত্তর মিলিয়ে দেখুন →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// 15. 1-CLICK OFFLINE PRINTABLE QUESTION BOOKLET + BLANK OMR + ANSWER KEY PDF
// -----------------------------------------------------------------------------
function printFullExamPackage(source = 'LIVE') {
  const bnOpt = { A: 'ক', B: 'খ', C: 'গ', D: 'ঘ' };
  let printQuestions = questions || [];
  let orgTitle = currentOrgHeaderBn || 'বাংলাদেশ সরকারি কর্ম কমিশন (BPSC)';
  let examTitle = currentExamTitleBn || 'বিসিএস প্রিলিমিনারি পূর্ণাঙ্গ মডেল প্রশ্নপত্র';
  let setCode = currentSetCodeBn || 'ক';
  let negVal = typeof currentNegativeRate === 'number' ? currentNegativeRate : 0.50;

  if (source === 'PAST_BANK') {
    const allPool = (typeof window !== 'undefined' && window.sampleQuestions) || questions;
    if (pastBankTrack !== 'BCS') {
      const sectorArchives = getSectorArchiveList(pastBankTrack);
      const found = sectorArchives.find(a => a.code === pastBankFilterValue) || sectorArchives[0];
      if (found) {
        const byId = new Map(allPool.map(q => [q.id, q]));
        printQuestions = (found.questionIds || []).map(id => byId.get(id)).filter(Boolean);
        orgTitle = found.authorityBn || orgTitle;
        examTitle = `${found.title} (${found.examDate})`;
        setCode = (found.setNameBn || 'ক').replace(/^সেট:\s*/, '');
        negVal = typeof found.negativeMark === 'number' ? found.negativeMark : 0.25;
      }
    }
  }

  const totalQ = printQuestions.length;
  const totalQBn = toBnDigits(totalQ);
  const negBn = toBnDigits(negVal.toFixed(2));

  let lastSubj = null;
  const qItemsHtml = printQuestions.map((q, idx) => {
    let subjHdr = '';
    if (q.subjectNameBn && q.subjectNameBn !== lastSubj) {
      lastSubj = q.subjectNameBn;
      subjHdr = `<div class="subj-hdr">বিষয়: ${q.subjectNameBn}</div>`;
    }
    return `
      ${subjHdr}
      <div class="q-item">
        <div class="q-stem"><b>${toBnDigits(idx + 1)}.</b> ${q.stemBn}</div>
        <div class="q-opts">
          <span><b>(ক)</b> ${q.options.A}</span>
          <span><b>(খ)</b> ${q.options.B}</span>
          <span><b>(গ)</b> ${q.options.C}</span>
          <span><b>(ঘ)</b> ${q.options.D}</span>
        </div>
      </div>
    `;
  }).join('');

  const blankOmrRowsHtml = printQuestions.map((_, idx) => `
    <div class="omr-row">
      <span class="omr-qno">${toBnDigits(idx + 1)}.</span>
      <span class="omr-b">ক</span>
      <span class="omr-b">খ</span>
      <span class="omr-b">গ</span>
      <span class="omr-b">ঘ</span>
    </div>
  `).join('');

  const ansKeyHtml = printQuestions.map((q, idx) => `
    <div class="ak-item">
      <b>${toBnDigits(idx + 1)}. (${bnOpt[q.correctOption]}) ${q.options[q.correctOption]}</b>
      ${q.explanationBn ? ` — <span>${q.explanationBn}</span>` : ''}
      ${q.shortcutFormula ? ` <small>[শর্টকাট: ${q.shortcutFormula}]</small>` : ''}
    </div>
  `).join('');

  const printHtml = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <title>${examTitle} — প্রশ্নপত্র + ফাঁকা OMR + উত্তরমালা</title>
  <link href="https://fonts.googleapis.com/css2?family=Tiro+Bangla:ital@0;1&family=Noto+Serif+Bengali:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 11mm; }
    body {
      font-family: 'Tiro Bangla', 'SolaimanLipi', 'Kalpurush', 'Noto Serif Bengali', serif;
      color: #0b0f17;
      background: #fff;
      margin: 0;
      padding: 0;
      font-size: 13.5px;
      line-height: 1.5;
    }
    .no-print-bar {
      background: #004d38;
      color: #fff;
      padding: 10px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: bold;
    }
    .no-print-bar button {
      background: #fbbf24;
      color: #0f172a;
      border: none;
      padding: 7px 16px;
      border-radius: 8px;
      font-weight: 800;
      cursor: pointer;
    }
    @media print { .no-print-bar { display: none !important; } }
    .sheet { padding: 6mm; }
    .page-break { page-break-before: always; }
    .head { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px; }
    .head h1 { font-size: 19px; margin: 2px 0; }
    .head h2 { font-size: 14px; margin: 2px 0; color: #006a4e; }
    .meta { display: flex; justify-content: space-between; border-top: 1px solid #000; padding-top: 5px; margin-top: 6px; font-weight: bold; font-size: 12.5px; }
    .set-box { border: 2px solid #000; padding: 1px 10px; }
    .ins { background: #f8f5eb; border: 1px solid #333; padding: 6px 10px; font-size: 11.5px; margin-bottom: 10px; }
    .two-col { column-count: 2; column-gap: 18px; column-rule: 1px solid #333; }
    .subj-hdr { column-span: all; background: #eee8d5; border-top: 1.5px solid #000; border-bottom: 1px solid #000; text-align: center; font-weight: bold; padding: 3px; margin: 8px 0 5px; }
    .q-item { break-inside: avoid; margin-bottom: 7px; padding-bottom: 5px; border-bottom: 1px dotted #aaa; }
    .q-opts { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 8px; padding-left: 10px; font-size: 12.8px; }
    /* Blank Pink/Red OMR Sheet */
    .omr-page { border: 2.5px solid #be123c; background: #fff9fa; padding: 14px; }
    .omr-header { background: #be123c; color: #fff; padding: 8px 14px; display: flex; justify-content: space-between; align-items: center; }
    .omr-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px 14px; margin-top: 12px; }
    .omr-row { display: flex; align-items: center; gap: 5px; padding: 2px 4px; border-bottom: 1px solid #fecdd3; font-size: 12px; }
    .omr-qno { width: 28px; font-weight: bold; color: #881337; }
    .omr-b { width: 19px; height: 19px; border-radius: 50%; border: 1.5px solid #e11d48; display: inline-flex; align-items: center; justify-content: center; font-size: 10.5px; color: #be123c; font-weight: bold; background: #fff; }
    .ak-grid { column-count: 2; column-gap: 18px; font-size: 12px; }
    .ak-item { break-inside: avoid; margin-bottom: 5px; border-bottom: 1px dashed #ccc; padding-bottom: 3px; }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <span>🖨️ ১-ক্লিকে অফলাইন প্রিন্টেবল প্যাকেজ: (১) ২-কলাম প্রশ্নপত্র + (২) ফাঁকা OMR উত্তরপত্র + (৩) ব্যাখ্যাসহ উত্তরমালা</span>
    <button onclick="window.print()">এখনই প্রিন্ট / Save as PDF করুন</button>
  </div>

  <!-- PART 1: 2-COLUMN QUESTION BOOKLET -->
  <div class="sheet">
    <div class="head">
      <div>গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</div>
      <h1>${orgTitle}</h1>
      <h2>${examTitle}</h2>
      <div class="meta">
        <span>পূর্ণমান: ${totalQBn}</span>
        <span class="set-box">সেট কোড : ${setCode}</span>
        <span>নেগেটিভ মার্কিং: -${negBn}</span>
      </div>
    </div>
    <div class="ins">
      <b>[নির্দেশনা:</b> প্রতিটি প্রশ্নের মান ১। প্রতিটি ভুল উত্তরের জন্য ${negBn} নম্বর কাটা যাবে। পরের পাতায় সংযুক্ত ফাঁকা OMR উত্তরপত্রে কালো বলপয়েন্ট কলম দিয়ে বৃত্ত ভরাট করে অনুশীলন করুন।<b>]</b>
    </div>
    <div class="two-col">${qItemsHtml}</div>
  </div>

  <!-- PART 2: BLANK PINK/RED OMR ANSWER SHEET -->
  <div class="sheet page-break">
    <div class="omr-page">
      <div class="omr-header">
        <div>
          <div style="font-size:16px;font-weight:bold;">${orgTitle} — ফাঁকা OMR উত্তরপত্র (Practice Sheet)</div>
          <div style="font-size:11px;">${examTitle} • সেট কোড: ${setCode} • কালো বলপয়েন্ট কলমে বৃত্ত ভরাট করুন</div>
        </div>
        <div style="border:2px solid #fff;padding:4px 10px;font-weight:bold;">মোট প্রশ্ন: ${totalQBn}টি</div>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 4px;border-bottom:1.5px solid #fda4af;font-size:12px;font-weight:bold;color:#881337;">
        <span>পরীক্ষার্থীর নাম: ................................................................</span>
        <span>রোল নম্বর: [  ][  ][  ][  ][  ][  ][  ][  ]</span>
        <span>তারিখ: .........................</span>
      </div>
      <div class="omr-grid">${blankOmrRowsHtml}</div>
    </div>
  </div>

  <!-- PART 3: OFFICIAL ANSWER KEY & EXPLANATIONS -->
  <div class="sheet page-break">
    <div class="head">
      <h1>ব্যাখ্যা ও শর্টকাটসহ সম্পূর্ণ উত্তরমালা (Answer Key)</h1>
      <h2>${examTitle} • সেট কোড: ${setCode}</h2>
    </div>
    <div class="ak-grid">${ansKeyHtml}</div>
  </div>
</body>
</html>`;

  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    const win = window.open('', '_blank');
    if (win && win.document) {
      win.document.open();
      win.document.write(printHtml);
      win.document.close();
    }
  }
  return printHtml;
}

// -----------------------------------------------------------------------------
// 16. MASTER TOOLKIT: 10-SEC MATH SHORTCUTS, WRITTEN/VIVA & 90-DAY ROUTINE
// -----------------------------------------------------------------------------
let toolkitSubView = 'MATH_SHORTCUTS'; // 'MATH_SHORTCUTS' | 'WRITTEN_VIVA' | 'ROUTINE_90'
let mathShortcutFilter = 'ALL';
let mathMiniQuizAnswers = {}; // { [sheetId]: 'A'|'B'|'C'|'D' }
let studyStreakDays = 7;
let dailyChecklistState = {
  q30: true,
  miniModel: false,
  confusing5: true,
  math10: false,
  mistakeRev: false
};
let syllabusProgressState = {
  BANGLA: 68,
  ENGLISH: 62,
  BANGLADESH_AFFAIRS: 75,
  INT_AFFAIRS: 55,
  MATH: 60,
  MENTAL_ABILITY: 70,
  GENERAL_SCIENCE: 58,
  COMPUTER_ICT: 64,
  GEOGRAPHY: 50,
  ETHICS: 52
};

function openVivaBridgeForSubject() {
  switchTab('master-toolkit');
  setToolkitSubView('WRITTEN_VIVA');
  if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function setToolkitSubView(view) {
  toolkitSubView = view;
  const btns = {
    MATH_SHORTCUTS: document.getElementById('btnToolkitMath'),
    WRITTEN_VIVA: document.getElementById('btnToolkitViva'),
    ROUTINE_90: document.getElementById('btnToolkitRoutine')
  };
  Object.keys(btns).forEach(k => {
    if (!btns[k]) return;
    btns[k].className = k === view
      ? 'seg seg-active'
      : 'px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold bg-white hover:bg-white text-slate-900 border border-emerald-400 transition';
  });
  renderMasterToolkitTab();
}

function answerMathShortcutQuiz(sheetId, optKey) {
  mathMiniQuizAnswers[sheetId] = optKey;
  renderMasterToolkitTab();
}

function toggleDailyTask(taskKey) {
  dailyChecklistState[taskKey] = !dailyChecklistState[taskKey];
  const allDone = Object.values(dailyChecklistState).every(Boolean);
  if (allDone) studyStreakDays = Math.max(studyStreakDays, 8);
  renderMasterToolkitTab();
}

function adjustSyllabusProgress(subjCode, delta) {
  const cur = syllabusProgressState[subjCode] || 50;
  syllabusProgressState[subjCode] = Math.min(100, Math.max(0, cur + delta));
  renderMasterToolkitTab();
}

function renderMasterToolkitTab() {
  const feed = document.getElementById('masterToolkitFeed');
  if (!feed) return;

  const bnOpt = { A: 'ক', B: 'খ', C: 'গ', D: 'ঘ' };

  // SUB-VIEW 1: 10-SECOND MATH & MENTAL ABILITY SHORTCUT FORMULA SHEETS
  if (toolkitSubView === 'MATH_SHORTCUTS') {
    const sheets = (typeof window !== 'undefined' && window.mathShortcutSheets) || [];
    feed.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        ${sheets.map(s => {
          const chosen = mathMiniQuizAnswers[s.id];
          const mq = s.miniQuiz;
          const isCorrect = chosen && mq && chosen === mq.correctOption;

          return `
            <div class="bg-white border-2 border-slate-200 hover:border-emerald-400 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between">
              <div class="bg-white px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <span class="px-2.5 py-0.5 rounded bg-emerald-400 text-slate-950 font-extrabold text-xs">${s.categoryNameBn}</span>
                <span class="text-[11px] font-bold text-amber-800">${s.examFrequency}</span>
              </div>

              <div class="p-5 space-y-3.5 flex-1">
                <h3 class="text-base sm:text-lg font-extrabold text-slate-900">${s.titleBn}</h3>

                <!-- Written vs 10-Sec Shortcut Comparison -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div class="bg-rose-50 border border-rose-200 rounded-xl p-3">
                    <div class="font-bold text-rose-700 mb-1">⏳ প্রচলিত লিখিত নিয়ম (২ মিনিট):</div>
                    <p class="text-slate-700 leading-relaxed">${s.writtenMethodBn}</p>
                  </div>
                  <div class="bg-emerald-50 border-2 border-emerald-500 rounded-xl p-3">
                    <div class="font-extrabold text-emerald-700 mb-1">⚡ ১০-সেকেন্ড এমসিকিউ শর্টকাট সূত্র:</div>
                    <p class="font-mono font-bold text-amber-800 leading-relaxed">${s.shortcutFormulaBn}</p>
                  </div>
                </div>

                <!-- Worked Example -->
                <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs sm:text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                  ${s.workedExampleBn}
                </div>

                <!-- Golden Table -->
                <div class="bg-amber-50 border border-amber-300 rounded-xl p-2.5 text-xs text-amber-800">
                  <strong>📌 রেডিমেড মান চার্ট:</strong> ${s.goldenTableBn}
                </div>

                <!-- 1-Click Practice Math -->
                ${mq ? `
                  <div class="bg-[#fbf9f2] text-slate-950 rounded-xl p-3.5 border-2 border-slate-200 space-y-2">
                    <div class="flex items-center justify-between text-xs font-extrabold text-[#006a4e]">
                      <span>🧮 ১০-সেকেন্ডে সমাধান করুন:</span>
                      ${chosen ? `<span class="${isCorrect ? 'text-emerald-700' : 'text-rose-700'}">${isCorrect ? '✓ সঠিক!' : '✗ ভুল হয়েছে'}</span>` : ''}
                    </div>
                    <p class="text-sm font-bold">${mq.stemBn}</p>
                    <div class="grid grid-cols-2 gap-1.5">
                      ${['A', 'B', 'C', 'D'].map(optKey => {
                        let cls = 'px-2.5 py-1.5 rounded border text-xs font-bold text-left transition cursor-pointer';
                        if (!chosen) cls += 'bg-white hover:bg-amber-50 border-slate-300 text-slate-900';
                        else if (optKey === mq.correctOption) cls += 'bg-emerald-100 border-emerald-200 text-emerald-950';
                        else if (chosen === optKey) cls += 'bg-rose-100 border-rose-200 text-rose-950 line-through';
                        else cls += 'bg-white border-slate-300 text-slate-400';
                        return `<button onclick="answerMathShortcutQuiz('${s.id}', '${optKey}')" class="${cls}">(${bnOpt[optKey]}) ${mq.options[optKey]}</button>`;
                      }).join('')}
                    </div>
                    ${chosen ? `<div class="text-xs bg-emerald-50 border-l-4 border-emerald-200 p-2 text-slate-900"><strong>সমাধান:</strong> ${mq.explanationBn}</div>` : ''}
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    return;
  }

  // SUB-VIEW 2: PRELI-TO-WRITTEN & VIVA BRIDGE
  if (toolkitSubView === 'WRITTEN_VIVA') {
    const vivaData = (typeof window !== 'undefined' && window.writtenVivaBridgeData) || [];
    feed.innerHTML = `
      <div class="space-y-5">
        ${vivaData.map(item => `
          <div class="bg-white border-2 border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <h3 class="text-lg font-extrabold text-amber-800">${item.topicTitleBn}</h3>
              <span class="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">${item.trackBadge}</span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm">
              <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div class="font-bold text-emerald-700 mb-1">📌 প্রিলিমিনারি ফ্যাক্টস (এমসিকিউ বেস):</div>
                <p class="text-slate-700 leading-relaxed">${item.preliCoreBn}</p>
              </div>
              <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div class="font-bold text-emerald-700 mb-1">✍️ লিখিত পরীক্ষার ফোকাস রাইটিং ও মূল পয়েন্ট:</div>
                <p class="text-slate-700 leading-relaxed">${item.writtenFocusBn}</p>
              </div>
            </div>

            <div class="space-y-2.5">
              <div class="text-xs font-extrabold text-amber-800 uppercase">🎙️ ভাইভা বোর্ডের বাস্তব প্রশ্ন ও আদর্শ উত্তর কৌশল:</div>
              ${(item.vivaQuestions || []).map(vq => `
                <div class="bg-[#fbf9f2] text-slate-950 rounded-xl p-3.5 border-l-4 border-[#006a4e] space-y-1">
                  <div class="font-extrabold text-sm text-[#004d38]">❓ ${vq.q}</div>
                  <div class="text-xs sm:text-sm text-slate-800 leading-relaxed">✅ ${vq.a}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
    return;
  }

  // SUB-VIEW 3: DAILY TARGET, STREAK COUNTER, SYLLABUS TRACKER & 90-DAY ROUTINE PLANNER
  const routinePhases = (typeof window !== 'undefined' && window.ninetyDaysRoutineData) || [];
  const checklistItems = [
    { key: 'q30', label: '📖 আজকের ৩০টি নতুন প্রামাণ্য এমসিকিউ অনুশীলন (বোর্ড বই ও আর্কাইভ)' },
    { key: 'miniModel', label: '📝 ২-কলাম বুকলেটে ১টি পূর্ণাঙ্গ বা মিনি মডেল টেস্ট প্রদান' },
    { key: 'confusing5', label: '⚡ ৫টি কনফিউজিং পেয়ার ও ট্র্যাপ কুইজ রিভিশন' },
    { key: 'math10', label: '🧮 ১০টি গণিত শর্টকাট ও ইংরেজি ভোকাবুলারি চর্চা' },
    { key: 'mistakeRev', label: '📕 ভুল খাতা (Mistake Vault) থেকে গতকালের ভুল প্রশ্নগুলো রিভিশন' }
  ];
  const doneCount = Object.values(dailyChecklistState).filter(Boolean).length;
  const dailyPct = Math.round((doneCount / checklistItems.length) * 100);

  const subjectNames = [
    { code: 'BANGLA', name: 'বাংলা ভাষা ও সাহিত্য (৩৫)' },
    { code: 'ENGLISH', name: 'English Language & Literature (৩৫)' },
    { code: 'BANGLADESH_AFFAIRS', name: 'বাংলাদেশ বিষয়াবলী ও সংবিধান (৩০)' },
    { code: 'INT_AFFAIRS', name: 'আন্তর্জাতিক বিষয়াবলী (২০)' },
    { code: 'MATH', name: 'গাণিতিক যুক্তি (১৫/২০)' },
    { code: 'MENTAL_ABILITY', name: 'মানসিক দক্ষতা (১৫)' },
    { code: 'GENERAL_SCIENCE', name: 'সাধারণ বিজ্ঞান (১৫)' },
    { code: 'COMPUTER_ICT', name: 'কম্পিউটার ও তথ্যপ্রযুক্তি (১৫)' },
    { code: 'GEOGRAPHY', name: 'ভূগোল, পরিবেশ ও দুর্যোগ (১০)' },
    { code: 'ETHICS', name: 'নৈতিকতা, মূল্যবোধ ও সুশাসন (১০)' }
  ];

  feed.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Left 5 cols: Daily Target Checklist & Streak Counter -->
      <div class="lg:col-span-5 space-y-4">
        <div class="bg-white border-2 border-amber-400 rounded-2xl p-5 space-y-4 shadow-sm">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-amber-800 block">🔥 ধারাবাহিক প্রস্তুতি স্ট্রিক</span>
              <h3 class="text-xl font-extrabold text-slate-900 mt-0.5">টানা ${toBnDigits(studyStreakDays)} দিন অনুশীলন চলছে!</h3>
            </div>
            <div class="px-3.5 py-2 rounded-2xl bg-amber-400 text-slate-950 font-extrabold text-sm shadow">
              ${toBnDigits(dailyPct)}% সম্পন্ন
            </div>
          </div>

          <div class="w-full bg-white h-3 rounded-full overflow-hidden">
            <div class="bg-emerald-500 h-full transition-all duration-300" style="width:${dailyPct}%"></div>
          </div>

          <div class="space-y-2 pt-1">
            <div class="text-xs font-bold text-slate-700">আজকের ডেইলি টার্গেট চেকলিস্ট (ক্লিক করে টিক দিন):</div>
            ${checklistItems.map(item => {
              const checked = !!dailyChecklistState[item.key];
              return `
                <div onclick="toggleDailyTask('${item.key}')" class="p-3 rounded-xl border cursor-pointer flex items-center justify-between transition ${
                  checked ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
                }">
                  <span class="text-xs sm:text-sm font-semibold">${item.label}</span>
                  <span class="w-5 h-5 rounded flex items-center justify-center font-bold text-xs ${checked ? 'bg-emerald-500 text-slate-950' : 'border border-slate-200'}">
                    ${checked ? '✓' : ''}
                  </span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Subject-wise Syllabus Progress Tracker -->
        <div class="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
          <h3 class="text-base font-extrabold text-slate-900">📊 বিষয়ভিত্তিক সিলেবাস সম্পন্ন ট্র্যাকার</h3>
          <div class="space-y-2.5">
            ${subjectNames.map(s => {
              const pct = syllabusProgressState[s.code] || 50;
              return `
                <div class="space-y-1">
                  <div class="flex items-center justify-between text-xs">
                    <span class="font-semibold text-slate-800">${s.name}</span>
                    <div class="flex items-center gap-1.5">
                      <button onclick="adjustSyllabusProgress('${s.code}', -5)" class="px-1.5 py-0.2 rounded bg-white hover:bg-slate-100 text-slate-700 font-bold">-</button>
                      <span class="font-mono font-bold text-emerald-700 w-10 text-center">${toBnDigits(pct)}%</span>
                      <button onclick="adjustSyllabusProgress('${s.code}', 5)" class="px-1.5 py-0.2 rounded bg-white hover:bg-slate-100 text-emerald-700 font-bold">+</button>
                    </div>
                  </div>
                  <div class="w-full bg-white h-2 rounded-full overflow-hidden">
                    <div class="bg-emerald-400 h-full" style="width:${pct}%"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Right 7 cols: 90-Day 3-Phase Master Routine -->
      <div class="lg:col-span-7 space-y-4">
        <div class="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
          <h3 class="text-lg font-extrabold text-amber-800">📅 ৯০ দিনের মাস্টার স্টাডি রুটিন (বিসিএস, প্রাইমারি, নিবন্ধন ও ব্যাংক)</h3>
          <div class="space-y-4">
            ${routinePhases.map(p => `
              <div class="bg-slate-50 border-l-4 border-emerald-500 rounded-r-2xl p-4 space-y-2">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <h4 class="text-sm sm:text-base font-extrabold text-slate-900">${p.phaseTitleBn}</h4>
                  <span class="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">${p.badgeBn}</span>
                </div>
                <div class="text-xs font-bold text-amber-800">🎯 দৈনিক লক্ষ্যমাত্রা: ${p.dailyTargetSummaryBn}</div>
                <ul class="space-y-1.5 pt-1 text-xs sm:text-sm text-slate-700 list-disc pl-5">
                  ${(p.tasks || []).map(t => `<li>${t}</li>`).join('')}
                </ul>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}



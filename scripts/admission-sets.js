/**
 * University admission (ভর্তি প্রস্তুতি) data for the /admission portal, used by build-practice-sets.js.
 *
 * - Subject pools in src/data/admission/*.json are ORIGINAL practice questions written from the
 *   HSC syllabus. They are not past admission-test questions and are never labelled as such.
 * - Real past papers can be added later in src/data/admission/past-papers/*.json (see the README there).
 *   Only those get a "verified past question" label and the exam/session they came from.
 * - Unit model tests: science, humanities, business and private-university style.
 */
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'src', 'data', 'admission');
const PAST_DIR = path.join(DIR, 'past-papers');
const PRACTICE_LABEL = 'অনুশীলন প্রশ্ন • HSC পাঠ্যসূচিভিত্তিক (বিগত সালের আসল প্রশ্ন নয়)';
const bnDigits = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);

const SUBJECTS = [
  { code: 'ADM_PHYSICS', file: 'physics.json', nameBn: 'পদার্থবিজ্ঞান', key: 'p' },
  { code: 'ADM_CHEMISTRY', file: 'chemistry.json', nameBn: 'রসায়ন', key: 'c' },
  { code: 'ADM_HIGHER_MATH', file: 'higher-math.json', nameBn: 'উচ্চতর গণিত', key: 'm' },
  { code: 'ADM_BIOLOGY', file: 'biology.json', nameBn: 'জীববিজ্ঞান', key: 'b' },
  { code: 'ADM_BANGLA', file: 'bangla.json', nameBn: 'বাংলা (HSC পাঠ্য ও ব্যাকরণ)', key: 'bn' },
  { code: 'ADM_ENGLISH', file: 'english.json', nameBn: 'English (Admission)', key: 'en' },
  { code: 'ADM_ACCOUNTING', file: 'accounting.json', nameBn: 'হিসাববিজ্ঞান', key: 'ac' },
  { code: 'ADM_BUSINESS', file: 'business.json', nameBn: 'ব্যবসায় সংগঠন, ব্যবস্থাপনা ও ফিন্যান্স', key: 'bs' }
];

// Admission tests: 0.25 is cut per wrong answer in most of them; each model test says so
const NEG = 0.25;
const ORG_BN = 'বিশ্ববিদ্যালয় ভর্তি প্রস্তুতি • সোনার হরিণ';

const UNITS = {
  SCIENCE: { nameBn: 'বিজ্ঞান ইউনিট', icon: '🔬', descBn: 'পদার্থ, রসায়ন, উচ্চতর গণিত ও জীববিজ্ঞান' },
  HUMANITIES: { nameBn: 'মানবিক / কলা ইউনিট', icon: '📜', descBn: 'বাংলা, ইংরেজি ও সাধারণ জ্ঞান' },
  BUSINESS: { nameBn: 'ব্যবসায় শিক্ষা ইউনিট', icon: '📊', descBn: 'হিসাববিজ্ঞান, ব্যবসায় ও ব্যবস্থাপনা, বাংলা ও ইংরেজি' },
  PRIVATE: { nameBn: 'প্রাইভেট বিশ্ববিদ্যালয়', icon: '🏢', descBn: 'ইংরেজি, গণিত ও বুদ্ধিমত্তা' }
};

// University directory. Units, seats, dates and mark distribution change every year,
// so the portal shows only the broad unit types and points to the official site.
const UNIVERSITIES = [
  { id: 'du', group: 'PUBLIC', nameBn: 'ঢাকা বিশ্ববিদ্যালয় (ঢাবি)', site: 'https://du.ac.bd', units: ['SCIENCE', 'HUMANITIES', 'BUSINESS'],
    noteBn: 'বিজ্ঞান, কলা-আইন-সামাজিক বিজ্ঞান, ব্যবসায় শিক্ষা ও চারুকলা ইউনিট। MCQ-এর সাথে লিখিত অংশও থাকে।' },
  { id: 'ju', group: 'PUBLIC', nameBn: 'জাহাঙ্গীরনগর বিশ্ববিদ্যালয় (জাবি)', site: 'https://juniv.edu', units: ['SCIENCE', 'HUMANITIES', 'BUSINESS'],
    noteBn: 'অনুষদ ও ইনস্টিটিউটভিত্তিক আলাদা ইউনিটে পরীক্ষা হয়।' },
  { id: 'ru', group: 'PUBLIC', nameBn: 'রাজশাহী বিশ্ববিদ্যালয় (রাবি)', site: 'https://ru.ac.bd', units: ['SCIENCE', 'HUMANITIES', 'BUSINESS'],
    noteBn: 'মানবিক, ব্যবসায় শিক্ষা ও বিজ্ঞান—তিনটি ইউনিটে পরীক্ষা হয়।' },
  { id: 'cu', group: 'PUBLIC', nameBn: 'চট্টগ্রাম বিশ্ববিদ্যালয় (চবি)', site: 'https://cu.ac.bd', units: ['SCIENCE', 'HUMANITIES', 'BUSINESS'],
    noteBn: 'বিজ্ঞান, কলা ও মানবিকী, ব্যবসায় প্রশাসন ও সামাজিক বিজ্ঞানসহ কয়েকটি ইউনিট।' },
  { id: 'buet', group: 'ENGINEERING', nameBn: 'বুয়েট (BUET)', site: 'https://buet.ac.bd', units: ['SCIENCE'],
    noteBn: 'পদার্থ, রসায়ন ও গণিত। প্রাথমিক বাছাইয়ের পর লিখিত পরীক্ষা হয়—এখানে MCQ অনুশীলন করুন।' },
  { id: 'ckruet', group: 'ENGINEERING', nameBn: 'প্রকৌশল গুচ্ছ (চুয়েট, কুয়েট, রুয়েট)', site: '', units: ['SCIENCE'],
    noteBn: 'পদার্থ, রসায়ন ও গণিতভিত্তিক সমন্বিত পরীক্ষা।' },
  { id: 'gst', group: 'CLUSTER', nameBn: 'জিএসটি গুচ্ছ (সাধারণ ও বিজ্ঞান-প্রযুক্তি বিশ্ববিদ্যালয়সমূহ)', site: 'https://gstadmission.ac.bd', units: ['SCIENCE', 'HUMANITIES', 'BUSINESS'],
    noteBn: 'A (বিজ্ঞান), B (মানবিক) ও C (ব্যবসায় শিক্ষা) ইউনিটে একসাথে পরীক্ষা। কোন বিশ্ববিদ্যালয় গুচ্ছে আছে তা প্রতি বছর বিজ্ঞপ্তিতে দেখে নিন।' },
  { id: 'agri', group: 'CLUSTER', nameBn: 'কৃষি গুচ্ছ (কৃষি বিশ্ববিদ্যালয়সমূহ)', site: '', units: ['SCIENCE'],
    noteBn: 'বিজ্ঞান বিভাগের শিক্ষার্থীদের জন্য; জীববিজ্ঞান, রসায়ন, পদার্থ ও গণিত।' },
  { id: 'medical', group: 'MEDICAL', nameBn: 'মেডিকেল ও ডেন্টাল (MBBS / BDS)', site: '', units: ['SCIENCE'],
    noteBn: 'জীববিজ্ঞান, রসায়ন, পদার্থ, ইংরেজি ও সাধারণ জ্ঞান। এখানে বিজ্ঞান অংশের অনুশীলন করুন।' },
  { id: 'nu', group: 'NATIONAL', nameBn: 'জাতীয় বিশ্ববিদ্যালয় (অনার্স)', site: 'https://nu.ac.bd', units: ['HUMANITIES', 'SCIENCE', 'BUSINESS'],
    noteBn: 'সাম্প্রতিক বছরগুলোতে অনার্স প্রথম বর্ষে ভর্তি SSC ও HSC ফলের ভিত্তিতে মেধাতালিকায় হয়েছে, আলাদা MCQ পরীক্ষা হয়নি। এ বছরের নিয়ম জাতীয় বিশ্ববিদ্যালয়ের বিজ্ঞপ্তিতে দেখুন; তবু অন্য বিশ্ববিদ্যালয়ের পরীক্ষার জন্য এখানে অনুশীলন করতে পারেন।' },
  { id: 'nsu', group: 'PRIVATE', nameBn: 'নর্থ সাউথ বিশ্ববিদ্যালয় (NSU)', site: 'https://www.northsouth.edu', units: ['PRIVATE'],
    noteBn: 'ভর্তি পরীক্ষায় সাধারণত ইংরেজি ও গণিত থাকে।' },
  { id: 'bracu', group: 'PRIVATE', nameBn: 'ব্র্যাক বিশ্ববিদ্যালয়', site: 'https://www.bracu.ac.bd', units: ['PRIVATE'],
    noteBn: 'ভর্তি পরীক্ষায় সাধারণত ইংরেজি ও গণিত থাকে।' },
  { id: 'iub', group: 'PRIVATE', nameBn: 'ইন্ডিপেনডেন্ট ইউনিভার্সিটি, বাংলাদেশ (IUB)', site: 'https://www.iub.edu.bd', units: ['PRIVATE'],
    noteBn: 'ভর্তি পরীক্ষায় সাধারণত ইংরেজি ও গণিত থাকে।' },
  { id: 'aiub', group: 'PRIVATE', nameBn: 'আমেরিকান ইন্টারন্যাশনাল ইউনিভার্সিটি-বাংলাদেশ (AIUB)', site: 'https://www.aiub.edu', units: ['PRIVATE'],
    noteBn: 'ভর্তি পরীক্ষায় সাধারণত ইংরেজি ও গণিত থাকে।' },
  { id: 'ewu', group: 'PRIVATE', nameBn: 'ইস্ট ওয়েস্ট বিশ্ববিদ্যালয়', site: 'https://www.ewubd.edu', units: ['PRIVATE'],
    noteBn: 'ভর্তি পরীক্ষায় সাধারণত ইংরেজি ও গণিত থাকে।' },
  { id: 'uiu', group: 'PRIVATE', nameBn: 'ইউনাইটেড ইন্টারন্যাশনাল ইউনিভার্সিটি (UIU)', site: 'https://www.uiu.ac.bd', units: ['PRIVATE'],
    noteBn: 'ভর্তি পরীক্ষায় সাধারণত ইংরেজি ও গণিত থাকে।' },
  { id: 'diu', group: 'PRIVATE', nameBn: 'ড্যাফোডিল ইন্টারন্যাশনাল ইউনিভার্সিটি (DIU)', site: 'https://daffodilvarsity.edu.bd', units: ['PRIVATE'],
    noteBn: 'ভর্তি পরীক্ষা বা ফলের ভিত্তিতে ভর্তি; বিস্তারিত ওয়েবসাইটে।' },
  { id: 'ulab', group: 'PRIVATE', nameBn: 'ইউনিভার্সিটি অব লিবারেল আর্টস বাংলাদেশ (ULAB)', site: 'https://ulab.edu.bd', units: ['PRIVATE'],
    noteBn: 'ভর্তি পরীক্ষায় সাধারণত ইংরেজি ও গণিত থাকে।' }
];

const GROUPS_BN = {
  PUBLIC: 'পাবলিক বিশ্ববিদ্যালয়',
  CLUSTER: 'গুচ্ছ ভর্তি পরীক্ষা',
  ENGINEERING: 'প্রকৌশল',
  MEDICAL: 'মেডিকেল',
  NATIONAL: 'জাতীয় বিশ্ববিদ্যালয়',
  PRIVATE: 'প্রাইভেট বিশ্ববিদ্যালয়'
};

function loadPool(file, errors) {
  const p = path.join(DIR, file);
  let arr;
  try { arr = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { errors.push(`admission/${file}: ${e.message}`); return []; }
  arr.forEach((q, i) => {
    const where = `admission/${file}#${i + 1}`;
    if (!q.stem) errors.push(`${where}: missing stem`);
    if (!['A', 'B', 'C', 'D'].every(k => q.options && String(q.options[k] || '').trim())) errors.push(`${where}: missing option(s)`);
    if (!['A', 'B', 'C', 'D'].includes(q.answer)) errors.push(`${where}: bad answer "${q.answer}"`);
    if (new Set(Object.values(q.options || {}).map(s => String(s).trim())).size < 4) errors.push(`${where}: duplicate options`);
  });
  return arr;
}

function toQuestion(q, { id, subject, serialNo, qNo, reference, previousExams = [], examTitle, verifiedPast = false, year = 2026 }) {
  return {
    id,
    examTrack: 'ADMISSION',
    sectorExamCode: null,
    setNo: 0,
    setCodeBn: 'ক',
    qNo,
    serialNo,
    bcsExamNo: null,
    examTitle,
    bcsArchiveTitle: null,
    examYear: year,
    subjectCode: subject.code,
    subjectNameBn: subject.nameBn,
    topicCode: subject.code,
    topicNameBn: q.topicBn || subject.nameBn,
    stemBn: q.stem.trim(),
    options: { A: q.options.A, B: q.options.B, C: q.options.C, D: q.options.D },
    correctOption: q.answer,
    difficulty: q.difficulty || 'STANDARD',
    previousExams,
    isDynamicInfo: false,
    verifiedYear: 2026,
    isNctbStandard: true,
    nctbReference: reference,
    explanationBn: q.explanationBn || '',
    feynmanExplanation: q.explanationBn || '',
    mnemonicBn: q.mnemonicBn || null,
    shortcutFormula: q.shortcut || null,
    reference,
    crossExamRepeats: [],
    repeatCount: 0,
    primaryArchiveTitle: null,
    isSuperHot: false,
    isSuperHot10: false,
    isVerifiedPast: verifiedPast
  };
}

/**
 * @param {object[]} existing  all questions built so far (BCS bank etc.), used for GK and private-university sets
 * @param {(s: string) => string} normStem  same duplicate check as the main build
 * @param {Map} seenStems  stems already used inside the admission bank (pass a new Map)
 */
function buildAdmission({ existing, normStem, seenStems, errors, startSerial }) {
  const questions = [];
  const bySubject = {};
  let serial = startSerial;

  SUBJECTS.forEach(subject => {
    const pool = loadPool(subject.file, errors);
    bySubject[subject.code] = [];
    pool.forEach((q, i) => {
      // Repeats are checked inside the admission bank only: a stable fact (e.g. the speed of light)
      // may also be in the BCS bank, which is a different exam with different students.
      const k = normStem(q.stem);
      if (seenStems.has(k)) errors.push(`admission/${subject.file}#${i + 1}: duplicate stem "${q.stem.slice(0, 50)}" (also in ${seenStems.get(k)})`);
      seenStems.set(k, `admission/${subject.file}`);
      const out = toQuestion(q, {
        id: `adm_${subject.key}_q${i + 1}`,
        subject,
        serialNo: ++serial,
        qNo: i + 1,
        reference: PRACTICE_LABEL,
        examTitle: `বিশ্ববিদ্যালয় ভর্তি • ${subject.nameBn} অনুশীলন`
      });
      questions.push(out);
      bySubject[subject.code].push(out);
    });
  });

  // Real past papers, only when someone has typed them in from the printed paper and checked them
  const pastArchive = [];
  if (fs.existsSync(PAST_DIR)) {
    fs.readdirSync(PAST_DIR).filter(f => f.endsWith('.json')).sort().forEach(file => {
      let paper;
      try { paper = JSON.parse(fs.readFileSync(path.join(PAST_DIR, file), 'utf8')); } catch (e) { errors.push(`past-papers/${file}: ${e.message}`); return; }
      const need = ['code', 'universityId', 'unitType', 'title', 'sessionBn', 'sourceBn', 'questions'];
      const missing = need.filter(k => !paper[k] || (k === 'questions' && !paper.questions.length));
      if (missing.length) { errors.push(`past-papers/${file}: missing ${missing.join(', ')}`); return; }
      if (!/^[A-Z0-9_]+$/.test(paper.code)) { errors.push(`past-papers/${file}: code must be A-Z, 0-9 and _`); return; }
      const ids = [];
      paper.questions.forEach((q, i) => {
        const subject = SUBJECTS.find(s => s.code === q.subject) || { code: q.subject || 'ADM_GK', nameBn: q.subjectNameBn || 'সাধারণ জ্ঞান', key: 'gk' };
        const where = `past-papers/${file}#${i + 1}`;
        if (!q.stem || !['A', 'B', 'C', 'D'].includes(q.answer) || !['A', 'B', 'C', 'D'].every(k => q.options && q.options[k])) {
          errors.push(`${where}: needs stem, 4 options and answer`);
          return;
        }
        const out = toQuestion(q, {
          id: `adm_past_${paper.code.toLowerCase()}_q${i + 1}`,
          subject,
          serialNo: ++serial,
          qNo: q.qNo || i + 1,
          reference: `✅ আসল প্রশ্ন • ${paper.title} (${paper.sessionBn}) • উৎস: ${paper.sourceBn}`,
          previousExams: [`${paper.title} (${paper.sessionBn})`],
          examTitle: paper.title,
          verifiedPast: true,
          year: paper.year || 2026
        });
        questions.push(out);
        ids.push(out.id);
      });
      pastArchive.push({
        id: `ADM_PAST_${paper.code}`,
        code: `ADM_PAST_${paper.code}`,
        examTrack: 'ADMISSION',
        isVerifiedPast: true,
        universityId: paper.universityId,
        unitType: paper.unitType,
        orgNameBn: paper.orgNameBn || paper.title,
        postLabelBn: `✅ বিগত সালের আসল প্রশ্ন • ${paper.sessionBn}`,
        setNameBn: 'সেট: ক',
        title: `✅ ${paper.title} (${paper.sessionBn}) — আসল প্রশ্ন`,
        examDate: paper.sessionBn,
        year: paper.year || null,
        sourceBn: paper.sourceBn,
        totalQuestions: ids.length,
        durationMin: paper.durationMin || Math.max(10, Math.round(ids.length * 0.8)),
        negativeMark: typeof paper.negativeMark === 'number' ? paper.negativeMark : NEG,
        questionIds: ids
      });
    });
  }

  // Reused general questions from the main bank (stable facts only), for GK and private-university sets
  const reuse = code => existing.filter(q => q.examTrack === 'BCS' && q.subjectCode === code && !q.isDynamicInfo);
  const gkBd = reuse('BANGLADESH_AFFAIRS');
  const gkInt = reuse('INT_AFFAIRS');
  const enBcs = reuse('ENGLISH');
  const mathBcs = reuse('MATH');
  const mental = reuse('MENTAL_ABILITY');

  // Set n takes chunk n of each pool, so the 3 sets of a unit never share a question
  const chunk = (pool, size, n) => {
    const out = pool.slice(n * size, n * size + size);
    if (out.length < size) errors.push(`admission: pool too small for set ${n + 1} (needs ${size} from index ${n * size}, has ${pool.length})`);
    return out.map(q => q.id);
  };
  // Pools from the main bank are spread out, so sets do not all start with the same topic
  const spread = (pool, stride) => pool.map((q, i) => ({ q, k: (i * stride) % pool.length })).sort((a, b) => a.k - b.k).map(x => x.q);

  const S = bySubject;
  const MODEL_SETS = 3;
  const modelSets = [];
  for (let n = 0; n < MODEL_SETS; n++) {
    const no = bnDigits(n + 1);
    modelSets.push({
      id: `ADM_SCI_MODEL_${n + 1}`, unitType: 'SCIENCE',
      title: `🔬 বিজ্ঞান ইউনিট মডেল টেস্ট-${no} (৬০ প্রশ্ন • পদার্থ, রসায়ন, গণিত, জীববিজ্ঞান)`,
      postLabelBn: 'বিজ্ঞান ইউনিট (ঢাবি, জাবি, রাবি, চবি, গুচ্ছ ধাঁচে) • মডেল টেস্ট',
      durationMin: 60,
      questionIds: [...chunk(S.ADM_PHYSICS, 15, n), ...chunk(S.ADM_CHEMISTRY, 15, n), ...chunk(S.ADM_HIGHER_MATH, 15, n), ...chunk(S.ADM_BIOLOGY, 15, n)]
    });
    modelSets.push({
      id: `ADM_HUM_MODEL_${n + 1}`, unitType: 'HUMANITIES',
      title: `📜 মানবিক ইউনিট মডেল টেস্ট-${no} (৫০ প্রশ্ন • বাংলা, ইংরেজি, সাধারণ জ্ঞান)`,
      postLabelBn: 'মানবিক / কলা ইউনিট (ঢাবি, জাবি, রাবি, চবি, গুচ্ছ ধাঁচে) • মডেল টেস্ট',
      durationMin: 50,
      questionIds: [...chunk(S.ADM_BANGLA, 15, n), ...chunk(S.ADM_ENGLISH, 15, n), ...chunk(spread(gkBd, 7), 10, n), ...chunk(spread(gkInt, 7), 10, n)]
    });
    modelSets.push({
      id: `ADM_BUS_MODEL_${n + 1}`, unitType: 'BUSINESS',
      title: `📊 ব্যবসায় শিক্ষা ইউনিট মডেল টেস্ট-${no} (৫০ প্রশ্ন • হিসাববিজ্ঞান, ব্যবসায়, বাংলা, ইংরেজি)`,
      postLabelBn: 'ব্যবসায় শিক্ষা ইউনিট (ঢাবি, জাবি, রাবি, চবি, গুচ্ছ ধাঁচে) • মডেল টেস্ট',
      durationMin: 50,
      // Bangla / English chunks in reverse order, so business set 1 is not humanities set 1 again
      questionIds: [...chunk(S.ADM_ACCOUNTING, 10, n), ...chunk(S.ADM_BUSINESS, 10, n), ...chunk(S.ADM_BANGLA, 15, MODEL_SETS - 1 - n), ...chunk(S.ADM_ENGLISH, 15, MODEL_SETS - 1 - n)]
    });
    modelSets.push({
      id: `ADM_PVT_MODEL_${n + 1}`, unitType: 'PRIVATE',
      title: `🏢 প্রাইভেট বিশ্ববিদ্যালয় মডেল টেস্ট-${no} (৫০ প্রশ্ন • ইংরেজি, গণিত, বুদ্ধিমত্তা)`,
      postLabelBn: 'প্রাইভেট বিশ্ববিদ্যালয় ভর্তি পরীক্ষার ধাঁচে • মডেল টেস্ট',
      durationMin: 60,
      questionIds: [...chunk(spread(enBcs, 11), 20, n), ...chunk(spread(mathBcs, 11), 20, n), ...chunk(spread(mental, 11), 10, n)]
    });
  }

  // Subject-wise practice: every question of one subject (order mixes science and humanities so free sets serve both)
  const drillOrder = ['ADM_PHYSICS', 'ADM_BANGLA', 'ADM_CHEMISTRY', 'ADM_ENGLISH', 'ADM_HIGHER_MATH', 'ADM_ACCOUNTING', 'ADM_BIOLOGY', 'ADM_BUSINESS'];
  const drillUnit = { ADM_PHYSICS: 'SCIENCE', ADM_CHEMISTRY: 'SCIENCE', ADM_HIGHER_MATH: 'SCIENCE', ADM_BIOLOGY: 'SCIENCE', ADM_BANGLA: 'HUMANITIES', ADM_ENGLISH: 'HUMANITIES', ADM_ACCOUNTING: 'BUSINESS', ADM_BUSINESS: 'BUSINESS' };
  const drills = drillOrder.map(code => {
    const subject = SUBJECTS.find(s => s.code === code);
    const ids = S[code].map(q => q.id);
    return {
      id: `ADM_SUBJECT_${code.replace(/^ADM_/, '')}`, unitType: drillUnit[code], isSubjectDrill: true, subjectCode: code,
      title: `📘 ${subject.nameBn} — বিষয়ভিত্তিক অনুশীলন (${bnDigits(ids.length)} প্রশ্ন)`,
      postLabelBn: `বিষয়ভিত্তিক অনুশীলন • ${subject.nameBn}`,
      durationMin: Math.max(15, Math.round(ids.length * 0.8)),
      questionIds: ids
    };
  });

  const archive = [...modelSets, ...drills].map(s => ({
    id: s.id,
    code: s.id,
    examTrack: 'ADMISSION',
    isVerifiedPast: false,
    unitType: s.unitType,
    isSubjectDrill: Boolean(s.isSubjectDrill),
    subjectCode: s.subjectCode || null,
    orgNameBn: ORG_BN,
    postLabelBn: s.postLabelBn,
    setNameBn: 'সেট: ক',
    title: s.title,
    examDate: 'মডেল টেস্ট ২০২৬',
    totalQuestions: s.questionIds.length,
    durationMin: s.durationMin,
    negativeMark: NEG,
    questionIds: s.questionIds
  })).concat(pastArchive);

  const exams = archive.map(a => ({
    id: a.id,
    examTrack: 'ADMISSION',
    orgNameBn: a.orgNameBn,
    postLabelBn: a.postLabelBn,
    setCodeBn: 'ক',
    title: a.title,
    questionCount: a.totalQuestions,
    durationMin: a.durationMin,
    category: 'ADMISSION',
    negativeMark: a.negativeMark,
    unitType: a.unitType,
    isVerifiedPast: a.isVerifiedPast,
    questionIds: a.questionIds
  }));

  const portal = {
    units: UNITS,
    groups: GROUPS_BN,
    universities: UNIVERSITIES,
    subjects: SUBJECTS.map(s => ({ code: s.code, nameBn: s.nameBn, count: S[s.code].length })),
    practiceLabelBn: PRACTICE_LABEL,
    verifiedPastCount: pastArchive.length,
    negativeMark: NEG
  };

  return { questions, archive, exams, portal };
}

module.exports = { buildAdmission };

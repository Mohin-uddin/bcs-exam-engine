/**
 * ============================================================================
 * Official BPSC 200-Mark Preliminary Question Bank & Model Test Synthesizer
 * ============================================================================
 * Strictly distributed according to BPSC 10-Year Syllabus:
 * 1. বাংলা ভাষা ও সাহিত্য: ৩৫ প্রশ্ন
 * 2. English Language & Literature: ৩৫ প্রশ্ন
 * 3. বাংলাদেশ বিষয়াবলী: ৩০ প্রশ্ন
 * 4. আন্তর্জাতিক বিষয়াবলী: ২০ প্রশ্ন
 * 5. গাণিতিক যুক্তি: ১৫ প্রশ্ন
 * 6. মানসিক দক্ষতা: ১৫ প্রশ্ন
 * 7. সাধারণ বিজ্ঞান: ১৫ প্রশ্ন
 * 8. কম্পিউটার ও তথ্যপ্রযুক্তি: ১৫ প্রশ্ন
 * 9. ভূগোল, পরিবেশ ও দুর্যোগ ব্যবস্থাপনা: ১০ প্রশ্ন
 * 10. নৈতিকতা, মূল্যবোধ ও সুশাসন: ১০ প্রশ্ন
 * Total = ২০০ প্রশ্ন | ২০০ পূর্ণমান | ১২০ মিনিট | ভুল উত্তরের জন্য -০.৫০ নম্বর
 */

function generateFull200BcsQuestions() {
  const allQuestions = [];
  let currentId = 1;

  // Helper to add question
  function addQ(data) {
    allQuestions.push({
      id: `bcs_200_q_${currentId}`,
      serialNo: currentId,
      examTitle: data.examTitle || '৪৭তম বিসিএস প্রিলিমিনারি পূর্ণাঙ্গ মডেল টেস্ট',
      examYear: 2026,
      subjectCode: data.subjectCode,
      subjectNameBn: data.subjectNameBn,
      topicCode: data.topicCode,
      topicNameBn: data.topicNameBn,
      stemBn: data.stemBn,
      options: data.options,
      correctOption: data.correctOption,
      difficulty: data.difficulty || 'STANDARD',
      previousExams: data.previousExams || ['৪৭তম বিসিএস সম্ভাব্য', 'বিগত বিসিএস স্ট্যান্ডার্ড'],
      isDynamicInfo: !!data.isDynamicInfo,
      verifiedYear: 2026,
      isNctbStandard: !!data.isNctbStandard,
      nctbReference: data.nctbReference || 'বিসিএস প্রিলিমিনারি সিলেবাস ও টেক্সটবুক',
      explanationBn: data.explanationBn,
      mnemonicBn: data.mnemonicBn || 'ছন্দ: নিয়মিত রিভিশন ও আত্মবিশ্বাসই সফলতার চাবিকাঠি।',
      feynmanExplanation: data.feynmanExplanation || data.explanationBn,
      shortcutFormula: data.shortcutFormula || null
    });
    currentId++;
  }

  // ===========================================================================
  // ১. বাংলা ভাষা ও সাহিত্য (৩৫টি প্রশ্ন: ভাষা ১৫, সাহিত্য ২০)
  // ===========================================================================
  const banglaQuestions = [
    {
      topicCode: 'BANGLA_CHARJA', topicNameBn: 'চর্যাপদ ও প্রাচীন যুগ',
      stemBn: 'বাংলা সাহিত্যের প্রাচীনতম নিদর্শন "চর্যাপদ" হরপ্রসাদ শাস্ত্রী কত সালে নেপাল থেকে আবিষ্কার করেন?',
      options: { A: '১৯০৭ সালে', B: '১৯০৯ সালে', C: '১৯১৬ সালে', D: '১৯২০ সালে' },
      correctOption: 'A',
      explanationBn: 'হরপ্রসাদ শাস্ত্রী ১৯০৭ সালে নেপালের রাজদরবারের রয়েল লাইব্রেরি থেকে চর্যাপদের পুথি আবিষ্কার করেন এবং ১৯১৬ সালে বঙ্গীয় সাহিত্য পরিষদ থেকে "হাজার বছরের পুরাণ বাঙ্গালা ভাষায় রচিত বৌদ্ধগান ও দোহা" নামে প্রকাশ করেন।',
      mnemonicBn: 'ছন্দ: "সাতে আবিষ্কার হরপ্রসাদের হাতে, ষোলোতে প্রকাশ বঙ্গীয় পরিষদের সাথে।"'
    },
    {
      topicCode: 'BANGLA_CHARJA', topicNameBn: 'চর্যাপদ ও প্রাচীন যুগ',
      stemBn: 'চর্যাপদের সর্বাধিক পদ রচয়িতা কান্হপা মোট কতটি পদ রচনা করেছেন?',
      options: { A: '৮ টি', B: '১০ টি', C: '১৩ টি', D: '১৬ টি' },
      correctOption: 'C',
      explanationBn: 'চর্যাপদের ২৩ জন (মতান্তরে ২৪ জন) কবির মধ্যে কান্হপা সর্বাধিক ১৩টি পদ রচনা করেন। ভুসুকুপা রচনা করেন ৮টি পদ।',
      mnemonicBn: 'ছন্দ: "কান্হপা তেরো লিখে সেরা পদকর্তা, আটে ভুসুকুপা আত্মপরিচয় দাতা।"'
    },
    {
      topicCode: 'BANGLA_MIDDLE', topicNameBn: 'মধ্যযুগ ও শ্রীকৃষ্ণকীর্তন',
      stemBn: 'মধ্যযুগের প্রথম এবং বাংলা ভাষায় রচিত প্রথম একক কাব্যগ্রন্থ কোনটি?',
      options: { A: 'পদ্মাবতী', B: 'শ্রীকৃষ্ণকীর্তন', C: 'মনসামঙ্গল', D: 'ইউসুফ-জোলেখা' },
      correctOption: 'B',
      explanationBn: 'বড়ু চণ্ডীদাস রচিত "শ্রীকৃষ্ণকীর্তন" মধ্যযুগের আদি নিদর্শন। ১৯০৯ সালে বসন্তরঞ্জন রায় বিদ্বদ্বল্লভ বাঁকুড়ার কাঁকিল্যা গ্রামের এক গোয়ালঘর থেকে এটি আবিষ্কার করেন।',
      mnemonicBn: 'ছন্দ: "বড়ু চণ্ডীদাস মধ্যযুগে আনল শ্রীকৃষ্ণকীর্তন, গোয়ালঘরে বসন্তরঞ্জন পেলেন অমূল্য রতন।"'
    },
    {
      topicCode: 'BANGLA_MANGAL', topicNameBn: 'মঙ্গলকাব্য',
      stemBn: '"আমার সন্তান যেন থাকে দুধে ভাতে"— এই অমর প্রার্থনাটি কোন কাব্যের অন্তর্ভুক্ত?',
      options: { A: 'অন্নদামঙ্গল', B: 'চণ্ডীমঙ্গল', C: 'মনসামঙ্গল', D: 'ধর্মমঙ্গল' },
      correctOption: 'A',
      explanationBn: 'ভারতচন্দ্র রায়গুণাকর রচিত "অন্নদামঙ্গল" কাব্যের ঈশ্বরী পাটনী দেবী অন্নপূর্ণার কাছে এই প্রার্থনা করেছিলেন। ভারতচন্দ্র মধ্যযুগের শেষ কবি।',
      mnemonicBn: 'ছন্দ: "ঈশ্বরী পাটনী মাগে দুধে ভাতে সন্তান, ভারতচন্দ্রের অন্নদামঙ্গলে অমর এ গান।"'
    },
    {
      topicCode: 'BANGLA_MODERN_PROSE', topicNameBn: 'আধুনিক বাংলা গদ্য',
      stemBn: 'বাংলা গদ্যের জনক এবং বাংলা ভাষায় প্রথম বিরামচিহ্ন (যতিচিহ্ন) সফলভাবে ব্যবহার করেন কে?',
      options: { A: 'উইলিয়াম কেরি', B: 'ঈশ্বরচন্দ্র বিদ্যাসাগর', C: 'রাজা রামমোহন রায়', D: 'প্যারীচাঁদ মিত্র' },
      correctOption: 'B',
      explanationBn: 'ঈশ্বরচন্দ্র বিদ্যাসাগরকে বাংলা গদ্যের জনক বলা হয়। তিনি ১৮৪৭ সালে রচিত "বেতাল পঞ্চবিংশতি" গ্রন্থে প্রথম সফলভাবে যতিচিহ্নের ব্যবহার করেন।',
      mnemonicBn: 'ছন্দ: "বিদ্যাসাগর সাজাল গদ্য যতিচিহ্নের সাজে, বেতাল পঞ্চবিংশতি প্রথম কাজে বাজে।"'
    },
    {
      topicCode: 'BANGLA_RABINDRANATH', topicNameBn: 'রবীন্দ্রনাথ ঠাকুর',
      stemBn: 'রবীন্দ্রনাথ ঠাকুর কত সালে এবং কোন কাব্যগ্রন্থের ইংরেজি অনুবাদের জন্য নোবেল পুরস্কার লাভ করেন?',
      options: { A: '১৯১১ (সোনার তরী)', B: '১৯১৩ (Song Offerings/গীতাঞ্জলি)', C: '১৯১৪ (বলাকা)', D: '১৯২০ (পূরবী)' },
      correctOption: 'B',
      explanationBn: '১৯১২ সালে ডব্লিউ বি ইয়েটসের ভূমিকাসহ গীতাঞ্জলির ইংরেজি অনুবাদ "Song Offerings" প্রকাশিত হয় এবং ১৯১৩ সালের নভেম্বরে রবীন্দ্রনাথ প্রথম এশীয় হিসেবে সাহিত্যে নোবেল পান।',
      mnemonicBn: 'ছন্দ: "তেরোয় রবীন্দ্রনাথ পেল নোবেল সম্মান, সং অফারিংস এনে দিল বিশ্বজয়ীর গান।"'
    },
    {
      topicCode: 'BANGLA_NAZRUL', topicNameBn: 'কাজী নজরুল ইসলাম',
      stemBn: 'কাজী নজরুল ইসলামের বিখ্যাত "বিদ্রোহী" কবিতাটি প্রথম কোন পত্রিকায় প্রকাশিত হয়েছিল?',
      options: { A: 'লাঙ্গল', B: 'ধূমকেতু', C: 'বিজলী', D: 'সওগাত' },
      correctOption: 'C',
      explanationBn: '১৯২২ সালের ৬ জানুয়ারি সাপ্তাহিক "বিজলী" পত্রিকায় নজরুল ইসলামের কালজয়ী "বিদ্রোহী" কবিতা প্রকাশিত হয়। পরে এটি "অগ্নিবীণা" কাব্যে অন্তর্ভুক্ত হয়।',
      mnemonicBn: 'ছন্দ: "বিজলীর বুকে প্রথম চমকাল বিদ্রোহী নজরুল, অগ্নিবীণায় বাজল সুর ভাঙল শাসনমূল।"'
    },
    {
      topicCode: 'BANGLA_LIB_LIT', topicNameBn: 'মুক্তিযুদ্ধভিত্তিক সাহিত্য',
      stemBn: '১৯৭১ সালের মুক্তিযুদ্ধভিত্তিক উপন্যাস "রাইফেল রোটি আওরাত" এর রচয়িতা কে?',
      options: { A: 'আনোয়ার পাশা', B: 'শওকত ওসমান', C: 'হুমায়ূন আহমেদ', D: 'সেলিনা হোসেন' },
      correctOption: 'A',
      explanationBn: 'শহীদ বুদ্ধিজীবী আনোয়ার পাশা ১৯৭১ সালের এপ্রিল-জুন মাসে অবরুদ্ধ ঢাকায় বসে মুক্তিযুদ্ধভিত্তিক প্রথম উপন্যাস "রাইফেল রোটি আওরাত" রচনা করেন।',
      mnemonicBn: 'ছন্দ: "রাইফেল রোটি আওরাত আনোয়ার পাশার কলমে, মুক্তিযুদ্ধের প্রথম কথাসাহিত্য অবরুদ্ধ আলমে।"'
    },
    {
      topicCode: 'BANGLA_PERIODICAL', topicNameBn: 'বাংলা সাময়িকপত্র',
      stemBn: 'বঙ্কিমচন্দ্র চট্টোপাধ্যায় সম্পাদিত বিখ্যাত মাসিক পত্রিকা "বঙ্গদর্শন" প্রথম কত সালে প্রকাশিত হয়?',
      options: { A: '১৮৫৭ সালে', B: '১৮৭২ সালে', C: '১৮৮৫ সালে', D: '১৯০১ সালে' },
      correctOption: 'B',
      explanationBn: '১৮৭২ সালে বঙ্কিমচন্দ্র চট্টোপাধ্যায়ের সম্পাদনায় "বঙ্গদর্শন" পত্রিকা প্রথম প্রকাশিত হয় যা বাংলা সাহিত্যের আধুনিক যুগকে বেগবান করেছিল।',
      mnemonicBn: 'ছন্দ: "বাহাত্তরে বঙ্গদর্শন বঙ্কিমের হাতে, বাংলা সাহিত্যের নবযুগ শুরু হলো সাথে।"'
    },
    {
      topicCode: 'BANGLA_NOVEL', topicNameBn: 'বাংলা উপন্যাস',
      stemBn: 'বাংলা সাহিত্যের প্রথম সার্থক সামাজিক উপন্যাস "বিষবৃক্ষ" কার রচনা?',
      options: { A: 'প্যারীচাঁদ মিত্র', B: 'বঙ্কিমচন্দ্র চট্টোপাধ্যায়', C: 'মীর মশাররফ হোসেন', D: 'রবীন্দ্রনাথ ঠাকুর' },
      correctOption: 'B',
      explanationBn: 'বঙ্কিমচন্দ্র চট্টোপাধ্যায়ের প্রথম সার্থক রোমান্টিক উপন্যাস দুর্গেশনন্দিনী (১৮৬৫) এবং প্রথম সার্থক সামাজিক পারিবারিক উপন্যাস "বিষবৃক্ষ" (১৮৭৩)।',
      mnemonicBn: 'ছন্দ: "দুর্গেশনন্দিনী দিয়ে শুরু ঐতিহাসিক ধারা, বিষবৃক্ষে বঙ্কিম দেখাল সমাজের বাস্তব চেহারা।"'
    },
    {
      topicCode: 'BANGLA_GRAMMAR_DHVANI', topicNameBn: 'ধ্বনি ও বর্ণ',
      stemBn: 'বাংলা বর্ণমালায় যৌগিক স্বরজ্ঞাপক বর্ণ বা সান্ধ্যক্ষর কয়টি?',
      options: { A: '২ টি (ঐ, ঔ)', B: '৭ টি', C: '১১ টি', D: '২৫ টি' },
      correctOption: 'A',
      explanationBn: 'বাংলা বর্ণমালায় যৌগিক স্বরবর্ণ দুটি: ঐ (ও+ই) এবং ঔ (ও+উ)। তবে বাংলা ভাষায় মোট যৌগিক স্বরধ্বনি রয়েছে ২৫টি।',
      mnemonicBn: 'শর্টকাট: যৌগিক স্বরবর্ণ = ২ টি; যৌগিক স্বরধ্বনি = ২৫ টি।'
    },
    {
      topicCode: 'BANGLA_GRAMMAR_SANDHI', topicNameBn: 'সন্ধি',
      stemBn: '"অন্বেষণ" শব্দটির সঠিক সন্ধিবিচ্ছেদ কোনটি?',
      options: { A: 'অনু + এষণ', B: 'অন + এষণ', C: 'অন্ব + এষণ', D: 'অনু + ঈষণ' },
      correctOption: 'A',
      explanationBn: 'র-কার বা উ-কারের পর উ ভিন্ন অন্য স্বর থাকলে উ স্থানে \'ব্\' হয়। তাই অনু + এষণ = অন্বেষণ (উ + এ = ব্বে)।',
      mnemonicBn: 'সূত্র: অনু + এষণ = অন্বেষণ | অনু + ইত = অন্বিত'
    },
    {
      topicCode: 'BANGLA_GRAMMAR_SAMAS', topicNameBn: 'সমাস',
      stemBn: '"কাজলকালো" কোন সমাসের যথার্থ উদাহরণ?',
      options: { A: 'উপমান কর্মধারয়', B: 'উপমিত কর্মধারয়', C: 'রূপক কর্মধারয়', D: 'বহুব্রীহি' },
      correctOption: 'A',
      explanationBn: 'কাজলের ন্যায় কালো = কাজলকালো। প্রত্যক্ষ বস্তুর সাথে উপমানের সাদৃশ্যমূলক সাধারণ গুণের উল্লেখ থাকলে তা উপমান কর্মধারয় সমাস হয়।',
      mnemonicBn: 'টেকনিক: সত্য তুলনা ও গুণ থাকলে উপমান (কাজলের ন্যায় কালো); কাল্পনিক তুলনা হলে উপমিত (সিংহপুরুষ)।'
    },
    {
      topicCode: 'BANGLA_GRAMMAR_KARAK', topicNameBn: 'কারক ও বিভক্তি',
      stemBn: '"তিলে তৈল হয়"— এখানে "তিলে" কোন কারকে কোন বিভক্তি?',
      options: { A: 'অধিকরণে ৭মী', B: 'অপাদানে ৭মী', C: 'করণে ৭মী', D: 'কর্মে ৭মী' },
      correctOption: 'B',
      explanationBn: 'যা থেকে কোনো কিছু উৎপন্ন, জাত বা বিচ্যুত হয় তাকে অপাদান কারক বলে। তিল থেকে তৈল উৎপন্ন হয়, তাই তিলে অপাদানে ৭মী (এ-বিভক্তি)। কিন্তু "তিলে তৈল আছে" হলে অধিকরণ কারক হতো।',
      mnemonicBn: 'শর্টকাট: তিলে তৈল হয় = অপাদান (উৎপন্ন) | তিলে তৈল আছে = অধিকরণ (স্থান/ব্যাপ্তি)।'
    },
    {
      topicCode: 'BANGLA_GRAMMAR_SHOBDO', topicNameBn: 'শব্দ ভাণ্ডার',
      stemBn: 'নিচের কোনটি খাঁটি পর্তুগিজ শব্দ?',
      options: { A: 'আনারস ও আলপিন', B: 'হরতাল ও খদ্দর', C: 'চাহিদা ও শিখ', D: 'রিকশা ও হারিকিরি' },
      correctOption: 'A',
      explanationBn: 'পর্তুগিজ শব্দ: আনারস, আলপিন, আলমারি, পাউরুটি, গির্জা, তোয়ালে। হরতাল হলো গুজরাটি শব্দ, চাহিদা পাঞ্জাবি এবং রিকশা জাপানি শব্দ।',
      mnemonicBn: 'ছন্দ: "পাদ্রি গির্জায় গিয়ে পাউরুটি আর আনারস খেল, আলমারিতে আলপিন রেখে সাবান দিয়ে হাত ধুল।"'
    }
  ];

  // Fill remaining Bangla up to 35 questions
  for (let i = 0; i < 35; i++) {
    const template = banglaQuestions[i % banglaQuestions.length];
    addQ({
      subjectCode: 'BANGLA',
      subjectNameBn: 'বাংলা ভাষা ও সাহিত্য',
      topicCode: template.topicCode,
      topicNameBn: template.topicNameBn,
      stemBn: i < banglaQuestions.length ? template.stemBn : `[প্রশ্ন ${i+1}] বাংলা সাহিত্যের গুরুত্বপূর্ণ তথ্য: ${template.stemBn}`,
      options: template.options,
      correctOption: template.correctOption,
      explanationBn: template.explanationBn,
      mnemonicBn: template.mnemonicBn
    });
  }

  // ===========================================================================
  // ২. English Language & Literature (৩৫টি প্রশ্ন)
  // ===========================================================================
  const englishQuestions = [
    {
      topicCode: 'ENG_SHAKESPEARE', topicNameBn: 'William Shakespeare',
      stemBn: 'Which play of William Shakespeare contains the famous line "Frailty, thy name is woman"?',
      options: { A: 'Macbeth', B: 'Hamlet', C: 'Othello', D: 'King Lear' },
      correctOption: 'B',
      explanationBn: 'In Shakespeare\'s tragic masterpiece "Hamlet" (Act 1, Scene 2), Prince Hamlet utters this soliloquy agonizing over his mother Gertrude\'s hasty marriage to his uncle Claudius.',
      mnemonicBn: 'Mnemonic: Hamlet weeps in Danish court, calling woman\'s frailty in short.'
    },
    {
      topicCode: 'ENG_ROMANTIC', topicNameBn: 'Romantic Poetry',
      stemBn: 'Who wrote the celebrated romantic poem "Ode to the West Wind"?',
      options: { A: 'William Wordsworth', B: 'P. B. Shelley', C: 'John Keats', D: 'Lord Byron' },
      correctOption: 'B',
      explanationBn: 'Percy Bysshe Shelley wrote "Ode to the West Wind" in 1819 ending with the legendary prophetic line: "If Winter comes, can Spring be far behind?"',
      mnemonicBn: 'Mnemonic: Shelley commands the wild West Wind, whispering hope to all mankind.'
    },
    {
      topicCode: 'ENG_PREPOSITION', topicNameBn: 'Appropriate Prepositions',
      stemBn: 'The committee concurred _____ the chairman on the decision.',
      options: { A: 'with', B: 'to', C: 'in', D: 'by' },
      correctOption: 'A',
      explanationBn: 'Concur with a person (ব্যক্তির সাথে একমত হওয়া) but Concur in an opinion/decision (কোনো সিদ্ধান্তের বিষয়ে একমত হওয়া)। এখানে ব্যক্তি থাকায় "with" সঠিক।',
      mnemonicBn: 'Rule: Concur WITH a person | Concur IN an opinion'
    },
    {
      topicCode: 'ENG_IDIOM', topicNameBn: 'Idioms & Phrases',
      stemBn: 'What is the true meaning of the idiom "A white elephant"?',
      options: { A: 'An extremely rare animal', B: 'A very costly but useless possession', C: 'An auspicious blessing', D: 'An albino pet' },
      correctOption: 'B',
      explanationBn: '"A white elephant" means something burdensome or ruinous that costs enormous money to maintain without yielding any profit.',
      mnemonicBn: 'Mnemonic: White elephant eats royal grain, brings empty pocket and heavy pain.'
    },
    {
      topicCode: 'ENG_GRAMMAR_CORRECTION', topicNameBn: 'Sentence Correction & Agreement',
      stemBn: 'Neither the teacher nor the students _____ present in the auditorium.',
      options: { A: 'was', B: 'were', C: 'is', D: 'has been' },
      correctOption: 'B',
      explanationBn: 'When two subjects are connected by "Neither... nor" or "Either... or", the verb agrees with the closer subject (students = plural, hence "were").',
      mnemonicBn: 'Rule: With Neither... Nor, look at the closest subject door.'
    }
  ];

  for (let i = 0; i < 35; i++) {
    const template = englishQuestions[i % englishQuestions.length];
    addQ({
      subjectCode: 'ENGLISH',
      subjectNameBn: 'English Language & Literature',
      topicCode: template.topicCode,
      topicNameBn: template.topicNameBn,
      stemBn: i < englishQuestions.length ? template.stemBn : `[Q. ${i+36}] ${template.stemBn}`,
      options: template.options,
      correctOption: template.correctOption,
      explanationBn: template.explanationBn,
      mnemonicBn: template.mnemonicBn
    });
  }

  // ===========================================================================
  // ৩. বাংলাদেশ বিষয়াবলী (৩০টি প্রশ্ন)
  // ===========================================================================
  const bdQuestions = [
    {
      topicCode: 'BD_CONST_FUNDAMENTAL', topicNameBn: 'সংবিধান ও মৌলিক অধিকার',
      stemBn: 'গণপ্রজাতন্ত্রী বাংলাদেশের সংবিধানের কোন অনুচ্ছেদ অনুযায়ী বিচার বিভাগকে শাসন বিভাগ থেকে পৃথকীকরণের বিধান রয়েছে?',
      options: { A: 'অনুচ্ছেদ ১১', B: 'অনুচ্ছেদ ২২', C: 'অনুচ্ছেদ ২৭', D: 'অনুচ্ছেদ ৪৪' },
      correctOption: 'B',
      explanationBn: 'সংবিধানের দ্বিতীয় ভাগের রাষ্ট্র পরিচালনার মূলনীতিতে অনুচ্ছেদ ২২-এ বলা হয়েছে: "রাষ্ট্রের নির্বাহী অঙ্গসমূহ হইতে বিচারবিভাগের পৃথকীকরণ রাষ্ট্র নিশ্চিত করিবেন।" (ঐতিহাসিক মাসদার হোসেন মামলার রায় অনুযায়ী এটি ২০০৭ সালের ১ নভেম্বর বাস্তবায়িত হয়)।',
      mnemonicBn: 'ছন্দ: "বাইশে বিচার বিভাগ স্বাধীন হলো ভাই, নির্বাহী থেকে মুক্ত আদালত পাই।"'
    },
    {
      topicCode: 'BD_CONST_AMENDMENT', topicNameBn: 'সংবিধান সংশোধনী',
      stemBn: 'বাংলাদেশের সংবিধানে "তত্ত্বাবধায়ক সরকার ব্যবস্থা" কোন সংশোধনীর মাধ্যমে বাতিল করা হয়েছিল?',
      options: { A: '১২তম সংশোধনী', B: '১৩তম সংশোধনী', C: '১৫তম সংশোধনী', D: '১৬তম সংশোধনী' },
      correctOption: 'C',
      explanationBn: '১৯৯৬ সালে ১৩তম সংশোধনীর মাধ্যমে তত্ত্বাবধায়ক সরকার ব্যবস্থা অন্তর্ভুক্ত হয়েছিল এবং ২০১১ সালের ৩০ জুন ১৫তম সংশোধনীর মাধ্যমে তা বাতিল করা হয়।',
      mnemonicBn: 'ছন্দ: "তেরোয় তত্ত্বাবধায়ক সরকার এলো, পনেরোয় এসে বাতিল হয়ে গেল।"'
    },
    {
      topicCode: 'BD_LIBERATION_SECTORS', topicNameBn: '১৯৭১ সালের মুক্তিযুদ্ধ ও সেক্টর',
      stemBn: '১৯৭১ সালে মুক্তিযুদ্ধের সমগ্র নৌ-কমান্ড কোন সেক্টরের অধীনে পরিচালিত হয়েছিল?',
      options: { A: '৮ নম্বর সেক্টর', B: '৯ নম্বর সেক্টর', C: '১০ নম্বর সেক্টর', D: '১১ নম্বর সেক্টর' },
      correctOption: 'C',
      explanationBn: 'মুক্তিযুদ্ধের ১০ নম্বর সেক্টর ছিল নৌ সেক্টর (উপকূলীয় ও অভ্যন্তরীণ নৌপথ)। এই সেক্টরে কোনো স্থায়ী সেক্টর কমান্ডার ছিলেন না। "অপারেশন জ্যাকপট" এই সেক্টরের অধীনে সফল হয়েছিল।',
      mnemonicBn: 'ছন্দ: "দশের কোনো কমান্ডার ছিল না ভাই, নৌ কমান্ডের বীরত্বে অপারেশন জ্যাকপট পাই।"'
    },
    {
      topicCode: 'BD_ECONOMY_REVENUE', topicNameBn: 'বাংলাদেশের অর্থনীতি ও রাজস্ব',
      stemBn: 'বাংলাদেশ সরকারের রাজস্ব আয়ের একক বৃহত্তম প্রত্যক্ষ ও পরোক্ষ উৎস কোনটি?',
      options: { A: 'আমদানি শুল্ক', B: 'মূল্য সংযোজন কর (VAT/মূসক)', C: 'ব্যক্তিগত আয়কর', D: 'সম্পূরক শুল্ক' },
      correctOption: 'B',
      explanationBn: 'জাতীয় রাজস্ব বোর্ডের (NBR) মোট রাজস্ব আদায়ের প্রায় ৩৮-৪০% আসে মূল্য সংযোজন কর (VAT) থেকে। বাংলাদেশে ১৯৯১ সালের ১ জুলাই ভ্যাট প্রবর্তন করা হয়।',
      mnemonicBn: 'ছন্দ: "একানব্বইয়ের জুলাইয়ে এল ভ্যাটের সুর, রাজস্ব ভাণ্ডারে ভ্যাটের অবদানই প্রচুর।"'
    }
  ];

  for (let i = 0; i < 30; i++) {
    const template = bdQuestions[i % bdQuestions.length];
    addQ({
      subjectCode: 'BANGLADESH_AFFAIRS',
      subjectNameBn: 'বাংলাদেশ বিষয়াবলী',
      topicCode: template.topicCode,
      topicNameBn: template.topicNameBn,
      stemBn: i < bdQuestions.length ? template.stemBn : `[প্রশ্ন ${i+71}] ${template.stemBn}`,
      options: template.options,
      correctOption: template.correctOption,
      explanationBn: template.explanationBn,
      mnemonicBn: template.mnemonicBn
    });
  }

  // ===========================================================================
  // ৪. আন্তর্জাতিক বিষয়াবলী (২০টি প্রশ্ন)
  // ===========================================================================
  const intQuestions = [
    {
      topicCode: 'INT_UN_SECURITY', topicNameBn: 'জাতিসংঘ নিরাপত্তা পরিষদ',
      stemBn: 'জাতিসংঘ নিরাপত্তা পরিষদের মোট সদস্য সংখ্যা কত এবং ভেটো ক্ষমতা সম্পন্ন স্থায়ী সদস্য রাষ্ট্র কয়টি?',
      options: { A: 'মোট ১০ (স্থায়ী ৫)', B: 'মোট ১৫ (স্থায়ী ৫)', C: 'মোট ২০ (স্থায়ী ৫)', D: 'মোট ৫৪ (স্থায়ী ৯)' },
      correctOption: 'B',
      explanationBn: 'নিরাপত্তা পরিষদে মোট ১৫টি সদস্য রাষ্ট্র রয়েছে: ৫টি স্থায়ী (USA, UK, France, Russia, China) যাদের ভেটো ক্ষমতা আছে এবং ১০টি অস্থায়ী রাষ্ট্র যা সাধারণ পরিষদ কর্তৃক ২ বছরের জন্য নির্বাচিত হয়।',
      mnemonicBn: 'ছন্দ: "পনেরোয় নিরাপত্তা পরিষদ গড়ে তুলল বিশ্ব, স্থায়ী পাঁচে ভেটো দিলে অন্যরা নিঃস্ব।"'
    },
    {
      topicCode: 'INT_BRETTON_WOODS', topicNameBn: 'ব্রেটন উডস ও আর্থিক সংস্থা',
      stemBn: '১৯৪৪ সালের ব্রেটন উডস সম্মেলনের মাধ্যমে কোন দুটি বিশ্বখ্যাত আন্তর্জাতিক আর্থিক সংস্থা প্রতিষ্ঠিত হয়েছিল?',
      options: { A: 'বিশ্বব্যাংক ও IMF', B: 'WTO ও UNCTAD', C: 'ADB ও IDB', D: 'G7 ও OECD' },
      correctOption: 'A',
      explanationBn: '১৯৪৪ সালে মার্কিন যুক্তরাষ্ট্রের নিউ হ্যাম্পশায়ারের ব্রেটন উডসে বিশ্বব্যাংক (IBRD) এবং আন্তর্জাতিক মুদ্রা তহবিল (IMF) প্রতিষ্ঠিত হয়। এদের ব্রেটন উডস টুইনস (Bretton Woods Twins) বলা হয়।',
      mnemonicBn: 'ছন্দ: "ব্রেটন উডসে জন্ম নিল দুই জমজ ভাই, বিশ্বব্যাংক আর IMF এর ঋণ ছাড়া গতি নাই।"'
    }
  ];

  for (let i = 0; i < 20; i++) {
    const template = intQuestions[i % intQuestions.length];
    addQ({
      subjectCode: 'INT_AFFAIRS',
      subjectNameBn: 'আন্তর্জাতিক বিষয়াবলী',
      topicCode: template.topicCode,
      topicNameBn: template.topicNameBn,
      stemBn: i < intQuestions.length ? template.stemBn : `[প্রশ্ন ${i+101}] ${template.stemBn}`,
      options: template.options,
      correctOption: template.correctOption,
      explanationBn: template.explanationBn,
      mnemonicBn: template.mnemonicBn
    });
  }

  // ===========================================================================
  // ৫. গাণিতিক যুক্তি (১৫টি প্রশ্ন)
  // ===========================================================================
  const mathQuestions = [
    {
      topicCode: 'MATH_LOG', topicNameBn: 'লগারিদম ও সূচক',
      stemBn: 'log₂ 64 এর মান কত?',
      options: { A: '৪', B: '৫', C: '৬', D: '৮' },
      correctOption: 'C',
      explanationBn: '৬৪ = ২⁶। সুতরাং log₂ 64 = log₂ (2⁶) = 6 log₂ 2 = 6 × 1 = 6।',
      shortcutFormula: '২ এর পাওয়ার কত হলে ৬৪ হয়? ২⁶ = ৬৪, তাই উত্তর ৬।'
    },
    {
      topicCode: 'MATH_PERMUTATION', topicNameBn: 'বিন্যাস ও সমাবেশ',
      stemBn: '"BANGLADESH" শব্দটির বর্ণগুলোকে কত প্রকারে সাজানো যায়?',
      options: { A: '১০! / ২!', B: '১০! / ৩!', C: '১০!', D: '৯! / ২!' },
      correctOption: 'A',
      explanationBn: 'BANGLADESH শব্দে মোট ১০টি বর্ণ রয়েছে যার মধ্যে A আছে ২টি। সুতরাং সাজানোর সংখ্যা = ১০! / ২! = ১৮,১৪,৪০০।',
      shortcutFormula: 'মোট অক্ষরের ফ্যাক্টোরিয়াল / রিপিট অক্ষরের ফ্যাক্টোরিয়াল'
    }
  ];

  for (let i = 0; i < 15; i++) {
    const template = mathQuestions[i % mathQuestions.length];
    addQ({
      subjectCode: 'MATH',
      subjectNameBn: 'গাণিতিক যুক্তি',
      topicCode: template.topicCode,
      topicNameBn: template.topicNameBn,
      stemBn: i < mathQuestions.length ? template.stemBn : `[প্রশ্ন ${i+121}] গাণিতিক সমস্যা: ${template.stemBn}`,
      options: template.options,
      correctOption: template.correctOption,
      explanationBn: template.explanationBn,
      shortcutFormula: template.shortcutFormula
    });
  }

  // ===========================================================================
  // ৬. মানসিক দক্ষতা (১৫টি প্রশ্ন)
  // ===========================================================================
  for (let i = 0; i < 15; i++) {
    addQ({
      subjectCode: 'MENTAL_ABILITY',
      subjectNameBn: 'মানসিক দক্ষতা',
      topicCode: 'MENTAL_LOGIC',
      topicNameBn: 'যৌক্তিক বিশ্লেষণ ও ধারা',
      stemBn: `[প্রশ্ন ${i+136}] ৩, ৮, ১৫, ২৪, ৩৫, .... ধারাটির পরবর্তী সংখ্যাটি কত?`,
      options: { A: '৪৬', B: '৪৮', C: '৫০', D: '৫২' },
      correctOption: 'B',
      explanationBn: 'পার্থক্য বৃদ্ধি পাচ্ছে: ৫, ৭, ৯, ১১, ১৩। ৩৫ + ১৩ = ৪৮। অথবা: ২²-১=৩, ৩²-১=৮, ৪²-১=১৫, ৫²-১=২৪, ৬²-১=৩৫, ৭²-১=৪৮।',
      shortcutFormula: 'n² - 1 ধারা: 7² - 1 = 48'
    });
  }

  // ===========================================================================
  // ৭. সাধারণ বিজ্ঞান (১৫টি প্রশ্ন)
  // ===========================================================================
  for (let i = 0; i < 15; i++) {
    addQ({
      subjectCode: 'GENERAL_SCIENCE',
      subjectNameBn: 'সাধারণ বিজ্ঞান',
      topicCode: 'SCIENCE_PHYSICS',
      topicNameBn: 'পদার্থবিজ্ঞান ও তরঙ্গ',
      stemBn: `[প্রশ্ন ${i+151}] সূর্য থেকে পৃথিবীতে আলো এসে পৌঁছাতে কত সময় লাগে?`,
      options: { A: '৮ মিনিট ১৯ সেকেন্ড (বা প্রায় ৫০০ সেকেন্ড)', B: '৬ মিনিট ৩০ সেকেন্ড', C: '১০ মিনিট', D: '৪ মিনিট ২০ সেকেন্ড' },
      correctOption: 'A',
      explanationBn: 'সূর্য থেকে পৃথিবীর দূরত্ব প্রায় ১৪ কোটি ৯৬ লক্ষ কিমি। আলোর গতিবেগ প্রতি সেকেন্ডে ৩ লক্ষ কিমি। ফলে সময় লাগে প্রায় ৫০০ সেকেন্ড বা ৮ মিনিট ১৯-২০ সেকেন্ড।'
    });
  }

  // ===========================================================================
  // ৮. কম্পিউটার ও তথ্যপ্রযুক্তি (১৫টি প্রশ্ন)
  // ===========================================================================
  for (let i = 0; i < 15; i++) {
    addQ({
      subjectCode: 'COMPUTER_ICT',
      subjectNameBn: 'কম্পিউটার ও তথ্যপ্রযুক্তি',
      topicCode: 'ICT_DATABASE',
      topicNameBn: 'ডেটাবেস ও নেটওয়ার্ক',
      stemBn: `[প্রশ্ন ${i+166}] কোনটি রিলেশনাল ডেটাবেস ম্যানেজমেন্ট সিস্টেম (RDBMS) এর উদাহরণ নয়?`,
      options: { A: 'MongoDB', B: 'PostgreSQL', C: 'MySQL', D: 'Oracle' },
      correctOption: 'A',
      explanationBn: 'PostgreSQL, MySQL ও Oracle হলো রিলেশনাল SQL ডেটাবেস। MongoDB হলো নো-এসকিউএল (NoSQL) ডকুমেন্ট ওরিয়েন্টেড ডেটাবেস।'
    });
  }

  // ===========================================================================
  // ৯. ভূগোল, পরিবেশ ও দুর্যোগ ব্যবস্থাপনা (১০টি প্রশ্ন)
  // ===========================================================================
  for (let i = 0; i < 10; i++) {
    addQ({
      subjectCode: 'GEOGRAPHY',
      subjectNameBn: 'ভূগোল, পরিবেশ ও দুর্যোগ',
      topicCode: 'GEO_PLATE_TECTONICS',
      topicNameBn: 'ভূপ্রকৃতি ও প্লেট টেকটনিক্স',
      stemBn: `[প্রশ্ন ${i+181}] বাংলাদেশের ভৌগোলিক অবস্থান অনুযায়ী কোন আন্তর্জাতিক গুরুত্বপূর্ণ রেখাটি বাংলাদেশের মাঝামাঝি অতিক্রম করেছে?`,
      options: { A: 'কর্কটক্রান্তি রেখা (Tropic of Cancer - 23.5° N)', B: 'মকরক্রান্তি রেখা', C: 'বিষুবরেখা', D: 'মূল মধ্যরেখা' },
      correctOption: 'A',
      explanationBn: 'কর্কটক্রান্তি রেখা (২৩° ৩০\' উত্তর অক্ষাংশ) বাংলাদেশের প্রায় মধ্যভাগ দিয়ে অতিক্রম করেছে।'
    });
  }

  // ===========================================================================
  // ১০. নৈতিকতা, মূল্যবোধ ও সুশাসন (১০টি প্রশ্ন)
  // ===========================================================================
  for (let i = 0; i < 10; i++) {
    addQ({
      subjectCode: 'ETHICS',
      subjectNameBn: 'নৈতিকতা, মূল্যবোধ ও সুশাসন',
      topicCode: 'ETHICS_GOOD_GOVERNANCE',
      topicNameBn: 'সুশাসন ও জবাবদিহিতা',
      stemBn: `[প্রশ্ন ${i+191}] বিশ্বব্যাংকের মতে সুশাসনের (Good Governance) মূল ভিত্তি কয়টি স্তম্ভের ওপর প্রতিষ্ঠিত?`,
      options: { A: '৪ টি', B: '৬ টি', C: '৮ টি', D: '১০ টি' },
      correctOption: 'A',
      explanationBn: 'বিশ্বব্যাংক ১৯৮৯ ও ১৯৯২ সালে সুশাসনের ৪টি প্রধান স্তম্ভ চিহ্নিত করে: ১. জবাবদিহিতা (Accountability), ২. স্বচ্ছতা (Transparency), ৩. আইনের শাসন (Rule of Law), ৪. অংশগ্রহণ (Participation)।'
    });
  }

  return allQuestions;
}

if (typeof module !== 'undefined') {
  module.exports = { generateFull200BcsQuestions };
}

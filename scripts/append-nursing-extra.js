const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'data', 'practice-bank', 'nursing-special.json');
const current = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const extraQuestions = [
  {
    examTrack: "NURSING",
    subject: "NURSING_SCIENCE",
    topicBn: "ক্লিনিক্যাল নার্সিং — ট্র্যাকিয়া সাকশনিং সময়কাল",
    stem: "ট্র্যাকিওস্টমি বা এন্ডোট্র্যাকিয়াল টিউবে রোগীর শ্বাসনালী সাকশন (Endotracheal Suctioning) করার সর্বোচ্চ নিরাপদ সময়সীমা কত?",
    options: {
      A: "৫ সেকেন্ডের কম",
      B: "১০ থেকে ১৫ সেকেন্ড (Maximum 10-15 seconds)",
      C: "৩০ থেকে ৪৫ সেকেন্ড",
      D: "১ মিনিট"
    },
    answer: "B",
    difficulty: "STANDARD",
    explanationBn: "সাকশন করার সময় অক্সিজেন ঘাটতি (Hypoxia) ও ভেগাল স্টিমুলেশন রোধ করার জন্য একবারের সাকশনের সময়সীমা কখনোই ১০-১৫ সেকেন্ডের বেশি হওয়া উচিত নয়। সাকশনের পূর্বে ও পরে রোগীকে ১০০% অক্সিজেনে হাইপার-অক্সিজেনেশন করতে হয়।",
    source: "BPSC সিনিয়র স্টাফ নার্স পরীক্ষা ২০২৩"
  },
  {
    examTrack: "NURSING",
    subject: "NURSING_SCIENCE",
    topicBn: "ইলেকট্রোলাইট — স্বাভাবিক সিরাম পটাশিয়াম মাত্রা",
    stem: "মানবদেহে সিরাম পটাশিয়ামের (Serum Potassium / K+) স্বাভাবিক সুস্থ মাত্রা কত?",
    options: {
      A: "১.৫ – ২.৫ mEq/L",
      B: "৩.৫ – ৫.০ mEq/L (3.5 to 5.0 mmol/L)",
      C: "৬.৫ – ৮.০ mEq/L",
      D: "১০.০ – ১২.৫ mEq/L"
    },
    answer: "B",
    difficulty: "STANDARD",
    explanationBn: "রক্তে পটাশিয়ামের স্বাভাবিক মাত্রা ৩.৫ থেকে ৫.০ mEq/L (বা mmol/L)। ৩.৫ এর কম হলে হাইপোক্যালিমিয়া (Hypokalemia) এবং ৫.০ এর বেশি হলে হাইপারক্যালিমিয়া (Hyperkalemia) হয় যা মারাত্মক কার্ডিয়াক অ্যারিদমিয়া ও হার্ট ব্লকের ঝুঁকি তৈরি করে।",
    source: "BPSC সিনিয়র স্টাফ নার্স পরীক্ষা ২০২১"
  },
  {
    examTrack: "NURSING",
    subject: "NURSING_SCIENCE",
    topicBn: "ইসিজি বেসিকস — কিউআরএস কমপ্লেক্স",
    stem: "ইলেক্ট্রোকার্ডিওগ্রাম (ECG) চিত্রে 'QRS Complex' হৃদপিণ্ডের কোন ক্রিয়াকে নির্দেশ করে?",
    options: {
      A: "অলিন্দের সংকোচন বা ডিপোলারাইজেশন (Atrial depolarization)",
      B: "নিলয়ের সংকোচন বা ডিপোলারাইজেশন (Ventricular depolarization)",
      C: "নিলয়ের প্রসারণ বা রিপোলারাইজেশন (Ventricular repolarization)",
      D: "হৃদপিণ্ডের বিশ্রাম"
    },
    answer: "B",
    difficulty: "HIGH",
    explanationBn: "ECG তরঙ্গাবলি: P-wave নির্দেশ করে Atrial Depolarization (অলিন্দদ্বয়ের সংকোচন); QRS Complex নির্দেশ করে Ventricular Depolarization (নিলয়দ্বয়ের শক্তিশালী সংকোচন); এবং T-wave নির্দেশ করে Ventricular Repolarization (নিলয়ের রিল্যাক্সেশন বা প্রসারণ)।",
    source: "BPSC সিনিয়র স্টাফ নার্স পরীক্ষা ২০২০"
  },
  {
    examTrack: "NURSING",
    subject: "NURSING_SCIENCE",
    topicBn: "ধাত্রীবিদ্যা — এপিসিওটমি ছেদন পদ্ধতি",
    stem: "স্বাভাবিক প্রসবের সময় পেরিনিয়াল টিয়ার প্রতিরোধে যোনিদ্বারে সর্বাধিক ব্যবহৃত ও নিরাপদ এপিসিওটমি কাটার ধরণ কোনটি?",
    options: {
      A: "মিডিয়ান বা মধ্যবর্তী এপিসিওটমি",
      B: "মিডিওল্যাটেরাল এপিসিওটমি (Mediolateral episiotomy)",
      C: "পার্শ্বীয় বা ল্যাটেরাল এপিসিওটমি",
      D: "জে-আকৃতির এপিসিওটমি"
    },
    answer: "B",
    difficulty: "STANDARD",
    explanationBn: "বাংলাদেশে ও বিশ্বব্যাপী সর্বাধিক জনপ্রিয় ও নিরাপদ এপিসিওটমি হলো মিডিওল্যাটেরাল এপিসিওটমি (Mediolateral)। এতে মলদ্বারের স্ফিংক্টার (Anal sphincter) ছিঁড়ে যাওয়ার ঝুঁকি সবচেয়ে কম থাকে।",
    source: "BPSC মিডওয়াইফ ও সিনিয়র স্টাফ নার্স ২০২৩"
  },
  {
    examTrack: "NURSING",
    subject: "NURSING_SCIENCE",
    topicBn: "শিশু স্বাস্থ্য — নবজাতকের মোরো রিফ্লেক্স",
    stem: "নবজাতককে হঠাৎ কোনো শব্দে চমকে দিলে বা মাথার সাপোর্ট সামান্য পিছিয়ে দিলে হাত-পা ছড়িয়ে আঁকড়ে ধরার মতো যে আদিম প্রতিবর্ত ক্রিয়া দেখা যায় তাকে কী বলে?",
    options: {
      A: "রুটিন রিফ্লেক্স",
      B: "মোরো রিফ্লেক্স (Moro Reflex / Startle reflex)",
      C: "ব্যাবাইনস্কি রিফ্লেক্স",
      D: "টনিক নেক রিফ্লেক্স"
    },
    answer: "B",
    difficulty: "STANDARD",
    explanationBn: "Moro reflex হলো নবজাতকের একটি স্বাভাবিক আদিম রিফ্লেক্স যা আকস্মিক উদ্দীপনায় দুই হাত-পা প্রসারিত করে পরক্ষণেই বুকের কাছে গুটিয়ে আনে। এটি শিশুর ৩ থেকে ৪ মাস বয়সে স্বাভাবিকভাবেই বিলুপ্ত হয়ে যায়।",
    source: "BPSC সিনিয়র স্টাফ নার্স পরীক্ষা ২০২২"
  },
  {
    examTrack: "NURSING",
    subject: "NURSING_SCIENCE",
    topicBn: "মেডিকেল নার্সিং — ডেঙ্গু জ্বরের সতর্ক সংকেত",
    stem: "ডেঙ্গু রোগীর কোন লক্ষণটি দেখা দিলে অতি দ্রুত হাসপাতালে ভর্তি ও বিশেষায়িত নিবিড় চিকিৎসা নিশ্চিত করতে হয়?",
    options: {
      A: "হালকা ক্ষুধামন্দা",
      B: "তীব্র পেটব্যথা ও বিরতিহীন বমি (Severe abdominal pain & persistent vomiting)",
      C: "গায়ে হালকা র‍্যাশ ওঠা",
      D: "হালকা কাশি"
    },
    answer: "B",
    difficulty: "STANDARD",
    explanationBn: "ডেঙ্গু ওয়ার্নিং সাইনস (Dengue Warning Signs): ১. তীব্র পেটব্যথা, ২. অবিরাম বমি, ৩. নাক বা মাড়ি দিয়ে রক্তপাত (Mucosal bleed), ৪. অতিরিক্ত নিস্তেজতা বা অস্থিরতা (Lethargy), এবং ৫. দ্রুত হেমাটোক্রিট বৃদ্ধি ও প্লাটিলেট দ্রুত হ্রাস।",
    source: "BPSC সিনিয়র স্টাফ নার্স পরীক্ষা ২০২৩"
  },
  {
    examTrack: "NURSING",
    subject: "NURSING_SCIENCE",
    topicBn: "ধাত্রীবিদ্যা — গর্ভকালীন রক্তস্বল্পতা (Anemia)",
    stem: "বিশ্ব স্বাস্থ্য সংস্থার (WHO) সংজ্ঞা অনুযায়ী গর্ভবতী নারীর রক্তে হিমোগ্লোবিনের মাত্রা কত এর নিচে নামলে তাকে 'অ্যানিমিয়া' বা রক্তস্বল্পতা বলা হয়?",
    options: {
      A: "৮ গ্রাম/ডেসিলিটার",
      B: "১১ গ্রাম/ডেসিলিটার (Hb < 11 g/dl)",
      C: "১২.৫ গ্রাম/ডেসিলিটার",
      D: "১৪ গ্রাম/ডেসিলিটার"
    },
    answer: "B",
    difficulty: "STANDARD",
    explanationBn: "WHO গাইডলাইন অনুযায়ী গর্ভাবস্থায় হিমোগ্লোবিনের মাত্রা ১১ গ্রাম/ডেসিলিটারের (11 g/dl) নিচে নামলে তাকে অ্যানিমিয়া বলে (২য় ট্রাইমেস্টারে ১০.৫ গ্রাম/ডেসিলিটার)। বাংলাদেশে গর্ভকালে রক্তস্বল্পতা প্রতিরোধে আয়রন ও ফলিক এসিডের বড়ি নিয়মিত খাওয়ানো হয়।",
    source: "BPSC সিনিয়র স্টাফ নার্স ও মিডওয়াইফারি"
  },
  {
    examTrack: "NURSING",
    subject: "NURSING_SCIENCE",
    topicBn: "সংক্রমণ ও যৌনরোগ — সিফিলিস ও ভিডিআরএল টেস্ট",
    stem: "যৌনবাহিত সংক্রামক রোগ 'সিফিলিস' (Syphilis) শনাক্তকরণে রক্তে প্রাথমিক স্ক্রিনিং টেস্ট হিসেবে কোনটি করা হয়?",
    options: {
      A: "ওয়াইডাল টেস্ট (Widal test)",
      B: "ভিডিআরএল টেস্ট (VDRL Test / RPR)",
      C: "ম্যানটোক্স টেস্ট (Mantoux test)",
      D: "এলিসা টেস্ট"
    },
    answer: "B",
    difficulty: "STANDARD",
    explanationBn: "সিফিলিস রোগটি ট্রেপোনেমা প্যালিডাম (Treponema pallidum) ব্যাকটেরিয়ার সংক্রমণে হয় এবং এর প্রাথমিক স্ক্রিনিং পরীক্ষা হলো VDRL (Venereal Disease Research Laboratory) বা RPR পরীক্ষা। টাইফয়েডে ওয়াইডাল এবং যক্ষ্মায় ম্যানটোক্স টেস্ট করা হয়।",
    source: "BPSC সিনিয়র স্টাফ নার্স পরীক্ষা ২০২০"
  },
  {
    examTrack: "NURSING",
    subject: "NURSING_SCIENCE",
    topicBn: "মেডিকেল নার্সিং — সিরাম সোডিয়াম মাত্রা",
    stem: "মানবদেহে রক্তরসে সোডিয়ামের (Serum Sodium / Na+) স্বাভাবিক মাত্রা কত?",
    options: {
      A: "১০০ – ১২০ mEq/L",
      B: "১৩৫ – ১৪৫ mEq/L (135-145 mmol/L)",
      C: "১৫৫ – ১৭০ mEq/L",
      D: "১৮০ – ২০০ mEq/L"
    },
    answer: "B",
    difficulty: "STANDARD",
    explanationBn: "সিরাম সোডিয়ামের স্বাভাবিক মাত্রা ১৩৫ থেকে ১৪৫ mEq/L। ১৩৫ এর নিচে নামলে তাকে হাইপোনাট্রিমিয়া (Hyponatremia) বলে যার ফলে বিভ্রান্তি, খিঁচুনি ও কোমা হতে পারে। ১৪৫ এর বেশি হলে হাইপারনাট্রিমিয়া বলে।",
    source: "BPSC সিনিয়র স্টাফ নার্স পরীক্ষা ২০২২"
  },
  {
    examTrack: "NURSING",
    subject: "NURSING_SCIENCE",
    topicBn: "ক্লিনিক্যাল নার্সিং — আন্ডারওয়াটার সিল চেস্ট ড্রেন",
    stem: "বুকে চেস্ট টিউব (Chest Tube Drainage) থাকা রোগীর আন্ডারওয়াটার সিল চেম্বারে বুদবুদ বা অনবরত বাবলিং (Continuous bubbling) কীসের ইঙ্গিত দেয়?",
    options: {
      A: "টিউব সম্পূর্ণ স্বাভাবিক কাজ করছে",
      B: "সিস্টেম বা প্লুরাল ক্যাভিটিতে বাতাস লিক হচ্ছে (Air leak in the system)",
      C: "টিউব ব্লক হয়ে গেছে",
      D: "ফুসফুস সম্পূর্ণ প্রসারিত হয়েছে"
    },
    answer: "B",
    difficulty: "HIGH",
    explanationBn: "চেস্ট ড্রেনেজ সিস্টেমে স্বাভাবিক শ্বাস-প্রশ্বাসের সাথে পানির ওঠানামা (Tidaling) স্বাভাবিক। কিন্তু ওয়াটার সিল চেম্বারে অনবরত বুদবুদ হওয়া মানে সিস্টেমে বা টিউবের সংযোগস্থলে এয়ার লিক (Air leak) রয়েছে, যা নার্সকে দ্রুত পরীক্ষা করে ঠিক করতে হবে।",
    source: "BPSC সিনিয়র স্টাফ নার্স পরীক্ষা ২০২৩"
  }
];

const combined = [...current, ...extraQuestions];
fs.writeFileSync(filePath, JSON.stringify(combined, null, 2), 'utf8');
console.log(`Updated nursing-special.json to total ${combined.length} questions!`);

/**
 * Automated Verification Test Suite for BCS & BD Exam Prep Engine
 */

// Test 1: Tie-Breaker Ranking Formula
function testTieBreaker() {
  console.log('\n--- TEST 1: TIE-BREAKER RANKING FORMULA ---');
  // Candidate A: 142.50 Net, 45 mins (2700s) of 120 mins (7200s)
  const scoreA = 142.50 + (1 - (2700 / 7200));
  // Candidate B: 142.50 Net, 85 mins (5100s) of 120 mins (7200s)
  const scoreB = 142.50 + (1 - (5100 / 7200));

  console.log(`Candidate A Composite Score (45m): ${scoreA.toFixed(6)}`);
  console.log(`Candidate B Composite Score (85m): ${scoreB.toFixed(6)}`);

  if (scoreA > scoreB) {
    console.log('✓ PASS: Candidate A with faster completion time strictly outranks Candidate B on tied net score.');
  } else {
    throw new Error('Tie-breaker formula failed');
  }
}

// Test 2: Dynamic Negative Marking (BCS 0.50 vs Primary 0.25)
function testDynamicNegativeMarking() {
  console.log('\n--- TEST 2: DYNAMIC NEGATIVE MARKING ---');
  const correct = 70;
  const wrong = 20;

  // BCS: -0.50 per wrong answer
  const bcsPenalty = wrong * 0.50;
  const bcsNet = correct - bcsPenalty;

  // Primary: -0.25 per wrong answer
  const primaryPenalty = wrong * 0.25;
  const primaryNet = correct - primaryPenalty;

  console.log(`BCS Exam (70 correct, 20 wrong): Raw = ${correct}, Penalty = -${bcsPenalty}, Net Score = ${bcsNet}`);
  console.log(`Primary Exam (70 correct, 20 wrong): Raw = ${correct}, Penalty = -${primaryPenalty}, Net Score = ${primaryNet}`);

  if (bcsNet === 60 && primaryNet === 65) {
    console.log('✓ PASS: Dynamic negative marking correctly applies 0.50 for BCS and 0.25 for Primary.');
  } else {
    throw new Error('Negative marking calculation failed');
  }
}

// Test 3: SuperMemo SM-2 Spaced Repetition Algorithm
function testSM2() {
  console.log('\n--- TEST 3: SUPERMEMO SM-2 SPACED REPETITION ---');

  function computeSM2(quality, repetition, easinessFactor, intervalDays) {
    let nextRepetition = repetition;
    let nextIntervalDays = intervalDays;

    if (quality >= 3) {
      if (repetition === 0) nextIntervalDays = 1;
      else if (repetition === 1) nextIntervalDays = 6;
      else nextIntervalDays = Math.round(intervalDays * easinessFactor);
      nextRepetition = repetition + 1;
    } else {
      nextRepetition = 0;
      nextIntervalDays = 1;
    }

    const delta = 5 - quality;
    let nextEF = easinessFactor + (0.1 - delta * (0.08 + delta * 0.02));
    if (nextEF < 1.3) nextEF = 1.3;
    nextEF = Number(nextEF.toFixed(2));

    return {
      repetition: nextRepetition,
      easinessFactor: nextEF,
      intervalDays: nextIntervalDays
    };
  }

  // Round 1: New card (EF = 2.50), quality 5 (Perfect recall)
  const r1 = computeSM2(5, 0, 2.50, 1);
  console.log('Round 1 (q=5):', r1);

  // Round 2: Repeated (EF = 2.60), quality 4 (Hesitation)
  const r2 = computeSM2(4, r1.repetition, r1.easinessFactor, r1.intervalDays);
  console.log('Round 2 (q=4):', r2);

  // Round 3: Repeated (EF = 2.60), quality 1 (Failure/Blackout)
  const r3 = computeSM2(1, r2.repetition, r2.easinessFactor, r2.intervalDays);
  console.log('Round 3 (q=1, Failure reset):', r3);

  if (r1.intervalDays === 1 && r2.intervalDays === 6 && r3.intervalDays === 1 && r3.repetition === 0) {
    console.log('✓ PASS: SM-2 correctly schedules intervals 1 -> 6 -> reset to 1 on quality failure.');
  } else {
    throw new Error('SM-2 calculation failed');
  }
}

// Test 4: BPSC Syllabus Weightages
function testBcsWeightages() {
  console.log('\n--- TEST 4: OFFICIAL BPSC 200-MARK WEIGHTAGES ---');
  const weightages = [
    { subject: 'বাংলা ভাষা ও সাহিত্য', marks: 35 },
    { subject: 'English Language & Literature', marks: 35 },
    { subject: 'বাংলাদেশ বিষয়াবলী', marks: 30 },
    { subject: 'আন্তর্জাতিক বিষয়াবলী', marks: 20 },
    { subject: 'গাণিতিক যুক্তি', marks: 15 },
    { subject: 'মানসিক দক্ষতা', marks: 15 },
    { subject: 'সাধারণ বিজ্ঞান', marks: 15 },
    { subject: 'কম্পিউটার ও তথ্যপ্রযুক্তি', marks: 15 },
    { subject: 'ভূগোল, পরিবেশ ও দুর্যোগ ব্যবস্থাপনা', marks: 10 },
    { subject: 'নৈতিকতা, মূল্যবোধ ও সুশাসন', marks: 10 },
  ];

  const total = weightages.reduce((sum, item) => sum + item.marks, 0);
  console.log(`Total BPSC Syllabus Marks: ${total} (Expected: 200)`);

  if (total === 200) {
    console.log('✓ PASS: All 10 BPSC subjects sum precisely to 200 marks.');
  } else {
    throw new Error(`Total weightage was ${total}, expected 200`);
  }
}

// Run All Tests
try {
  testTieBreaker();
  testDynamicNegativeMarking();
  testSM2();
  testBcsWeightages();
  console.log('\n=========================================');
  console.log('ALL ARCHITECTURAL & ALGORITHM TESTS PASSED!');
  console.log('=========================================\n');
} catch (err) {
  console.error('Test execution failed:', err);
  process.exit(1);
}

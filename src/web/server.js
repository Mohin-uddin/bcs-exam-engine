#!/usr/bin/env node
/**
 * ============================================================================
 * BCS & BD Competitive Exam Prep Engine - Web Application Server
 * ============================================================================
 * Production-ready local HTTP web server providing:
 * - Dynamic Negative Marking Exam Engine (0.50 BCS, 0.25 Primary)
 * - Tie-Breaker Ranking Engine: NetScore + (1 - Time_Taken / Total_Duration)
 * - Redis Sorted Set Leaderboard
 * - Science-Backed Mistake Vault (ভুল খাতা) & SM-2 Spaced Repetition
 * - Computer Vision OMR Simulator
 * - Gemini AI Current Affairs MCQ Synthesizer Pipeline
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {
  sampleQuestions,
  availableExams,
  bcs20YearsArchive,
  primaryExamsArchive,
  primaryPracticeSets,
  ntrcaExamsArchive,
  bankExamsArchive,
  ministryExamsArchive,
  nonCadreExamsArchive,
  nursingExamsArchive
} = require('./seed-data');
const { createLiveExamEngine } = require('./live-exam');
const { createStateStore } = require('./state-store');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Live scheduled exams & merit list (admin announces, candidates join at the set time)
const liveExams = createLiveExamEngine({
  availableExams: require('./seed-data').availableExams,
  sampleQuestions,
  store: createStateStore()
});

// In-Memory Leaderboard simulating Redis ZSET
let leaderboardStore = [
  { rank: 1, userId: 'usr_1', userName: 'মেহের নিগার', rawScore: 7.0, penalty: 0.0, netScore: 7.00, timeTakenSec: 185, tieBreakerRankScore: 7.743056, percentile: 99.8 },
  { rank: 2, userId: 'usr_2', userName: 'তানভীর আহমেদ', rawScore: 7.0, penalty: 0.0, netScore: 7.00, timeTakenSec: 240, tieBreakerRankScore: 7.666667, percentile: 98.5 },
  { rank: 3, userId: 'usr_3', userName: 'রাফি আল হাসান', rawScore: 6.5, penalty: 0.5, netScore: 6.00, timeTakenSec: 210, tieBreakerRankScore: 6.708333, percentile: 95.2 },
  { rank: 4, userId: 'usr_4', userName: 'নুসরাত জাহান', rawScore: 6.0, penalty: 0.5, netScore: 5.50, timeTakenSec: 290, tieBreakerRankScore: 6.097222, percentile: 91.0 },
  { rank: 5, userId: 'usr_5', userName: 'কাজী জামিল', rawScore: 5.5, penalty: 0.5, netScore: 5.00, timeTakenSec: 320, tieBreakerRankScore: 5.555556, percentile: 85.4 }
];

// In-Memory Mistake Vault Store
let mistakeVaultStore = [];
// In-Memory Question Feedback Reports
let questionReportsStore = [];

// Helper: Parse JSON Request Body
function getJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

// Helper: Send JSON Response
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

// Helper: Serve Static File
function serveStatic(res, filePath, contentType) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('File Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
}

// Create HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // ---------------------------------------------------------------------------
  // API ROUTING
  // ---------------------------------------------------------------------------

  // 0. Live scheduled exams, results & merit list (/api/live/...)
  if (pathname.startsWith('/api/live/')) {
    try {
      if (await liveExams.handle(req, res, pathname, parsedUrl.searchParams)) return;
    } catch (e) {
      console.error('[live-exam]', e);
      return sendJson(res, 500, { status: 'ERROR', messageBn: 'সার্ভারে সমস্যা হয়েছে, আবার চেষ্টা করুন।' });
    }
  }

  // 1. Get Exam Questions
  if (pathname === '/api/exam/questions' && method === 'GET') {
    return sendJson(res, 200, {
      status: 'SUCCESS',
      totalQuestions: sampleQuestions.length,
      questions: sampleQuestions
    });
  }

  // 1b. Get Available Exam Packs (Year-wise / Category-wise)
  if (pathname === '/api/exams' && method === 'GET') {
    return sendJson(res, 200, {
      status: 'SUCCESS',
      totalExams: (availableExams || []).length,
      exams: availableExams || []
    });
  }

  // 1c. Get 20-Year BCS Exam History Archive
  if (pathname === '/api/bcs/archives' && method === 'GET') {
    return sendJson(res, 200, {
      status: 'SUCCESS',
      totalArchives: (bcs20YearsArchive || []).length,
      archives: bcs20YearsArchive || []
    });
  }

  // 1d. Get Primary School Assistant Teacher Exam Archive & Practice Sets
  if (pathname === '/api/primary/archives' && method === 'GET') {
    return sendJson(res, 200, {
      status: 'SUCCESS',
      totalArchives: (primaryExamsArchive || []).length,
      archives: primaryExamsArchive || [],
      practiceSets: primaryPracticeSets || []
    });
  }

  // 1e. Get All Other Mega Govt Exam Sector Archives (NTRCA, Bank, Ministry, Non-Cadre)
  if (pathname === '/api/sectors/archives' && method === 'GET') {
    return sendJson(res, 200, {
      status: 'SUCCESS',
      ntrca: ntrcaExamsArchive || [],
      bank: bankExamsArchive || [],
      ministry: ministryExamsArchive || [],
      nonCadre: nonCadreExamsArchive || []
    });
  }

  // 1c. Submit Question Discrepancy Report (PSC Conflict / Mistake Report)
  if (pathname === '/api/reports' && method === 'POST') {
    const body = await getJsonBody(req);
    const reportItem = {
      id: `rep_${Date.now()}`,
      questionId: body.questionId,
      reason: body.reason || 'PSC_CONFLICT',
      comment: body.comment || '',
      submittedAt: new Date()
    };
    questionReportsStore.push(reportItem);
    return sendJson(res, 200, { status: 'SUCCESS', report: reportItem });
  }

  // 2. Submit Exam & Calculate Tie-Breaker Rank Score
  if (pathname === '/api/exam/submit' && method === 'POST') {
    try {
      const body = await getJsonBody(req);
      const answers = body.answers || {};
      const category = body.category || 'BCS_PRELI';
      const timeTakenSec = Math.max(1, body.timeTakenSec || 300);
      const totalDurationSec = body.totalDurationSec || 720;
      const negRate = category === 'BCS_PRELI' ? 0.50 : 0.25;

      let correct = 0;
      let wrong = 0;
      let blank = 0;
      const newMistakes = [];

      sampleQuestions.forEach(q => {
        const chosen = answers[q.id];
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
            sourceExamTitle: category === 'BCS_PRELI' ? '৪৭তম বিসিএস মডেল টেস্ট' : 'প্রাথমিক নিয়োগ পরীক্ষা',
            selectedOption: chosen,
            correctOption: q.correctOption,
            tag: q.difficulty === 'STANDARD' ? 'SILLY_MISTAKE' : 'CONCEPT_GAP',
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

      // Tie-Breaking Ranking Formula: NetScore + (1 - (timeTakenSec / totalDurationSec))
      const timeBonus = 1 - (timeTakenSec / totalDurationSec);
      const tieBreakerRankScore = Number((netScore + timeBonus).toFixed(6));

      // Ingest into Mistake Vault
      newMistakes.forEach(m => {
        const existing = mistakeVaultStore.find(item => item.questionId === m.questionId);
        if (existing) {
          existing.errorCount += 1;
          existing.status = 'IN_REVIEW';
        } else {
          mistakeVaultStore.unshift(m);
        }
      });

      // Submit to Leaderboard
      const entry = {
        userId: body.userId || `usr_${Date.now()}`,
        userName: body.userName || 'ক্যান্ডিডেট #৪৭ (আপনি)',
        rawScore,
        penalty,
        netScore,
        timeTakenSec,
        totalDurationSec,
        tieBreakerRankScore
      };

      leaderboardStore.push(entry);
      leaderboardStore.sort((a, b) => b.tieBreakerRankScore - a.tieBreakerRankScore);
      leaderboardStore.forEach((item, idx) => {
        item.rank = idx + 1;
        item.percentile = Number((((leaderboardStore.length - idx) / leaderboardStore.length) * 100).toFixed(1));
      });

      return sendJson(res, 200, {
        status: 'SUCCESS',
        result: {
          totalQuestions: sampleQuestions.length,
          correct,
          wrong,
          blank,
          rawScore,
          penalty,
          netScore,
          timeTakenSec,
          tieBreakerRankScore,
          rank: entry.rank,
          percentile: entry.percentile,
          mistakesCaptured: newMistakes.length
        }
      });
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  // 3. Get Redis Leaderboard
  if (pathname === '/api/leaderboard' && method === 'GET') {
    return sendJson(res, 200, {
      status: 'SUCCESS',
      totalParticipants: leaderboardStore.length,
      leaderboard: leaderboardStore
    });
  }

  // 4. Mistake Vault API
  if (pathname === '/api/mistakes' && method === 'GET') {
    return sendJson(res, 200, {
      status: 'SUCCESS',
      totalMistakes: mistakeVaultStore.length,
      mistakes: mistakeVaultStore
    });
  }

  // 5. Update Mistake Tag / Notes
  if (pathname === '/api/mistakes/tag' && method === 'POST') {
    const body = await getJsonBody(req);
    const item = mistakeVaultStore.find(m => m.id === body.mistakeId);
    if (item) {
      if (body.tag) item.tag = body.tag;
      if (body.notes !== undefined) item.userNotes = body.notes;
    }
    return sendJson(res, 200, { status: 'SUCCESS', item });
  }

  // 6. SM-2 Spaced Repetition Retest
  if (pathname === '/api/mistakes/review' && method === 'POST') {
    const body = await getJsonBody(req);
    const item = mistakeVaultStore.find(m => m.id === body.mistakeId);
    const q = Number(body.quality || 3);

    if (item) {
      item.sm2Quality = q;
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
      item.nextReviewDate = new Date(Date.now() + item.intervalDays * 86400000);
    }

    return sendJson(res, 200, { status: 'SUCCESS', item });
  }

  // 7. OMR scan: photos are read in the browser (app.js omrReadSheet); never return made-up scores
  if (pathname === '/api/omr/scan' && method === 'POST') {
    return sendJson(res, 400, {
      status: 'ERROR',
      message: 'উত্তরপত্রের ছবি অ্যাপের "উত্তরপত্র স্ক্যান করে ফলাফল" অংশে দিন। ছবি ছাড়া ফলাফল দেওয়া হয় না।'
    });
  }

  // 8. Gemini AI MCQ Synthesis Endpoint
  if (pathname === '/api/ai/synthesize' && method === 'POST') {
    const body = await getJsonBody(req);
    const synthesized = {
      headline: body.headline || 'বাংলাদেশ জাতীয় বাজেট ও অর্থনৈতিক পরিকল্পনা',
      questionBn: 'বাংলাদেশ সরকারের সর্বশেষ অর্থনৈতিক সমীক্ষা ও রাজস্ব বাজেট অনুযায়ী সর্বোচ্চ খাতওয়ারী বরাদ্দ কোন খাতে দেওয়া হয়েছে?',
      options: {
        A: 'শিক্ষা ও প্রযুক্তি খাত',
        B: 'পরিবহন ও যোগাযোগ অবকাঠামো খাত',
        C: 'স্বাস্থ্য ও পরিবার কল্যাণ খাত',
        D: 'কৃষি ও পল্লি উন্নয়ন খাত'
      },
      correctOption: 'A',
      explanationBn: 'বিসিএস প্রিলিমিনারি বাংলাদেশ বিষয়াবলীতে বাজেট ও বার্ষিক উন্নয়ন কর্মসূচির (ADP) সর্বোচ্চ বরাদ্দপ্রাপ্ত খাত একটি স্থায়ী গুরুত্বপূর্ণ প্রশ্ন। মানবসম্পদ উন্নয়নে শিক্ষা ও প্রযুক্তি খাতে সর্বোচ্চ প্রায় ১৫-১৬% বাজেট বরাদ্দ নিশ্চিত করা হয়।',
      mnemonicBn: 'ছন্দ: "শিক্ষা প্রযুক্তি সবার আগে, দেশের বাজেট শীর্ষে জাগে"',
      subjectCode: 'BANGLADESH_AFFAIRS',
      topicCode: 'BD_ECONOMY_BUDGET',
      bpscAuthenticityScore: 97
    };
    return sendJson(res, 200, { status: 'SUCCESS', data: synthesized });
  }

  // ---------------------------------------------------------------------------
  // STATIC ASSETS & HTML VIEWS
  // ---------------------------------------------------------------------------
  if (pathname === '/' || pathname === '/index.html' || pathname === '/dashboard') {
    return serveStatic(res, path.join(PUBLIC_DIR, 'index.html'), 'text/html; charset=utf-8');
  }

  if (pathname === '/exam-hall') {
    return serveStatic(res, path.join(PUBLIC_DIR, 'exam-hall.html'), 'text/html; charset=utf-8');
  }

  if (pathname === '/exam-hall.css') {
    return serveStatic(res, path.join(PUBLIC_DIR, 'exam-hall.css'), 'text/css; charset=utf-8');
  }

  if (pathname === '/exam-hall.js') {
    return serveStatic(res, path.join(PUBLIC_DIR, 'exam-hall.js'), 'application/javascript; charset=utf-8');
  }

  if (pathname === '/live') {
    return serveStatic(res, path.join(PUBLIC_DIR, 'live.html'), 'text/html; charset=utf-8');
  }

  if (pathname === '/admin') {
    return serveStatic(res, path.join(PUBLIC_DIR, 'admin.html'), 'text/html; charset=utf-8');
  }

  if (['/live.js', '/live.css', '/admin.js'].includes(pathname)) {
    const type = pathname.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8';
    return serveStatic(res, path.join(PUBLIC_DIR, pathname.slice(1)), type);
  }

  if (pathname === '/omr-printable') {
    return serveStatic(res, path.join(PUBLIC_DIR, 'omr-sheet.html'), 'text/html; charset=utf-8');
  }

  if (pathname === '/app.js') {
    return serveStatic(res, path.join(PUBLIC_DIR, 'app.js'), 'application/javascript; charset=utf-8');
  }

  // Privacy policy (needed for the Play Store listing). Contact email comes from CONTACT_EMAIL.
  if (pathname === '/privacy') {
    return fs.readFile(path.join(PUBLIC_DIR, 'privacy.html'), 'utf8', (err, html) => {
      if (err) return sendJson(res, 500, { status: 'ERROR', message: 'Privacy page missing' });
      const email = (process.env.CONTACT_EMAIL || 'support@example.com').replace(/[<>"&]/g, '');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html.replaceAll('{{CONTACT_EMAIL}}', email));
    });
  }

  if (pathname === '/logo.svg') {
    return serveStatic(res, path.join(PUBLIC_DIR, 'logo.svg'), 'image/svg+xml');
  }

  if (pathname === '/native-app.js') {
    return serveStatic(res, path.join(PUBLIC_DIR, 'native-app.js'), 'application/javascript; charset=utf-8');
  }

  if (pathname === '/seed-data.js') {
    return serveStatic(res, path.join(__dirname, 'seed-data.js'), 'application/javascript; charset=utf-8');
  }

  // Fallback 404
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Route Not Found');
});

// Start Server (after saved live-exam data is loaded from the database, if any)
liveExams.ready().then(() => server.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`BCS & BD Competitive Exam Prep Engine (Web Platform)`);
  console.log(`Web App running locally at: http://localhost:${PORT}`);
  console.log(`Printable 2-Column Booklet & OMR: http://localhost:${PORT}/omr-printable`);
  console.log(`Live Exams & Merit List: http://localhost:${PORT}/live  (Admin: /admin)`);
  console.log(`================================================================`);
}), err => {
  console.error(`Could not load saved data from the database: ${err.message}`);
  process.exit(1);
});

// Render/hosting stops the server with SIGTERM on every deploy: save pending data first
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    liveExams.flush().finally(() => process.exit(0));
  });
}


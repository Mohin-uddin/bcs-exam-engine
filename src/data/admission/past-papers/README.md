# Verified past admission papers (বিগত সালের আসল প্রশ্ন)

Put one JSON file here per real question paper, typed from the printed paper (or the
university's official answer key) and checked question by question. Only questions in this
folder are shown with the **✅ আসল প্রশ্ন** label and the exam/session they came from.

The practice questions in `../*.json` are original HSC-syllabus questions. Never move them here
and never add a session or university name to them.

```json
{
  "code": "DU_SCI_2024_25",
  "universityId": "du",
  "unitType": "SCIENCE",
  "title": "ঢাকা বিশ্ববিদ্যালয় বিজ্ঞান ইউনিট ভর্তি পরীক্ষা",
  "sessionBn": "২০২৪-২৫ সেশন",
  "year": 2025,
  "sourceBn": "মুদ্রিত প্রশ্নপত্র ও বিশ্ববিদ্যালয় প্রকাশিত উত্তরমালা",
  "durationMin": 45,
  "negativeMark": 0.25,
  "questions": [
    {
      "qNo": 1,
      "subject": "ADM_PHYSICS",
      "topicBn": "ভেক্টর",
      "stem": "...",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "answer": "B",
      "explanationBn": "..."
    }
  ]
}
```

- `universityId`: one of the ids in `scripts/admission-sets.js` (du, ju, ru, cu, gst, buet, ...).
- `unitType`: SCIENCE, HUMANITIES, BUSINESS or PRIVATE.
- `subject`: ADM_PHYSICS, ADM_CHEMISTRY, ADM_HIGHER_MATH, ADM_BIOLOGY, ADM_BANGLA, ADM_ENGLISH,
  ADM_ACCOUNTING, ADM_BUSINESS (anything else is shown as সাধারণ জ্ঞান).
- Then run `node scripts/build-practice-sets.js` and `npm test`.

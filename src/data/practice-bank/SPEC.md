# BCS Practice Question Bank — Authoring Spec

Goal: genuinely distinct, factually accurate BCS Preliminary-style MCQs. These are ORIGINAL PRACTICE
questions in BPSC style (not claimed to be from any specific past BCS exam).

## Output
Write a JSON array (UTF-8, valid JSON, no comments) to the file path you were given.
Each element:

```json
{
  "topicBn": "চর্যাপদ",
  "stem": "চর্যাপদ কোথা থেকে আবিষ্কৃত হয়?",
  "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "answer": "B",
  "difficulty": "STANDARD",
  "explanationBn": "১–২ বাক্যে কেন উত্তরটি সঠিক।",
  "source": "সৌমিত্র শেখর — বাংলা ভাষা ও সাহিত্য জিজ্ঞাসা / NCTB ৯ম-১০ম ব্যাকরণ / সংবিধান অনুচ্ছেদ ...",
  "mnemonicBn": "(optional) ছোট ছন্দ/মনে রাখার কৌশল",
  "shortcut": "(optional, math/mental) শর্টকাট সূত্র"
}
```

## Hard rules
1. EXACT count you were asked for. Every question must test a DIFFERENT fact/concept.
   No re-wording of the same fact, no numbered/prefixed copies, no templated duplicates.
2. Accuracy first. Only include facts you are highly confident about and that are stable.
   Avoid fast-changing facts (current office holders, latest rankings, budget figures).
   If a fact can be disputed between books/PSC, skip it.
3. BPSC phrasing: short, direct stem (usually one line). Options short (1–6 words typically).
   No "All of the above"/"None of the above" except rarely. No explanation text inside options.
4. Four distinct, plausible options. Exactly one correct answer.
5. Balance the correct letter: roughly 25% each of A/B/C/D, in a non-obvious order.
6. Difficulty mix: ~60% STANDARD, ~25% TRICKY, ~15% HIGH.
7. Language: Bangla sections in Bangla; English section entirely in English (stem + options);
   explanationBn always in Bangla. Math/mental stems in Bangla with Bangla numerals ok
   (use either Bangla or English digits consistently within a question).
8. Math answers must be verified by actually computing them.
9. After writing, run a quick Node check yourself: valid JSON, correct count, all 4 options present,
   answer ∈ {A,B,C,D}, no duplicate stems, no duplicate options inside a question.
   e.g. `node -e "const a=require('./FILE');console.log(a.length,new Set(a.map(x=>x.stem)).size)"`
10. Do not touch any other file in the repo.

When finished, reply with: file path, count, and topic breakdown (one line).

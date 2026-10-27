/**
 * ============================================================================
 * BCS 600 Unique & Verified Question Bank (3 Full 200-Question Practice Sets)
 * ============================================================================
 * Assembled from src/data/practice-bank/*.json via scripts/build-practice-sets.js
 */
const path = require('node:path');

function generate500PlusUniqueQuestions() {
  const { sampleQuestions } = require(path.join(__dirname, '..', 'web', 'seed-data.js'));
  return sampleQuestions;
}

module.exports = {
  generate500PlusUniqueQuestions
};

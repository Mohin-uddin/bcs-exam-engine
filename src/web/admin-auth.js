/**
 * Admin key check shared by every /admin API (live exams, accounts, question reports).
 * - Production (NODE_ENV=production) without ADMIN_KEY: admin APIs stay locked instead of
 *   falling back to a guessable default key.
 * - Local development without ADMIN_KEY: "admin123", with a warning in the log.
 */
const crypto = require('node:crypto');

const PRODUCTION = process.env.NODE_ENV === 'production';
const KEY = process.env.ADMIN_KEY || (PRODUCTION ? '' : 'admin123');

if (!process.env.ADMIN_KEY) {
  console.warn(PRODUCTION
    ? '[admin] ADMIN_KEY is not set: the admin panel is locked until you set it.'
    : '[admin] ADMIN_KEY is not set: using the development key "admin123".');
}

const digest = s => crypto.createHash('sha256').update(String(s)).digest();

function isAdmin(req) {
  if (!KEY) return false;
  const given = req.headers['x-admin-key'];
  if (typeof given !== 'string' || !given) return false;
  return crypto.timingSafeEqual(digest(given), digest(KEY));
}

module.exports = { isAdmin };

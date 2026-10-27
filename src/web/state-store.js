/**
 * Small key -> JSON store for server state (live exams, and later payments/users).
 * - DATABASE_URL set (production, e.g. Neon Postgres): one row per key in table app_state
 * - otherwise: returns null, and callers keep using their local JSON files
 * Render's free plan wipes local files on every restart/deploy, so production needs the DB.
 */

function createStateStore() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;

  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: url,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
    max: 3
  });
  let ready = null;

  function init() {
    if (!ready) {
      ready = pool.query(`CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    }
    return ready;
  }

  return {
    kind: 'postgres',
    async get(key) {
      await init();
      const { rows } = await pool.query('SELECT value FROM app_state WHERE key = $1', [key]);
      return rows.length ? rows[0].value : null;
    },
    async set(key, value) {
      await init();
      await pool.query(
        `INSERT INTO app_state (key, value, updated_at) VALUES ($1, $2, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [key, JSON.stringify(value)]
      );
    },
    close: () => pool.end()
  };
}

module.exports = { createStateStore };

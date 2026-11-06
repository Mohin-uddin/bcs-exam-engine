#!/usr/bin/env node
/**
 * Copy the data/ folder of a local computer (accounts, live exams, question reports, study
 * progress) into the production database, without losing anything already on the server.
 *
 *   node scripts/import-local-data.js <folder>            -> shows what would change, writes nothing
 *   node scripts/import-local-data.js <folder> --apply    -> writes (stop the app first: pm2 stop sonarhorin)
 *   add --with-settings to also take plans, prices and bKash/Nagad numbers from the local copy
 *
 * Merge rules: nothing on the server is overwritten or removed.
 * - A local user whose phone number is already on the server is the same person: their payments,
 *   orders, live exam entries and progress are attached to the server account.
 * - Login sessions are not copied (people log in again once).
 * - Weekly exams made automatically on the local computer are skipped; the server makes its own.
 * - Before writing, the server's current values are saved to <folder>/server-backup-<time>.json.
 */
const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, '..');
const envFile = path.join(appDir, '.env');
if (!process.env.DATABASE_URL && fs.existsSync(envFile)) {
  Object.assign(process.env, require('dotenv').parse(fs.readFileSync(envFile)));
}
const { createStateStore } = require('../src/web/state-store');
const progressCore = require('../src/web/public/progress-core');

const args = process.argv.slice(2);
const dir = args.find(a => !a.startsWith('--'));
const APPLY = args.includes('--apply');
const WITH_SETTINGS = args.includes('--with-settings');

function readJson(file) {
  const p = path.join(dir, file);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function addById(target, items, mapItem = x => x) {
  const have = new Set(target.map(x => x.id));
  let added = 0;
  for (const item of items || []) {
    if (!item || !item.id || have.has(item.id)) continue;
    target.push(mapItem(item));
    have.add(item.id);
    added++;
  }
  return added;
}

async function main() {
  if (!dir || !fs.existsSync(dir)) {
    console.log('Usage: node scripts/import-local-data.js <data folder> [--apply] [--with-settings]');
    process.exit(1);
  }
  const store = createStateStore();
  if (!store) {
    console.log('DATABASE_URL is not set (run this inside ~/sonarhorin on the server).');
    process.exit(1);
  }

  const backup = {};
  const writes = {};
  const idMap = new Map(); // local user id -> server user id
  const mapUser = id => (id && idMap.has(id) ? idMap.get(id) : id);

  // ---------------- Accounts ----------------
  const localAcc = readJson('accounts.json');
  if (localAcc) {
    const server = (await store.get('accounts')) || {};
    backup.accounts = JSON.parse(JSON.stringify(server));
    for (const k of ['users', 'sessions', 'payments', 'orders']) if (!Array.isArray(server[k])) server[k] = [];

    const byPhone = new Map(server.users.map(u => [u.phone, u]));
    const serverIds = new Set(server.users.map(u => u.id));
    let newUsers = 0;
    let sameUsers = 0;
    for (const u of localAcc.users || []) {
      const twin = byPhone.get(u.phone);
      if (twin) {
        idMap.set(u.id, twin.id);
        sameUsers++;
        // Keep the later premium end date of the two
        if (u.premiumUntil && (!twin.premiumUntil || u.premiumUntil > twin.premiumUntil)) twin.premiumUntil = u.premiumUntil;
      } else if (!serverIds.has(u.id)) {
        server.users.push(u);
        byPhone.set(u.phone, u);
        serverIds.add(u.id);
        newUsers++;
      }
    }
    const pay = addById(server.payments, localAcc.payments, p => ({ ...p, userId: mapUser(p.userId) }));
    const ord = addById(server.orders, localAcc.orders, o => ({ ...o, userId: mapUser(o.userId) }));
    if (WITH_SETTINGS && localAcc.settings) server.settings = localAcc.settings;
    writes.accounts = server;
    console.log(`Accounts: ${newUsers} new users, ${sameUsers} already on the server (same phone), ` +
      `${pay} payments, ${ord} orders${WITH_SETTINGS ? ', settings taken from the local copy' : ', server settings kept'}`);
  }

  // ---------------- Live exams ----------------
  const localLive = readJson('live-exams.json');
  if (localLive) {
    const server = (await store.get('live-exams')) || { exams: [] };
    backup['live-exams'] = JSON.parse(JSON.stringify(server));
    if (!Array.isArray(server.exams)) server.exams = [];
    const exams = (localLive.exams || []).filter(e => !e.auto);
    const added = addById(server.exams, exams, e => ({
      ...e,
      candidates: (e.candidates || []).map(c => ({ ...c, userId: mapUser(c.userId) }))
    }));
    writes['live-exams'] = server;
    const skipped = (localLive.exams || []).length - exams.length;
    console.log(`Live exams: ${added} added${skipped ? `, ${skipped} automatic weekly exams skipped` : ''}`);
  }

  // ---------------- Question reports ----------------
  const localRep = readJson('question-reports.json');
  if (Array.isArray(localRep)) {
    const server = (await store.get('question-reports')) || [];
    backup['question-reports'] = JSON.parse(JSON.stringify(server));
    const added = addById(server, localRep, r => (r.user ? { ...r, user: { ...r.user, id: mapUser(r.user.id) } } : r));
    writes['question-reports'] = server;
    console.log(`Question reports: ${added} added`);
  }

  // ---------------- Study progress (one file per user) ----------------
  const progDir = path.join(dir, 'progress');
  if (fs.existsSync(progDir)) {
    let n = 0;
    for (const f of fs.readdirSync(progDir).filter(x => x.endsWith('.json'))) {
      const userId = mapUser(f.replace(/\.json$/, ''));
      const local = JSON.parse(fs.readFileSync(path.join(progDir, f), 'utf8'));
      const key = `progress:${userId}`;
      const current = await store.get(key);
      backup[key] = current;
      writes[key] = current ? progressCore.merge(current, local) : progressCore.sanitize(local);
      n++;
    }
    console.log(`Study progress: ${n} users`);
  }

  if (!Object.keys(writes).length) {
    console.log(`Nothing to import in ${dir} (expected accounts.json, live-exams.json, question-reports.json, progress/).`);
    await store.close();
    return;
  }
  if (!APPLY) {
    console.log('\nNothing written yet. Stop the app, then run again with --apply:');
    console.log('  pm2 stop sonarhorin && node scripts/import-local-data.js ' + dir + ' --apply && pm2 start sonarhorin');
    await store.close();
    return;
  }

  const backupFile = path.join(dir, `server-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backup));
  for (const [key, value] of Object.entries(writes)) await store.set(key, value);
  console.log(`\nDone. Server copy before the import: ${backupFile}`);
  await store.close();
}

main().catch(e => {
  console.error(`Import failed: ${e.message}`);
  process.exit(1);
});

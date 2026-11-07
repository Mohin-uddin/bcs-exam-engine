#!/usr/bin/env bash
# Runs every 2 minutes from cron (installed by setup.sh). When GitHub's main branch has new
# commits, it pulls them and reloads the app, so a merged pull request goes live by itself.
# If the new version does not answer, it goes back to the previous commit.
# Log: ~/sonarhorin/auto-update.log
set -uo pipefail
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PORT=3100
LOG="$APP_DIR/auto-update.log"
cd "$APP_DIR" || exit 1
export PATH="$PATH:/usr/local/bin:/usr/bin:$HOME/.npm-global/bin"

# Only one run at a time
exec 9>"$APP_DIR/.auto-update.lock"
flock -n 9 || exit 0

git fetch -q origin main || exit 0
OLD="$(git rev-parse HEAD)"
NEW="$(git rev-parse origin/main)"
[ "$OLD" = "$NEW" ] && exit 0
# A version that already failed to start is not tried again (the next merge is)
[ "$(cat "$APP_DIR/.auto-update.bad" 2>/dev/null)" = "$NEW" ] && exit 0

log() { echo "$(date '+%F %T') $*" >> "$LOG"; }
log "update ${OLD:0:7} -> ${NEW:0:7}"

reload() {
  npm install --omit=dev --no-audit --no-fund --loglevel=error >> "$LOG" 2>&1
  pm2 startOrReload deploy/oracle/ecosystem.config.cjs --update-env >> "$LOG" 2>&1
  for _ in $(seq 1 30); do curl -fs -o /dev/null "http://127.0.0.1:$PORT/" && return 0; sleep 1; done
  return 1
}

if ! git merge --ff-only -q origin/main >> "$LOG" 2>&1; then
  log "git pull failed (local changes on the server?), nothing changed"
  exit 1
fi
if reload; then
  pm2 save >/dev/null 2>&1
  log "OK, live: $(git log -1 --format='%h %s')"
else
  log "new version did not start, going back to ${OLD:0:7}"
  echo "$NEW" > "$APP_DIR/.auto-update.bad"
  git reset -q --hard "$OLD"
  reload && log "back on ${OLD:0:7}" || log "previous version did not start either, see: pm2 logs sonarhorin"
fi

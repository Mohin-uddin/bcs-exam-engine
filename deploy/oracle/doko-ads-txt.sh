#!/usr/bin/env bash
# Google AdSense reads ads.txt only from the root domain. While Sonar Horin runs on
# sonarhorin.dokoikeba.com, the file must answer at https://dokoikeba.com/ads.txt (Doko's site).
# This adds one rule to Doko's nginx site: /ads.txt is passed to Sonar Horin (127.0.0.1:3100),
# which writes the line from the Publisher ID saved in /admin. Nothing else of Doko changes.
#
# Run on the server:   bash ~/sonarhorin/deploy/oracle/doko-ads-txt.sh
# Safe to run again. A backup of Doko's file is kept; if nginx rejects the change it is put back.
set -euo pipefail
ROOT="${1:-dokoikeba.com}"
PORT=3100

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33m!! %s\033[0m\n' "$*"; }

# Doko's enabled nginx file: the one whose server_name has the bare root domain (not our sonarhorin file)
FILE=""
for f in /etc/nginx/sites-enabled/*; do
  [ "$(basename "$f")" = "sonarhorin" ] && continue
  if sudo grep -Eq "server_name[^;]*[[:space:]]${ROOT//./\\.}([[:space:]]|;)" "$f"; then FILE="$(readlink -f "$f")"; break; fi
done
[ -n "$FILE" ] || { warn "No nginx site with 'server_name $ROOT' found in /etc/nginx/sites-enabled"; exit 1; }
say "Doko's nginx file: $FILE"

if sudo grep -q 'location = /ads.txt' "$FILE"; then
  echo "already has an /ads.txt rule, nothing to change"
else
  BACKUP="$FILE.bak-adstxt-$(date +%F-%H%M%S)"
  sudo cp "$FILE" "$BACKUP"
  # After every server_name line that names the root domain, add the /ads.txt rule
  sudo sed -i -E "/server_name[^;]*[[:space:]]${ROOT//./\\.}([[:space:]]|;)/a\\
    # Google AdSense ads.txt from Sonar Horin (deploy/oracle/doko-ads-txt.sh)\\
    location = /ads.txt { proxy_pass http://127.0.0.1:${PORT}/ads.txt; proxy_set_header Host \$host; }" "$FILE"
  if sudo nginx -t; then
    sudo systemctl reload nginx
    echo "added; backup at $BACKUP"
  else
    sudo cp "$BACKUP" "$FILE"
    warn "nginx rejected the change; Doko's file is back as it was. Nothing changed."
    exit 1
  fi
fi

say "Check"
for u in "https://$ROOT/ads.txt" "https://$ROOT/" ; do
  printf '%s -> ' "$u"; curl -s -o /dev/null -w '%{http_code}\n' --max-time 15 "$u" || echo "no answer"
done
curl -s --max-time 15 "https://$ROOT/ads.txt" || true

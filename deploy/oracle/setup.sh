#!/usr/bin/env bash
# Install or update Sonar Horin on the Oracle VM, next to Doko.
# Run on the server from the app folder:   bash deploy/oracle/setup.sh sonarhorin.com
# Another domain later (e.g. a subdomain first): run it again with that name.
# Safe to run again: it pulls the latest code and restarts only the sonarhorin process.
#
# What it uses (none of Doko's pieces are changed):
#   app folder   ~/sonarhorin              (git clone of Mohin-uddin/bcs-exam-engine)
#   process      pm2 "sonarhorin" on 127.0.0.1:3100
#   database     own Docker container "sonarhorin_db" on 127.0.0.1:5433
#   web          /etc/nginx/sites-available/sonarhorin + Let's Encrypt for the domain only
set -euo pipefail

DOMAIN="${1:-sonarhorin.com}"
PORT=3100
DB_PORT=5433
DB_CONTAINER=sonarhorin_db
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SERVER_IP="$(curl -s -4 --max-time 5 https://api.ipify.org || true)"
cd "$APP_DIR"

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33m!! %s\033[0m\n' "$*"; }

say "1/6 Latest code"
git pull --ff-only -q || warn "git pull skipped (local changes?)"
npm install --omit=dev --no-audit --no-fund --loglevel=error

say "2/6 Database (own container, Doko's database is not touched)"
if ! docker ps -a --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  DB_PASS="$(openssl rand -hex 24)"
  docker run -d --name "$DB_CONTAINER" --restart unless-stopped \
    -e POSTGRES_USER=sonarhorin -e POSTGRES_PASSWORD="$DB_PASS" -e POSTGRES_DB=sonarhorin \
    -v sonarhorin_pgdata:/var/lib/postgresql/data \
    -p 127.0.0.1:$DB_PORT:5432 postgres:16-alpine >/dev/null
  echo "created $DB_CONTAINER"
else
  docker start "$DB_CONTAINER" >/dev/null
  echo "$DB_CONTAINER already exists"
fi
for _ in $(seq 1 30); do docker exec "$DB_CONTAINER" pg_isready -q -U sonarhorin && break; sleep 1; done

say "3/6 Settings (.env)"
if [ ! -f .env ]; then
  [ -n "${DB_PASS:-}" ] || { warn "Database exists but .env is missing; restore .env first."; exit 1; }
  echo "Type the values (nothing is shown while typing the password):"
  read -rsp "  SSLCommerz Store Password (sandbox, from the SSLCommerz email): " SSL_PASS </dev/tty; echo
  read -rsp "  Admin password for /admin (choose a strong one): " ADMIN_KEY </dev/tty; echo
  read -rp  "  Contact email shown on the site: " CONTACT_EMAIL </dev/tty
  umask 077
  cat > .env <<ENV
PORT=$PORT
DATABASE_URL=postgres://sonarhorin:$DB_PASS@127.0.0.1:$DB_PORT/sonarhorin
PUBLIC_URL=https://$DOMAIN
ADMIN_KEY=$ADMIN_KEY
CONTACT_EMAIL=$CONTACT_EMAIL
PAYMENT_GATEWAY=sslcommerz
PAYMENT_SANDBOX=true
SSLCOMMERZ_STORE_ID=sonar6ae0b32620118
SSLCOMMERZ_STORE_PASSWORD=$SSL_PASS
ENV
  echo ".env written (only you can read it). Change values later with: nano ~/sonarhorin/.env"
else
  echo ".env already exists, keeping it"
  # Domain changed since the first run: point the payment callbacks at the new one
  sed -i "s|^PUBLIC_URL=.*|PUBLIC_URL=https://$DOMAIN|" .env
fi

say "4/6 App (pm2: sonarhorin on port $PORT)"
if ss -ltnp 2>/dev/null | grep -q ":$PORT " && ! pm2 describe sonarhorin >/dev/null 2>&1; then
  warn "Port $PORT is used by something else. Stopping so nothing breaks."; exit 1
fi
pm2 startOrReload deploy/oracle/ecosystem.config.cjs --update-env
pm2 save >/dev/null
for _ in $(seq 1 20); do curl -fs -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 1; done
curl -fs -o /dev/null "http://127.0.0.1:$PORT/" && echo "app answers on 127.0.0.1:$PORT" || { warn "App did not start. See: pm2 logs sonarhorin"; exit 1; }

say "5/6 Nginx site for $DOMAIN"
sed -e "s/__DOMAIN__/$DOMAIN/g" -e "s/__PORT__/$PORT/g" deploy/oracle/nginx-sonarhorin.conf > /tmp/sonarhorin.nginx
# Write it on the first run or when the domain changed (certbot adds its HTTPS lines again in step 6)
if ! grep -q "server_name $DOMAIN " /etc/nginx/sites-available/sonarhorin 2>/dev/null; then
  sudo cp /tmp/sonarhorin.nginx /etc/nginx/sites-available/sonarhorin
  sudo ln -sf /etc/nginx/sites-available/sonarhorin /etc/nginx/sites-enabled/sonarhorin
fi
sudo nginx -t && sudo systemctl reload nginx

say "6/6 HTTPS certificate"
DNS_IP="$(getent ahostsv4 "$DOMAIN" | awk '{print $1; exit}' || true)"
if [ -n "$SERVER_IP" ] && [ "$DNS_IP" != "$SERVER_IP" ]; then
  warn "$DOMAIN points to '${DNS_IP:-nothing}', not this server ($SERVER_IP)."
  warn "Add a DNS A record for $DOMAIN -> $SERVER_IP (Cloudflare: grey cloud, DNS only), wait 5 minutes, then run this script again."
elif sudo test -d "/etc/letsencrypt/live/$DOMAIN"; then
  echo "certificate already there"
else
  NAMES=(-d "$DOMAIN")
  [ "$(getent ahostsv4 "www.$DOMAIN" | awk '{print $1; exit}' || true)" = "$SERVER_IP" ] && NAMES+=(-d "www.$DOMAIN")
  sudo certbot --nginx "${NAMES[@]}" --non-interactive --agree-tos --redirect \
    --register-unsafely-without-email || warn "certbot failed; check DNS and run this script again"
fi

say "Check"
printf 'Sonar Horin  https://%s  -> ' "$DOMAIN"; curl -s -o /dev/null -w '%{http_code}\n' --max-time 15 "https://$DOMAIN/" || echo "not yet"
printf 'Doko         https://dokoikeba.com -> '; curl -s -o /dev/null -w '%{http_code}\n' --max-time 15 https://dokoikeba.com/ || echo "no answer"
pm2 ls

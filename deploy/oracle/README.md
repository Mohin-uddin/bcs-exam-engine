# Sonar Horin on the Oracle VM (next to Doko)

From the Mac, one command installs or updates everything:

```
ssh -t ubuntu@140.238.54.24 'git clone -q https://github.com/Mohin-uddin/bcs-exam-engine ~/sonarhorin 2>/dev/null; cd ~/sonarhorin && git pull -q && bash deploy/oracle/setup.sh sonarhorin.com'
```

The first run asks for the SSLCommerz Store Password, an admin password and a contact email,
and writes them to `~/sonarhorin/.env` on the server (never into git).

- App: pm2 process `sonarhorin` on 127.0.0.1:3100 (`pm2 logs sonarhorin`)
- Database: Docker container `sonarhorin_db` (Postgres 16) on 127.0.0.1:5433, volume `sonarhorin_pgdata`
- Nginx: `/etc/nginx/sites-available/sonarhorin`, HTTPS by certbot for the domain only
- DNS (Cloudflare): A records `@` and `www` -> 140.238.54.24, DNS only (grey cloud)

Doko's app, database, Nginx site and pm2 processes are not changed.

**Auto-update:** setup.sh adds a cron job (`deploy/oracle/auto-update.sh`, every 2 minutes).
When `main` on GitHub has new commits it pulls them, reloads pm2 and checks the app answers;
if the new version does not start it goes back to the previous commit. Log: `~/sonarhorin/auto-update.log`.
So after this one run from the Mac, merging a pull request is enough to put it live.

**OTP SMS:** cheapest is your own Android phone + SIM with the free "SMS Gateway for Android" app.
Type the app's Username / Password in `/admin` -> "📱 OTP SMS" (no server login needed).
Or set `SMS_PROVIDER` (bulksmsbd / smsnetbd) in `~/sonarhorin/.env`; that wins over /admin.
Backup: `docker exec sonarhorin_db pg_dump -U sonarhorin sonarhorin | gzip > ~/backups/sonarhorin-$(date +%F).sql.gz`

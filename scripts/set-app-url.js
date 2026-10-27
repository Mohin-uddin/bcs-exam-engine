// Point the Android app at your deployed web app.
// Usage: npm run app:url -- https://your-domain.com
//        npm run app:url -- http://10.0.2.2:3000   (emulator -> your laptop's localhost)
const fs = require('fs');
const path = require('path');

const url = (process.argv[2] || '').replace(/\/+$/, '');
if (!/^https?:\/\/[^/]+/.test(url)) {
  console.error('Usage: npm run app:url -- https://your-domain.com');
  process.exit(1);
}

const root = path.join(__dirname, '..');
const cfgPath = path.join(root, 'capacitor.config.json');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
cfg.server.url = url;
// Plain http is only for local testing (emulator / LAN); production must be https.
cfg.server.cleartext = url.startsWith('http://');
fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');

fs.writeFileSync(
  path.join(root, 'mobile/www/config.js'),
  `// Set by: npm run app:url -- https://your-domain.com\nwindow.APP_URL = ${JSON.stringify(url)};\n`
);
console.log(`App URL set to ${url}. Now run: npx cap sync android`);

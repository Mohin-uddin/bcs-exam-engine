// PM2 process for Sonar Horin on the Oracle VM. Settings come from the .env in the app folder.
const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, '..', '..');
const env = require('dotenv').parse(fs.readFileSync(path.join(appDir, '.env')));

module.exports = {
  apps: [{
    name: 'sonarhorin',
    cwd: appDir,
    script: 'src/web/server.js',
    // One process: live exam and payment state is kept in memory between DB writes
    exec_mode: 'fork',
    instances: 1,
    max_memory_restart: '1G',
    env: { NODE_ENV: 'production', ...env }
  }]
};

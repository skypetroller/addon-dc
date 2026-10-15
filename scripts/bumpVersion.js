// Bumps the patch version in src/manifest.json and src/server.js so that
// Stremio clients re-sync after the data updater commits new content.
// Run by .github/workflows/update-data.yml; safe to run manually.
const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '../src/manifest.json');
const serverPath = path.join(__dirname, '../src/server.js');

let manifestSrc = fs.readFileSync(manifestPath, 'utf8');
const match = manifestSrc.match(/"version": "(\d+)\.(\d+)\.(\d+)"/);
if (!match) {
  console.error('❌ Could not find "version" in src/manifest.json');
  process.exit(1);
}

const newVersion = `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;

manifestSrc = manifestSrc.replace(/"version": "\d+\.\d+\.\d+"/, `"version": "${newVersion}"`);
fs.writeFileSync(manifestPath, manifestSrc);

let serverSrc = fs.readFileSync(serverPath, 'utf8');
serverSrc = serverSrc.replace(/version: "\d+\.\d+\.\d+"/g, `version: "${newVersion}"`);
fs.writeFileSync(serverPath, serverSrc);

console.log(`✅ Bumped version to ${newVersion}`);

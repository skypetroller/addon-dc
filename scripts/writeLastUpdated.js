// Stamps the current time into Data/lastUpdated.json on every updater run.
// /health and the configure page read it to show how fresh the data is.
const fs = require('fs');
const path = require('path');

const out = path.join(__dirname, '../Data/lastUpdated.json');
const payload = { updatedAt: new Date().toISOString() };
fs.writeFileSync(out, JSON.stringify(payload, null, 2) + '\n');
console.log(`✅ Stamped Data/lastUpdated.json with ${payload.updatedAt}`);

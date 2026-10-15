// Rebuilds the James Gunn chronological catalog file from the refreshed
// curated data files. Run after the fetch* scripts (see .github/workflows).
const fs = require('fs');
const path = require('path');

const anim = require('../Data/animationsData.js');
const series = require('../Data/seriesData.js');
const movies = require('../Data/moviesData.js');

const find = (arr, title, year) =>
  arr.find((i) => i.title === title && (!year || i.releaseYear === year));

// James Gunn DCU in story order (The Suicide Squad bridges DCEU -> DCU).
const gunnOrder = [
  [movies, 'The Suicide Squad', '2021'],
  [movies, 'Blue Beetle', '2023'],
  [anim, 'Creature Commandos', '2024'],
  [movies, 'Superman', '2025'],
  [series, 'Peacemaker', undefined],
  [series, 'Lanterns', '2026'],
  [movies, 'Supergirl', '2026'],
  [movies, 'Clayface', '2026'],
  [movies, 'Man of Tomorrow', '2027'],
];

const out = [];
for (const [arr, title, year] of gunnOrder) {
  const entry = find(arr, title, year);
  if (!entry) {
    console.warn(`   ⚠️ "${title}" not found in source data, skipping.`);
    continue;
  }
  out.push(entry);
}

const outPath = path.join(__dirname, '../Data/dcuGunnChronologicalData.js');
fs.writeFileSync(outPath, `module.exports = ${JSON.stringify(out, null, 2)};\n`);
console.log(`✅ Wrote ${out.length} Gunn chronological items to dcuGunnChronologicalData.js`);

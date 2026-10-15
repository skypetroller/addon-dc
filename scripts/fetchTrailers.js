// Fetches YouTube trailer IDs for catalog entries that don't have one yet and
// stores them as `trailer` on the entry (shown by Stremio as a trailer button).
// Runs after the fetch scripts in the weekly workflow, so steady-state runs
// only look up brand-new titles. Every lookup is shared across files: an entry
// that appears in several catalogs (movie + release + chronological...) gets
// the same key everywhere.
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const TMDB_API_KEY = process.env.TMDB_API_KEY;

const FILES = [
  'moviesData.js',
  'seriesData.js',
  'animationsData.js',
  'DCEUMovies.js',
  'DCSeries.js',
  'everythingbatman.js',
  'everythingbatmananimation.js',
  'everythingsuperman.js',
  'everythingsupermananimation.js',
  'releaseData.js',
  'dcuGunnChronologicalData.js',
  'chronologicalData.js',
  'elseworldsData.js',
  'arrowverseData.js',
  'dcauData.js',
  'dcamuData.js',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function load(file) {
  const full = path.join(__dirname, '../Data', file);
  if (!fs.existsSync(full)) return null;
  delete require.cache[require.resolve(full)];
  const data = require(full);
  return Array.isArray(data) ? data : null;
}

function pickTrailer(videos) {
  const yt = (videos || []).filter((v) => v && v.site === 'YouTube' && v.key);
  const ranked =
    yt.find((v) => v.type === 'Trailer' && v.official && v.iso_639_1 === 'en') ||
    yt.find((v) => v.type === 'Trailer' && v.official) ||
    yt.find((v) => v.type === 'Trailer') ||
    yt.find((v) => v.type === 'Teaser');
  return ranked ? ranked.key : null;
}

async function fetchTrailerKey(media, tmdbId) {
  const res = await axios.get(
    `https://api.themoviedb.org/3/${media}/${tmdbId}/videos?api_key=${TMDB_API_KEY}&language=en-US`,
    { timeout: 15000 }
  );
  return pickTrailer(res.data?.results);
}

async function main() {
  console.log('🎬 Collecting trailer IDs...');
  const files = FILES.map((name) => ({ name, data: load(name) })).filter((f) => f.data);

  // Unique lookups needed (entries missing a trailer).
  const needed = new Map(); // key -> { media, tmdbId }
  for (const { data } of files) {
    for (const item of data) {
      if (item.trailer || !item.tmdbId) continue;
      const media = (item.type === 'series' || item.type === 'tv') ? 'tv' : 'movie';
      needed.set(`${media}-${item.tmdbId}`, { media, tmdbId: item.tmdbId });
    }
  }
  console.log(`   ${needed.size} titles need a trailer lookup.`);

  const found = new Map(); // `${media}-${tmdbId}` -> key
  let done = 0;
  for (const [k, { media, tmdbId }] of needed) {
    try {
      const key = await fetchTrailerKey(media, tmdbId);
      if (key) found.set(k, key);
    } catch (err) {
      console.warn(`   ⚠️ videos fetch failed for ${media}/${tmdbId}: ${err.message}`);
    }
    done++;
    if (done % 25 === 0) console.log(`   ... ${done}/${needed.size}`);
    await sleep(60);
  }
  console.log(`   Found trailers for ${found.size}/${needed.size} titles.`);

  // Apply to every file (and every duplicate entry), then write back.
  let updatedFiles = 0;
  let updatedEntries = 0;
  for (const { name, data } of files) {
    let changed = false;
    for (const item of data) {
      if (item.trailer || !item.tmdbId) continue;
      const media = (item.type === 'series' || item.type === 'tv') ? 'tv' : 'movie';
      const key = found.get(`${media}-${item.tmdbId}`);
      if (key) {
        item.trailer = key;
        updatedEntries++;
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(
        path.join(__dirname, '../Data', name),
        `module.exports = ${JSON.stringify(data, null, 2)};\n`
      );
      updatedFiles++;
    }
  }
  console.log(`✅ Trailers applied: ${updatedEntries} entries across ${updatedFiles} files.`);
}

main().catch((err) => {
  console.error('❌ Trailer fetch failed:', err);
  process.exit(1);
});

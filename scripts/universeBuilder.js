// Shared helper for the hand-curated universe catalogs (Elseworlds, Arrowverse,
// DCAU, DCAMU). For every planned title it resolves, in order:
//   1. the refreshed source files (movies/series/animations — fresh metadata
//      every weekly run, zero API calls),
//   2. the existing curated output file (so fetched-once entries are never
//      refetched),
//   3. a one-time TMDB lookup (only for titles nothing else has yet).
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const OMDB_API_KEY = process.env.OMDB_API_KEY;

const SOURCE_LOADERS = [
  () => require('../Data/moviesData.js'),
  () => require('../Data/seriesData.js'),
  () => require('../Data/animationsData.js'),
];

function loadExisting(outFile) {
  try {
    if (fs.existsSync(outFile)) {
      delete require.cache[require.resolve(outFile)];
      const data = require(outFile);
      if (Array.isArray(data)) return data;
    }
  } catch {
    // Fall through to empty
  }
  return [];
}

function cleanTitle(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function findIn(arr, title, year) {
  const want = cleanTitle(title);
  return arr.find((i) => {
    if (cleanTitle(i.title) !== want) return false;
    if (!year) return true;
    return String(i.releaseYear) === String(year);
  });
}

async function fetchEntry(media, title, year) {
  const isMovie = media === 'movie';
  try {
    let url =
      `https://api.themoviedb.org/3/search/${media}?api_key=${TMDB_API_KEY}` +
      `&query=${encodeURIComponent(title)}&language=en-US`;
    if (year) {
      url += isMovie ? `&primary_release_year=${year}` : `&first_air_date_year=${year}`;
    }
    const searchRes = await axios.get(url, { timeout: 20000 });
    let pick = (searchRes.data?.results || [])[0];
    if (!pick && year) {
      // Retry without the year filter (TMDB date metadata is sometimes off).
      const retry = await axios.get(
        `https://api.themoviedb.org/3/search/${media}?api_key=${TMDB_API_KEY}` +
          `&query=${encodeURIComponent(title)}&language=en-US`,
        { timeout: 20000 }
      );
      pick = (retry.data?.results || [])[0];
    }
    if (!pick) {
      console.warn(`   ⚠️ No TMDB match for "${title}" (${year})`);
      return null;
    }

    const detailsRes = await axios.get(
      `https://api.themoviedb.org/3/${media}/${pick.id}?api_key=${TMDB_API_KEY}` +
        `&language=en-US&append_to_response=external_ids`,
      { timeout: 20000 }
    );
    const details = detailsRes.data;
    if (!details || !details.poster_path || !details.overview || !details.overview.trim()) {
      console.warn(`   ⚠️ Missing poster/overview for "${title}" — skipping.`);
      return null;
    }

    const imdbId = details.external_ids?.imdb_id || null;
    let ratings = [];
    if (imdbId && OMDB_API_KEY) {
      try {
        const omdb = await axios.get(`https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_API_KEY}`, {
          timeout: 10000,
        });
        ratings = omdb.data?.Ratings || [];
      } catch {
        // Ratings are optional — quota exhaustion is non-fatal here.
      }
    }

    const releaseDate = details.release_date || details.first_air_date || null;
    return {
      tmdbId: pick.id,
      title: (details.title || details.name || title).trim(),
      type: isMovie ? 'movie' : 'series',
      imdbId: imdbId || `tmdb_${pick.id}`,
      id: `dc_${imdbId || 'tmdb_' + pick.id}`,
      releaseYear: (releaseDate || String(year || 'TBD')).split('-')[0],
      releaseDate,
      poster: `https://image.tmdb.org/t/p/w500${details.poster_path}`,
      ratings,
      genres: details.genres || [],
      overview: details.overview,
      addedAt: new Date().toISOString().split('T')[0],
    };
  } catch (err) {
    console.warn(`   ⚠️ Fetch failed for "${title}" (${year}): ${err.message}`);
    return null;
  }
}

// plan: [{ title, year, media }] — media: 'movie' | 'tv' (default 'tv').
async function buildUniverse({ label, outFile, plan }) {
  const sources = SOURCE_LOADERS.map((load) => load());
  const existing = loadExisting(outFile);
  const out = [];

  for (const step of plan) {
    const { title, year, media = 'tv' } = step;
    let entry =
      sources.map((arr) => findIn(arr, title, year)).find(Boolean) ||
      existing.find((i) => cleanTitle(i.title) === cleanTitle(title));
    if (!entry) {
      console.log(`   Fetching missing entry: "${title}" (${year}) as ${media}...`);
      entry = await fetchEntry(media, title, year);
    }
    if (!entry) {
      console.warn(`   ⚠️ "${title}" unresolved — skipping.`);
      continue;
    }
    out.push(entry);
  }

  fs.writeFileSync(outFile, `module.exports = ${JSON.stringify(out, null, 2)};\n`);
  console.log(`✅ Wrote ${out.length} ${label} items to ${path.basename(outFile)}`);
}

module.exports = { buildUniverse };

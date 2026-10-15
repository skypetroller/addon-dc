// Auto-discovers new DC releases via the TMDB discover API and appends
// genuinely new entries (by TMDb ID) to the curated data files.
// Additive only: never deletes or modifies existing entries.
// New items land in Movies / Series / Release automatically; hand-placed
// catalogs (Gunn chronological) still need manual curation.
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const OMDB_API_KEY = process.env.OMDB_API_KEY;

// Core DC production companies only (OR). WB Pictures/Animation IDs are
// deliberately excluded — they'd match every Warner release.
const DC_COMPANY_IDS = '9993|128064|184898';
const CORE_DC_IDS = [9993, 128064, 184898];
const ANIMATION_GENRE_ID = 16;

// Only consider releases from the last 2 years + upcoming.
const cutoff = new Date();
cutoff.setFullYear(cutoff.getFullYear() - 2);
const CUTOFF = cutoff.toISOString().split('T')[0];

const FILES = {
  movies: path.join(__dirname, '../Data/moviesData.js'),
  series: path.join(__dirname, '../Data/seriesData.js'),
  animations: path.join(__dirname, '../Data/animationsData.js'),
};

function load(file) {
  delete require.cache[require.resolve(file)];
  const data = require(file);
  return Array.isArray(data) ? data : [];
}

async function discover(media) {
  const isMovie = media === 'movie';
  const dateParam = isMovie ? 'primary_release_date.gte' : 'first_air_date.gte';
  const sort = isMovie ? 'primary_release_date.desc' : 'first_air_date.desc';
  const results = [];
  let page = 1;
  let totalPages = 1;
  do {
    const url =
      `https://api.themoviedb.org/3/discover/${media}?api_key=${TMDB_API_KEY}` +
      `&language=en-US&include_adult=false&with_companies=${DC_COMPANY_IDS}` +
      `&${dateParam}=${CUTOFF}&sort_by=${sort}&page=${page}`;
    try {
      const res = await axios.get(url, { timeout: 20000 });
      results.push(...(res.data.results || []));
      totalPages = res.data.total_pages || 1;
    } catch (err) {
      console.warn(`   ⚠️ discover/${media} page ${page} failed: ${err.message}`);
      break;
    }
    page++;
  } while (page <= totalPages);
  console.log(`   discover/${media}: ${results.length} raw candidates since ${CUTOFF}`);
  return results;
}

async function getDetails(media, id) {
  try {
    const res = await axios.get(
      `https://api.themoviedb.org/3/${media}/${id}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=external_ids`,
      { timeout: 20000 }
    );
    return res.data || null;
  } catch {
    return null;
  }
}

async function getRatings(imdbId) {
  if (!imdbId || !OMDB_API_KEY) return [];
  try {
    const res = await axios.get(`https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_API_KEY}`, {
      timeout: 10000,
    });
    return res.data?.Ratings || [];
  } catch {
    return []; // Quota exhausted or unreleased — non-fatal, ratings fill in later
  }
}

function sortByYear(a, b) {
  return (parseInt(a.releaseYear, 10) || 9999) - (parseInt(b.releaseYear, 10) || 9999);
}

async function main() {
  console.log('🔍 Discovering new DC releases...');
  const movies = load(FILES.movies);
  const series = load(FILES.series);
  const animations = load(FILES.animations);
  const knownIds = new Set([...movies, ...series, ...animations].map((i) => i.tmdbId));

  const [movieResults, tvResults] = await Promise.all([discover('movie'), discover('tv')]);
  const added = { movies: 0, series: 0, animations: 0 };
  const addedEntries = [];

  for (const [media, results, fallbackType] of [
    ['movie', movieResults, 'movie'],
    ['tv', tvResults, 'series'],
  ]) {
    for (const r of results) {
      if (knownIds.has(r.id)) continue;
      const details = await getDetails(media, r.id);
      if (!details) continue;

      const title = (details.title || details.name || '').trim();
      const releaseDate = details.release_date || details.first_air_date || null;
      const releaseYear = (releaseDate || 'TBD').split('-')[0];
      const genres = details.genres || [];

      // Must be produced by a core DC company (filters out tag-alongs).
      const companies = details.production_companies || [];
      if (!companies.some((c) => c && CORE_DC_IDS.includes(c.id))) continue;

      // Skip companion podcasts/talk shows — not catalog content.
      if (/podcast/i.test(title) || genres.some((g) => g && g.id === 10767)) {
        console.log(`   ⏭️ "${title}" — companion/talk content, skipping`);
        continue;
      }

      // Skip shorts (kids' interstitials etc.), but allow unknown runtimes
      // so unreleased films/shows aren't blocked.
      if (media === 'movie' && details.runtime && details.runtime < 45) {
        console.log(`   ⏭️ "${title}" — short (${details.runtime} min), skipping`);
        continue;
      }
      const epRuntime = (details.episode_run_time || []).find((r) => r > 0) || 0;
      if (media === 'tv' && epRuntime && epRuntime < 11) {
        console.log(`   ⏭️ "${title}" — shorts series (${epRuntime} min eps), skipping`);
        continue;
      }

      // Must have usable metadata.
      if (!details.poster_path || !details.overview || !details.overview.trim()) {
        console.log(`   ⏭️ "${details.title || details.name}" — no poster/overview yet, will retry next run`);
        continue;
      }

      const imdbId = details.external_ids?.imdb_id || `tmdb_${r.id}`;
      const isAnimated = genres.some((g) => g && g.id === ANIMATION_GENRE_ID);
      const ratings = await getRatings(details.external_ids?.imdb_id);

      const entry = {
        tmdbId: r.id,
        title,
        type: isAnimated ? (media === 'tv' ? 'series' : 'movie') : fallbackType,
        imdbId,
        id: `dc_${imdbId}`,
        releaseYear,
        releaseDate,
        poster: `https://image.tmdb.org/t/p/w500${details.poster_path}`,
        overview: details.overview,
        ratings,
        genres,
        addedAt: new Date().toISOString().split('T')[0],
        discovered: true,
      };

      if (isAnimated) {
        animations.push(entry);
        added.animations++;
      } else if (media === 'movie') {
        movies.push(entry);
        added.movies++;
      } else {
        series.push(entry);
        added.series++;
      }
      knownIds.add(r.id);
      addedEntries.push({ title, year: releaseYear, type: isAnimated ? 'animation' : fallbackType });
      console.log(`   ➕ New ${isAnimated ? 'animated' : fallbackType}: "${title}" (${releaseYear})`);
    }
  }

  movies.sort(sortByYear);
  series.sort(sortByYear);
  animations.sort(sortByYear);
  for (const [file, data] of [
    [FILES.movies, movies],
    [FILES.series, series],
    [FILES.animations, animations],
  ]) {
    fs.writeFileSync(file, `module.exports = ${JSON.stringify(data, null, 2)};\n`);
  }
  // Machine-readable report consumed by the update workflow (commit message).
  fs.writeFileSync(
    path.join(__dirname, '../discovery-report.json'),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), items: addedEntries }, null, 2)}\n`
  );
  console.log(
    `✅ Discovery complete: +${added.movies} movies, +${added.series} series, +${added.animations} animations`
  );
}

main().catch((err) => {
  console.error('❌ Discovery failed:', err);
  process.exit(1);
});

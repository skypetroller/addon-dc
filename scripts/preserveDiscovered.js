// Merge helper shared by the curated fetch scripts.
// The fetch scripts rebuild their data files from hardcoded title lists,
// which would otherwise drop:
//   1. entries added by discoverNewReleases.js (marked `discovered: true`), and
//   2. the `addedAt` timestamp on every existing entry (used by the
//      New Releases catalog).
// Usage: const merged = mergeDiscovered(finalData, outputPath);
const fs = require('fs');

function mergeDiscovered(newData, outputPath) {
  let old = [];
  try {
    if (fs.existsSync(outputPath)) {
      delete require.cache[require.resolve(outputPath)];
      old = require(outputPath);
      if (!Array.isArray(old)) old = [];
    }
  } catch {
    old = [];
  }

  const key = (i) => String(i.tmdbId || i.imdbId || i.id);
  const byKey = new Map(old.map((i) => [key(i), i]));
  const newKeys = new Set(newData.map(key));

  // 1. Carry over addedAt, the discovered marker, the stored trailer and the
  //    full release date (trailers are fetched separately by fetchTrailers.js,
  //    not by the curated fetch scripts).
  for (const item of newData) {
    const prev = byKey.get(key(item));
    if (prev) {
      if (prev.addedAt && !item.addedAt) item.addedAt = prev.addedAt;
      if (prev.discovered) item.discovered = true;
      if (prev.trailer && !item.trailer) item.trailer = prev.trailer;
      if (prev.releaseDate && !item.releaseDate) item.releaseDate = prev.releaseDate;
    }
  }

  // 2. Keep auto-discovered entries the curated rebuild didn't include.
  for (const item of old) {
    if (item.discovered && !newKeys.has(key(item))) {
      newData.push(item);
    }
  }

  return newData;
}

module.exports = { mergeDiscovered };

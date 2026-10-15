// CI guard: aborts the auto-update if the refresh degraded the data,
// e.g. when the OMDb daily quota is exhausted and all ratings come back empty.
// Compares the working tree against the last committed state and fails when:
//   - any catalog file loses items, or
//   - ratings / overview / poster coverage drops sharply (quota failure or
//     broken metadata fetch signature — the server's fast path depends on
//     stored overviews and posters being present).
const { execSync } = require('child_process');

const FILES = [
  'Data/moviesData.js',
  'Data/seriesData.js',
  'Data/animationsData.js',
  'Data/DCEUMovies.js',
  'Data/DCSeries.js',
  'Data/everythingbatman.js',
  'Data/everythingsuperman.js',
  'Data/releaseData.js',
  'Data/dcuGunnChronologicalData.js',
  'Data/elseworldsData.js',
  'Data/arrowverseData.js',
  'Data/dcauData.js',
  'Data/dcamuData.js',
];

function loadFromGit(rev, file) {
  const src = execSync(`git show ${rev}:${file}`, { encoding: 'utf8' });
  const mod = new module.constructor();
  mod._compile(src, file);
  return mod.exports;
}

function stats(data) {
  const rated = data.filter((i) => i.ratings && i.ratings.length > 0).length;
  const withOverview = data.filter((i) => i.overview && String(i.overview).trim()).length;
  const withPoster = data.filter((i) => i.poster).length;
  return { count: data.length, rated, withOverview, withPoster };
}

let failed = false;
for (const file of FILES) {
  let before, after;
  try {
    before = stats(loadFromGit('HEAD', file));
  } catch {
    console.log(`SKIP ${file}: not in HEAD (new file)`);
    continue;
  }
  delete require.cache[require.resolve(`../${file}`)];
  after = stats(require(`../${file}`));

  if (after.count < before.count) {
    console.error(`❌ ${file}: item count dropped ${before.count} -> ${after.count}`);
    failed = true;
  }
  // Coverage checks only fail on collapse, so legitimately missing metadata
  // for brand-new unreleased titles never trips the guard.
  if (before.rated > 0 && after.rated < before.rated * 0.5) {
    console.error(
      `❌ ${file}: rated entries collapsed ${before.rated} -> ${after.rated} (likely OMDb quota exhausted)`
    );
    failed = true;
  }
  if (before.withOverview > 0 && after.withOverview < before.withOverview * 0.5) {
    console.error(`❌ ${file}: overview coverage collapsed ${before.withOverview} -> ${after.withOverview}`);
    failed = true;
  }
  if (before.withPoster > 0 && after.withPoster < before.withPoster * 0.5) {
    console.error(`❌ ${file}: poster coverage collapsed ${before.withPoster} -> ${after.withPoster}`);
    failed = true;
  }
  if (!failed) {
    console.log(
      `✅ ${file}: ${after.count} items, ${after.rated} rated, ${after.withOverview} with overview, ${after.withPoster} with poster`
    );
  }
}

if (failed) {
  console.error('\n❌ Data quality guard failed — refusing to commit degraded data.');
  process.exit(1);
}
console.log('\n✅ Data quality guard passed.');

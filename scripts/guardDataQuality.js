// CI guard: aborts the auto-update if the refresh degraded the data,
// e.g. when the OMDb daily quota is exhausted and all ratings come back empty.
// Compares the working tree against the last committed state and fails when:
//   - any catalog file loses items, or
//   - the number of entries with ratings drops sharply (quota failure signature).
const { execSync } = require('child_process');

const FILES = [
  'Data/moviesData.js',
  'Data/seriesData.js',
  'Data/DCEUMovies.js',
  'Data/DCSeries.js',
  'Data/everythingbatman.js',
  'Data/everythingsuperman.js',
  'Data/releaseData.js',
  'Data/dcuGunnChronologicalData.js',
];

function loadFromGit(rev, file) {
  const src = execSync(`git show ${rev}:${file}`, { encoding: 'utf8' });
  const mod = new module.constructor();
  mod._compile(src, file);
  return mod.exports;
}

function stats(data) {
  const rated = data.filter((i) => i.ratings && i.ratings.length > 0).length;
  return { count: data.length, rated };
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
  // Ratings may legitimately be empty for unreleased titles; only fail on collapse.
  if (before.rated > 0 && after.rated < before.rated * 0.5) {
    console.error(
      `❌ ${file}: rated entries collapsed ${before.rated} -> ${after.rated} (likely OMDb quota exhausted)`
    );
    failed = true;
  }
  if (!failed) console.log(`✅ ${file}: ${after.count} items, ${after.rated} rated`);
}

if (failed) {
  console.error('\n❌ Data quality guard failed — refusing to commit degraded data.');
  process.exit(1);
}
console.log('\n✅ Data quality guard passed.');

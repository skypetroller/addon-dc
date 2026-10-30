# 🦇 DC Universe Add-on for Stremio

A self-hosted fork of [tapframe/addon-dc](https://github.com/tapframe/addon-dc) that puts a curated DC library inside Stremio — and **keeps itself up to date automatically**. New movies, series and animations are discovered from TMDb twice a week, committed by CI, and served fresh within the hour.

**Live addon:** https://addon-dc-ila1.onrender.com
**Configure page:** https://addon-dc-ila1.onrender.com/configure

---

## ✨ Features

*   🤖 **Automatic updates** — GitHub Actions refreshes every catalog twice a week (Mondays + Thursdays), auto-discovers new DC releases via TMDb, and commits them with a version bump. No manual pings.
*   🕰️ **Curated universes** — James Gunn DCU in story order, Zack Snyder DCEU in story order, Arrowverse, the classic DCAU, the 15-film DCAMU, and Elseworlds (Joker / The Batman / The Penguin).
*   📅 **Coming Soon** — announced titles with a confirmed future release date.
*   🔍 **Search, genre filters & paging** — every catalog ships a search box, a genre dropdown and infinite scrolling.
*   ▶️ **Trailers** — YouTube trailer links are stored with the data and surfaced by Stremio.
*   🆕 **New Releases** — everything added to the library in the last 120 days, animations included.
*   ⭐ **RPDB support (optional)** — show ratings on posters by adding your [RatingPosterDB](https://ratingposterdb.com) API key on the configure page.
*   🛡️ **Data quality guard** — CI refuses to commit degraded data (counting drops, missing posters/overviews/ratings after a quota hiccup), and weekly failures open a GitHub issue automatically.
*   🌡️ **Freshness visible** — the configure page footer shows the last data refresh, `/health` reports it as JSON, and a keep-alive workflow prevents cold starts on Render's free tier.

---

## 📦 Installation

### Standard installation

Use the addon URL directly:

```
https://addon-dc-ila1.onrender.com/v2/manifest.json
```

The plain `/manifest.json` URL still works, but it is kept only as an alias for existing installs. Stremio pins each addon record to the exact URL it was installed from, so accounts that added the old URL can keep getting a stale snapshot. New installs should use `/v2/manifest.json`.

### Custom catalog configuration

1. Visit the configuration page: https://addon-dc-ila1.onrender.com/configure
2. Select the catalogs you want (optionally add your RPDB key)
3. Click **Install addon**

The install URL encodes your selection, e.g. `https://addon-dc-ila1.onrender.com/catalog/dc-new,dc-movies/manifest.json`.

---

## 📚 Catalogs

| Catalog | Contents |
| --- | --- |
| **New Releases** | DC titles added in the last 120 days |
| **James Gunn Chronological** | DCU movies & shows in story order |
| **Zack Snyder Chronological** | Snyder-era DCEU in story order |
| **Coming Soon** | Announced titles with a confirmed future date |
| **DC Elseworlds** | Joker, The Batman, The Penguin & more |
| **Arrowverse** | The CW multiverse shows in premiere order |
| **DC Animated Universe** | Bruce Timm's DCAU in viewing order |
| **DC Animated Movie Universe** | The 15-film DCAMU, Flashpoint to Apokolips War |
| **Release Order** | All non-animated titles by release date |
| **Movies** | All live-action DC movies |
| **DCEU Movies** | The official DCEU collection |
| **Series** | All live-action DC series |
| **DC Modern Series** | Live-action series from the 2010s on |
| **Animations** | All animated features and series |
| **Batman / Superman Animations** | Character-focused animated collections |
| **Batman / Superman Collections** | Character-focused live-action movies |

---

## 🤖 How the automatic updates work

`.github/workflows/update-data.yml` runs every **Monday and Thursday at 06:00 UTC** (and on demand from the Actions tab):

1. Re-fetches every curated catalog from TMDb/OMDb (posters, overviews, ratings, release dates).
2. Discovers new DC releases from the last 2 years and appends genuinely new titles.
3. Rebuilds the derived catalogs (Gunn order, Elseworlds, Arrowverse, DCAU, DCAMU, release data).
4. Stores YouTube trailer links for new titles.
5. Runs the data-quality guard, commits, bumps the manifest version and pushes.
6. Render redeploys automatically; catalogs are cached for one hour.

The commit message lists the new titles. Successful runs close any open "Data updater failed" issue; failures open one.

---

## 🚀 Deploy your own

1. **Fork** this repository.
2. **Get API keys** (both free): [TMDb](https://www.themoviedb.org/settings/api) and [OMDb](https://www.omdbapi.com/apikey.aspx).
3. **Add GitHub secrets** (Settings → Secrets and variables → Actions): `TMDB_API_KEY`, `OMDB_API_KEY`.
4. **Deploy on Render** as a Web Service — build command `npm install`, start command `npm run start:server` — and set the same two env vars (`PORT` is provided by Render).
5. Optional: update the URLs inside `.github/workflows/keepalive.yml` and the badge links if you rename the service.

---

## 🖥️ Running locally

```bash
git clone https://github.com/skypetroller/addon-dc.git
cd addon-dc
npm install
```

Create a `.env` file:

```
TMDB_API_KEY=your_tmdb_key
OMDB_API_KEY=your_omdb_key
PORT=7000
```

Start the Express server (custom catalogs, configure page, API routes):

```bash
npm run start:server
```

Then open `http://localhost:7000/configure`.

Refresh the data manually any time:

```bash
node scripts/fetchMoviesList.js && node scripts/fetchSeriesList.js
node scripts/discoverNewReleases.js
node scripts/combineReleaseData.js
node scripts/buildGunnChronological.js
node scripts/buildElseworlds.js && node scripts/buildArrowverse.js
node scripts/buildDcau.js && node scripts/buildDcamu.js
node scripts/fetchTrailers.js
node scripts/guardDataQuality.js
```

---

## 🧩 Express API routes

| Route | Purpose |
| --- | --- |
| `/v2/manifest.json` | Full addon manifest (all catalogs); recommended install URL |
| `/manifest.json` | Alias of the full manifest, kept for existing installs |
| `/catalog/<ids>/manifest.json` | Manifest limited to selected catalogs |
| `/catalog/<type>/<id>.json` | Catalog data (also accepts `/search=x&genre=y&skip=100` extras) |
| `/rpdb/<key>/manifest.json` | Manifest with RPDB posters |
| `/configure` | Configuration page |
| `/api/catalogs` | Catalog list with live item counts |
| `/health` | Status, uptime, version, last data refresh |

---

## License

MIT — see [LICENSE](LICENSE).

---

## 🙏 Acknowledgements

*   **joaogonp** — creator of the original Marvel addon this project descends from.
*   **tapframe** — author of the DC fork this repository is based on.
*   This fork adds automated updates, the curated universes, search/genre filters, Coming Soon, trailers, freshness reporting and the data-quality guard.

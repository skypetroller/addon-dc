# DC Universe Add-on for Stremio

A self-hosted fork of [tapframe/addon-dc](https://github.com/tapframe/addon-dc) that puts a curated DC library inside Stremio — and keeps itself up to date automatically. New movies, series and animations are discovered from TMDb twice a week, committed by CI, and served fresh within the hour.

**Live addon:** https://addon-dc-ila1.onrender.com
**Configure page:** https://addon-dc-ila1.onrender.com/configure
**Manifest:** https://addon-dc-ila1.onrender.com/v2/manifest.json
**Stremio install:** `stremio://addon-dc-ila1.onrender.com/v2/manifest.json`

---

## Features

- **Automatic updates** — GitHub Actions refreshes every catalog twice a week (Mondays and Thursdays), auto-discovers new DC releases via TMDb, and commits them with a version bump.
- **Curated universes** — James Gunn DCU in story order, Zack Snyder DCEU in story order, Arrowverse, the classic DCAU, the 15-film DCAMU, and Elseworlds (Joker / The Batman / The Penguin).
- **Coming Soon** — announced titles with a confirmed future release date.
- **Search, genre filters and paging** — every catalog ships a search box, a genre dropdown and infinite scrolling.
- **Trailers** — YouTube trailer links are stored with the data and surfaced by Stremio.
- **New Releases** — everything added to the library in the last 120 days, animations included.
- **RPDB support (optional)** — show ratings on posters by adding your [RatingPosterDB](https://ratingposterdb.com) API key on the configure page.
- **Data quality guard** — CI refuses to commit degraded data (counting drops, missing posters, overviews or ratings after a quota hiccup), and failures open a GitHub issue automatically.
- **Freshness visible** — the configure page footer shows the last data refresh, `/health` reports it as JSON, and a shared keep-awake workflow keeps both DC and Marvel warm during a 12-hour daily window.

---

## Catalogs

| Catalog | ID | Contents |
| --- | --- | --- |
| Coming Soon | `dc-upcoming` | Announced titles with a confirmed future date |
| New Releases | `dc-new` | DC titles added in the last 120 days |
| James Gunn Chronological | `dcu-gunn-chronological` | DCU movies and shows in story order |
| Zack Snyder Chronological | `dc-chronological` | Snyder-era DCEU in story order |
| DC Elseworlds | `dc-elseworlds` | Joker, The Batman, The Penguin and more |
| Arrowverse | `dc-arrowverse` | The CW multiverse shows in premiere order |
| DC Animated Universe | `dc-dcau` | Bruce Timm's DCAU in viewing order |
| DC Animated Movie Universe | `dc-dcamu` | The 15-film DCAMU, Flashpoint to Apokolips War |
| Release Order | `dc-release` | All non-animated titles by release date |
| Movies | `dc-movies` | All live-action DC movies |
| DCEU Movies | `dceu_movies` | The official DCEU collection |
| Series | `dc-series` | All live-action DC series |
| DC Modern Series | `dc_modern_series` | Live-action series from the 2010s on |
| Animations | `dc-animations` | All animated features and series |
| Batman Animations | `dc-batman-animations` | Character-focused animated collection |
| Superman Animations | `dc-superman-animations` | Character-focused animated collection |
| Batman Collection | `dc-batman` | Character-focused live-action movies |
| Superman Collection | `dc-superman` | Character-focused live-action movies |

---

## Installation

### Standard installation

Use the addon URL directly:

```
https://addon-dc-ila1.onrender.com/v2/manifest.json
```

The plain `/manifest.json` URL still works, but it is kept only as an alias for existing installs. Stremio pins each addon record to the exact URL it was installed from, so accounts that added the old URL can keep getting a stale snapshot. New installs should use `/v2/manifest.json`.

### Custom catalog configuration

1. Visit the configuration page: https://addon-dc-ila1.onrender.com/configure
2. Select the catalogs you want (optionally add your RPDB key).
3. Click **Install addon**.

The install URL encodes your selection, e.g. `https://addon-dc-ila1.onrender.com/catalog/dc-new,dc-movies/manifest.json`.

---

## Deploy your own

1. **Fork** this repository.
2. **Get API keys** (both free): [TMDb](https://www.themoviedb.org/settings/api) and [OMDb](https://www.omdbapi.com/apikey.aspx).
3. **Add GitHub secrets** (Settings → Secrets and variables → Actions): `TMDB_API_KEY`, `OMDB_API_KEY`.
4. **Deploy on Render** as a Web Service — build command `npm install`, start command `npm run start:server` — and set the same two environment variables (`PORT` is provided by Render).
5. Optional: update the URLs inside `.github/workflows/keepalive.yml` and the badge links if you rename the service.

### Keep-awake window

Render's free tier spins a service down after ~15 minutes without traffic and gives each workspace 750 instance-hours per month. Keeping both this addon and the Marvel addon awake 24/7 would need ~1,460 hours, so the shared `.github/workflows/keepalive.yml` keeps both warm during a roughly 12-hour daily window: **~10:00–21:45 UTC**. Pings run from 09:55 to 21:30, then Render's idle timer covers the remaining 15 minutes. Outside that window the first request can take 30–60 seconds to cold-start.

The same workflow is intentionally present in both the DC and Marvel repositories; either repository can keep both services warm if GitHub throttles the other. It uses long-lived jobs because GitHub throttles short `*/10` cron workflows.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `TMDB_API_KEY` | yes | Metadata, posters, trailers and release dates |
| `OMDB_API_KEY` | recommended | IMDb ratings and fallback plots |
| `PORT` | no | Defaults to `7000` |

---

## Running locally

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

Start the Express server:

```bash
npm run start:server
```

Then open `http://localhost:7000/configure`.

To refresh the data manually:

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

## How the automatic updates work

`.github/workflows/update-data.yml` runs every **Monday and Thursday at 06:00 UTC** (and on demand from the Actions tab):

1. Re-fetches every curated catalog from TMDb/OMDb (posters, overviews, ratings, release dates).
2. Discovers new DC releases from the last 2 years and appends genuinely new titles.
3. Rebuilds the derived catalogs (Gunn order, Elseworlds, Arrowverse, DCAU, DCAMU, release data).
4. Stores YouTube trailer links for new titles.
5. Runs the data-quality guard, commits, bumps the manifest version and pushes.
6. Render redeploys automatically; catalogs are cached for one hour.

The commit message lists the new titles. Successful runs close any open "Data updater failed" issue; failures open one.

---

## API routes

| Route | Purpose |
| --- | --- |
| `/v2/manifest.json` | Full addon manifest (all catalogs); recommended install URL |
| `/manifest.json` | Alias of the full manifest, kept for existing installs |
| `/catalog/<ids>/manifest.json` | Manifest limited to selected catalogs |
| `/catalog/<type>/<id>.json` | Catalog data (also accepts `/search=x&genre=y&skip=100` extras) |
| `/rpdb/<key>/manifest.json` | Manifest with RPDB posters |
| `/configure` | Configuration page |
| `/api/catalogs` | Catalog list with live item counts |
| `/health` | Status, uptime, version and last data refresh |

---

## License

MIT — see [LICENSE](LICENSE).

---

## Acknowledgements

- **joaogonp** — creator of the original Marvel addon this project descends from.
- **tapframe** — author of the DC fork this repository is based on.
- This fork adds automated updates, the curated universes, search and genre filters, Coming Soon, trailers, freshness reporting and the data-quality guard.

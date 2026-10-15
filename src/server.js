const express = require('express');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const axios = require('axios');
const releaseData = require('../Data/releaseData');
const moviesData = require('../Data/moviesData');
const seriesData = require('../Data/seriesData');
const animationsData = require('../Data/animationsData');
const batmanData = require('../Data/everythingbatman');
const batmanAnimationData = require('../Data/everythingbatmananimation');
const supermanData = require('../Data/everythingsuperman');
const supermanAnimationData = require('../Data/everythingsupermananimation');
const dceuMoviesData = require('../Data/DCEUMovies');
const modernDCSeriesData = require('../Data/DCSeries');
const dcuGunnChronologicalData = require('../Data/dcuGunnChronologicalData');

require('dotenv').config();

// Get API keys and port
let tmdbKey, omdbKey, port;
try {
    ({ tmdbKey, omdbKey, port } = require('./config'));
} catch (error) {
    console.error('Error loading config.js. Using environment variables.', error);
    port = process.env.PORT || 7000;
    tmdbKey = process.env.TMDB_API_KEY;
    omdbKey = process.env.OMDB_API_KEY;
    
    if (!tmdbKey || !omdbKey) {
        console.error('CRITICAL: API keys (TMDB_API_KEY, OMDB_API_KEY) are missing. Addon cannot fetch metadata.');
    }
}

const app = express();
app.set('trust proxy', true);

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// Cache for 3 weeks
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'public, max-age=1814400');
    next();
});

// Route to serve configure.html for paths like /catalog/id1,id2/configure
app.get('/catalog/:ids/configure', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'configure.html'));
});

// Variable to store cache separated by ID
let cachedCatalog = {};

// Helper function for TMDb details fetching
async function getTmdbDetails(id, type) {
    // Map between Stremio and TMDb types
    const tmdbType = type === 'series' ? 'tv' : type;
    
    const url = `https://api.themoviedb.org/3/${tmdbType}/${id}?api_key=${tmdbKey}&language=en-US&append_to_response=external_ids`;
    try {
        const res = await axios.get(url);
        return res;
    } catch (err) {
        console.error(`TMDb details error for ${tmdbType}/${id}: ${err.message}`);
        return {};
    }
}

// Helper function to replace posters with RPDB posters when a valid key is provided
function replaceRpdbPosters(rpdbKey, metas) {
    if (!rpdbKey) {
        return metas;
    }

    return metas.map(meta => {
        // If the meta has an IMDb ID in proper format (tt12345), use it for RPDB poster
        const imdbId = meta.id.startsWith('tt') ? meta.id : null;
        
        if (imdbId) {
            return {
                ...meta, 
                poster: `https://api.ratingposterdb.com/${rpdbKey}/imdb/poster-default/${imdbId}.jpg`
            };
        }
        
        // If no valid IMDb ID, keep original poster
        return meta;
    });
}

// Helper function to extract the IMDb rating from stored OMDb ratings.
// The fetch scripts populate item.ratings weekly, so serving it from disk
// avoids a live OMDb call (1000 req/day quota) for every catalog item.
function getStoredImdbRating(item) {
    const ratings = item.ratings || [];
    const imdb = ratings.find(r => r && r.Source === 'Internet Movie Database');
    if (imdb && typeof imdb.Value === 'string') {
        const m = imdb.Value.match(/^([\d.]+)\/10$/);
        return m ? m[1] : imdb.Value;
    }
    return null;
}

// Helper function to fetch additional metadata
async function fetchAdditionalData(item) {
  console.log('\n--- Fetching details for item: ---', item); // Log raw item

  // Basic validation of the input item
  if (!item || (!item.imdbId && !item.id) || !item.type || !item.title) { // Allow using item.id if imdbId missing
      console.warn('Skipping item due to missing essential data:', item);
      return null;
  }
  const lookupId = item.imdbId || item.id; // Prefer imdbId but use item.id as fallback
  const idPrefix = lookupId.split('_')[0]; // Check prefix (e.g., 'tt' or 'tmdb')
  const isImdb = idPrefix === 'tt' || (item.imdbId && !item.imdbId.startsWith('tmdb_'));

  const storedImdbRating = getStoredImdbRating(item);
  // Fast path: items refreshed by the fetch scripts already carry poster,
  // overview, genres and ratings — serve those directly. Only the logo
  // (TMDB images, never stored) still needs a single live call.
  const hasFullLocal = Boolean(
      item.poster && item.overview && item.genres && item.genres.length > 0 && storedImdbRating
  );

  const toStoredMeta = (logoUrl) => ({
      id: lookupId, // Use the ID we actually used for lookup
      type: item.type === 'tv' ? 'series' : item.type, // Map 'tv' to 'series' for Stremio
      name: (item.type === 'series' || item.type === 'tv') ? item.title.replace(/ Season \d+/, '') : item.title,
      logo: logoUrl || null,
      poster: item.poster || null,
      description: item.overview || 'No description available.',
      releaseInfo: item.releaseYear || 'N/A',
      imdbRating: storedImdbRating || 'N/A',
      genres: item.genres ? item.genres.map(g => g.name) : []
  });

  if (hasFullLocal) {
      let logoUrl = null;
      const logoTmdbId = item.tmdbId || (idPrefix === 'tmdb' ? lookupId.split('_')[1] : null);
      if (tmdbKey && logoTmdbId) {
          const tmdbType = item.type === 'series' ? 'tv' : item.type;
          try {
              const imgRes = await axios.get(`https://api.themoviedb.org/3/${tmdbType}/${logoTmdbId}/images?api_key=${tmdbKey}`);
              const logos = (imgRes.data && imgRes.data.logos) || [];
              if (logos.length > 0) {
                  const bestLogo = logos.find(logo => logo.iso_639_1 === 'en') || logos[0];
                  if (bestLogo && bestLogo.file_path) {
                      logoUrl = `https://image.tmdb.org/t/p/original${bestLogo.file_path}`;
                  }
              }
          } catch (err) {
              if (!err.response || err.response.status !== 404) {
                  console.warn(`TMDb Images error for ${item.title}: ${err.message}`);
              }
          }
      }
      const meta = toStoredMeta(logoUrl);
      console.log('   > Returning stored metadata for:', meta.name);
      return meta;
  }

  // Check if API keys are available
  if (!tmdbKey || (!omdbKey && isImdb)) { // OMDb key only needed if we have an IMDb ID
      console.warn(`Skipping metadata fetch for ${item.title} (${lookupId}) because API keys are missing.`);
      // Return minimal data if keys are missing
      return {
          id: lookupId,
          type: item.type === 'tv' ? 'series' : item.type, // Map 'tv' to 'series' for Stremio
          name: (item.type === 'series' || item.type === 'tv') ? item.title.replace(/ Season \d+/, '') : item.title,
          poster: item.poster || null, // Use poster from data file if available
          description: item.overview || 'Metadata lookup unavailable (API key missing).', // Use local overview
          releaseInfo: item.releaseYear || 'N/A',
          imdbRating: 'N/A',
          genres: item.genres ? item.genres.map(g => g.name) : []
      };
  }

  let omdbData = {};
  let tmdbData = {};
  let tmdbImagesData = {};

  try {
    // OMDb call only if we have a real IMDb ID and no stored rating
    const omdbPromise = (isImdb && !storedImdbRating)
        ? axios.get(`http://www.omdbapi.com/?i=${lookupId}&apikey=${omdbKey}`).catch((err) => {
              console.error(`OMDB error for ${lookupId}: ${err.message}`);
              return {};
          })
        : Promise.resolve({}); // Resolve immediately if no IMDb ID

    // TMDb search/details call
    // We need TMDb ID for images, try to get it from item first
    let effectiveTmdbId = item.tmdbId || (idPrefix === 'tmdb' ? lookupId.split('_')[1] : null);
    let tmdbDetailsPromise;
    if (effectiveTmdbId) {
        // If we have tmdbId, fetch details directly
        // Map type for TMDb API (Stremio uses 'series', but TMDb uses 'tv')
        const tmdbType = item.type === 'series' ? 'tv' : item.type;
        const tmdbDetailsUrl = `https://api.themoviedb.org/3/${tmdbType}/${effectiveTmdbId}?api_key=${tmdbKey}&language=en-US`;
        tmdbDetailsPromise = axios.get(tmdbDetailsUrl).catch((err) => {
            console.error(`TMDB Details error for ${tmdbType}/${effectiveTmdbId}: ${err.message}`);
            return {};
        });
    } else {
        // If no tmdbId, search TMDb by title/year
        // Map type for TMDb API (Stremio uses 'series', but TMDb uses 'tv')
        const tmdbType = item.type === 'series' ? 'tv' : item.type;
        const tmdbSearchUrl = `https://api.themoviedb.org/3/search/${tmdbType}?api_key=${tmdbKey}&query=${encodeURIComponent(item.title)}&year=${item.releaseYear}`;
        tmdbDetailsPromise = axios.get(tmdbSearchUrl).then(res => 
            res.data?.results?.[0] ? getTmdbDetails(res.data.results[0].id, tmdbType) : {})
        .catch((err) => {
            console.error(`TMDB Search error for ${item.title}: ${err.message}`);
            return {};
        });
    }

    // Fetch Images using TMDb ID (if we found one)
    const tmdbImagesPromise = tmdbDetailsPromise.then(detailsRes => {
        const foundTmdbId = detailsRes?.data?.id || effectiveTmdbId; // Get ID from details if available
        if (foundTmdbId) {
            // Map type for TMDb API (Stremio uses 'series', but TMDb uses 'tv')
            const tmdbType = item.type === 'series' ? 'tv' : item.type;
            const tmdbImagesUrl = `https://api.themoviedb.org/3/${tmdbType}/${foundTmdbId}/images?api_key=${tmdbKey}`;
            return axios.get(tmdbImagesUrl).catch((err) => {
                if (!err.response || err.response.status !== 404) {
                    console.warn(`TMDb Images error for ${item.title}: ${err.message}`);
                }
                return {};
            });
        } else {
            return Promise.resolve({}); // No TMDb ID, no images
        }
    });

    console.log(`Fetching data for ${item.title} (${lookupId})...`);
    const [omdbRes, tmdbDetailsResult, tmdbImagesRes] = await Promise.all([
      omdbPromise,
      tmdbDetailsPromise,
      tmdbImagesPromise
    ]);

    omdbData = omdbRes.data || {};
    tmdbData = tmdbDetailsResult.data || {}; // If searched, this might already be details
    tmdbImagesData = tmdbImagesRes.data || {};

    // Poster priority: local data -> TMDb -> OMDb -> fallback
    let poster = item.poster || null;
    if (!poster && tmdbData.poster_path) {
      poster = `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}`;
    }
    if (!poster && omdbData.Poster && omdbData.Poster !== 'N/A') {
      poster = omdbData.Poster;
    }

    let logoUrl = null;
    if (tmdbImagesData.logos && tmdbImagesData.logos.length > 0) {
      let bestLogo = tmdbImagesData.logos.find(logo => logo.iso_639_1 === 'en');
      if (!bestLogo) {
        bestLogo = tmdbImagesData.logos[0];
      }
      if (bestLogo && bestLogo.file_path) {
          logoUrl = `https://image.tmdb.org/t/p/original${bestLogo.file_path}`;
      }
    }
    console.log(`   > Selected logo URL: ${logoUrl || 'Not found'}`);

    // Description priority: local data -> TMDb -> OMDb -> fallback
    const description = item.overview || tmdbData.overview || omdbData.Plot || 'No description available.';

    const meta = {
      id: lookupId, // Use the ID we actually used for lookup
      type: item.type === 'tv' ? 'series' : item.type, // Map 'tv' to 'series' for Stremio
      name: (item.type === 'series' || item.type === 'tv') ? item.title.replace(/ Season \d+/, '') : item.title,
      logo: logoUrl,
      poster: poster,
      description: description,
      releaseInfo: item.releaseYear || (tmdbData.release_date ? tmdbData.release_date.split('-')[0] : (tmdbData.first_air_date ? tmdbData.first_air_date.split('-')[0] : 'N/A')),
      imdbRating: omdbData.imdbRating || storedImdbRating || 'N/A',
      // Use TMDb genres if available, otherwise fallback to local genres
      genres: tmdbData.genres ? tmdbData.genres.map(g => g.name) : (item.genres ? item.genres.map(g => g.name) : [])
    };

    console.log('   > Returning metadata:', { ...meta, description: meta.description.substring(0, 50) + '...'}); // Log truncated desc
    return meta;
  } catch (err) {
    console.error(`Error processing ${item.title} (${lookupId}): ${err.message}`);
    return null;
  }
}

// Get all available catalogs
function getAllCatalogs() {
    return [
        {
            type: "DC",
            id: "dc-new",
            name: "New Releases"
        },
        {
            type: "DC",
            id: "dcu-gunn-chronological",
            name: "James Gunn Chronological"
        },
        {
            type: "DC",
            id: "dc-chronological",
            name: "Zack Snyder Chronological"
        },
        {
            type: "DC",
            id: "dc-release",
            name: "Release Order"
        },
        {
            type: "DC",
            id: "dc-movies",
            name: "Movies"
        },
        {
            type: "DC",
            id: "dceu_movies",
            name: "DCEU Movies"
        },
        {
            type: "DC",
            id: "dc-series",
            name: "Series"
        },
        {
            type: "DC",
            id: "dc_modern_series",
            name: "DC Modern Series"
        },
        {
            type: "DC",
            id: "dc-animations",
            name: "Animations"
        },
        {
            type: "DC",
            id: "dc-batman-animations",
            name: "Batman Animations"
        },
        {
            type: "DC",
            id: "dc-superman-animations",
            name: "Superman Animations"
        },
        {
            type: "DC",
            id: "dc-batman",
            name: "Batman Collection"
        },
        {
            type: "DC",
            id: "dc-superman",
            name: "Superman Collection"
        }
    ];
}

// Define the configuration page
app.get('/configure', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'configure.html'));
});

// Custom catalog manifest endpoint
app.get('/catalog/:catalogsParam/manifest.json', (req, res) => {
    const { catalogsParam } = req.params;
    
    // Parse configuration parameter for RPDB key
    let rpdbKey = null;
    let selectedCatalogIds = catalogsParam;
    
    // Check if the parameter contains catalog IDs and RPDB key in format "catalog1,catalog2:rpdbKey"
    if (catalogsParam.includes(':')) {
        const parts = catalogsParam.split(':');
        selectedCatalogIds = parts[0]; // First part is catalog IDs
        rpdbKey = parts[1];    // Second part is RPDB key
        console.log(`Custom manifest with RPDB key: ${rpdbKey}`);
        selectedCatalogIds = selectedCatalogIds.split(',').map(id => id.trim());
    } else {
        selectedCatalogIds = catalogsParam.split(',').map(id => id.trim());
    }

    const allCatalogs = getAllCatalogs(); // Fetch all defined catalogs
    
    // Filter catalogs based on selected IDs
    const selectedApiCatalogs = allCatalogs.filter(catalog => selectedCatalogIds.includes(catalog.id));
    
    if (selectedApiCatalogs.length === 0) {
        return res.status(404).send('No valid catalogs selected or found.');
    }
    
    // Create a custom ID that includes RPDB key info if present
    const customId = rpdbKey 
        ? `com.tapframe.dcaddon.custom.${selectedCatalogIds.join('.')}.rpdb`
        : `com.tapframe.dcaddon.custom.${selectedCatalogIds.join('.')}`;
        
    // Limit ID length to avoid issues
    const manifestId = customId.slice(0, 100);
    
    // Create the customized manifest
    const manifest = {
        id: manifestId,
        name: "DC Universe Custom",
        description: `Your personalized selection of DC catalogs: ${selectedApiCatalogs.map(c => c.name).join(', ')}`,
        version: "1.3.0",
        logo: `${req.protocol}://${req.get('host')}/assets/icon.png`,
        background: `${req.protocol}://${req.get('host')}/assets/background.jpg`,
        catalogs: selectedApiCatalogs,
        resources: ["catalog"],
        types: ["movie", "series"],
        idPrefixes: ["dc_"],
        behaviorHints: {
            configurable: true
        },
        contactEmail: "nayifveliya99@gmail.com"
    };
    
    res.json(manifest);
});

// Default manifest endpoint
app.get('/manifest.json', (req, res) => {
    console.log('Default manifest requested');
    
    // Check for RPDB key in query parameters
    const rpdbKey = req.query.rpdb || null;
    if (rpdbKey) {
        console.log(`Default manifest with RPDB key: ${rpdbKey}`);
    }
    
    // Create manifest ID that includes RPDB key info if present
    const manifestId = rpdbKey 
        ? "com.tapframe.dcaddon.rpdb"
        : "com.tapframe.dcaddon";
    
    const manifest = {
        id: manifestId,
        name: "DC Universe",
        description: "Explore the DC Universe by release date, movies, series, and animations!",
        version: "1.3.0",
        logo: `${req.protocol}://${req.get('host')}/assets/icon.png`,
        background: `${req.protocol}://${req.get('host')}/assets/background.jpg`,
        catalogs: getAllCatalogs(),
        resources: ["catalog"],
        types: ["movie", "series"],
        idPrefixes: ["dc_"],
        behaviorHints: {
            configurable: true
        },
        contactEmail: "nayifveliya99@gmail.com"
    };
    
    res.json(manifest);
});

// RPDB key manifest endpoint - handles full manifest with RPDB key using path structure
app.get('/rpdb/:rpdbKey/manifest.json', (req, res) => {
    const { rpdbKey } = req.params;
    console.log(`RPDB path-based manifest requested with key: ${rpdbKey}`);
    
    // Create a custom ID that includes RPDB key info
    const manifestId = `com.tapframe.dcaddon.rpdb.${rpdbKey.substring(0, 8)}`;
    
    const manifest = {
        id: manifestId,
        name: "DC Universe",
        description: "Explore the DC Universe by release date, movies, series, and animations! (with IMDb ratings on posters)",
        version: "1.3.0",
        logo: `${req.protocol}://${req.get('host')}/assets/icon.png`,
        background: `${req.protocol}://${req.get('host')}/assets/background.jpg`,
        catalogs: getAllCatalogs(),
        resources: ["catalog"],
        types: ["movie", "series"],
        idPrefixes: ["dc_"],
        behaviorHints: {
            configurable: true
        },
        contactEmail: "nayifveliya99@gmail.com"
    };
    
    res.json(manifest);
});

// API endpoint for catalog info
app.get('/api/catalogs', (req, res) => {
    console.log('Catalog info requested');
    
    const catalogInfo = [
        { 
            id: 'dc-new', 
            name: 'New Releases', 
            category: 'Timeline',
            description: 'DC titles added in the last 120 days',
            icon: 'star'
        },
        { 
            id: 'dcu-gunn-chronological', 
            name: 'James Gunn Chronological', 
            category: 'Timeline',
            description: 'James Gunn DCU in story order, newest first-era titles at top',
            icon: 'calendar-alt'
        },
        { 
            id: 'dc-chronological', 
            name: 'Zack Snyder Chronological', 
            category: 'Timeline',
            description: 'Snyder DCEU films and shows in story order',
            icon: 'calendar-alt'
        },
        { 
            id: 'dc-release', 
            name: 'Release Order', 
            category: 'Timeline',
            description: 'Browse content in original release date order',
            icon: 'clock'
        },
        { 
            id: 'dc-movies', 
            name: 'Movies', 
            category: 'Content Type',
            description: 'All DC movies across different eras',
            icon: 'film'
        },
        { 
            id: 'dceu_movies', 
            name: 'DCEU Movies', 
            category: 'Curated',
            description: 'Official DC Extended Universe film collection',
            icon: 'film'
        },
        { 
            id: 'dc-series', 
            name: 'Series', 
            category: 'Content Type',
            description: 'All DC television series',
            icon: 'tv'
        },
        { 
            id: 'dc_modern_series', 
            name: 'DC Modern Series', 
            category: 'Curated',
            description: 'Recent DC live-action series (2010s-Present)',
            icon: 'tv'
        },
        { 
            id: 'dc-animations', 
            name: 'Animations', 
            category: 'Content Type',
            description: 'All DC animated features and series',
            icon: 'play-circle'
        },
        { 
            id: 'dc-batman-animations', 
            name: 'Batman Animations', 
            category: 'Character',
            description: 'Batman animated movies and series',
            icon: 'mask'
        },
        { 
            id: 'dc-superman-animations', 
            name: 'Superman Animations', 
            category: 'Character',
            description: 'Superman animated movies and series',
            icon: 'shield-alt'
        },
        { 
            id: 'dc-batman', 
            name: 'Batman Collection', 
            category: 'Character',
            description: 'All Batman live-action movies',
            icon: 'mask'
        },
        { 
            id: 'dc-superman', 
            name: 'Superman Collection', 
            category: 'Character',
            description: 'All Superman live-action movies',
            icon: 'shield-alt'
        }
    ];
    
    // Attach live item counts so users can see the data is current
    const withCounts = catalogInfo.map(info => {
        try {
            const source = resolveCatalogSource(info.id);
            return { ...info, count: source ? source.length : 0 };
        } catch {
            return { ...info, count: 0 };
        }
    });
    
    res.json(withCounts);
});

// Registry of every catalog source, keyed by catalog ID.
// Add new catalogs here — all three endpoints pick them up automatically.
const CATALOG_SOURCES = {
    'dcu-gunn-chronological': () => dcuGunnChronologicalData,
    'dc-chronological': () => require('../Data/chronologicalData'),
    'dc-release': () => releaseData,
    'dc-movies': () => moviesData,
    'dc-series': () => seriesData,
    'dc-animations': () => animationsData,
    'dc-batman': () => batmanData,
    'dc-batman-animations': () => batmanAnimationData,
    'dc-superman': () => supermanData,
    'dc-superman-animations': () => supermanAnimationData,
    'dceu_movies': () => dceuMoviesData,
    'dc_modern_series': () => modernDCSeriesData,
    // Dynamic catalogs
    'dc-new': () => {
        const cutoff = Date.now() - 120 * 24 * 60 * 60 * 1000;
        return releaseData
            .filter(item => item.addedAt && new Date(item.addedAt).getTime() >= cutoff)
            .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
    }
};

// Resolves a catalog ID to its data array. Returns null for unknown IDs.
function resolveCatalogSource(id) {
    const getter = CATALOG_SOURCES[id];
    if (!getter) return null;
    const arr = getter();
    if (!Array.isArray(arr)) throw new Error(`Data source for ID ${id} is not a valid array.`);
    return arr;
}

// Builds the response for a catalog request, generating metas on first hit,
// then serving from cache. Supports Stremio pagination (skip/limit) and RPDB.
async function buildCatalogResponse(res, req, type, id, rpdbKey, cacheKey) {
    const skip = Math.max(0, parseInt(req.query.skip, 10) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 100));

    let metas;
    if (cachedCatalog[cacheKey]) {
        console.log(`✅ Returning cached catalog for ID: ${cacheKey}`);
        metas = cachedCatalog[cacheKey].metas;
    } else {
        let dataSource;
        try {
            dataSource = resolveCatalogSource(id);
        } catch (error) {
            console.error(`❌ Error loading data for catalog ID ${id}:`, error.message);
            return res.json({ metas: [] });
        }
        if (!dataSource) {
            console.warn(`Unrecognized catalog ID: ${id}`);
            return res.json({ metas: [] });
        }

        console.log(`⏳ Generating catalog for ${id} (${dataSource.length} items)...`);
        const generated = await Promise.all(dataSource.map(item => fetchAdditionalData(item)));
        metas = generated.filter(item => item !== null);
        cachedCatalog[cacheKey] = { metas };
        console.log(`✅ Catalog generated with ${metas.length} items for ID: ${id}`);
    }

    if (rpdbKey) {
        metas = replaceRpdbPosters(rpdbKey, metas);
    }
    return res.json({ metas: metas.slice(skip, skip + limit) });
}

// RPDB path-based catalog endpoint
app.get('/rpdb/:rpdbKey/catalog/:type/:id.json', async (req, res) => {
    const { rpdbKey, type, id } = req.params;
    console.log(`RPDB path-based catalog requested - Type: ${type}, ID: ${id}, RPDB Key: ${rpdbKey}`);
    return buildCatalogResponse(res, req, type, id, rpdbKey, `default-${id}`);
});

// Custom catalog endpoint
app.get('/catalog/:catalogsParam/catalog/:type/:id.json', async (req, res) => {
    const { catalogsParam, type, id } = req.params;
    console.log(`Custom catalog requested - Catalogs: ${catalogsParam}, Type: ${type}, ID: ${id}`);
    
    // Parse configuration parameter for RPDB key
    let rpdbKey = null;
    let catalogIds = catalogsParam;
    
    // Check if the parameter contains catalog IDs and RPDB key in format "catalog1,catalog2:rpdbKey"
    if (catalogsParam.includes(':')) {
        const parts = catalogsParam.split(':');
        catalogIds = parts[0]; // First part is catalog IDs
        rpdbKey = parts[1];    // Second part is RPDB key
        console.log(`RPDB key detected: ${rpdbKey}`);
    }
    
    return buildCatalogResponse(res, req, type, id, rpdbKey, `custom-${id}-${catalogsParam}`);
});

// Default catalog endpoint
app.get('/catalog/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    console.log(`Default catalog requested - Type: ${type}, ID: ${id}`);
    
    // Check for RPDB key in various sources
    let rpdbKey = null;
    
    // Check for RPDB key in query parameters (for backward compatibility)
    if (req.query.rpdb) {
        rpdbKey = req.query.rpdb;
    }
    
    // Check referer for a path-based RPDB key format
    const referer = req.get('Referrer') || '';
    if (!rpdbKey && referer) {
        // Extract RPDB key from path like /rpdb/KEY/manifest.json
        const rpdbMatch = referer.match(/\/rpdb\/([^\/]+)\/manifest\.json/);
        if (rpdbMatch && rpdbMatch[1]) {
            rpdbKey = decodeURIComponent(rpdbMatch[1]);
        }
    }
    
    if (rpdbKey) {
        console.log(`RPDB key detected: ${rpdbKey}`);
    }
    
    return buildCatalogResponse(res, req, type, id, rpdbKey, `default-${id}`);
});

// Health check endpoint (lightweight, for uptime monitors)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

// Default routes
app.get('/', (req, res) => {
    res.redirect('/configure');
});

app.listen(port, () => {
    console.log(`DC Universe Addon server running at http://localhost:${port}/`);
    console.log(`Configuration page: http://localhost:${port}/configure`);
    console.log(`To install with custom catalogs: stremio://localhost:${port}/catalog/CATALOG_IDS/manifest.json`);
});

// Export the fetchAdditionalData function for testing
module.exports = { fetchAdditionalData };
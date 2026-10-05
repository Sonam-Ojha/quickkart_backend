const https  = require('https');
const router = require('express').Router();

const GOOGLE_API_KEY = 'AIzaSyDoTvasMdk4HQhrfTO5pWkEGJAfhbVcqAk';

// ── Config ─────────────────────────────────────────────────────────────────────
const CACHE_TTL_MS      = 60 * 60 * 1000;  // 1 hour
const CACHE_GRID_DEG    = 0.002;            // ~200 m grid cell for cache key
const RATE_LIMIT_WINDOW = 60 * 1000;        // 1 minute
const RATE_LIMIT_MAX    = 40;               // max requests per IP per window

// ── In-memory cache & rate limiter ───────────────────────────────────────────

const _cache     = new Map();   // key → { data, expiresAt }
const _rateStore = new Map();   // ip  → { count, windowStart }

function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _cache.delete(key); return null; }
  return entry.data;
}
function cacheSet(key, data) {
  _cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  // Evict stale entries when cache grows large
  if (_cache.size > 2000) {
    const now = Date.now();
    for (const [k, v] of _cache) { if (now > v.expiresAt) _cache.delete(k); }
  }
}
function reverseKey(lat, lng) {
  const r = (n) => Math.round(n / CACHE_GRID_DEG) * CACHE_GRID_DEG;
  return `rev:${r(lat).toFixed(4)},${r(lng).toFixed(4)}`;
}

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = _rateStore.get(ip) || { count: 0, windowStart: now };
  if (now - entry.windowStart > RATE_LIMIT_WINDOW) {
    entry.count = 1;
    entry.windowStart = now;
  } else {
    entry.count += 1;
  }
  _rateStore.set(ip, entry);
  return entry.count <= RATE_LIMIT_MAX;
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateCoords(lat, lng) {
  const la = parseFloat(lat);
  const ln = parseFloat(lng);
  if (isNaN(la) || isNaN(ln)) return null;
  if (la < -90 || la > 90)   return null;
  if (ln < -180 || ln > 180) return null;
  return { lat: la, lng: ln };
}

// ── Google Maps API fetch (server-side — no CORS) ────────────────────────────

function googleFetch(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'maps.googleapis.com',
      path,
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid Google response')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Google timeout')); });
    req.end();
  });
}

// ── Abstract geocoding provider ───────────────────────────────────────────────

function nominatimFetch(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'nominatim.openstreetmap.org',
      path,
      method: 'GET',
      headers: {
        'User-Agent': 'Jhatpats/1.0 (contact@jhatpats.in)',
        'Accept-Language': 'en',
        'Accept': 'application/json',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid Nominatim response')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Nominatim timeout')); });
    req.end();
  });
}

async function reverseGeocodeProvider(lat, lng) {
  // Try Google first (most accurate)
  try {
    const g = await googleFetch(
      `/maps/api/geocode/json?latlng=${lat},${lng}&language=en&key=${GOOGLE_API_KEY}`
    );
    if (g.status === 'OK' && g.results && g.results.length > 0) {
      const result = g.results[0];
      const comps  = result.address_components || [];
      const get    = (type) => (comps.find(c => c.types.includes(type)) || {}).long_name || '';
      const locality = get('sublocality_level_2') || get('sublocality_level_1') ||
                       get('sublocality') || get('locality') || 'Current Location';
      const area = [
        get('sublocality_level_2'),
        get('sublocality_level_1'),
        get('locality'),
        get('administrative_area_level_2'),
      ].filter(Boolean).join(', ');
      return {
        locality,
        area:             area || result.formatted_address,
        city:             get('locality') || get('administrative_area_level_2'),
        state:            get('administrative_area_level_1'),
        postalCode:       get('postal_code'),
        country:          get('country'),
        formattedAddress: result.formatted_address,
      };
    }
  } catch (_) {}

  // Fallback: Nominatim
  const raw = await nominatimFetch(
    `/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`
  );
  if (!raw || raw.error) return null;

  const a = raw.address || {};
  const micro = a.residential || a.neighbourhood || a.quarter || a.allotments || '';
  const sub   = a.suburb || a.city_district || a.hamlet || a.borough || '';
  const road  = a.road || a.pedestrian || a.footway || a.cycleway || '';
  const house = a.house_number || '';
  const city  = a.city || a.town || a.municipality || a.village ||
                a.county || a.state_district || '';
  const locality = micro || sub || road || city || 'Current Location';
  const area = [
    [house, road].filter(Boolean).join(' '),
    micro,
    sub && sub !== micro ? sub : '',
    city,
  ].filter(Boolean).join(', ');

  return {
    locality,
    area:             area || raw.display_name || '',
    city,
    state:            a.state || '',
    postalCode:       a.postcode || '',
    country:          a.country || '',
    formattedAddress: raw.display_name || '',
  };
}

async function searchGeocodeProvider(query) {
  // Try structured search first (better for "area, city" style queries)
  const parts = query.split(',').map(s => s.trim()).filter(Boolean);
  const isMultiPart = parts.length >= 2;

  const buildUrl = (q) =>
    `/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=8&countrycodes=in&accept-language=en`;

  let raw = await nominatimFetch(buildUrl(query));

  // If no results and query looks like "locality, city", retry with just the city
  if ((!Array.isArray(raw) || raw.length === 0) && isMultiPart) {
    const cityQuery = parts.slice(1).join(', ');
    raw = await nominatimFetch(buildUrl(cityQuery));
  }

  if (!Array.isArray(raw) || raw.length === 0) return [];

  return raw.map((r) => {
    const a = r.address || {};
    const localPart = a.suburb || a.neighbourhood || a.quarter || a.road || a.village;
    const cityPart  = a.city || a.town || a.county;

    const area = [localPart, cityPart, a.state]
      .filter(Boolean).join(', ');

    return {
      displayName:      r.display_name,
      area:             area || r.display_name,
      city:             cityPart || '',
      state:            a.state || '',
      postalCode:       a.postcode || '',
      country:          a.country || '',
      formattedAddress: r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    };
  });
}

// ── Routes ─────────────────────────────────────────────────────────────────────

// GET /api/app/location/places?q=subhash+chowk+faridabad
// Google Places Autocomplete proxy — no CORS issue from server
router.get('/places', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.status(400).json({ message: 'Query too short.' });

  const cacheKey = `gplaces:${q.toLowerCase()}`;
  const cached   = cacheGet(cacheKey);
  if (cached) return res.json({ predictions: cached, cached: true });

  try {
    const data = await googleFetch(
      `/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&components=country:in&language=en&key=${GOOGLE_API_KEY}`
    );
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return res.status(502).json({ message: 'Places API error: ' + data.status });
    }
    const predictions = (data.predictions || []).map(p => ({
      placeId:       p.place_id,
      mainText:      p.structured_formatting?.main_text || p.description,
      secondaryText: p.structured_formatting?.secondary_text || '',
      description:   p.description,
    }));
    cacheSet(cacheKey, predictions);
    res.json({ predictions });
  } catch (err) {
    console.error('[location/places]', err.message);
    res.status(502).json({ message: 'Places search failed.' });
  }
});

// GET /api/app/location/places/details?place_id=ChIJ...
router.get('/places/details', async (req, res) => {
  const placeId = String(req.query.place_id || '').trim();
  if (!placeId) return res.status(400).json({ message: 'place_id required.' });

  const cacheKey = `gpdetails:${placeId}`;
  const cached   = cacheGet(cacheKey);
  if (cached) return res.json(cached);

  try {
    const data = await googleFetch(
      `/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=geometry,address_components,name,formatted_address&language=en&key=${GOOGLE_API_KEY}`
    );
    if (data.status !== 'OK') {
      return res.status(502).json({ message: 'Place details error: ' + data.status });
    }
    const r     = data.result;
    const loc   = r.geometry?.location;
    const comps = r.address_components || [];
    const get   = (type) => (comps.find(c => c.types.includes(type)) || {}).long_name || '';
    const result = {
      lat:             loc.lat,
      lng:             loc.lng,
      label:           r.name || get('sublocality_level_1') || 'Location',
      area:            r.formatted_address || '',
      pincode:         get('postal_code'),
    };
    cacheSet(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error('[location/places/details]', err.message);
    res.status(502).json({ message: 'Place details failed.' });
  }
});

// GET /api/app/location/reverse?lat=28.57&lng=77.32
router.get('/reverse', async (req, res) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ message: 'Too many requests. Try again in a minute.' });
  }

  const coords = validateCoords(req.query.lat, req.query.lng);
  if (!coords) {
    return res.status(400).json({ message: 'Invalid lat/lng. lat must be -90..90, lng -180..180.' });
  }

  const cacheKey = reverseKey(coords.lat, coords.lng);
  const cached   = cacheGet(cacheKey);
  if (cached) return res.json({ ...cached, cached: true });

  try {
    const result = await reverseGeocodeProvider(coords.lat, coords.lng);
    if (!result) return res.status(502).json({ message: 'Geocoding service unavailable.' });
    cacheSet(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error('[location/reverse]', err.message);
    res.status(502).json({ message: 'Geocoding failed. Please try again.' });
  }
});

// GET /api/app/location/serviceability?lat=28.57&lng=77.32
// Check if Jhatpats delivers to the given coordinates.
router.get('/serviceability', async (req, res) => {
  const coords = validateCoords(req.query.lat, req.query.lng);
  if (!coords) {
    return res.status(400).json({ message: 'Invalid lat/lng.' });
  }
  try {
    const { findNearestStore } = require('../../services/darkstore.service');
    const { store, distanceKm } = await findNearestStore(coords.lat, coords.lng);
    if (!store) {
      return res.json({ serviceable: false });
    }
    return res.json({
      serviceable:  true,
      storeName:    store.name,
      distanceKm:   Math.round(distanceKm * 10) / 10,
      eta:          '10 minutes',
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// GET /api/app/location/search?q=Sector 18 Noida
router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.status(400).json({ message: 'Query too short (min 2 chars).' });
  if (q.length > 200) return res.status(400).json({ message: 'Query too long.' });

  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ message: 'Too many requests. Try again in a minute.' });
  }

  const cacheKey = `search:${q.toLowerCase()}`;
  const cached   = cacheGet(cacheKey);
  if (cached) return res.json({ results: cached, cached: true });

  try {
    const results = await searchGeocodeProvider(q);
    cacheSet(cacheKey, results);
    res.json({ results });
  } catch (err) {
    console.error('[location/search]', err.message);
    res.status(502).json({ message: 'Search failed. Please try again.' });
  }
});

module.exports = router;

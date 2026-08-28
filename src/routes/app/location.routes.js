const https  = require('https');
const router = require('express').Router();

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

// ── Abstract geocoding provider ───────────────────────────────────────────────
// To swap provider: only change this function.
// Returns: { locality, area, city, state, postalCode, country, formattedAddress } | null

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
  const raw = await nominatimFetch(
    `/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`
  );
  if (!raw || raw.error) return null;

  const a = raw.address || {};

  const locality = a.suburb || a.neighbourhood || a.quarter ||
                   a.road || a.village || a.town || a.city || 'Current Location';

  const area = [
    a.suburb || a.neighbourhood || a.road || a.quarter,
    a.city   || a.town || a.village || a.county,
  ].filter(Boolean).join(', ');

  return {
    locality,
    area,
    city:            a.city || a.town || a.village || a.county || '',
    state:           a.state || '',
    postalCode:      a.postcode || '',
    country:         a.country || '',
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

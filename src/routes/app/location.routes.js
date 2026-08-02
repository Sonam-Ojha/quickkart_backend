const https  = require('https');
const router = require('express').Router();

function nominatimRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'nominatim.openstreetmap.org',
      path,
      method: 'GET',
      headers: {
        'User-Agent': 'Jhatpats/1.0 (quickkart@example.com)',
        'Accept-Language': 'en',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid Nominatim response')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Nominatim timeout')); });
    req.end();
  });
}

// GET /api/app/location/search?q=Sector 18 Noida
router.get('/search', async (req, res) => {
  const q = req.query.q;
  if (!q || String(q).trim().length < 2) {
    return res.status(400).json({ message: 'Query too short' });
  }
  try {
    const results = await nominatimRequest(
      `/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=8&countrycodes=in`
    );
    const mapped = results.map(r => {
      const a = r.address || {};
      const parts = [
        a.road || a.neighbourhood || a.suburb,
        a.city || a.town || a.village || a.county,
        a.state,
      ].filter(Boolean);
      return {
        displayName: r.display_name,
        shortName:   parts.join(', '),
        pincode:     a.postcode || '',
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
      };
    });
    res.json({ results: mapped });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/app/location/reverse?lat=28.57&lng=77.32
router.get('/reverse', async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ message: 'lat and lng required' });
  try {
    const result = await nominatimRequest(
      `/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`
    );
    const a = result.address || {};
    const locality = a.neighbourhood || a.suburb || a.road || a.city || 'Current Location';
    const parts = [
      a.road || a.neighbourhood || a.suburb,
      a.city || a.town || a.village,
      a.state,
    ].filter(Boolean);
    res.json({
      locality,
      displayName: result.display_name,
      shortName:   parts.join(', '),
      pincode:     a.postcode || '',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

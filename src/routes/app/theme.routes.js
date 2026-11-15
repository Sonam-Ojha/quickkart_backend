const router = require('express').Router();
const svc = require('../../services/theme.service');

// GET /api/app/theme?lat=&lng= — festival theme live for this area, or { theme: null }.
// Public: the website and app ask before login too.
router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=60');
    res.json(await svc.liveThemeFor(req.query.lat, req.query.lng));
  } catch (err) {
    console.error('[theme] lookup failed:', err.message);
    res.json({ theme: null }); // never break the home screen over a theme
  }
});

module.exports = router;

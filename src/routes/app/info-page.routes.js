const router = require('express').Router();
const InfoPage = require('../../models/info-page.model');

// GET /api/app/pages          — all active pages (for nav)
// GET /api/app/pages/:slug    — single page by slug
router.get('/', async (req, res) => {
  const pages = await InfoPage.findAll({
    where: { isActive: true },
    attributes: ['id', 'slug', 'title'],
    order: [['slug', 'ASC']],
  });
  res.json(pages);
});

router.get('/:slug', async (req, res) => {
  const page = await InfoPage.findOne({ where: { slug: req.params.slug, isActive: true } });
  if (!page) return res.status(404).json({ message: 'Page not found' });
  res.json(page);
});

module.exports = router;

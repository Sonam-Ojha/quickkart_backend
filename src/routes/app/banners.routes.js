const router = require('express').Router();
const Banner = require('../../models/banner.model');

const BG_HEX = {
  'orange-tint':  '#C2410C',
  'teal-tint':    '#0F766E',
  'blue-tint':    '#1D4ED8',
  'emerald-tint': '#065F46',
  'rose-tint':    '#BE123C',
  'purple-tint':  '#6D28D9',
};

// GET /api/app/banners?section=hero|promo  — public, no auth
router.get('/', async (req, res) => {
  try {
    const where = { isActive: true };
    if (req.query.section) where.section = req.query.section;

    const rows = await Banner.findAll({
      where,
      order: [['sort_order', 'ASC'], ['created_at', 'DESC']],
      limit: 10,
    });

    const banners = rows.map(b => ({
      id:       b.id,
      title:    b.title,
      subtitle: b.subtitle ?? '',
      img:      b.bannerImage,
      section:  b.section,
      emoji:    b.emoji ?? '',
      bgType:   b.bgType,
      bgColor:  BG_HEX[b.bgType] ?? '#C2410C',
      ctaLink:  b.deeplink ?? null,
    }));

    res.json(banners);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

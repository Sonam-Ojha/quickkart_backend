const router = require('express').Router();
const Faq = require('../../models/faq.model');

// GET /api/app/faqs?page=print  — public, no auth needed
router.get('/', async (req, res) => {
  try {
    const { page } = req.query;
    const where = { isActive: true };
    if (page) where.page = page;
    const faqs = await Faq.findAll({ where, order: [['sort_order', 'ASC']], attributes: ['id', 'question', 'answer', 'sortOrder'] });
    return res.json(faqs);
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

module.exports = router;

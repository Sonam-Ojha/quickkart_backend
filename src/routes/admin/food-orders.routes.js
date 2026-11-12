const router = require('express').Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireAdmin } = require('../../middlewares/admin.middleware');
const svc = require('../../services/order.service');

// Food orders are normal orders with orderType 'food' (see order.model).
// Flow: placed 'pending' → ops calls the restaurant → 'confirmed' here, which
// sends it to riders → rider picks up at the restaurant → delivered.
router.use(authenticate, requireAdmin);

// GET /api/admin/food-orders/stats
router.get('/stats', async (req, res) => {
  try { res.json(await svc.getStats({ type: 'food' })); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/admin/food-orders?status=&search=&page=
router.get('/', async (req, res) => {
  try { res.json(await svc.list({ ...req.query, type: 'food' })); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/admin/food-orders/:id
router.get('/:id', async (req, res) => {
  try { res.json({ order: await svc.getById(req.params.id) }); }
  catch (err) { res.status(404).json({ message: err.message }); }
});

// PATCH /api/admin/food-orders/:id/status  { status, note }
router.patch('/:id/status', async (req, res) => {
  try {
    await svc.updateStatus(req.params.id, req.body.status, req.body.note);
    res.json({ order: await svc.getById(req.params.id) });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;

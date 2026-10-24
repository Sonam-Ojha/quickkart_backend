const router = require('express').Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireAdmin } = require('../../middlewares/admin.middleware');
const svc = require('../../services/order.service');

// Print orders are normal orders with orderType 'print' (see order.model).
// These routes are the Print Orders page's view onto them; status changes go
// through the same service as every other order, so timeline, customer push
// and rider withdrawal all happen the same way.
router.use(authenticate, requireAdmin);

// GET /api/admin/print-orders/stats
router.get('/stats', async (req, res) => {
  try { res.json(await svc.getStats({ type: 'print' })); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/admin/print-orders
router.get('/', async (req, res) => {
  try { res.json(await svc.list({ ...req.query, type: 'print' })); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/admin/print-orders/:id
router.get('/:id', async (req, res) => {
  try { res.json({ order: await svc.getById(req.params.id) }); }
  catch (err) { res.status(404).json({ message: err.message }); }
});

// PATCH /api/admin/print-orders/:id/status
router.patch('/:id/status', async (req, res) => {
  try {
    await svc.updateStatus(req.params.id, req.body.status, req.body.note);
    res.json({ order: await svc.getById(req.params.id) });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;

const router      = require('express').Router();
const { authenticate }  = require('../../middlewares/auth.middleware');
const { requireAdmin }  = require('../../middlewares/admin.middleware');
const PrintOrder  = require('../../models/print-order.model');
const User        = require('../../models/user.model');

const VALID_STATUSES = ['pending', 'confirmed', 'printing', 'delivered', 'cancelled'];

router.use(authenticate, requireAdmin);

// GET /api/admin/print-orders
router.get('/', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status && status !== 'all') where.status = status;

    const { count, rows } = await PrintOrder.findAndCountAll({
      where,
      include: [{ model: User, as: 'customer', attributes: ['id', 'name', 'mobile', 'email'] }],
      order: [['created_at', 'DESC']],
      limit:  Number(limit),
      offset: (Number(page) - 1) * Number(limit),
    });

    res.json({ orders: rows, total: count, pages: Math.ceil(count / Number(limit)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/admin/print-orders/:id/status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const order = await PrintOrder.findByPk(req.params.id);
    if (!order) return res.status(404).json({ message: 'Print order not found' });
    await order.update({ status });
    res.json({ order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

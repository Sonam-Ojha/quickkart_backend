const express = require('express');
const router  = express.Router();
const { requireAdmin } = require('../../middlewares/admin.middleware');
const AccountDeletion = require('../../models/account-deletion.model');

// GET /api/admin/account-deletions
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const where = type ? { userType: type } : {};
    const offset = (Number(page) - 1) * Number(limit);

    const { count, rows } = await AccountDeletion.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: Number(limit),
      offset,
    });

    res.json({ total: count, page: Number(page), data: rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

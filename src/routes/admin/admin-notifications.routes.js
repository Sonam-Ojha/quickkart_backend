const express = require('express');
const router  = express.Router();
const { Op }  = require('sequelize');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireAdmin }  = require('../../middlewares/admin.middleware');
const AdminNotification = require('../../models/admin-notification.model');

// GET /api/admin/admin-notifications?category=today
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const { category } = req.query;

    let where = {};
    if (category === 'today') {
      where.created_at = { [Op.gte]: today };
    } else if (category === 'yesterday') {
      const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
      where.created_at = { [Op.gte]: yesterday, [Op.lt]: today };
    } else if (category === 'this_week') {
      const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay());
      where.created_at = { [Op.gte]: weekStart };
    } else if (category === 'last_week') {
      const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay());
      const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(weekStart.getDate() - 7);
      where.created_at = { [Op.gte]: lastWeekStart, [Op.lt]: weekStart };
    } else if (category === 'this_month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      where.created_at = { [Op.gte]: monthStart };
    }

    const notifications = await AdminNotification.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: 100,
    });

    const unreadCount = await AdminNotification.count({ where: { isRead: false } });
    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/admin/admin-notifications/:id/read
router.patch('/:id/read', authenticate, requireAdmin, async (req, res) => {
  try {
    await AdminNotification.update({ isRead: true }, { where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/admin/admin-notifications/read-all
router.patch('/read-all', authenticate, requireAdmin, async (req, res) => {
  try {
    await AdminNotification.update({ isRead: true }, { where: { isRead: false } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/admin/admin-notifications/:id
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await AdminNotification.destroy({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/admin/admin-notifications (clear all)
router.delete('/', authenticate, requireAdmin, async (req, res) => {
  try {
    await AdminNotification.destroy({ where: {} });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

const express = require('express');
const router  = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireAdmin }  = require('../../middlewares/admin.middleware');
const { sendToUsers }   = require('../../services/notification.service');
const User = require('../../models/user.model');

// POST /api/admin/notifications/send
router.post('/send', authenticate, requireAdmin, async (req, res) => {
  try {
    const { title, body, segment = 'all' } = req.body;
    if (!title || !body) return res.status(400).json({ message: 'title and body are required' });

    const where = { fcmToken: { [require('sequelize').Op.ne]: null } };
    if (segment === 'active') {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      where.updatedAt = { [require('sequelize').Op.gte]: since };
    }

    const users = await User.findAll({ where, attributes: ['id'] });
    const ids   = users.map(u => u.id);
    if (!ids.length) return res.json({ sent: 0, message: 'No users with FCM token' });

    const result = await sendToUsers(ids, { title, body });
    const sent = result?.responses?.filter(r => r.success).length ?? ids.length;
    return res.json({ sent, total: ids.length });
  } catch (err) {
    console.error('[ADMIN NOTIFY]', err.message);
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;

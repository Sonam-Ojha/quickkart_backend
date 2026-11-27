const router     = require('express').Router();
const { Op, fn, col, literal } = require('sequelize');
const OtpLog     = require('../../models/otp-log.model');
const { authenticate, requireAdmin } = require('../../middleware/auth.middleware');

const auth = [authenticate, requireAdmin];

// GET /api/admin/otp-logs/stats?from=&to=
router.get('/stats', auth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const where = {};
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at[Op.gte] = new Date(from);
      if (to)   where.created_at[Op.lte] = new Date(to + 'T23:59:59Z');
    }

    const [total, sent, failed, dev, byDay] = await Promise.all([
      OtpLog.count({ where }),
      OtpLog.count({ where: { ...where, status: 'sent' } }),
      OtpLog.count({ where: { ...where, status: 'failed' } }),
      OtpLog.count({ where: { ...where, status: 'dev' } }),
      OtpLog.findAll({
        where,
        attributes: [
          [fn('DATE', col('created_at')), 'date'],
          [fn('COUNT', col('id')), 'count'],
        ],
        group: [fn('DATE', col('created_at'))],
        order: [[fn('DATE', col('created_at')), 'ASC']],
        raw: true,
      }),
    ]);

    res.json({ total, sent, failed, dev, byDay });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/admin/otp-logs/by-user?from=&to=&page=&limit=
router.get('/by-user', auth, async (req, res) => {
  try {
    const { from, to, page = 1, limit = 50 } = req.query;
    const where = { mobile: { [Op.ne]: null } };
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at[Op.gte] = new Date(from);
      if (to)   where.created_at[Op.lte] = new Date(to + 'T23:59:59Z');
    }

    const rows = await OtpLog.findAll({
      where,
      attributes: [
        'mobile',
        [fn('COUNT', col('id')), 'total'],
        [fn('SUM', literal("CASE WHEN status='sent' THEN 1 ELSE 0 END")), 'sent'],
        [fn('SUM', literal("CASE WHEN status='failed' THEN 1 ELSE 0 END")), 'failed'],
        [fn('MAX', col('created_at')), 'lastAt'],
      ],
      group: ['mobile'],
      order: [[fn('COUNT', col('id')), 'DESC']],
      limit:  Number(limit),
      offset: (Number(page) - 1) * Number(limit),
      raw: true,
    });

    const totalUsers = await OtpLog.count({
      where,
      distinct: true,
      col: 'mobile',
    });

    res.json({ rows, totalUsers, page: Number(page), limit: Number(limit) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;

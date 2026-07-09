const Membership = require('../../models/membership.model');

// GET /api/app/membership  — current user's active membership
const get = async (req, res) => {
  try {
    const now = new Date();
    const row = await Membership.findOne({
      where: { userId: req.user.id, status: 'active' },
      order: [['ends_at', 'DESC']],
    });

    if (!row) return res.json({ active: false, plan: null, endsAt: null });

    // Auto-expire if past end date
    if (new Date(row.endsAt) < now) {
      await row.update({ status: 'expired' });
      return res.json({ active: false, plan: row.plan, endsAt: row.endsAt });
    }

    return res.json({ active: true, plan: row.plan, startsAt: row.startsAt, endsAt: row.endsAt });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// POST /api/app/membership/subscribe
// Body: { plan: 'plus_3month' | 'plus_6month' | 'plus_12month' }
const subscribe = async (req, res) => {
  const { plan = 'plus_3month' } = req.body;

  const PLAN_MONTHS = { plus_3month: 3, plus_6month: 6, plus_12month: 12 };
  const months = PLAN_MONTHS[plan] ?? 3;

  try {
    const startsAt = new Date();
    const endsAt   = new Date(startsAt);
    endsAt.setMonth(endsAt.getMonth() + months);

    // Cancel any existing active membership first
    await Membership.update(
      { status: 'cancelled' },
      { where: { userId: req.user.id, status: 'active' } }
    );

    const membership = await Membership.create({
      userId: req.user.id,
      plan,
      status: 'active',
      startsAt,
      endsAt,
    });

    return res.status(201).json({
      active:   true,
      plan:     membership.plan,
      startsAt: membership.startsAt,
      endsAt:   membership.endsAt,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { get, subscribe };

const router  = require('express').Router();
const Setting = require('../../models/setting.model');

// Returns whether the service is currently open/closed
// GET /api/app/service-status
router.get('/', async (req, res) => {
  try {
    const rows = await Setting.findAll({
      where: { key: ['service_enabled', 'operating_hours', 'closed_message', 'reopens_at'] },
    });
    const cfg = {};
    rows.forEach(r => { cfg[r.key] = r.value; });

    // Manual kill-switch
    if (cfg.service_enabled === 'false') {
      return res.json({
        isOpen: false,
        message: cfg.closed_message || 'Service is temporarily unavailable.',
        reopensAt: cfg.reopens_at || '',
      });
    }

    // Time-based check
    const hours = (() => {
      try { return JSON.parse(cfg.operating_hours || 'null'); } catch { return null; }
    })();

    if (hours && hours.shifts && hours.shifts.length > 0) {
      const now = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();

      const toMins = (t) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };

      const isInAnyShift = hours.shifts.some(s => {
        const open  = toMins(s.open);
        const close = toMins(s.close);
        return mins >= open && mins < close;
      });

      if (!isInAnyShift) {
        // Find next opening time
        const nextShift = hours.shifts
          .map(s => ({ ...s, openMins: toMins(s.open) }))
          .filter(s => s.openMins > mins)
          .sort((a, b) => a.openMins - b.openMins)[0];

        return res.json({
          isOpen: false,
          message: cfg.closed_message || "We're closed for now.",
          reopensAt: nextShift ? nextShift.open : hours.shifts[0]?.open || '',
          nextShiftName: nextShift?.name || '',
        });
      }
    }

    res.json({ isOpen: true });
  } catch (err) {
    // On error, keep service open (fail-safe)
    res.json({ isOpen: true });
  }
});

module.exports = router;

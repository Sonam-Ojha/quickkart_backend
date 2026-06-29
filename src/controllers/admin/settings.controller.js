const Setting = require('../../models/setting.model');

const DEFAULTS = {
  footer_tagline:   'Groceries, essentials & documents delivered in minutes.',
  support_phone:    '1800-XXX-XXXX (Toll Free)',
  support_email:    'help@quickkart.in',
  company_address:  'Noida, Uttar Pradesh',
  copyright_text:   '© 2026 QuickKart Technologies Pvt. Ltd. All rights reserved.',
  footer_badge:     '10-minute delivery · 30,000+ products',
  delivery_fee:            '30',
  free_delivery_threshold: '99',
  handling_charge:         '5',
  max_delivery_radius:     '10',
  otp_length:              '6',
  otp_expiry:              '300',
  max_otp_attempts:        '5',
  app_version_min:         '1.0.0',
};

// GET /api/admin/settings
exports.getAll = async (req, res) => {
  try {
    const rows = await Setting.findAll();
    const result = { ...DEFAULTS };
    rows.forEach(r => { result[r.key] = r.value; });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/admin/settings  — body: { key: value, ... }
exports.upsertMany = async (req, res) => {
  try {
    const entries = Object.entries(req.body);
    if (!entries.length) return res.status(400).json({ message: 'No settings provided' });

    await Promise.all(
      entries.map(([key, value]) =>
        Setting.upsert({ key, value: value === null || value === undefined ? '' : String(value) })
      )
    );
    res.json({ message: 'Settings saved' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

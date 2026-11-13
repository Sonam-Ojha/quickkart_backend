const Setting = require('../../models/setting.model');

const DEFAULTS = {
  footer_tagline:   'Groceries, essentials & documents delivered in minutes.',
  support_phone:    '1800-XXX-XXXX (Toll Free)',
  support_email:    'help@quickkart.in',
  company_address:  'Noida, Uttar Pradesh',
  copyright_text:   '© 2026 Jhatpats Technologies Pvt. Ltd. All rights reserved.',
  footer_badge:     '10-minute delivery · 30,000+ products',
  delivery_fee:            '35',
  free_delivery_threshold: '100',
  handling_charge:         '10',
  max_delivery_radius:     '10',
  otp_length:              '6',
  otp_expiry:              '300',
  max_otp_attempts:        '5',
  app_version_min:         '1.0.0',
  // Charges tab
  charge_platform_fee_enabled:   '1',  charge_platform_fee_amount:   '3',
  charge_handling_fee_enabled:   '1',  charge_handling_fee_amount:   '10',
  charge_small_cart_enabled:     '1',  charge_small_cart_amount:     '15',  charge_small_cart_threshold: '100',
  charge_distance_fee_enabled:   '0',  charge_distance_fee_amount:   '10',
  charge_rain_fee_enabled:       '0',  charge_rain_fee_amount:       '10',
  charge_surge_fee_enabled:      '0',  charge_surge_fee_amount:      '10',
  charge_late_night_enabled:     '0',  charge_late_night_amount:     '10',
  charge_packaging_fee_enabled:  '0',  charge_packaging_fee_amount:  '5',
  charge_cod_fee_enabled:        '0',  charge_cod_fee_amount:        '5',
  // OTP visibility
  show_otp_web:          '1',
  show_otp_customer_app: '1',
  show_otp_rider_app:    '1',
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

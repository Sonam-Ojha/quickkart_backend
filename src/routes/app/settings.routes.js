const router = require('express').Router();
const Setting = require('../../models/setting.model');
const { Op } = require('sequelize');

const PUBLIC_KEYS = [
  'footer_tagline', 'support_phone', 'support_email',
  'company_address', 'copyright_text', 'footer_badge',
];

const DEFAULTS = {
  footer_tagline:  'Groceries, essentials & documents delivered in minutes.',
  support_phone:   '1800-XXX-XXXX (Toll Free)',
  support_email:   'help@quickkart.in',
  company_address: 'Noida, Uttar Pradesh',
  copyright_text:  '© 2026 QuickKart Technologies Pvt. Ltd. All rights reserved.',
  footer_badge:    '10-minute delivery · 30,000+ products',
};

// GET /api/app/settings  — public, no auth
router.get('/', async (req, res) => {
  try {
    const rows = await Setting.findAll({ where: { key: { [Op.in]: PUBLIC_KEYS } } });
    const result = { ...DEFAULTS };
    rows.forEach(r => { result[r.key] = r.value; });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

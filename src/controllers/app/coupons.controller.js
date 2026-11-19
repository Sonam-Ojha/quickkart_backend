const { Op }        = require('sequelize');
const Product       = require('../../models/product.model');
const couponService = require('../../services/coupon.service');
const checkout      = require('../../services/checkout-payment.service');

// Cart subtotal in rupees from server-side prices, same as order placement.
async function serverSubtotal(rawItems) {
  const items = checkout.normalizeItems(rawItems);
  const products = await Product.findAll({ attributes: ['id', 'price'], where: { id: { [Op.in]: items.map(i => i.id) } } });
  const priceMap = Object.fromEntries(products.map(p => [p.id, Math.round(p.price / 100)]));
  return items.reduce((sum, i) => {
    if (priceMap[i.id] == null) throw checkout.fail(`Product #${i.id} not found`);
    return sum + priceMap[i.id] * i.qty;
  }, 0);
}

// GET /api/app/coupons — coupons this customer can use right now
const list = async (req, res) => {
  try {
    return res.json({ coupons: await couponService.listForCustomer(req.user.id) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// POST /api/app/coupons/validate — { code, items } (or legacy { code, subtotal })
const validate = async (req, res) => {
  try {
    const { code, items } = req.body;
    const subtotal = Array.isArray(items) ? await serverSubtotal(items) : Number(req.body.subtotal);
    if (!Number.isFinite(subtotal) || subtotal <= 0) throw checkout.fail('Your cart is empty');
    const { coupon, discount } = await couponService.evaluate({ code, userId: req.user.id, subtotal });
    return res.json({
      valid: true,
      discount,
      subtotal,
      coupon: { code: coupon.code, type: coupon.type, value: coupon.type === 'flat' ? Math.floor(coupon.value / 100) : coupon.value },
    });
  } catch (err) {
    return res.status(err.status ?? 500).json({ message: err.message });
  }
};

module.exports = { list, validate };

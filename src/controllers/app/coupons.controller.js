const Coupon      = require('../../models/coupon.model');
const CouponUsage = require('../../models/coupon-usage.model');
const { Op }      = require('sequelize');

const validate = async (req, res) => {
  try {
    const { code, subtotal } = req.body;

    const coupon = await Coupon.findOne({ where: { code, is_active: true } });
    if (!coupon) return res.status(404).json({ message: 'Invalid coupon code' });

    const now = new Date();
    if (coupon.valid_from && now < new Date(coupon.valid_from))
      return res.status(400).json({ message: 'Coupon not yet active' });
    if (coupon.valid_till && now > new Date(coupon.valid_till))
      return res.status(400).json({ message: 'Coupon has expired' });

    if (coupon.min_order_amount && subtotal < coupon.min_order_amount)
      return res.status(400).json({ message: `Minimum order amount is ₹${coupon.min_order_amount}` });

    if (coupon.max_uses) {
      const totalUsed = await CouponUsage.count({ where: { coupon_id: coupon.id } });
      if (totalUsed >= coupon.max_uses) return res.status(400).json({ message: 'Coupon usage limit reached' });
    }

    if (coupon.max_uses_per_user) {
      const userUsed = await CouponUsage.count({ where: { coupon_id: coupon.id, user_id: req.user.id } });
      if (userUsed >= coupon.max_uses_per_user) return res.status(400).json({ message: 'You have already used this coupon' });
    }

    const discount =
      coupon.type === 'percent'
        ? Math.min((subtotal * coupon.value) / 100, coupon.max_discount ?? Infinity)
        : coupon.value;

    return res.json({ valid: true, discount, coupon: { code: coupon.code, type: coupon.type, value: coupon.value } });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { validate };

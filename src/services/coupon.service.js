const { Op, fn, col } = require('sequelize');
const Coupon = require('../models/coupon.model');
const CouponUsage = require('../models/coupon-usage.model');

// Money columns on coupons (flat value, maxDiscount, minOrder) are stored in paise;
// order subtotals and discounts are rupees.
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const rupees = (paise) => Math.floor(Number(paise ?? 0) / 100);
const normalizeCode = (code) => (typeof code === 'string' ? code.trim().toUpperCase() : '');

// Admin forms send plain dates. Treat them as whole days in India time so a
// coupon "valid till 30 Nov" still works on the evening of 30 Nov.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const startOfDay = (v) => (typeof v === 'string' && DATE_ONLY.test(v) ? `${v}T00:00:00.000+05:30` : v);
const endOfDay   = (v) => (typeof v === 'string' && DATE_ONLY.test(v) ? `${v}T23:59:59.999+05:30` : v);

function discountFor(coupon, subtotal) {
  const raw = coupon.type === 'flat'
    ? rupees(coupon.value)
    : Math.floor((subtotal * coupon.value) / 100);
  const capped = coupon.type === 'percent' && coupon.maxDiscount != null ? Math.min(raw, rupees(coupon.maxDiscount)) : raw;
  return Math.max(0, Math.min(capped, subtotal));
}

/**
 * Checks a coupon for this customer and cart subtotal (rupees) and returns the
 * discount in rupees. Pass a transaction to lock the coupon row while the
 * order that uses it is written. Throws a 400 error with a customer-facing message.
 */
async function evaluate({ code, userId, subtotal, transaction }) {
  const normalized = normalizeCode(code);
  if (!normalized) throw fail('Please enter a coupon code');
  const coupon = await Coupon.findOne({
    where: { code: normalized, isActive: true },
    ...(transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {}),
  });
  if (!coupon) throw fail('Invalid coupon code');

  const now = new Date();
  if (now < new Date(coupon.validFrom)) throw fail('This coupon is not active yet');
  if (now > new Date(coupon.validTo)) throw fail('This coupon has expired');

  const minOrder = rupees(coupon.minOrder);
  if (subtotal < minOrder) throw fail(`Add items worth ₹${minOrder - subtotal} more to use this coupon (minimum order ₹${minOrder})`);

  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) throw fail('This coupon has reached its usage limit');
  if (coupon.perUserLimit) {
    const used = await CouponUsage.count({ where: { couponId: coupon.id, userId }, transaction });
    if (used >= coupon.perUserLimit) throw fail('You have already used this coupon');
  }

  const discount = discountFor(coupon, subtotal);
  if (discount <= 0) throw fail('This coupon does not give any discount on this cart');
  return { coupon, discount };
}

async function recordUsage({ coupon, userId, orderId, discount, transaction }) {
  await CouponUsage.create({ couponId: coupon.id, userId, orderId, discountAmount: discount }, { transaction });
  await coupon.increment('usedCount', { transaction });
}

/** Frees the coupon an order used, so a cancelled order doesn't use up the customer's limit. */
async function releaseForOrder(orderId, transaction) {
  const usage = await CouponUsage.findOne({ where: { orderId }, transaction });
  if (!usage) return;
  await usage.destroy({ transaction });
  await Coupon.decrement('usedCount', { where: { id: usage.couponId, usedCount: { [Op.gt]: 0 } }, transaction });
}

/** Coupons this customer can use right now, in rupees, for the app's Coupons screen. */
async function listForCustomer(userId) {
  const now = new Date();
  const coupons = await Coupon.findAll({
    where: { isActive: true, validFrom: { [Op.lte]: now }, validTo: { [Op.gte]: now } },
    order: [['valid_to', 'ASC']],
  });
  const usage = coupons.length ? await CouponUsage.findAll({
    attributes: ['couponId', [fn('COUNT', col('id')), 'used']],
    where: { userId, couponId: { [Op.in]: coupons.map(c => c.id) } },
    group: ['couponId'],
    raw: true,
  }) : [];
  const usedByMe = Object.fromEntries(usage.map(u => [u.couponId, Number(u.used)]));
  return coupons
    .filter(c => c.usageLimit == null || c.usedCount < c.usageLimit)
    .filter(c => !c.perUserLimit || (usedByMe[c.id] ?? 0) < c.perUserLimit)
    .map(c => ({
      code:        c.code,
      type:        c.type,
      value:       c.type === 'flat' ? rupees(c.value) : c.value,
      maxDiscount: c.type === 'percent' && c.maxDiscount != null ? rupees(c.maxDiscount) : null,
      minOrder:    rupees(c.minOrder),
      validTo:     c.validTo,
    }));
}

const list = async ({ search, status } = {}) => {
  const where = {};
  if (search) where.code = { [Op.like]: `%${search.toUpperCase()}%` };
  if (status === 'active')   where.isActive = true;
  if (status === 'inactive') where.isActive = false;
  return Coupon.findAll({ where, order: [['created_at', 'DESC']] });
};

const create = async (data) => {
  const { code, type, value, maxDiscount, minOrder, usageLimit, perUserLimit, validFrom, validTo, isActive } = data;
  if (!code || !type || !value || !validFrom || !validTo) throw new Error('code, type, value, validFrom, validTo are required');
  if (!['flat', 'percent'].includes(type)) throw new Error('type must be flat or percent');
  if (type === 'percent' && (value < 1 || value > 100)) throw new Error('Percent value must be 1–100');
  const exists = await Coupon.findOne({ where: { code: code.toUpperCase() } });
  if (exists) throw new Error('Coupon code already exists');
  return Coupon.create({ code: code.toUpperCase(), type, value, maxDiscount, minOrder, usageLimit, perUserLimit, validFrom: startOfDay(validFrom), validTo: endOfDay(validTo), isActive });
};

const update = async (id, data) => {
  const coupon = await Coupon.findByPk(id);
  if (!coupon) throw new Error('Coupon not found');
  const { code, type, value, maxDiscount, minOrder, usageLimit, perUserLimit, validFrom, validTo, isActive } = data;
  await coupon.update({
    code: code ? code.toUpperCase() : undefined,
    type, value, maxDiscount, minOrder, usageLimit, perUserLimit,
    validFrom: startOfDay(validFrom), validTo: endOfDay(validTo), isActive,
  });
  return coupon;
};

const toggle = async (id) => {
  const coupon = await Coupon.findByPk(id);
  if (!coupon) throw new Error('Coupon not found');
  await coupon.update({ isActive: !coupon.isActive });
  return coupon;
};

const remove = async (id) => {
  const coupon = await Coupon.findByPk(id);
  if (!coupon) throw new Error('Coupon not found');
  await coupon.destroy();
};

module.exports = {
  list, create, update, toggle, remove,
  normalizeCode, evaluate, recordUsage, releaseForOrder, listForCustomer,
};

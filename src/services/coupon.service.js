const { Op } = require('sequelize');
const Coupon = require('../models/coupon.model');

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
  return Coupon.create({ code: code.toUpperCase(), type, value, maxDiscount, minOrder, usageLimit, perUserLimit, validFrom, validTo, isActive });
};

const update = async (id, data) => {
  const coupon = await Coupon.findByPk(id);
  if (!coupon) throw new Error('Coupon not found');
  if (data.code) data.code = data.code.toUpperCase();
  await coupon.update(data);
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

module.exports = { list, create, update, toggle, remove };

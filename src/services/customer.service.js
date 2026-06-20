const { Op } = require('sequelize');
const User = require('../models/user.model');

const listCustomers = async ({ search, status, page = 1, limit = 20 } = {}) => {
  page  = parseInt(page)  || 1;
  limit = parseInt(limit) || 20;
  const where = { role: 'user' };

  if (search) {
    where[Op.or] = [
      { name:   { [Op.like]: `%${search}%` } },
      { email:  { [Op.like]: `%${search}%` } },
      { mobile: { [Op.like]: `%${search}%` } },
    ];
  }

  if (status === 'active')  where.isActive = true;
  if (status === 'blocked') where.isActive = false;

  const offset = (page - 1) * limit;

  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: ['id', 'name', 'email', 'mobile', 'avatar', 'walletBalance', 'referralCode', 'isActive', 'created_at'],
    order: [['created_at', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  });

  return { customers: rows, total: count, page: Number(page), pages: Math.ceil(count / limit) };
};

const getCustomer = async (id) => {
  const customer = await User.findOne({
    where: { id, role: 'user' },
    attributes: ['id', 'name', 'email', 'mobile', 'avatar', 'walletBalance', 'referralCode', 'dob', 'isActive', 'created_at'],
  });
  if (!customer) throw new Error('Customer not found');
  return customer;
};

const toggleBlock = async (id) => {
  const customer = await User.findOne({ where: { id, role: 'user' } });
  if (!customer) throw new Error('Customer not found');
  await customer.update({ isActive: !customer.isActive });
  return { id: customer.id, isActive: customer.isActive };
};

module.exports = { listCustomers, getCustomer, toggleBlock };

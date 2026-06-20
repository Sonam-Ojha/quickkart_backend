const { Op } = require('sequelize');
const Payment = require('../models/payment.model');
const Order   = require('../models/order.model');
const User    = require('../models/user.model');

const getStats = async () => {
  const [total, paid, failed, refunded, pending] = await Promise.all([
    Payment.count(),
    Payment.count({ where: { status: 'paid' } }),
    Payment.count({ where: { status: 'failed' } }),
    Payment.count({ where: { status: 'refunded' } }),
    Payment.count({ where: { status: 'pending' } }),
  ]);
  const revenue = await Payment.sum('amount', { where: { status: 'paid' } });
  return { total, paid, failed, refunded, pending, revenue: revenue || 0 };
};

const list = async ({ status, gateway, search, page = 1, limit = 15 } = {}) => {
  page  = parseInt(page)  || 1;
  limit = parseInt(limit) || 15;
  const where = {};
  if (status  && status  !== 'all') where.status  = status;
  if (gateway && gateway !== 'all') where.gateway = gateway;

  const offset = (page - 1) * limit;
  const { count, rows } = await Payment.findAndCountAll({
    where,
    include: [{
      model: Order, as: 'order',
      attributes: ['id', 'total', 'status'],
      include: [{ model: User, as: 'customer', attributes: ['id', 'name', 'email'] }],
    }],
    order: [['created_at', 'DESC']],
    limit: Number(limit),
    offset: Number(offset),
  });

  let payments = rows;
  if (search) {
    const q = search.toLowerCase();
    payments = rows.filter(p =>
      p.txnId?.toLowerCase().includes(q) ||
      String(p.orderId).includes(q) ||
      p.order?.customer?.name?.toLowerCase().includes(q)
    );
  }

  return { payments, total: count, page: Number(page), pages: Math.ceil(count / limit) };
};

module.exports = { getStats, list };

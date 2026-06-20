const { Op, fn, col, literal } = require('sequelize');
const sequelize = require('../config/db');
const Order     = require('../models/order.model');
const OrderItem = require('../models/order-item.model');
const User      = require('../models/user.model');
const Product   = require('../models/product.model');
const Rider     = require('../models/rider.model');
const DarkStore = require('../models/darkstore.model');

const todayStart = () => {
  const d = new Date(); d.setHours(0,0,0,0); return d;
};

const getKpis = async () => {
  const today = todayStart();
  const [todayOrders, todayRevenue, totalCustomers, activeRiders] = await Promise.all([
    Order.count({ where: { created_at: { [Op.gte]: today } } }),
    Order.sum('total', { where: { status: 'delivered', created_at: { [Op.gte]: today } } }),
    User.count({ where: { role: 'user' } }),
    Rider.count({ where: { status: 'active' } }),
  ]);
  return {
    todayOrders,
    todayRevenue: todayRevenue || 0,
    totalCustomers,
    activeRiders,
  };
};

const getOrderStatusDist = async () => {
  const today = todayStart();
  const results = await Order.findAll({
    where: { created_at: { [Op.gte]: today } },
    attributes: ['status', [fn('COUNT', col('id')), 'count']],
    group: ['status'],
    raw: true,
  });
  return results.map(r => ({ status: r.status, count: Number(r.count) }));
};

const getWeeklyChart = async () => {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0,0,0,0);
    const next = new Date(d); next.setDate(next.getDate() + 1);
    const [orderCount, revenue] = await Promise.all([
      Order.count({ where: { created_at: { [Op.gte]: d, [Op.lt]: next } } }),
      Order.sum('total', { where: { status: 'delivered', created_at: { [Op.gte]: d, [Op.lt]: next } } }),
    ]);
    days.push({
      day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      orders: orderCount,
      revenue: revenue || 0,
    });
  }
  return days;
};

const getRecentOrders = async () => {
  return Order.findAll({
    limit: 5,
    order: [['created_at', 'DESC']],
    include: [
      { model: User,      as: 'customer', attributes: ['id', 'name'] },
      { model: DarkStore, as: 'store',    attributes: ['id', 'name'] },
    ],
    attributes: ['id', 'total', 'status', 'created_at'],
  });
};

const getTopProducts = async () => {
  const results = await OrderItem.findAll({
    attributes: [
      'productId',
      [fn('SUM', col('quantity')),       'totalQty'],
      [fn('SUM', col('OrderItem.total')), 'totalRevenue'],
    ],
    include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }],
    group: ['productId', 'product.id'],
    order: [[literal('totalQty'), 'DESC']],
    limit: 5,
    raw: false,
  });
  return results.map(r => ({
    id:           r.productId,
    name:         r.product?.name ?? '—',
    totalQty:     Number(r.dataValues.totalQty),
    totalRevenue: Number(r.dataValues.totalRevenue),
  }));
};

module.exports = { getKpis, getOrderStatusDist, getWeeklyChart, getRecentOrders, getTopProducts };

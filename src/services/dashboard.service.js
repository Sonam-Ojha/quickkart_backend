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

const dateWhere = (from, to) => {
  if (!from && !to) return {};
  const w = {};
  if (from) w[Op.gte] = from;
  if (to)   w[Op.lte] = to;
  return { created_at: w };
};

const getKpis = async (from, to) => {
  const base = dateWhere(from, to);
  const today = from ? null : todayStart();
  const orderWhere   = from ? base : { created_at: { [Op.gte]: today } };
  const revenueWhere = from ? { status: 'delivered', ...base } : { status: 'delivered', created_at: { [Op.gte]: today } };
  const [todayOrders, todayRevenue, totalCustomers, activeRiders] = await Promise.all([
    Order.count({ where: orderWhere }),
    Order.sum('total', { where: revenueWhere }),
    User.count({ where: { role: 'user' } }),
    Rider.count({ where: { status: 'active' } }),
  ]);
  return { todayOrders, todayRevenue: todayRevenue || 0, totalCustomers, activeRiders };
};

const getOrderStatusDist = async (from, to) => {
  const today = todayStart();
  const where = from ? dateWhere(from, to) : { created_at: { [Op.gte]: today } };
  const results = await Order.findAll({
    where,
    attributes: ['status', [fn('COUNT', col('id')), 'count']],
    group: ['status'],
    raw: true,
  });
  return results.map(r => ({ status: r.status, count: Number(r.count) }));
};

const getWeeklyChart = async () => {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
    const next = new Date(d); next.setDate(next.getDate() + 1);
    const [orderCount, revenue] = await Promise.all([
      Order.count({ where: { created_at: { [Op.gte]: d, [Op.lt]: next } } }),
      Order.sum('total', { where: { status: 'delivered', created_at: { [Op.gte]: d, [Op.lt]: next } } }),
    ]);
    days.push({ day: d.toLocaleDateString('en-IN', { weekday: 'short' }), orders: orderCount, revenue: revenue || 0 });
  }
  return days;
};

const getRangeChart = async (from, to) => {
  const days = [];
  const cur = new Date(from); cur.setHours(0,0,0,0);
  const end = new Date(to);   end.setHours(23,59,59,999);
  while (cur <= end) {
    const next = new Date(cur); next.setDate(next.getDate() + 1);
    const [orderCount, revenue] = await Promise.all([
      Order.count({ where: { created_at: { [Op.gte]: new Date(cur), [Op.lt]: next } } }),
      Order.sum('total', { where: { status: 'delivered', created_at: { [Op.gte]: new Date(cur), [Op.lt]: next } } }),
    ]);
    days.push({ day: cur.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), orders: orderCount, revenue: revenue || 0 });
    cur.setDate(cur.getDate() + 1);
  }
  return days;
};

const getRecentOrders = async (from, to) => {
  const where = from ? dateWhere(from, to) : {};
  return Order.findAll({
    where,
    limit: 10,
    order: [['created_at', 'DESC']],
    include: [
      { model: User,      as: 'customer', attributes: ['id', 'name'] },
      { model: DarkStore, as: 'store',    attributes: ['id', 'name'] },
    ],
    attributes: ['id', 'total', 'status', 'created_at'],
  });
};

const getTopProducts = async (from, to) => {
  const where = from ? dateWhere(from, to) : {};
  const results = await OrderItem.findAll({
    attributes: [
      'productId',
      [fn('SUM', col('quantity')),        'totalQty'],
      [fn('SUM', col('OrderItem.total')), 'totalRevenue'],
    ],
    include: [
      { model: Product, as: 'product', attributes: ['id', 'name'] },
      ...(from ? [{ model: Order, as: 'Order', attributes: [], where, required: true }] : []),

    ],
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

module.exports = { getKpis, getOrderStatusDist, getWeeklyChart, getRangeChart, getRecentOrders, getTopProducts };

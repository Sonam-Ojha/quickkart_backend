const { Op } = require('sequelize');
const Order         = require('../models/order.model');
const OrderItem     = require('../models/order-item.model');
const OrderTimeline = require('../models/order-timeline.model');
const User          = require('../models/user.model');
const DarkStore     = require('../models/darkstore.model');
const Rider         = require('../models/rider.model');
const Product       = require('../models/product.model');

const CUSTOMER_ATTRS = ['id', 'name', 'email', 'mobile'];
const STORE_ATTRS    = ['id', 'name', 'city'];
const RIDER_ATTRS    = ['id', 'name', 'mobile', 'rating'];
const PRODUCT_ATTRS  = ['id', 'name', 'imageUrl'];

const list = async ({ status, search, page = 1, limit = 15 } = {}) => {
  page  = parseInt(page)  || 1;
  limit = parseInt(limit) || 15;
  const where = {};
  if (status && status !== 'all') where.status = status;

  const offset = (page - 1) * limit;

  const { count, rows } = await Order.findAndCountAll({
    where,
    include: [
      { model: User,      as: 'customer', attributes: CUSTOMER_ATTRS },
      { model: DarkStore, as: 'store',    attributes: STORE_ATTRS },
      { model: Rider,     as: 'rider',    attributes: RIDER_ATTRS, required: false },
    ],
    order: [['created_at', 'DESC']],
    limit: Number(limit),
    offset: Number(offset),
  });

  // search on customer name / email after join
  let orders = rows;
  if (search) {
    const q = search.toLowerCase();
    orders = rows.filter(o =>
      String(o.id).includes(q) ||
      o.customer?.name?.toLowerCase().includes(q) ||
      o.customer?.email?.toLowerCase().includes(q) ||
      o.customer?.mobile?.includes(q)
    );
  }

  return { orders, total: count, page: Number(page), pages: Math.ceil(count / limit) };
};

const getById = async (id) => {
  const order = await Order.findByPk(id, {
    include: [
      { model: User,      as: 'customer', attributes: CUSTOMER_ATTRS },
      { model: DarkStore, as: 'store',    attributes: STORE_ATTRS },
      { model: Rider,     as: 'rider',    attributes: RIDER_ATTRS, required: false },
      {
        model: OrderItem, as: 'items',
        include: [{ model: Product, as: 'product', attributes: PRODUCT_ATTRS }],
      },
      { model: OrderTimeline, as: 'timeline', order: [['created_at', 'ASC']] },
    ],
  });
  if (!order) throw new Error('Order not found');
  return order;
};

const STATUS_FLOW = {
  pending:          'confirmed',
  confirmed:        'preparing',
  preparing:        'out_for_delivery',
  out_for_delivery: 'delivered',
};

const updateStatus = async (id, status, note) => {
  const valid = ['pending','confirmed','preparing','out_for_delivery','delivered','cancelled'];
  if (!valid.includes(status)) throw new Error('Invalid status');

  const order = await Order.findByPk(id);
  if (!order) throw new Error('Order not found');
  if (order.status === 'delivered' || order.status === 'cancelled') throw new Error('Cannot update a completed order');

  await order.update({ status });
  await OrderTimeline.create({ orderId: id, status, note: note || null });
  return order;
};

const getStats = async () => {
  const sequelize = require('../config/db');
  const [total, pending, active, delivered, cancelled] = await Promise.all([
    Order.count(),
    Order.count({ where: { status: 'pending' } }),
    Order.count({ where: { status: { [Op.in]: ['confirmed','preparing','out_for_delivery'] } } }),
    Order.count({ where: { status: 'delivered' } }),
    Order.count({ where: { status: 'cancelled' } }),
  ]);
  const revenue = await Order.sum('total', { where: { status: 'delivered' } });
  return { total, pending, active, delivered, cancelled, revenue: revenue || 0 };
};

module.exports = { list, getById, updateStatus, getStats };

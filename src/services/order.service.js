const { Op } = require('sequelize');
const { notifyOrderStatus } = require('./notification.service');
const Order         = require('../models/order.model');
const OrderItem     = require('../models/order-item.model');
const OrderTimeline = require('../models/order-timeline.model');
const User          = require('../models/user.model');
const DarkStore     = require('../models/darkstore.model');
const Rider         = require('../models/rider.model');
const Product       = require('../models/product.model');
const Address       = require('../models/address.model');
const Restaurant    = require('../models/restaurant.model');

const CUSTOMER_ATTRS = ['id', 'name', 'email', 'mobile'];
const STORE_ATTRS    = ['id', 'name', 'city'];
const RIDER_ATTRS    = ['id', 'name', 'mobile', 'rating'];
const PRODUCT_ATTRS  = ['id', 'name', 'imageUrl'];
const RESTAURANT_ATTRS = ['id', 'name', 'phone', 'address', 'lat', 'lng'];
const ORDER_TYPES    = ['grocery', 'print', 'food'];

const list = async ({ status, type, search, page = 1, limit = 15 } = {}) => {
  page  = parseInt(page)  || 1;
  limit = parseInt(limit) || 15;
  const where = {};
  if (status && status !== 'all') where.status = status;
  if (ORDER_TYPES.includes(type)) where.orderType = type;

  // Push search into the SQL query so pagination metadata is correct
  const customerWhere = {};
  if (search) {
    const q = `%${search}%`;
    customerWhere[Op.or] = [
      { name:   { [Op.like]: q } },
      { email:  { [Op.like]: q } },
      { mobile: { [Op.like]: q } },
    ];
  }
  // Also allow searching by order ID directly
  if (search && /^\d+$/.test(search)) {
    where[Op.or] = [{ id: parseInt(search) }];
  }

  const offset = (page - 1) * limit;

  const { count, rows } = await Order.findAndCountAll({
    where,
    include: [
      { model: User,      as: 'customer', attributes: CUSTOMER_ATTRS, where: Object.keys(customerWhere).length ? customerWhere : undefined, required: Object.keys(customerWhere).length > 0 },
      { model: DarkStore, as: 'store',    attributes: STORE_ATTRS },
      { model: Rider,     as: 'rider',    attributes: RIDER_ATTRS, required: false },
      { model: Restaurant, as: 'restaurant', attributes: RESTAURANT_ATTRS, required: false },
    ],
    order: [['created_at', 'DESC']],
    limit: Number(limit),
    offset: Number(offset),
    distinct: true,
  });

  return { orders: rows, total: count, page: Number(page), pages: Math.ceil(count / limit) };
};

const getById = async (id) => {
  const order = await Order.findByPk(id, {
    include: [
      { model: User,      as: 'customer', attributes: CUSTOMER_ATTRS },
      { model: DarkStore, as: 'store',    attributes: STORE_ATTRS },
      { model: Rider,     as: 'rider',    attributes: RIDER_ATTRS, required: false },
      { model: Restaurant, as: 'restaurant', attributes: RESTAURANT_ATTRS, required: false },
      {
        model: OrderItem, as: 'items',
        include: [{ model: Product, as: 'product', attributes: PRODUCT_ATTRS }],
      },
      { model: OrderTimeline, as: 'timeline', order: [['created_at', 'ASC']] },
      { model: Address, as: 'address', attributes: ['id', 'label', 'line1', 'line2', 'city', 'pincode', 'lat', 'lng'], required: false },
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
  // Fire-and-forget push notification to customer
  notifyOrderStatus(order, status).catch(() => {});
  require('./realtime.service').orderChanged(order);
  if (status === 'cancelled') require('./rider-dispatch.service').withdrawOffers(order.id).catch(() => {});
  // Food orders wait for ops to confirm with the restaurant; that is when a
  // rider is sent (the sweeper would also pick it up on its next pass).
  if (order.orderType === 'food' && status === 'confirmed' && !order.riderId) {
    require('./rider-dispatch.service').offerOrder(order.id)
      .catch(err => console.error('[dispatch] food confirm:', err.message));
  }
  return order;
};

const getStats = async ({ type } = {}) => {
  const sequelize = require('../config/db');
  const typeClause = ORDER_TYPES.includes(type) ? 'AND order_type = :orderType' : '';
  const [row] = await sequelize.query(
    `SELECT
       COUNT(*)                                                                    AS total,
       COALESCE(SUM(status = 'pending'), 0)                                       AS pending,
       COALESCE(SUM(status IN ('confirmed','preparing','out_for_delivery')), 0)   AS active,
       COALESCE(SUM(status = 'delivered'), 0)                                     AS delivered,
       COALESCE(SUM(status = 'cancelled'), 0)                                     AS cancelled,
       COALESCE(SUM(CASE WHEN status = 'delivered' THEN total ELSE 0 END), 0)    AS revenue
     FROM orders WHERE 1=1 ${typeClause}`,
    { replacements: type ? { orderType: type } : {}, type: sequelize.QueryTypes.SELECT },
  );
  return {
    total:     Number(row.total),
    pending:   Number(row.pending),
    active:    Number(row.active),
    delivered: Number(row.delivered),
    cancelled: Number(row.cancelled),
    revenue:   Number(row.revenue),
  };
};

module.exports = { list, getById, updateStatus, getStats };

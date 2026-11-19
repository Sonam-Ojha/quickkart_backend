const bcrypt        = require('bcryptjs');
const jwt           = require('jsonwebtoken');
const { Op }        = require('sequelize');
const sequelize     = require('../config/db');
const nonOverlappingTask = require('./non-overlapping-task');
const RestaurantStaff = require('../models/restaurant-staff.model');
const Restaurant    = require('../models/restaurant.model');
const Order         = require('../models/order.model');
const OrderItem     = require('../models/order-item.model');
const OrderTimeline = require('../models/order-timeline.model');
const Payment       = require('../models/payment.model');
const Address       = require('../models/address.model');
const User          = require('../models/user.model');
const food          = require('./food.service');
const orderSvc      = require('./order.service');
const { saveAdminNotification, sendToUser } = require('./notification.service');

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

// Indian mobile, digits only; "+91 98xxxxxxxx" → "98xxxxxxxx".
const normalizeMobile = (m) => {
  const d = String(m ?? '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  if (!/^[6-9]\d{9}$/.test(d)) throw fail('Enter a valid 10-digit mobile number');
  return d;
};
const checkPassword = (p) => {
  if (typeof p !== 'string' || p.length < 6) throw fail('Password must be at least 6 characters');
};

// ── Staff logins (managed by super admin / ops) ──────────────

const listStaff = (restaurantId) =>
  RestaurantStaff.findAll({ where: { restaurantId }, order: [['id', 'ASC']] });

const createStaff = async (restaurantId, { name, mobile, password }) => {
  if (!(await Restaurant.findByPk(restaurantId))) throw fail('Restaurant not found', 404);
  if (!name?.trim()) throw fail('Name is required');
  const m = normalizeMobile(mobile);
  checkPassword(password);
  if (await RestaurantStaff.findOne({ where: { mobile: m } })) throw fail('This mobile number already has a partner login', 409);
  const s = await RestaurantStaff.create({ restaurantId, name: name.trim(), mobile: m, password: await bcrypt.hash(password, 10) });
  return RestaurantStaff.findByPk(s.id);
};

const updateStaff = async (restaurantId, staffId, { name, password, isActive }) => {
  const s = await RestaurantStaff.findOne({ where: { id: staffId, restaurantId } });
  if (!s) throw fail('Login not found', 404);
  const patch = {};
  if (name !== undefined) { if (!String(name).trim()) throw fail('Name is required'); patch.name = String(name).trim(); }
  if (isActive !== undefined) patch.isActive = !!isActive;
  if (password) { checkPassword(password); patch.password = await bcrypt.hash(password, 10); }
  await s.update(patch);
  return RestaurantStaff.findByPk(s.id);
};

const deleteStaff = async (restaurantId, staffId) => {
  const n = await RestaurantStaff.destroy({ where: { id: staffId, restaurantId } });
  if (!n) throw fail('Login not found', 404);
};

const hasActiveStaff = async (restaurantId) =>
  (await RestaurantStaff.count({ where: { restaurantId, isActive: true } })) > 0;

// ── Login ────────────────────────────────────────────────────

const login = async ({ mobile, password }) => {
  let m;
  try { m = normalizeMobile(mobile); } catch { throw fail('Wrong mobile number or password', 401); }
  const s = await RestaurantStaff.scope('withPassword').findOne({ where: { mobile: m } });
  // Same message for unknown number and wrong password — don't reveal which.
  if (!s || !(await bcrypt.compare(String(password ?? ''), s.password))) throw fail('Wrong mobile number or password', 401);
  if (!s.isActive) throw fail('This login has been turned off. Contact Jhatpats.', 403);
  const restaurant = await Restaurant.findByPk(s.restaurantId, { attributes: ['id', 'name', 'imageUrl'] });
  if (!restaurant) throw fail('Restaurant not found', 404);
  await s.update({ lastLoginAt: new Date() });
  const token = jwt.sign(
    { staffId: s.id, restaurantId: s.restaurantId, role: 'restaurant_partner' },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '30d' },
  );
  return { token, staff: { id: s.id, name: s.name, mobile: s.mobile }, restaurant };
};

// ── Restaurant profile (partner-editable subset) ─────────────

// Commission, area, listing on/off and name stay with Jhatpats.
const PARTNER_EDITABLE = ['description', 'cuisines', 'imageUrl', 'phone', 'prepTimeMins', 'openTime', 'closeTime', 'isOpen', 'isPureVeg'];

const getRestaurant = async (restaurantId) => {
  const r = await food.getRestaurant(restaurantId);
  return { ...r.toJSON(), openNow: food.isOpenNow(r) };
};

const updateRestaurant = async (restaurantId, data) => {
  const patch = Object.fromEntries(PARTNER_EDITABLE.filter(k => data[k] !== undefined).map(k => [k, data[k]]));
  await food.updateRestaurant(restaurantId, patch);
  return getRestaurant(restaurantId);
};

// ── Orders ───────────────────────────────────────────────────

const ORDER_INCLUDE = [
  { model: OrderItem, as: 'items', attributes: ['id', 'menuItemId', 'itemName', 'quantity', 'unitPrice', 'total'] },
  { model: User,      as: 'customer', attributes: ['id', 'name', 'mobile'] },
  { model: Address,   as: 'address', attributes: ['label', 'line1', 'line2', 'city', 'pincode', 'phone'], required: false },
  { model: Payment,   as: 'payment', attributes: ['gateway', 'status'], required: false },
];
const ORDER_ATTRS = { exclude: ['deliveryOtp', 'riderBaseFee', 'riderIncentive', 'riderTip'] };

// Tabs in the partner panel: waiting to accept / in the kitchen (incl. ready,
// see readyAt) / picked up by the rider / finished.
const STATUS_GROUPS = {
  new:       ['pending'],
  preparing: ['confirmed', 'preparing'],
  onTheWay:  ['out_for_delivery'],
  done:      ['delivered', 'cancelled'],
};

const listOrders = async (restaurantId, { group = 'new', limit = 50 } = {}) => {
  const statuses = STATUS_GROUPS[group] ?? STATUS_GROUPS.new;
  const orders = await Order.findAll({
    where: { restaurantId, orderType: 'food', status: { [Op.in]: statuses } },
    include: ORDER_INCLUDE,
    attributes: ORDER_ATTRS,
    order: [['created_at', group === 'done' ? 'DESC' : 'ASC']],
    limit: Math.min(Number(limit) || 50, 100),
  });
  const counts = Object.fromEntries(await Promise.all(Object.entries(STATUS_GROUPS).map(async ([g, st]) =>
    [g, g === 'done' ? null : await Order.count({ where: { restaurantId, orderType: 'food', status: { [Op.in]: st } } })])));
  return { orders, counts };
};

const loadOwn = async (restaurantId, orderId) => {
  const o = await Order.findOne({ where: { id: orderId, restaurantId, orderType: 'food' } });
  if (!o) throw fail('Order not found', 404);
  return o;
};

const getOrder = async (restaurantId, orderId) => {
  const o = await Order.findOne({ where: { id: orderId, restaurantId, orderType: 'food' }, include: ORDER_INCLUDE, attributes: ORDER_ATTRS });
  if (!o) throw fail('Order not found', 404);
  return o;
};

// Accept → 'confirmed': the shared status flow notifies the customer and,
// for food orders, sends it to riders (order.service.updateStatus).
const accept = async (restaurantId, orderId, staffName) => {
  const o = await loadOwn(restaurantId, orderId);
  if (o.status !== 'pending') throw fail('This order is no longer waiting to be accepted', 409);
  await orderSvc.updateStatus(o.id, 'confirmed', `Accepted by restaurant (${staffName})`);
  return getOrder(restaurantId, orderId);
};

const startPreparing = async (restaurantId, orderId, staffName) => {
  const o = await loadOwn(restaurantId, orderId);
  if (o.status !== 'confirmed') throw fail('Accept the order first', 409);
  await orderSvc.updateStatus(o.id, 'preparing', `Restaurant started preparing (${staffName})`);
  return getOrder(restaurantId, orderId);
};

// Ready doesn't change the shared status (the rider's pickup does); it stamps
// readyAt so the rider / ops can see the food is waiting.
const markReady = async (restaurantId, orderId, staffName) => {
  const o = await loadOwn(restaurantId, orderId);
  if (!['confirmed', 'preparing'].includes(o.status)) throw fail('Only accepted orders can be marked ready', 409);
  if (o.readyAt) return getOrder(restaurantId, orderId);
  await o.update({ readyAt: new Date(), status: 'preparing' });
  await OrderTimeline.create({ orderId: o.id, status: 'preparing', note: `Food ready for pickup (${staffName})` });
  require('./realtime.service').orderChanged(o);
  return getOrder(restaurantId, orderId);
};

// Reject → cancel now and tell the customer why; flag online refunds to ops.
const reject = async (restaurantId, orderId, reason, staffName) => {
  const why = String(reason ?? '').trim();
  if (!why) throw fail('Choose or type a reason');
  const o = await loadOwn(restaurantId, orderId);
  if (!['pending', 'confirmed', 'preparing'].includes(o.status)) throw fail('This order can no longer be rejected', 409);
  const restaurant = await Restaurant.findByPk(restaurantId, { attributes: ['name'] });
  await sequelize.transaction(async (t) => {
    await o.reload({ transaction: t, lock: t.LOCK.UPDATE });
    if (!['pending', 'confirmed', 'preparing'].includes(o.status)) throw fail('This order can no longer be rejected', 409);
    await require('./wallet-checkout.service').refund(o, t);
    await o.update({ status: 'cancelled', cancelReason: `Restaurant: ${why}`.slice(0, 255) }, { transaction: t });
    await OrderTimeline.create({ orderId: o.id, status: 'cancelled', note: `Rejected by restaurant (${staffName}): ${why}` }, { transaction: t });
  });
  require('./realtime.service').orderChanged(o);
  require('./rider-dispatch.service').withdrawOffers(o.id).catch(() => {});
  sendToUser(o.customerId, {
    title: 'Order Cancelled',
    body: `${restaurant?.name ?? 'The restaurant'} couldn't take your order: ${why}`,
    data: { orderId: String(o.id), type: 'order_status', screen: 'Orders' },
  }).catch(() => {});
  const payment = await Payment.findOne({ where: { orderId: o.id } });
  if (payment && payment.gateway !== 'cod' && payment.status === 'paid') {
    saveAdminNotification({
      title: `💸 Refund needed — Food order #${o.id}`,
      body: `${restaurant?.name ?? 'Restaurant'} rejected a paid order (₹${o.total}): ${why}`,
      type: 'order', sourceId: o.id, icon: '💸',
    });
  }
  return getOrder(restaurantId, orderId);
};

// ── Earnings ─────────────────────────────────────────────────

// Day boundaries in IST, returned as UTC Dates.
const istStart = (daysBack = 0, unit = 'day') => {
  const now = new Date(Date.now() + 5.5 * 3600e3); // shift to IST wall clock
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), unit === 'month' ? 1 : now.getUTCDate()));
  if (unit === 'week') d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // Monday
  d.setUTCDate(d.getUTCDate() - daysBack);
  return new Date(d.getTime() - 5.5 * 3600e3);
};

// Food sales = item subtotal (delivery/handling are Jhatpats' charges).
const earnings = async (restaurantId) => {
  const r = await Restaurant.findByPk(restaurantId, { attributes: ['commissionPct'] });
  const pct = Number(r?.commissionPct ?? 0);
  const period = async (from) => {
    const rows = await Order.findAll({
      where: { restaurantId, orderType: 'food', status: 'delivered', created_at: { [Op.gte]: from } },
      attributes: ['subtotal'], raw: true,
    });
    const sales = rows.reduce((s, x) => s + Number(x.subtotal || 0), 0);
    const commission = Math.round(sales * pct / 100);
    return { orders: rows.length, sales, commission, payout: sales - commission };
  };
  const [today, week, month] = await Promise.all([period(istStart()), period(istStart(0, 'week')), period(istStart(0, 'month'))]);
  const cancelledThisMonth = await Order.count({
    where: { restaurantId, orderType: 'food', status: 'cancelled', created_at: { [Op.gte]: istStart(0, 'month') } },
  });
  return { commissionPct: pct, today, week, month, cancelledThisMonth };
};

// ── Dashboard (all numbers from real orders, IST days) ───────

const IST_MS = 5.5 * 3600e3;
const istDayKey = (d) => new Date(new Date(d).getTime() + IST_MS).toISOString().slice(0, 10);
const istHour = (d) => new Date(new Date(d).getTime() + IST_MS).getUTCHours();
const round1 = (n) => Math.round(n * 10) / 10;
const avg = (a) => (a.length ? round1(a.reduce((s, x) => s + x, 0) / a.length) : null);

const summarize = (orders, pct) => {
  const delivered = orders.filter(o => o.status === 'delivered');
  const cancelled = orders.filter(o => o.status === 'cancelled');
  const sales = delivered.reduce((s, o) => s + Number(o.subtotal || 0), 0);
  const commission = Math.round(sales * pct / 100);
  const acceptMins = [], prepMins = [];
  let accepted = 0, rejected = 0;
  for (const o of orders) {
    const conf = o.timeline?.find(t => t.status === 'confirmed');
    if (conf) {
      accepted++;
      // Older timeline rows have no time saved — leave them out of the averages.
      if (conf.createdAt) {
        acceptMins.push((new Date(conf.createdAt) - new Date(o.created_at)) / 60000);
        if (o.readyAt) prepMins.push((new Date(o.readyAt) - new Date(conf.createdAt)) / 60000);
      }
    } else if (o.status === 'cancelled' && String(o.cancelReason || '').startsWith('Restaurant:')) rejected++;
  }
  const customers = new Map();
  for (const o of orders) customers.set(o.customerId, (customers.get(o.customerId) || 0) + 1);
  return {
    orders: orders.length,
    delivered: delivered.length,
    cancelled: cancelled.length,
    rejected,
    sales, commission, payout: sales - commission,
    avgOrderValue: delivered.length ? Math.round(sales / delivered.length) : 0,
    avgAcceptMins: avg(acceptMins.filter(m => m >= 0 && m < 24 * 60)),
    avgPrepMins: avg(prepMins.filter(m => m >= 0 && m < 24 * 60)),
    acceptRate: accepted + rejected ? Math.round((accepted / (accepted + rejected)) * 100) : null,
    customers: customers.size,
    repeatCustomers: [...customers.values()].filter(n => n > 1).length,
  };
};

const dashboard = async (restaurantId, { days } = {}) => {
  const range = [7, 30, 90].includes(Number(days)) ? Number(days) : 7;
  const r = await Restaurant.findByPk(restaurantId, { attributes: ['commissionPct'] });
  const pct = Number(r?.commissionPct ?? 0);

  // Current window + the window before it (for "vs last period" arrows).
  const from = istStart(range - 1);
  const prevFrom = istStart(range * 2 - 1);
  const all = await Order.findAll({
    where: { restaurantId, orderType: 'food', created_at: { [Op.gte]: prevFrom } },
    attributes: ['id', 'status', 'subtotal', 'total', 'customerId', 'cancelReason', 'readyAt', 'created_at'],
    include: [
      { model: OrderTimeline, as: 'timeline', attributes: ['status', 'createdAt'], required: false },
      { model: OrderItem, as: 'items', attributes: ['itemName', 'quantity', 'total'], required: false },
    ],
    order: [['created_at', 'DESC']],
  });
  const cur  = all.filter(o => new Date(o.created_at) >= from);
  const prev = all.filter(o => new Date(o.created_at) < from);
  const todayStart = istStart();
  const today = cur.filter(o => new Date(o.created_at) >= todayStart);

  // Day-by-day series (every day present, even with 0 orders).
  const daily = [];
  for (let i = range - 1; i >= 0; i--) {
    const key = istDayKey(istStart(i));
    daily.push({ date: key, orders: 0, sales: 0, cancelled: 0 });
  }
  const byDay = Object.fromEntries(daily.map(d => [d.date, d]));
  for (const o of cur) {
    const d = byDay[istDayKey(o.created_at)];
    if (!d) continue;
    d.orders++;
    if (o.status === 'delivered') d.sales += Number(o.subtotal || 0);
    if (o.status === 'cancelled') d.cancelled++;
  }

  const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0 }));
  for (const o of cur) hourly[istHour(o.created_at)].orders++;

  const items = new Map();
  for (const o of cur) {
    if (o.status === 'cancelled') continue;
    for (const it of o.items || []) {
      const name = it.itemName || 'Item';
      const x = items.get(name) || { name, qty: 0, sales: 0 };
      x.qty += it.quantity; x.sales += Number(it.total || 0);
      items.set(name, x);
    }
  }
  const topItems = [...items.values()].sort((a, b) => b.qty - a.qty || b.sales - a.sales).slice(0, 8);

  const status = { new: 0, preparing: 0, onTheWay: 0, delivered: 0, cancelled: 0 };
  for (const o of cur) {
    if (o.status === 'pending') status.new++;
    else if (['confirmed', 'preparing'].includes(o.status)) status.preparing++;
    else if (o.status === 'out_for_delivery') status.onTheWay++;
    else status[o.status]++;
  }

  // Live counts are not tied to the range.
  const live = await Order.findAll({
    where: { restaurantId, orderType: 'food', status: { [Op.in]: ['pending', 'confirmed', 'preparing', 'out_for_delivery'] } },
    attributes: ['status'], raw: true,
  });

  return {
    range, commissionPct: pct,
    live: {
      new: live.filter(o => o.status === 'pending').length,
      preparing: live.filter(o => ['confirmed', 'preparing'].includes(o.status)).length,
      onTheWay: live.filter(o => o.status === 'out_for_delivery').length,
    },
    today: summarize(today, pct),
    current: summarize(cur, pct),
    previous: summarize(prev, pct),
    daily, hourly, topItems, status,
    recent: cur.slice(0, 6).map(o => ({
      id: o.id, status: o.status, subtotal: o.subtotal, created_at: o.created_at,
      items: (o.items || []).map(i => `${i.quantity}× ${i.itemName ?? 'Item'}`).join(', '),
    })),
  };
};

// ── "Restaurant hasn't accepted" alert for ops ──────────────

const ACCEPT_ALERT_AFTER_MS = 5 * 60 * 1000;

const alertSlowAccepts = async () => {
  const stale = await Order.findAll({
    where: {
      orderType: 'food', status: 'pending', partnerAlertedAt: null,
      created_at: { [Op.lt]: new Date(Date.now() - ACCEPT_ALERT_AFTER_MS) },
    },
    include: [{ model: Restaurant, as: 'restaurant', attributes: ['id', 'name', 'phone'] }],
    limit: 50,
  });
  for (const o of stale) {
    // Only restaurants that run their own orders; others ops confirms by phone anyway.
    if (!o.restaurant || !(await hasActiveStaff(o.restaurant.id))) continue;
    await o.update({ partnerAlertedAt: new Date() });
    await saveAdminNotification({
      title: `⏰ Not accepted — Food order #${o.id}`,
      body: `${o.restaurant.name} hasn't accepted in 5 minutes. Call ${o.restaurant.phone ?? 'the restaurant'}.`,
      type: 'order', sourceId: o.id, icon: '⏰',
    });
  }
  return stale.length;
};

let _timer = null;
const startAcceptAlerts = (ms = 60_000) => {
  if (_timer) return;
  const runAlerts = nonOverlappingTask(alertSlowAccepts);
  _timer = setInterval(() => runAlerts().catch(e => console.error('[partner] accept alert:', e.message)), ms);
  _timer.unref?.();
};

module.exports = {
  listStaff, createStaff, updateStaff, deleteStaff, hasActiveStaff,
  login, getRestaurant, updateRestaurant,
  listOrders, getOrder, accept, startPreparing, markReady, reject,
  earnings, dashboard, alertSlowAccepts, startAcceptAlerts,
};

const admin  = require('../config/firebase');
const User   = require('../models/user.model');
const Rider  = require('../models/rider.model');

const fcmReady = () => admin.apps && admin.apps.length > 0;

// ─── Core send ───────────────────────────────────────────────────────────────

const sendToToken = async (token, { title, body, data = {} }) => {
  if (!fcmReady() || !token) return null;
  try {
    const result = await admin.messaging().send({
      token,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: { priority: 'high' },
      apns:    { payload: { aps: { sound: 'default' } } },
    });
    return result;
  } catch (err) {
    // Invalid / expired token — clear it so we stop sending to it
    if (err.code === 'messaging/registration-token-not-registered' ||
        err.code === 'messaging/invalid-registration-token') {
      return { stale: true };
    }
    console.error('[FCM] sendToToken error:', err.message);
    return null;
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sendToUser = async (userId, payload) => {
  const user = await User.findByPk(userId, { attributes: ['id', 'fcm_token'] });
  if (!user?.fcm_token) return;
  const res = await sendToToken(user.fcm_token, payload);
  if (res?.stale) await User.update({ fcm_token: null }, { where: { id: userId } });
};

const sendToRider = async (riderId, payload) => {
  const rider = await Rider.findByPk(riderId, { attributes: ['id', 'fcm_token'] });
  if (!rider?.fcm_token) return;
  const res = await sendToToken(rider.fcm_token, payload);
  if (res?.stale) await Rider.update({ fcm_token: null }, { where: { id: riderId } });
};

// Send to many rider ids
const sendToManyRiders = async (riderIds, payload) => {
  const riders = await Rider.findAll({
    where: { id: riderIds },
    attributes: ['id', 'fcm_token'],
  });
  const sends = riders
    .filter(r => r.fcm_token)
    .map(r => sendToToken(r.fcm_token, payload));
  return Promise.allSettled(sends);
};

// Send to many user ids (e.g. broadcast)
const sendToUsers = async (userIds, payload) => {
  const users = await User.findAll({
    where: { id: userIds },
    attributes: ['id', 'fcm_token'],
  });
  const tokens = users.map(u => u.fcm_token).filter(Boolean);
  if (!tokens.length || !fcmReady()) return;
  const messages = tokens.map(token => ({
    token,
    notification: { title: payload.title, body: payload.body },
    data: payload.data
      ? Object.fromEntries(Object.entries(payload.data).map(([k, v]) => [k, String(v)]))
      : {},
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default' } } },
  }));
  return admin.messaging().sendEach(messages);
};

// ─── Pre-built messages ───────────────────────────────────────────────────────

const ORDER_NOTIFICATIONS = {
  confirmed:        (id) => ({ title: 'Order Confirmed ✅', body: 'Your order has been accepted and is being processed.', data: { orderId: id, type: 'order_status', screen: 'OrderTracking' } }),
  preparing:        (id) => ({ title: 'Order Being Prepared 🍱', body: "We're packing your order right now!", data: { orderId: id, type: 'order_status', screen: 'OrderTracking' } }),
  out_for_delivery: (id) => ({ title: 'Out for Delivery 🛵', body: 'Your order is on its way! Track it live.', data: { orderId: id, type: 'order_status', screen: 'OrderTracking' } }),
  delivered:        (id) => ({ title: 'Order Delivered 🎉', body: 'Your order has been delivered. Enjoy!', data: { orderId: id, type: 'order_status', screen: 'OrderTracking' } }),
  cancelled:        (id) => ({ title: 'Order Cancelled', body: 'Your order has been cancelled. Refund will be processed shortly.', data: { orderId: id, type: 'order_status', screen: 'Orders' } }),
};

const notifyOrderStatus = async (order, newStatus) => {
  const builder = ORDER_NOTIFICATIONS[newStatus];
  if (!builder || !order.userId) return;
  await sendToUser(order.userId, builder(String(order.id)));
};

const notifyRiderNewOrder = async (riderId, order) => {
  // Build location line from address if available.
  const addr = order.address;
  const location = addr
    ? [addr.area, addr.city].filter(Boolean).join(', ') || addr.line1 || 'Customer location'
    : 'Customer location';

  // Build items summary: "Milk, Bread, Eggs" or "Milk, Bread (+3 more)"
  const items = (order.items ?? []).map(i => i.product?.name).filter(Boolean);
  const MAX_SHOW = 3;
  const itemsLine = items.length === 0
    ? `${order.itemCount ?? '?'} items`
    : items.length <= MAX_SHOW
      ? items.join(', ')
      : `${items.slice(0, MAX_SHOW).join(', ')} (+${items.length - MAX_SHOW} more)`;

  await sendToRider(riderId, {
    title: `🛵 New Order — ₹${Math.round((order.total ?? 0) / 100)}`,
    body:  `📍 ${location}\n🛒 ${itemsLine}`,
    data:  { orderId: String(order.id), type: 'new_order', screen: 'OrderOffer' },
  });
};

module.exports = {
  sendToToken,
  sendToUser,
  sendToRider,
  sendToManyRiders,
  sendToUsers,
  notifyOrderStatus,
  notifyRiderNewOrder,
};

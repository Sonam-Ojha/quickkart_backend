const crypto        = require('crypto');
const { Op }        = require('sequelize');
const sequelize     = require('../config/db');
const Order         = require('../models/order.model');
const OrderItem     = require('../models/order-item.model');
const OrderTimeline = require('../models/order-timeline.model');
const Payment       = require('../models/payment.model');
const Address       = require('../models/address.model');
const User          = require('../models/user.model');
const Restaurant    = require('../models/restaurant.model');
const MenuItem      = require('../models/menu-item.model');
const DarkStore     = require('../models/darkstore.model');
const { findNearestStore } = require('./darkstore.service');
const { isOpenNow } = require('./food.service');
const { sendSms }   = require('./otp.service');
const { notifyAdminNewOrder } = require('./notification.service');

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

// Same delivery + handling charges as grocery orders (orders.controller).
const chargesFor = (subtotal) => ({ deliveryFee: subtotal >= 99 ? 0 : 25, handlingCharge: 5 });

/**
 * Place a food order. Unlike grocery it is NOT auto-confirmed: it waits in
 * 'pending' until ops has called the restaurant and confirms it in the admin
 * panel — only then is it offered to riders (see order.service.updateStatus).
 *
 * body: { restaurant_id, items: [{ menu_item_id, qty }], address_id?, lat, lng, payment_method? }
 */
const placeFoodOrder = async (userId, body) => {
  const { restaurant_id, items, address_id, lat, lng, payment_method = 'cod' } = body ?? {};
  if (!restaurant_id) throw fail('Restaurant is required');
  if (!Array.isArray(items) || items.length === 0) throw fail('No items in order');

  const restaurant = await Restaurant.findOne({ where: { id: restaurant_id, isActive: true } });
  if (!restaurant) throw fail('Restaurant not found', 404);
  const store = await DarkStore.findByPk(restaurant.storeId);
  if (!store?.isActive || !store.foodEnabled) throw fail('Food delivery is not available here right now', 409);
  if (!isOpenNow(restaurant)) throw fail(`${restaurant.name} is closed right now`, 409);

  // The delivery point must be inside the restaurant's area (its store's radius).
  const { store: serving } = await findNearestStore(lat, lng);
  if (!serving || serving.id !== restaurant.storeId) {
    throw fail(`${restaurant.name} doesn't deliver to this address`, 409);
  }

  // Merge duplicate lines and validate quantities.
  const qtyById = new Map();
  for (const it of items) {
    const id  = Number(it.menu_item_id ?? it.id);
    const qty = Number(it.qty ?? 1);
    if (!Number.isInteger(id) || !Number.isInteger(qty) || qty < 1 || qty > 50) throw fail('Invalid item in cart');
    qtyById.set(id, (qtyById.get(id) ?? 0) + qty);
  }

  // Server-side prices; every item must belong to this restaurant and be orderable.
  const menu = await MenuItem.findAll({
    where: { id: { [Op.in]: [...qtyById.keys()] }, restaurantId: restaurant.id, isActive: true },
  });
  const byId = new Map(menu.map(m => [m.id, m]));
  for (const id of qtyById.keys()) {
    const m = byId.get(id);
    if (!m) throw fail('Some items are no longer on the menu. Please refresh your cart.', 409);
    if (!m.isAvailable) throw fail(`${m.name} is sold out. Please remove it from your cart.`, 409);
  }

  const lines = [...qtyById].map(([id, qty]) => {
    const m = byId.get(id);
    return { menuItemId: id, itemName: m.name, quantity: qty, unitPrice: m.price, total: m.price * qty };
  });
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const { deliveryFee, handlingCharge } = chargesFor(subtotal);
  const total = subtotal + deliveryFee + handlingCharge;

  if (address_id != null) {
    const owned = await Address.findOne({ where: { id: address_id, userId }, attributes: ['id'] });
    if (!owned) throw fail('Delivery address not found');
  }

  const deliveryOtp = String(crypto.randomInt(100000, 1000000));
  const order = await sequelize.transaction(async (t) => {
    const o = await Order.create({
      customerId:   userId,
      storeId:      restaurant.storeId,
      restaurantId: restaurant.id,
      orderType:    'food',
      addressId:    address_id ?? null,
      status:       'pending',
      subtotal,
      deliveryFee,
      discount:     0,
      total,
      deliveryOtp,
    }, { transaction: t });
    await OrderItem.bulkCreate(lines.map(l => ({ ...l, orderId: o.id, productId: null })), { transaction: t });
    await OrderTimeline.create({ orderId: o.id, status: 'pending', note: `Food order placed — waiting for ${restaurant.name} to confirm` }, { transaction: t });
    await Payment.create({
      orderId: o.id,
      gateway: payment_method === 'razorpay' ? 'razorpay' : 'cod',
      amount:  total,
      status:  payment_method === 'cod' ? 'pending' : 'paid',
    }, { transaction: t });
    return o;
  });

  const customer = await User.findByPk(userId, { attributes: ['mobile', 'name'] });
  if (customer?.mobile) {
    sendSms(customer.mobile,
      `Hi ${customer.name || 'there'}! Your Jhatpats food order #${order.id} from ${restaurant.name} is placed. Total: Rs.${total}. Delivery OTP: ${deliveryOtp}. Share it only with your rider.`
    ).catch(() => {});
  }
  // Ops relays the order to the restaurant, so the alert carries its name.
  notifyAdminNewOrder({ id: order.id, total, restaurantName: restaurant.name })
    .catch(err => console.error('[ADMIN NOTIF] failed:', err.message));

  return { ...order.toJSON(), payment_method, restaurant: { id: restaurant.id, name: restaurant.name } };
};

// ── Rider view ────────────────────────────────────────────

const RESTAURANT_PICKUP_ATTRS = ['id', 'name', 'address', 'lat', 'lng', 'phone'];

/**
 * Riders read the pickup point from `store` and item names from
 * `items[].product.name`. For food orders point both at the restaurant and
 * the menu-item snapshot, so the rider app needs no special casing.
 */
const riderOrderView = (order) => {
  if (!order) return order;
  const o = typeof order.toJSON === 'function' ? order.toJSON() : order;
  if (o.orderType !== 'food') return o;
  const r = o.restaurant;
  if (r) {
    o.store = { ...(o.store ?? {}), name: r.name, address: r.address, lat: r.lat ?? o.store?.lat, lng: r.lng ?? o.store?.lng };
  }
  if (Array.isArray(o.items)) {
    o.items = o.items.map(i => (i.product ? i : { ...i, product: { id: null, name: i.itemName ?? 'Item', imageUrl: null } }));
  }
  return o;
};

module.exports = { placeFoodOrder, riderOrderView, RESTAURANT_PICKUP_ATTRS };

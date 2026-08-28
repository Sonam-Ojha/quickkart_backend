const sequelize         = require('../config/db');
const Order             = require('../models/order.model');
const OrderItem         = require('../models/order-item.model');
const OrderTimeline     = require('../models/order-timeline.model');
const Payment           = require('../models/payment.model');
const Product           = require('../models/product.model');
const User              = require('../models/user.model');
const DarkStore         = require('../models/darkstore.model');
const Address           = require('../models/address.model');
const Rider             = require('../models/rider.model');
const RiderNotification = require('../models/rider-notification.model');
const RiderOrderOffer   = require('../models/rider-order-offer.model');
const earningsSvc       = require('./rider-earnings.service');

// The rider-side stage machine. `from` is the only stage each action may run
// in, so a replayed or out-of-order request is rejected instead of skipping a
// step. `status` is the shared order status to move to, when the step moves it.
const TRANSITIONS = {
  reachedStore:  { from: 'accepted',    to: 'at_store',    label: 'mark reached-store' },
  confirmPickup: { from: 'at_store',    to: 'to_customer', label: 'confirm pickup', status: 'out_for_delivery' },
  arrived:       { from: 'to_customer', to: 'at_customer', label: 'mark arrived' },
  deliver:       { from: 'at_customer', to: 'delivered',   label: 'deliver', status: 'delivered' },
};

const DETAIL_INCLUDE = [
  { model: User,      as: 'customer', attributes: ['id', 'name', 'mobile'] },
  { model: DarkStore, as: 'store',    attributes: ['id', 'name', 'address', 'city', 'lat', 'lng'] },
  { model: Address,   as: 'address',  attributes: ['id', 'label', 'line1', 'line2', 'city', 'pincode', 'lat', 'lng'], required: false },
  { model: OrderItem, as: 'items', include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'imageUrl'] }] },
  { model: Payment,   as: 'payment', attributes: ['gateway', 'status'], required: false },
];

const fail = (message, status) => Object.assign(new Error(message), { status });

// Always scope by riderId — a rider must never be able to touch someone
// else's order by guessing an id.
const loadOwned = async (riderId, orderId, opts = {}) => {
  const order = await Order.findOne({ where: { id: orderId, riderId }, ...opts });
  if (!order) throw fail('Order not found', 404);
  return order;
};

const getDetail = async (riderId, orderId) => {
  const order = await Order.findOne({
    where: { id: orderId, riderId },
    include: DETAIL_INCLUDE,
    // Never leak the handover code to the rider before they are at the door —
    // they are supposed to hear it from the customer.
    attributes: { exclude: ['deliveryOtp'] },
  });
  if (!order) throw fail('Order not found', 404);
  return order;
};

const step = async (riderId, orderId, action, note) => {
  const rule = TRANSITIONS[action];
  const order = await loadOwned(riderId, orderId);
  if (order.riderStage !== rule.from) {
    throw fail(`Cannot ${rule.label} from stage "${order.riderStage ?? 'none'}" — expected "${rule.from}"`, 409);
  }
  const patch = { riderStage: rule.to };
  if (rule.status) patch.status = rule.status;
  if (action === 'confirmPickup') patch.pickedAt = new Date();
  await order.update(patch);
  await OrderTimeline.create({ orderId, status: patch.status ?? order.status, note });
  return order;
};

const reachedStore = (riderId, orderId) =>
  step(riderId, orderId, 'reachedStore', 'Rider reached the store');

const arrived = (riderId, orderId) =>
  step(riderId, orderId, 'arrived', 'Rider arrived at the customer');

const setItemPicked = async (riderId, orderId, itemId, picked) => {
  const order = await loadOwned(riderId, orderId);
  if (order.riderStage !== 'at_store') throw fail('Items can only be checked off at the store', 409);

  const item = await OrderItem.findOne({ where: { id: itemId, orderId } });
  if (!item) throw fail('Order item not found', 404);
  await item.update({ picked: !!picked });

  const items = await OrderItem.findAll({ where: { orderId } });
  return { item, allPicked: items.every(i => i.picked) };
};

const confirmPickup = async (riderId, orderId) => {
  const order = await loadOwned(riderId, orderId);
  if (order.riderStage !== 'at_store') {
    throw fail(`Cannot confirm pickup from stage "${order.riderStage ?? 'none'}" — expected "at_store"`, 409);
  }
  const items = await OrderItem.findAll({ where: { orderId } });
  const pending = items.filter(i => !i.picked);
  if (pending.length) throw fail(`${pending.length} item(s) still unchecked`, 400);

  return step(riderId, orderId, 'confirmPickup', 'Picked up from store');
};

// Closes the delivery: verifies the handover code, settles COD, writes the
// earnings row and bumps the rider's lifetime counters — all in one
// transaction so a partial failure can't pay a rider for an undelivered order.
const deliver = async (riderId, orderId, { otp, codCollected = false }) => {
  const order = await loadOwned(riderId, orderId);
  if (order.riderStage !== 'at_customer') {
    throw fail(`Cannot deliver from stage "${order.riderStage ?? 'none'}" — expected "at_customer"`, 409);
  }
  if (!order.deliveryOtp) throw fail('This order has no delivery OTP set', 409);
  if (String(otp || '') !== order.deliveryOtp) throw fail('Incorrect delivery OTP', 401);

  const payment = await Payment.findOne({ where: { orderId } });
  const isCod   = payment?.gateway === 'cod' && payment.status !== 'paid';
  if (isCod && !codCollected) throw fail(`Collect Rs.${order.total} in cash before delivering`, 400);

  const fee       = Number(order.riderBaseFee)   || 0;
  const incentive = Number(order.riderIncentive) || 0;
  const tip       = Number(order.riderTip)       || 0;
  const amount    = fee + incentive + tip;

  await sequelize.transaction(async (t) => {
    await order.update({
      status: 'delivered', riderStage: 'delivered',
      deliveredAt: new Date(), codCollected: isCod ? true : order.codCollected,
    }, { transaction: t });

    await OrderTimeline.create(
      { orderId, status: 'delivered', note: 'Delivered — OTP verified' },
      { transaction: t },
    );

    if (isCod) await payment.update({ status: 'paid' }, { transaction: t });

    const address  = order.addressId ? await Address.findByPk(order.addressId, { transaction: t }) : null;
    const dropArea = address ? [address.line2, address.city].filter(Boolean).join(', ') : null;

    await earningsSvc.creditEarning(
      riderId, { orderId, type: 'delivery', fee, incentive, tip, amount, dropArea }, t,
    );
    await Rider.increment({ totalDeliveries: 1 }, { where: { id: riderId }, transaction: t });
    await RiderNotification.create({
      riderId, type: 'payout',
      title: `Rs.${amount} added`,
      body:  `Payout for order #${orderId} has been credited to your earnings.`,
    }, { transaction: t });
  });

  return { orderId: order.id, amount, fee, incentive, tip, codCollected: isCod ? true : order.codCollected };
};

// A rider who breaks down mid-run needs a way out. The order goes back into
// the pool rather than being cancelled outright — the customer still wants it.
// Once delivered it's too late; anything earlier is fair game.
const cancel = async (riderId, orderId, reason) => {
  const text = String(reason || '').trim();
  if (!text) throw fail('A reason is required to drop an order', 400);

  const order = await loadOwned(riderId, orderId);
  if (order.riderStage === 'delivered' || order.status === 'delivered') {
    throw fail('This order is already delivered', 409);
  }
  if (order.status === 'cancelled') throw fail('This order is already cancelled', 409);

  await sequelize.transaction(async (t) => {
    // Unpick everything — the next rider starts the checklist clean.
    await OrderItem.update({ picked: false }, { where: { orderId }, transaction: t });
    await order.update({
      riderId: null, riderStage: null,
      acceptedAt: null, pickedAt: null,
      // Back to the state dispatch picks up from.
      status: 'confirmed',
    }, { transaction: t });
    await OrderTimeline.create(
      { orderId, status: 'confirmed', note: `Dropped by rider #${riderId}: ${text}` },
      { transaction: t },
    );
    await Rider.increment({ cancelledCount: 1 }, { where: { id: riderId }, transaction: t });

    // Retire this rider's own offer, otherwise the re-dispatch below hands the
    // order straight back to them — their row is still 'accepted', which the
    // eligibility filter treats as a fresh candidate. The rider's
    // cancelled_count (not rejected_count) is what records the drop.
    await RiderOrderOffer.update(
      { state: 'rejected', respondedAt: new Date() },
      { where: { orderId, riderId }, transaction: t },
    );
  });

  // Offer it to whoever else is free.
  const dispatch = require('./rider-dispatch.service');
  const result = await dispatch.offerOrder(orderId).catch(() => ({ offered: 0 }));
  return { orderId: order.id, reoffered: result.offered || 0 };
};

module.exports = { getDetail, reachedStore, setItemPicked, confirmPickup, arrived, deliver, cancel };

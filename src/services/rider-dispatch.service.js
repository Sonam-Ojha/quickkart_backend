const { Op }          = require('sequelize');
const sequelize       = require('../config/db');
const Order           = require('../models/order.model');
const OrderItem       = require('../models/order-item.model');
const OrderTimeline   = require('../models/order-timeline.model');
const Product         = require('../models/product.model');
const Payment         = require('../models/payment.model');
const User            = require('../models/user.model');
const DarkStore       = require('../models/darkstore.model');
const Address         = require('../models/address.model');
const Rider           = require('../models/rider.model');
const RiderOrderOffer = require('../models/rider-order-offer.model');

// How long an incoming-order card stays live before it lapses. The app renders
// this as the countdown ring, so changing it here changes it there too.
const OFFER_TTL_SEC = 30;

// What the rider earns for this delivery. Frozen onto the order at offer time
// so a later fee-config change never rewrites historical earnings.
const computePayout = (order) => ({
  riderBaseFee:   Math.max(Number(order.deliveryFee) || 0, 20),
  riderIncentive: 0,
  riderTip:       0,
});

const OFFER_INCLUDE = [
  // The handover code must never reach the rider ahead of the doorstep — they
  // are meant to hear it from the customer.
  { model: Order, as: 'order', attributes: { exclude: ['deliveryOtp'] }, include: [
    { model: User,      as: 'customer', attributes: ['id', 'name', 'mobile'] },
    { model: DarkStore, as: 'store',    attributes: ['id', 'name', 'address', 'city', 'lat', 'lng'] },
    { model: Address,   as: 'address',  attributes: ['id', 'label', 'line1', 'line2', 'city', 'pincode', 'lat', 'lng'], required: false },
    { model: OrderItem, as: 'items', include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'imageUrl'] }] },
    { model: Payment,   as: 'payment', attributes: ['gateway', 'status'], required: false },
  ]},
];

// Lapse anything past its deadline. Called before every read/write so a stale
// row can never be accepted, without needing a background cron.
const expireStale = async (riderId = null) => {
  const where = { state: 'pending', expiresAt: { [Op.lt]: new Date() } };
  if (riderId) where.riderId = riderId;
  await RiderOrderOffer.update({ state: 'expired', respondedAt: new Date() }, { where });
};

// Fan an order out to every free rider at its store. Idempotent: re-running it
// for the same order tops up new riders rather than duplicating existing rows.
const offerOrder = async (orderId) => {
  const order = await Order.findByPk(orderId);
  if (!order) throw new Error('Order not found');
  if (order.riderId) return { offered: 0, reason: 'already assigned' };

  const riders = await Rider.findAll({
    where: { storeId: order.storeId, status: 'active', isOnline: true },
    attributes: ['id'],
  });
  if (!riders.length) return { offered: 0, reason: 'no online riders at this store' };

  // Skip riders already busy with a live delivery.
  const busy = await Order.findAll({
    where: { riderId: riders.map(r => r.id), riderStage: { [Op.in]: ['accepted','at_store','to_customer','at_customer'] } },
    attributes: ['riderId'],
  });
  const busyIds = new Set(busy.map(o => o.riderId));

  // And skip anyone who already said no to this order, or the retry sweep
  // would keep pushing the same card back at them.
  const refused = await RiderOrderOffer.findAll({
    where: { orderId: order.id, state: { [Op.in]: ['rejected', 'lost'] } },
    attributes: ['riderId'],
  });
  const refusedIds = new Set(refused.map(o => o.riderId));

  const eligible = riders.filter(r => !busyIds.has(r.id) && !refusedIds.has(r.id));
  if (!eligible.length) return { offered: 0, reason: 'no free rider left to offer' };

  const expiresAt = new Date(Date.now() + OFFER_TTL_SEC * 1000);
  await RiderOrderOffer.bulkCreate(
    eligible.map(r => ({ riderId: r.id, orderId: order.id, state: 'pending', expiresAt })),
    { updateOnDuplicate: ['state', 'expiresAt', 'respondedAt'] },
  );
  await Rider.increment('offeredCount', { where: { id: eligible.map(r => r.id) } });
  await order.update({ riderStage: 'offered', assignedAt: new Date(), ...computePayout(order) });

  return { offered: eligible.length, expiresAt };
};

const listPending = async (riderId) => {
  await expireStale(riderId);
  return RiderOrderOffer.findAll({
    where: { riderId, state: 'pending' },
    include: OFFER_INCLUDE,
    order: [['created_at', 'DESC']],
  });
};

// First rider to accept wins. The row-level lock plus the riderId re-check
// inside the transaction is what stops two riders taking the same order.
const accept = async (riderId, orderId) => {
  await expireStale(riderId);
  return sequelize.transaction(async (t) => {
    const offer = await RiderOrderOffer.findOne({
      where: { riderId, orderId, state: 'pending' },
      lock: t.LOCK.UPDATE, transaction: t,
    });
    if (!offer) throw Object.assign(new Error('No live offer for this order'), { status: 409 });

    const order = await Order.findByPk(orderId, { lock: t.LOCK.UPDATE, transaction: t });
    if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
    if (order.riderId) throw Object.assign(new Error('Another rider already took this order'), { status: 409 });

    await order.update({ riderId, riderStage: 'accepted', acceptedAt: new Date() }, { transaction: t });
    await offer.update({ state: 'accepted', respondedAt: new Date() }, { transaction: t });
    // Everyone else loses the race.
    await RiderOrderOffer.update(
      { state: 'lost', respondedAt: new Date() },
      { where: { orderId, state: 'pending' }, transaction: t },
    );
    await Rider.increment('acceptedCount', { where: { id: riderId }, transaction: t });
    await OrderTimeline.create(
      { orderId, status: order.status, note: `Accepted by rider #${riderId}` },
      { transaction: t },
    );
    return order;
  });
};

const reject = async (riderId, orderId) => {
  await expireStale(riderId);
  const offer = await RiderOrderOffer.findOne({ where: { riderId, orderId, state: 'pending' } });
  if (!offer) throw Object.assign(new Error('No live offer for this order'), { status: 409 });

  await offer.update({ state: 'rejected', respondedAt: new Date() });
  await Rider.increment('rejectedCount', { where: { id: riderId } });
  return { rejected: true };
};

// Going offline drops anything the rider hasn't answered yet.
const dropPendingFor = async (riderId) => {
  await RiderOrderOffer.update(
    { state: 'expired', respondedAt: new Date() },
    { where: { riderId, state: 'pending' } },
  );
};

// Orders that are live but have nobody on them and no offer outstanding —
// either the first round all lapsed, or nobody was online when it landed.
// Orders older than this stop being retried. Without a cutoff an order nobody
// wants would ping-pong offer -> lapse -> offer forever; past this point it
// needs a human (admin can still force one with POST /orders/:id/dispatch).
const RETRY_WINDOW_MIN = Number(process.env.DISPATCH_RETRY_WINDOW_MIN ?? 30);

const findStranded = async () => Order.findAll({
  where: {
    riderId: null,
    status:  { [Op.in]: ['confirmed', 'preparing'] },
    created_at: { [Op.gte]: new Date(Date.now() - RETRY_WINDOW_MIN * 60_000) },
  },
  attributes: ['id'],
  order: [['created_at', 'ASC']],
  limit: 50,
});

// Periodic retry. Without this an order whose offers all timed out sits at
// riderStage 'offered' with no rider, forever, until someone re-dispatches
// it by hand.
const sweep = async () => {
  await expireStale();
  const stranded = await findStranded();
  if (!stranded.length) return { checked: 0, redispatched: 0 };

  let redispatched = 0;
  for (const o of stranded) {
    const live = await RiderOrderOffer.count({ where: { orderId: o.id, state: 'pending' } });
    if (live) continue;                       // still waiting on someone
    const res = await offerOrder(o.id).catch(() => ({ offered: 0 }));
    if (res.offered) redispatched++;
  }
  return { checked: stranded.length, redispatched };
};

// Called once from index.js. DISPATCH_SWEEP_MS=0 turns it off.
let _timer = null;
const startSweeper = () => {
  const ms = Number(process.env.DISPATCH_SWEEP_MS ?? 15000);
  if (!ms || _timer) return null;
  _timer = setInterval(() => {
    sweep()
      .then(r => { if (r.redispatched) console.log(`[dispatch] re-offered ${r.redispatched} order(s)`); })
      .catch(e => console.error('[dispatch] sweep failed:', e.message));
  }, ms);
  _timer.unref();                             // never hold the process open
  console.log(`[dispatch] retry sweep every ${ms}ms`);
  return _timer;
};
const stopSweeper = () => { if (_timer) { clearInterval(_timer); _timer = null; } };

module.exports = { OFFER_TTL_SEC, computePayout, offerOrder, listPending, accept, reject, expireStale, dropPendingFor, sweep, startSweeper, stopSweeper };

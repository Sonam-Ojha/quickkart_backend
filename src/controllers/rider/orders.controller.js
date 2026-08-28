const { Op }        = require('sequelize');
const Order         = require('../../models/order.model');
const OrderItem     = require('../../models/order-item.model');
const Rider         = require('../../models/rider.model');
const User          = require('../../models/user.model');
const Product       = require('../../models/product.model');
const dispatch      = require('../../services/rider-dispatch.service');
const riderOrderSvc = require('../../services/rider-order.service');
const earningsSvc   = require('../../services/rider-earnings.service');

// Services throw errors carrying a `status`; anything else is a real 500.
const send = (res, err) => res.status(err.status || 500).json({ message: err.message });

const ACTIVE_STATUSES = ['confirmed', 'preparing', 'out_for_delivery'];
const DONE_STATUSES   = ['delivered', 'cancelled'];

const myOrders = async (req, res) => {
  try {
    const { filter = 'active' } = req.query;
    const where = { riderId: req.rider.id };
    if (filter === 'active') where.status = ACTIVE_STATUSES;
    else if (filter === 'done') where.status = DONE_STATUSES;

    const orders = await Order.findAll({
      where,
      attributes: { exclude: ['deliveryOtp'] },   // never expose the handover code
      include: [
        { model: User, as: 'customer', attributes: ['id', 'name', 'mobile'] },
        {
          model: OrderItem, as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'imageUrl'] }],
        },
      ],
      order: [['created_at', 'DESC']],
      limit: 30,
    });
    res.json({ orders });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const orderDetail = async (req, res) => {
  try {
    res.json({ order: await riderOrderSvc.getDetail(req.rider.id, req.params.id) });
  } catch (err) { send(res, err); }
};

// ── Dispatch ────────────────────────────────────────────────
const offers = async (req, res) => {
  try {
    res.json({ offers: await dispatch.listPending(req.rider.id), ttlSeconds: dispatch.OFFER_TTL_SEC });
  } catch (err) { send(res, err); }
};

const acceptOffer = async (req, res) => {
  try {
    const order = await dispatch.accept(req.rider.id, req.params.id);
    res.json({ message: 'Order accepted', orderId: order.id, riderStage: order.riderStage });
  } catch (err) { send(res, err); }
};

const rejectOffer = async (req, res) => {
  try {
    await dispatch.reject(req.rider.id, req.params.id);
    res.json({ message: 'Order rejected' });
  } catch (err) { send(res, err); }
};

// ── Delivery flow ───────────────────────────────────────────
const reachedStore = async (req, res) => {
  try {
    const o = await riderOrderSvc.reachedStore(req.rider.id, req.params.id);
    res.json({ message: 'Reached store', riderStage: o.riderStage });
  } catch (err) { send(res, err); }
};

const pickItem = async (req, res) => {
  try {
    const { item, allPicked } = await riderOrderSvc.setItemPicked(
      req.rider.id, req.params.id, req.params.itemId, req.body.picked);
    res.json({ itemId: item.id, picked: item.picked, allPicked });
  } catch (err) { send(res, err); }
};

const confirmPickup = async (req, res) => {
  try {
    const o = await riderOrderSvc.confirmPickup(req.rider.id, req.params.id);
    res.json({ message: 'Pickup confirmed', riderStage: o.riderStage, status: o.status });
  } catch (err) { send(res, err); }
};

const arrived = async (req, res) => {
  try {
    const o = await riderOrderSvc.arrived(req.rider.id, req.params.id);
    res.json({ message: 'Arrived at customer', riderStage: o.riderStage });
  } catch (err) { send(res, err); }
};

const cancel = async (req, res) => {
  try {
    const result = await riderOrderSvc.cancel(req.rider.id, req.params.id, req.body?.reason);
    res.json({ message: 'Order dropped and re-offered', ...result });
  } catch (err) { send(res, err); }
};

const deliver = async (req, res) => {
  try {
    const result = await riderOrderSvc.deliver(req.rider.id, req.params.id, req.body);
    res.json({ message: 'Delivered', ...result });
  } catch (err) { send(res, err); }
};

const earnings = async (req, res) => {
  try {
    const rider = await Rider.findByPk(req.rider.id, {
      attributes: ['id', 'name', 'totalDeliveries', 'rating'],
    });
    // Derived from rider_earnings, not the cached riders.total_earnings —
    // the ledger is the source of truth for money.
    const { earned, balance } = await earningsSvc.balanceOf(req.rider.id);

    // Today's delivered count. The Order model renames its timestamps, so the
    // attribute is `updated_at` (not `updatedAt`) — see order.model.js options.
    // TODO(phase 3): switch to `deliveredAt` once the deliver endpoint sets it.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDeliveries = await Order.count({
      where: { riderId: req.rider.id, status: 'delivered', updated_at: { [Op.gte]: today } },
    });

    res.json({
      totalDeliveries: rider.totalDeliveries,
      totalEarnings:   earned,
      balance,
      rating:          rider.rating,
      todayDeliveries,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = {
  myOrders, orderDetail, earnings,
  offers, acceptOffer, rejectOffer,
  reachedStore, pickItem, confirmPickup, arrived, deliver, cancel,
};

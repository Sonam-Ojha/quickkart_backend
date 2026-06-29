const Order         = require('../../models/order.model');
const OrderItem     = require('../../models/order-item.model');
const OrderTimeline = require('../../models/order-timeline.model');
const Rider         = require('../../models/rider.model');
const User          = require('../../models/user.model');
const Product       = require('../../models/product.model');

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
    const order = await Order.findOne({
      where: { id: req.params.id, riderId: req.rider.id },
      include: [
        { model: User, as: 'customer', attributes: ['id', 'name', 'mobile'] },
        {
          model: OrderItem, as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'imageUrl'] }],
        },
        { model: OrderTimeline, as: 'timeline' },
      ],
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json({ order });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Rider can only move status forward: out_for_delivery → delivered
const updateStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    const allowed = ['out_for_delivery', 'delivered'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: `Rider can only set status to: ${allowed.join(', ')}` });
    }

    const order = await Order.findOne({ where: { id: req.params.id, riderId: req.rider.id } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    await order.update({ status });
    await OrderTimeline.create({
      orderId:   order.id,
      status,
      note:      note || `Marked ${status} by rider`,
      changedBy: 'rider',
    });

    // On delivery, increment rider stats
    if (status === 'delivered') {
      const rider = await Rider.findByPk(req.rider.id);
      await rider.increment({ totalDeliveries: 1, totalEarnings: Math.round(order.deliveryFee || 0) });
    }

    res.json({ message: 'Order status updated', status });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

const earnings = async (req, res) => {
  try {
    const rider = await Rider.findByPk(req.rider.id, {
      attributes: ['id', 'name', 'totalDeliveries', 'totalEarnings', 'rating'],
    });

    // Today's delivered count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDeliveries = await Order.count({
      where: { riderId: req.rider.id, status: 'delivered', updatedAt: { $gte: today } },
    });

    res.json({
      totalDeliveries: rider.totalDeliveries,
      totalEarnings:   rider.totalEarnings,
      rating:          rider.rating,
      todayDeliveries,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { myOrders, orderDetail, updateStatus, earnings };

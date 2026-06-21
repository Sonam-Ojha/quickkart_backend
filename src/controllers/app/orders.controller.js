const Order         = require('../../models/order.model');
const OrderItem     = require('../../models/order-item.model');
const OrderTimeline = require('../../models/order-timeline.model');
const Product       = require('../../models/product.model');
const sequelize     = require('../../../src/config/db');

const list = async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { user_id: req.user.id },
      include: [{ model: OrderItem, as: 'items', include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'image_url'] }] }],
      order: [['created_at', 'DESC']],
    });
    return res.json(orders);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const place = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { items, address_id, coupon_code, payment_method = 'cod' } = req.body;

    let subtotal = 0;
    for (const item of items) {
      subtotal += item.price * item.qty;
    }

    const delivery_fee     = subtotal >= 99 ? 0 : 25;
    const handling_charge  = 5;
    const total_amount     = subtotal + delivery_fee + handling_charge;

    const order = await Order.create(
      {
        user_id: req.user.id,
        address_id,
        status: 'pending',
        total_amount,
        delivery_fee,
        payment_method,
      },
      { transaction: t },
    );

    await OrderItem.bulkCreate(
      items.map((i) => ({
        order_id:   order.id,
        product_id: i.product_id ?? i.id,
        qty:        i.qty,
        unit_price: i.price,
        total_price: i.price * i.qty,
      })),
      { transaction: t },
    );

    await OrderTimeline.create({ order_id: order.id, status: 'pending', note: 'Order placed' }, { transaction: t });

    await t.commit();
    return res.status(201).json(order);
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ message: err.message });
  }
};

const getById = async (req, res) => {
  try {
    const order = await Order.findOne({
      where: { id: req.params.id, user_id: req.user.id },
      include: [
        { model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] },
        { model: OrderTimeline, as: 'timeline', order: [['created_at', 'ASC']] },
      ],
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    return res.json(order);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { list, place, getById };

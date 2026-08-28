const Order         = require('../../models/order.model');
const OrderItem     = require('../../models/order-item.model');
const OrderTimeline = require('../../models/order-timeline.model');
const Payment       = require('../../models/payment.model');
const Product       = require('../../models/product.model');
const DarkStore     = require('../../models/darkstore.model');
const Inventory     = require('../../models/inventory.model');
const Rider         = require('../../models/rider.model');
const User          = require('../../models/user.model');
const sequelize     = require('../../../src/config/db');
const { sendSms }   = require('../../services/otp.service');

const list = async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { customerId: req.user.id },
      include: [{ model: OrderItem, as: 'items', include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'imageUrl'] }] }],
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
    const { items, address_id, coupon_code, payment_method = 'cod', delivery_fee: clientFee, handling_charge: clientHandling, discount = 0 } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No items in order' });
    }

    let subtotal = 0;
    for (const item of items) {
      subtotal += (item.price ?? 0) * (item.qty ?? 1);
    }

    const delivery_fee    = clientFee    != null ? Number(clientFee)    : (subtotal >= 99 ? 0 : 25);
    const handling_charge = clientHandling != null ? Number(clientHandling) : 5;
    const total           = subtotal - Number(discount) + delivery_fee + handling_charge;

    // Auto-pick first active dark store
    const store = await DarkStore.findOne({ where: { is_active: true } });

    // Check + lock inventory for each item (only block if record exists AND qty is insufficient)
    for (const item of items) {
      const productId = item.product_id ?? item.id;
      const qty       = item.qty ?? 1;
      const inv = await Inventory.findOne({
        where: { productId, ...(store ? { storeId: store.id } : {}) },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      // If inventory record exists and stock is less than requested, block
      if (inv && inv.stockQty < qty) {
        throw new Error(`Out of stock: product #${productId} (available: ${inv.stockQty}, requested: ${qty})`);
      }
    }

    // Code the customer reads out to the rider at handover. Minted here so it
    // exists for the whole life of the order, not just once a rider is assigned.
    const deliveryOtp = String(Math.floor(100000 + Math.random() * 900000));

    const order = await Order.create({
      customerId: req.user.id,
      storeId:    store?.id ?? null,
      addressId:  address_id ?? null,
      status:     'pending',
      subtotal,
      deliveryFee: delivery_fee,
      discount:    Number(discount),
      total,
      deliveryOtp,
    }, { transaction: t });

    await OrderItem.bulkCreate(
      items.map((i) => ({
        orderId:   order.id,
        productId: i.product_id ?? i.id,
        quantity:  i.qty ?? 1,
        unitPrice: i.price,
        total:     (i.price ?? 0) * (i.qty ?? 1),
      })),
      { transaction: t },
    );

    await OrderTimeline.create({
      orderId: order.id,
      status:  'pending',
      note:    'Order placed',
    }, { transaction: t });

    // Deduct inventory (only if record exists)
    // Quick-commerce: confirm immediately so the order can reach riders. It
    // used to sit at 'pending' until an admin flipped it by hand.
    await order.update({ status: 'confirmed' }, { transaction: t });
    await OrderTimeline.create({
      orderId: order.id,
      status:  'confirmed',
      note:    'Auto-confirmed on placement',
    }, { transaction: t });

    // Deduct inventory
    for (const item of items) {
      const productId = item.product_id ?? item.id;
      const qty       = item.qty ?? 1;
      const invExists = await Inventory.findOne({
        where: { productId, ...(store ? { storeId: store.id } : {}) },
        transaction: t,
      });
      if (invExists) {
        await Inventory.decrement('stockQty', {
          by: qty,
          where: { productId, ...(store ? { storeId: store.id } : {}) },
          transaction: t,
        });
      }
    }

    const gatewayMap = { cod: 'cod', razorpay: 'razorpay' };
    await Payment.create({
      orderId: order.id,
      gateway: gatewayMap[payment_method] ?? 'cod',
      amount:  total,
      status:  payment_method === 'cod' ? 'pending' : 'paid',
    }, { transaction: t });

    await t.commit();

    // Send order confirmation SMS
    const customer = await User.findByPk(req.user.id, { attributes: ['mobile', 'name'] });
    if (customer?.mobile) {
      const payLabel = payment_method === 'cod' ? 'Cash on Delivery' : 'Online Payment';
      sendSms(customer.mobile,
        `Hi ${customer.name || 'there'}! Your Jhatpats order #${order.id} is placed. Total: Rs.${total}. Payment: ${payLabel}. Delivery OTP: ${deliveryOtp}. Share it only with your rider.`
      ).catch(() => {});
    }

    // Fan out to riders. Best-effort: if nobody is online the sweeper retries,
    // and a dispatch failure must never fail an order the customer already paid for.
    require('../../services/rider-dispatch.service')
      .offerOrder(order.id)
      .catch(err => console.error('[dispatch] on placement:', err.message));

    return res.status(201).json({ ...order.toJSON(), payment_method });
  } catch (err) {
    await t.rollback();
    console.error('[ORDER ERROR]', err.message, err.errors ?? '');
    return res.status(500).json({ message: err.message, detail: err.errors?.map(e => e.message) });
  }
};

const getById = async (req, res) => {
  try {
    const order = await Order.findOne({
      where: { id: req.params.id, customerId: req.user.id },
      include: [
        { model: OrderItem, as: 'items', include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'image_url', 'unit'] }] },
        { model: OrderTimeline, as: 'timeline' },
        { model: Rider, as: 'rider', attributes: ['id', 'name', 'mobile', 'vehicleType', 'vehicleNumber', 'rating', 'currentLat', 'currentLng', 'locationUpdatedAt'], required: false },
      ],
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    return res.json(order);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const cancel = async (req, res) => {
  try {
    const order = await Order.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({ message: 'Order cannot be cancelled at this stage' });
    }
    await order.update({ status: 'cancelled' });
    await OrderTimeline.create({ orderId: order.id, status: 'cancelled', note: req.body.reason || 'Cancelled by customer' });
    return res.json({ message: 'Order cancelled successfully' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { list, place, getById, cancel };

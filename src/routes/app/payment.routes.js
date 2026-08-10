const router  = require('express').Router();
const crypto  = require('crypto');
const Razorpay = require('razorpay');
const Order         = require('../../models/order.model');
const OrderItem     = require('../../models/order-item.model');
const OrderTimeline = require('../../models/order-timeline.model');
const Payment       = require('../../models/payment.model');
const DarkStore     = require('../../models/darkstore.model');
const Inventory     = require('../../models/inventory.model');
const User          = require('../../models/user.model');
const sequelize     = require('../../../src/config/db');
const { sendSms }   = require('../../services/otp.service');
const { authenticateCustomer } = require('../../middlewares/customer.middleware');

router.use(authenticateCustomer);

// POST /api/app/payments/razorpay/create
// Creates a Razorpay order and returns key + order_id for frontend
router.post('/razorpay/create', async (req, res) => {
  try {
    const { amount } = req.body;
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ message: 'Online payment not configured. Please use Cash on Delivery.' });
    }
    const rzp = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    const order = await rzp.orders.create({
      amount:   Math.round(amount * 100), // paise
      currency: 'INR',
      receipt:  `rcpt_${Date.now()}`,
    });
    return res.json({
      key:               process.env.RAZORPAY_KEY_ID,
      razorpay_order_id: order.id,
      amount:            order.amount,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/app/payments/razorpay/verify
// Verifies Razorpay payment signature and places order
router.post('/razorpay/verify', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      razorpay_order_id, razorpay_payment_id, razorpay_signature,
      items, delivery_fee = 0, handling_charge = 5, discount = 0,
    } = req.body;

    // Verify signature
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expected !== razorpay_signature) {
      return res.status(400).json({ message: 'Payment verification failed. Invalid signature.' });
    }

    let subtotal = 0;
    for (const item of items) subtotal += (item.price ?? 0) * (item.qty ?? 1);
    const total = subtotal - Number(discount) + Number(delivery_fee) + Number(handling_charge);

    const store = await DarkStore.findOne({ where: { is_active: true } });

    // Check + lock inventory
    for (const item of items) {
      const productId = item.product_id ?? item.id;
      const qty       = item.qty ?? 1;
      const inv = await Inventory.findOne({
        where: { productId, ...(store ? { storeId: store.id } : {}) },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!inv || inv.stockQty < qty) {
        throw new Error(`Out of stock: product #${productId} (available: ${inv?.stockQty ?? 0}, requested: ${qty})`);
      }
    }

    const order = await Order.create({
      customerId:  req.user.id,
      storeId:     store?.id ?? null,
      status:      'confirmed',
      subtotal,
      deliveryFee: Number(delivery_fee),
      discount:    Number(discount),
      total,
    }, { transaction: t });

    await OrderItem.bulkCreate(
      items.map(i => ({
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
      status:  'confirmed',
      note:    `Paid via Razorpay (${razorpay_payment_id})`,
    }, { transaction: t });

    // Deduct inventory
    for (const item of items) {
      await Inventory.decrement('stockQty', {
        by: item.qty ?? 1,
        where: { productId: item.product_id ?? item.id, ...(store ? { storeId: store.id } : {}) },
        transaction: t,
      });
    }

    await Payment.create({
      orderId: order.id,
      gateway: 'razorpay',
      txnId:   razorpay_payment_id,
      amount:  total,
      status:  'paid',
    }, { transaction: t });

    await t.commit();

    // Send confirmation SMS
    const customer = await User.findByPk(req.user.id, { attributes: ['mobile', 'name'] });
    if (customer?.mobile) {
      sendSms(customer.mobile,
        `Hi ${customer.name || 'there'}! Your Jhatpats order #${order.id} is confirmed. Total: Rs.${total}. Paid via Razorpay. We will deliver soon!`
      ).catch(() => {});
    }

    return res.status(201).json({ ...order.toJSON(), payment_id: razorpay_payment_id });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;

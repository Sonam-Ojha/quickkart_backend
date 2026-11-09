const router  = require('express').Router();
const crypto  = require('crypto');
const Razorpay = require('razorpay');
const { Op }        = require('sequelize');
const Order         = require('../../models/order.model');
const OrderItem     = require('../../models/order-item.model');
const OrderTimeline = require('../../models/order-timeline.model');
const Payment       = require('../../models/payment.model');
const DarkStore     = require('../../models/darkstore.model');
const Inventory     = require('../../models/inventory.model');
const Product       = require('../../models/product.model');
const User          = require('../../models/user.model');
const Address       = require('../../models/address.model');
const sequelize     = require('../../../src/config/db');
const { sendSms }   = require('../../services/otp.service');
const { authenticateCustomer } = require('../../middlewares/customer.middleware');
const { storeForDelivery, NOT_SERVICEABLE } = require('../../services/storefront.service');

router.use(authenticateCustomer);

// POST /api/app/payments/razorpay/create
// Creates a Razorpay order and returns key + order_id for frontend
router.post('/razorpay/create', async (req, res) => {
  try {
    const { items, lat, lng } = req.body;
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ message: 'Online payment not configured. Please use Cash on Delivery.' });
    }
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No items provided' });
    }
    // Compute amount server-side — never trust the client-supplied amount.
    const productIds = items.map(i => i.product_id ?? i.id);
    const products   = await Product.findAll({ where: { id: { [Op.in]: productIds } }, attributes: ['id', 'price'] });
    const priceMap   = Object.fromEntries(products.map(p => [p.id, Math.round(p.price / 100)]));
    let subtotal = 0;
    for (const item of items) {
      const pid = item.product_id ?? item.id;
      if (priceMap[pid] == null) return res.status(400).json({ message: `Product #${pid} not found` });
      subtotal += priceMap[pid] * (item.qty ?? 1);
    }
    const computedTotal = subtotal + (subtotal >= 99 ? 0 : 25) + 5;

    // Refuse before the customer pays, not after.
    const { store, located } = await storeForDelivery(lat, lng);
    if (located && !store) return res.status(400).json({ message: NOT_SERVICEABLE });
    const rzp = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    const order = await rzp.orders.create({
      amount:   Math.round(computedTotal * 100), // paise — server-computed, not client-supplied
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
      items, lat, lng, address_id,
    } = req.body;

    // Verify signature
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expected !== razorpay_signature) {
      return res.status(400).json({ message: 'Payment verification failed. Invalid signature.' });
    }

    // ── Server-side price computation (same logic as COD path) ───────────────
    const productIds = items.map(i => i.product_id ?? i.id);
    const products   = await Product.findAll({ where: { id: { [Op.in]: productIds } }, attributes: ['id', 'price'], transaction: t });
    // Product.price is in paise in the DB; convert to rupees.
    const priceMap   = Object.fromEntries(products.map(p => [p.id, Math.round(p.price / 100)]));

    let subtotal = 0;
    for (const item of items) {
      const pid = item.product_id ?? item.id;
      const serverPrice = priceMap[pid];
      if (serverPrice == null) throw Object.assign(new Error(`Product #${pid} not found`), { status: 400 });
      subtotal += serverPrice * (item.qty ?? 1);
    }

    const delivery_fee_computed    = subtotal >= 99 ? 0 : 25;
    const handling_charge_computed = 5;
    const total = subtotal + delivery_fee_computed + handling_charge_computed;

    // Payment is already captured here, so if the location check somehow
    // fails now (it passed at /create) fall back to any active store rather
    // than losing a paid order.
    let { store } = await storeForDelivery(lat, lng);
    if (!store) store = await DarkStore.findOne({ where: { is_active: true } });

    // Check + lock inventory
    for (const item of items) {
      const productId = item.product_id ?? item.id;
      const qty       = item.qty ?? 1;
      const inv = await Inventory.findOne({
        where: { productId, ...(store ? { storeId: store.id } : {}) },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (inv && inv.stockQty < qty) {
        throw new Error(`Out of stock: product #${productId} (available: ${inv?.stockQty ?? 0}, requested: ${qty})`);
      }
    }

    // Only the customer's own saved address can be attached to the order.
    const address = address_id != null
      ? await Address.findOne({ where: { id: address_id, userId: req.user.id }, attributes: ['id'], transaction: t })
      : null;
    if (address_id != null && !address) {
      throw Object.assign(new Error('Delivery address not found'), { status: 400 });
    }

    const deliveryOtp = String(crypto.randomInt(100000, 1000000));

    const order = await Order.create({
      customerId:  req.user.id,
      storeId:     store?.id ?? null,
      addressId:   address?.id ?? null,
      deliveryOtp,
      status:      'confirmed',
      subtotal,
      deliveryFee: delivery_fee_computed,
      discount:    0,
      total,
    }, { transaction: t });

    await OrderItem.bulkCreate(
      items.map(i => {
        const pid   = i.product_id ?? i.id;
        const price = priceMap[pid];
        const qty   = i.qty ?? 1;
        return { orderId: order.id, productId: pid, quantity: qty, unitPrice: price, total: price * qty };
      }),
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
        `Hi ${customer.name || 'there'}! Your Jhatpats order #${order.id} is confirmed. Total: Rs.${total}. Paid via Razorpay. Delivery OTP: ${deliveryOtp}. Share it only with your rider.`
      ).catch(() => {});
    }

    // Fan out to riders, same as COD orders. Best-effort: the sweeper retries.
    require('../../services/rider-dispatch.service')
      .offerOrder(order.id)
      .catch(err => console.error('[dispatch] on razorpay placement:', err.message));

    return res.status(201).json({ ...order.toJSON(), payment_id: razorpay_payment_id });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;

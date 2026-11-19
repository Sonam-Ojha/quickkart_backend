const router  = require('express').Router();
const crypto  = require('crypto');
const checkout = require('../../services/checkout-payment.service');
const { Op }        = require('sequelize');
const Order         = require('../../models/order.model');
const OrderItem     = require('../../models/order-item.model');
const OrderTimeline = require('../../models/order-timeline.model');
const Payment       = require('../../models/payment.model');
const Inventory     = require('../../models/inventory.model');
const Product       = require('../../models/product.model');
const User          = require('../../models/user.model');
const Address       = require('../../models/address.model');
const sequelize     = require('../../../src/config/db');
const { sendSms }   = require('../../services/otp.service');
const { authenticateCustomer } = require('../../middlewares/customer.middleware');
const { storeForDelivery, storeCatalog, NOT_SERVICEABLE } = require('../../services/storefront.service');

router.use(authenticateCustomer);

// POST /api/app/payments/razorpay/create
// Creates a Razorpay order and returns key + order_id for frontend
router.post('/razorpay/create', async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (!Array.isArray(req.body.items) && req.body.amount != null) {
      return res.status(426).json({ code: 'APP_UPDATE_REQUIRED', message: 'Please update Jhatpats from the Play Store, then remove and re-add your cart items before paying.' });
    }
    checkout.fingerprint(req.body, 'grocery');
    const items = checkout.normalizeItems(req.body.items);
    // Compute amount server-side — never trust the client-supplied amount.
    const productIds = items.map(i => i.product_id ?? i.id);
    const products   = await Product.findAll({ attributes: ['id', 'price'], where: { id: { [Op.in]: productIds }, isActive: true } });
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
    const catalog = await storeCatalog(store?.id);
    for (const item of items) {
      if (catalog.hidden.includes(item.id) || (catalog.stock[item.id] != null && catalog.stock[item.id] < item.qty))
        throw checkout.fail('Some items are unavailable at your store', 409);
    }
    if (req.body.address_id != null && !await Address.findOne({ where: { id: req.body.address_id, userId: req.user.id } }))
      throw checkout.fail('Delivery address not found');
    return res.json(await checkout.createPayment(req.user.id, req.body, 'grocery', computedTotal));
  } catch (err) {
    return res.status(err.status ?? 500).json({ message: err.message });
  }
});

// POST /api/app/payments/razorpay/verify
// Verifies Razorpay payment signature and places order
router.post('/razorpay/verify', async (req, res) => {
  let t;
  try {
    const verified = await checkout.verifyPayment(req.user.id, req.body, 'grocery');
    const { lat, lng, address_id, razorpay_payment_id } = req.body;
    const items = checkout.normalizeItems(req.body.items);
    t = await sequelize.transaction();
    // All checkout completions for a customer serialize, including concurrent retries.
    await User.findByPk(req.user.id, { transaction: t, lock: t.LOCK.UPDATE });
    const prior = await Payment.findOne({ where: { gateway: 'razorpay', txnId: verified.id }, transaction: t });
    if (prior) {
      const existing = await Order.findByPk(prior.orderId, { transaction: t });
      if (!existing || existing.customerId !== req.user.id) throw checkout.fail('Payment already used', 409);
      await t.commit();
      return res.json({ ...existing.toJSON(), payment_id: verified.id });
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

    if (Math.round(total * 100) !== verified.amount) throw checkout.fail('Prices changed. Contact support for payment reconciliation.', 409);

    const { store } = await storeForDelivery(lat, lng);
    if (!store) throw checkout.fail('Delivery is no longer available here. Contact support for payment reconciliation.', 409);

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
        throw checkout.fail(`Out of stock: product #${productId} (available: ${inv?.stockQty ?? 0}, requested: ${qty})`, 409);
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
    const customer = await User.findByPk(req.user.id, { attributes: ['mobile', 'name'] }).catch(() => null);
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
    if (t && !t.finished) await t.rollback();
    return res.status(err.status ?? 500).json({ message: err.message });
  }
});

module.exports = router;

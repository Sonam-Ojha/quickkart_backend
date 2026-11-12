const Order         = require('../../models/order.model');
const OrderItem     = require('../../models/order-item.model');
const OrderTimeline = require('../../models/order-timeline.model');
const Payment       = require('../../models/payment.model');
const Product       = require('../../models/product.model');
const DarkStore     = require('../../models/darkstore.model');
const Inventory     = require('../../models/inventory.model');
const Rider         = require('../../models/rider.model');
const Address       = require('../../models/address.model');
const Restaurant    = require('../../models/restaurant.model');
const User          = require('../../models/user.model');
const Coupon        = require('../../models/coupon.model');
const CouponUsage   = require('../../models/coupon-usage.model');
const { Op }        = require('sequelize');
const sequelize     = require('../../../src/config/db');
const { sendSms }   = require('../../services/otp.service');
const { notifyAdminNewOrder } = require('../../services/notification.service');
const { storeForDelivery, storeCatalog, NOT_SERVICEABLE } = require('../../services/storefront.service');

const list = async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { customerId: req.user.id },
      include: [
        { model: OrderItem, as: 'items', include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'imageUrl'] }] },
        // Food orders: which restaurant (items carry itemName instead of a product)
        { model: Restaurant, as: 'restaurant', attributes: ['id', 'name', 'imageUrl'], required: false },
      ],
      order: [['created_at', 'DESC']],
      limit: 100,
    });
    return res.json(orders);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const place = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { items, address_id, coupon_code, payment_method = 'cod', lat, lng } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No items in order' });
    }

    // ── Server-side price computation ─────────────────────────────────────────
    const productIds = [...new Set(items.map(i => i.product_id ?? i.id))];
    const products = await Product.findAll({ where: { id: { [Op.in]: productIds } }, attributes: ['id', 'name', 'price'], transaction: t });
    // Product.price is stored in paise; convert to rupees to match the rest of the system.
    const priceMap = Object.fromEntries(products.map(p => [p.id, Math.round(p.price / 100)]));

    let subtotal = 0;
    for (const item of items) {
      const pid = item.product_id ?? item.id;
      const serverPrice = priceMap[pid];
      if (serverPrice == null) {
        await t.rollback();
        return res.status(400).json({ message: `Product #${pid} not found` });
      }
      subtotal += serverPrice * (item.qty ?? 1);
    }

    // ── Server-side coupon validation ─────────────────────────────────────────
    let discount = 0;
    let appliedCoupon = null;
    if (coupon_code) {
      const coupon = await Coupon.findOne({ where: { code: coupon_code, isActive: true }, transaction: t });
      if (!coupon) {
        await t.rollback();
        return res.status(400).json({ message: 'Invalid or expired coupon code' });
      }
      const now = new Date();
      if (now < coupon.validFrom || now > coupon.validTo) {
        await t.rollback();
        return res.status(400).json({ message: 'Coupon is not valid at this time' });
      }
      // coupon.minOrder is stored in paise — convert to rupees for comparison.
      const minOrderRupees = Math.round((coupon.minOrder ?? 0) / 100);
      if (subtotal < minOrderRupees) {
        await t.rollback();
        return res.status(400).json({ message: `Minimum order value for this coupon is ₹${minOrderRupees}` });
      }
      if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
        await t.rollback();
        return res.status(400).json({ message: 'Coupon usage limit reached' });
      }
      const userUsage = await CouponUsage.count({ where: { couponId: coupon.id, userId: req.user.id }, transaction: t });
      if (userUsage >= (coupon.perUserLimit ?? 1)) {
        await t.rollback();
        return res.status(400).json({ message: 'You have already used this coupon' });
      }
      // coupon.value for flat type is in paise; convert. For percent type it's a percentage (0–100).
      const couponValueRupees = coupon.type === 'flat' ? Math.round(coupon.value / 100) : null;
      const maxDiscRupees     = coupon.maxDiscount != null ? Math.round(coupon.maxDiscount / 100) : Infinity;
      discount = coupon.type === 'flat'
        ? couponValueRupees
        : Math.min(Math.floor(subtotal * coupon.value / 100), maxDiscRupees);
      appliedCoupon = coupon;
    }

    const delivery_fee    = subtotal >= 99 ? 0 : 25;
    const handling_charge = 5;
    const total           = subtotal - discount + delivery_fee + handling_charge;

    // Only the customer's own saved address can be attached to the order.
    if (address_id != null) {
      const owned = await Address.findOne({ where: { id: address_id, userId: req.user.id }, attributes: ['id'], transaction: t });
      if (!owned) {
        await t.rollback();
        return res.status(400).json({ message: 'Delivery address not found' });
      }
    }

    // Fulfil from the store whose radius covers the delivery location.
    const { store, located } = await storeForDelivery(lat, lng);
    if (located && !store) {
      await t.rollback();
      return res.status(400).json({ message: NOT_SERVICEABLE });
    }

    // Products the admin switched OFF for this store can't be ordered from it.
    const { hidden } = await storeCatalog(store?.id);

    // Validate all products exist in one query (N+1 → 1 query)
    const existingProducts = await Product.findAll({
      where: { id: { [Op.in]: productIds } },
      attributes: ['id', 'name'],
      transaction: t,
    });
    if (existingProducts.length !== productIds.length) {
      await t.rollback();
      return res.status(400).json({ message: 'Some items in your cart are no longer available. Please clear your cart and add items again.' });
    }
    const productNameMap = new Map(existingProducts.map(p => [p.id, p.name]));

    // Fetch + lock all inventory rows in one query (N+1 → 1 query)
    const invRows = await Inventory.findAll({
      where: { productId: { [Op.in]: productIds }, ...(store ? { storeId: store.id } : {}) },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    const invMap = new Map(invRows.map(r => [r.productId, r]));

    for (const item of items) {
      const productId = item.product_id ?? item.id;
      const qty       = item.qty ?? 1;
      const inv       = invMap.get(productId);
      if (hidden.includes(Number(productId)) || (inv && inv.stockQty < qty)) {
        const name = productNameMap.get(productId) ?? `Product #${productId}`;
        const err  = new Error(`${name} is not available at your nearest store. Please remove it from your cart.`);
        err.status = 409;
        throw err;
      }
    }

    // Code the customer reads out to the rider at handover. Minted here so it
    // exists for the whole life of the order, not just once a rider is assigned.
    const deliveryOtp = String(require('crypto').randomInt(100000, 1000000));

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
      items.map((i) => {
        const pid   = i.product_id ?? i.id;
        const price = priceMap[pid];
        const qty   = i.qty ?? 1;
        return { orderId: order.id, productId: pid, quantity: qty, unitPrice: price, total: price * qty }; // price already in rupees
      }),
      { transaction: t },
    );

    await OrderTimeline.create({
      orderId: order.id,
      status:  'pending',
      note:    'Order placed',
    }, { transaction: t });

    // Record coupon usage so it can't be reused beyond its limit
    if (appliedCoupon) {
      await CouponUsage.create({
        couponId:       appliedCoupon.id,
        userId:         req.user.id,
        orderId:        order.id,
        discountAmount: discount,
      }, { transaction: t });
      await appliedCoupon.increment('usedCount', { transaction: t });
    }

    // Quick-commerce: confirm immediately so the order can reach riders.
    await order.update({ status: 'confirmed' }, { transaction: t });
    await OrderTimeline.create({
      orderId: order.id,
      status:  'confirmed',
      note:    'Auto-confirmed on placement',
    }, { transaction: t });

    // Deduct inventory — reuse invMap from the validation step above (no extra queries)
    for (const item of items) {
      const productId = item.product_id ?? item.id;
      const qty       = item.qty ?? 1;
      if (invMap.has(productId)) {
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

    // Notify admin of new order (best-effort)
    notifyAdminNewOrder({ id: order.id, total }).catch(err => console.error('[ADMIN NOTIF] failed:', err.message));

    // Fan out to riders. Best-effort: if nobody is online the sweeper retries,
    // and a dispatch failure must never fail an order the customer already paid for.
    require('../../services/rider-dispatch.service')
      .offerOrder(order.id)
      .catch(err => console.error('[dispatch] on placement:', err.message));

    return res.status(201).json({ ...order.toJSON(), payment_method });
  } catch (err) {
    await t.rollback();
    console.error('[ORDER ERROR]', err.message, err.errors ?? '');
    const isClientError = err.status && err.status < 500;
    return res.status(err.status ?? 500).json({ message: isClientError ? err.message : 'Failed to place order' });
  }
};

const getById = async (req, res) => {
  try {
    const order = await Order.findOne({
      where: { id: req.params.id, customerId: req.user.id },
      include: [
        { model: OrderItem, as: 'items', include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'image_url', 'unit'] }] },
        { model: Restaurant, as: 'restaurant', attributes: ['id', 'name', 'imageUrl'], required: false },
        { model: OrderTimeline, as: 'timeline' },
        { model: Rider, as: 'rider', attributes: ['id', 'name', 'mobile', 'vehicleType', 'vehicleNumber', 'rating', 'currentLat', 'currentLng', 'locationUpdatedAt'], required: false },
        { model: Address, as: 'address', attributes: ['id', 'label', 'line1', 'line2', 'city', 'pincode', 'lat', 'lng'], required: false },
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
    const order = await Order.findOne({
      where: { id: req.params.id, customerId: req.user.id },
      include: [{ model: OrderItem, as: 'items' }],
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const CANCELLABLE = ['pending', 'confirmed', 'preparing'];
    if (!CANCELLABLE.includes(order.status)) {
      return res.status(400).json({
        message: order.status === 'out_for_delivery'
          ? 'Cannot cancel — rider is already on the way'
          : 'Order cannot be cancelled at this stage',
      });
    }

    const { reason = 'Cancelled by customer' } = req.body;

    const ct = await sequelize.transaction();
    try {
      await order.update({ status: 'cancelled' }, { transaction: ct });
      await OrderTimeline.create({ orderId: order.id, status: 'cancelled', note: reason }, { transaction: ct });

      await Promise.all(
        (order.items ?? []).map(item =>
          Inventory.increment('stockQty', {
            by: item.quantity,
            where: { productId: item.productId, ...(order.storeId ? { storeId: order.storeId } : {}) },
            transaction: ct,
          })
        )
      );
      await ct.commit();
    } catch (innerErr) {
      await ct.rollback();
      throw innerErr;
    }

    require('../../services/realtime.service').orderChanged(order);
    require('../../services/rider-dispatch.service').withdrawOffers(order.id).catch(() => {});
    return res.json({ message: 'Order cancelled successfully' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to cancel order' });
  }
};

module.exports = { list, place, getById, cancel };

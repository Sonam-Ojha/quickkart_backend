const router  = require('express').Router();
const checkout = require('../../services/checkout-payment.service');
const sequelize = require('../../config/db');
const User = require('../../models/user.model');
const Payment = require('../../models/payment.model');
const Order = require('../../models/order.model');
const svc = require('../../services/food.service');
const { placeFoodOrder, quoteFoodOrder } = require('../../services/food-order.service');
const { authenticateCustomer } = require('../../middlewares/customer.middleware');

// Food-tab API. Browsing is public like products/categories; placing an order needs login.

// GET /api/app/food/status?lat=&lng=  → { enabled, storeId?, restaurantCount? }
// Apps show the Food tab only when enabled is true.
router.get('/status', async (req, res) => {
  try { res.json(await svc.getFoodStatus(req.query.lat, req.query.lng)); }
  catch (err) { res.status(err.status ?? 500).json({ message: err.message }); }
});

// GET /api/app/food/restaurants?lat=&lng=
router.get('/restaurants', async (req, res) => {
  try { res.json(await svc.listPublicRestaurants(req.query.lat, req.query.lng)); }
  catch (err) { res.status(err.status ?? 500).json({ message: err.message }); }
});

// GET /api/app/food/restaurants/:id  → { restaurant, sections: [{ id, name, items }] }
router.get('/restaurants/:id', async (req, res) => {
  try { res.json(await svc.getPublicMenu(req.params.id)); }
  catch (err) { res.status(404).json({ message: err.message }); }
});

// POST /api/app/food/orders  { restaurant_id, items: [{ menu_item_id, qty }], address_id, lat, lng, payment_method }
// Placed as 'pending'; ops confirms with the restaurant before a rider is sent.
router.post('/orders', authenticateCustomer, async (req, res) => {
  try { res.status(201).json(await placeFoodOrder(req.user.id, req.body)); }
  catch (err) {
    if (!err.status) console.error('[FOOD ORDER ERROR]', err.message);
    res.status(err.status ?? 500).json({ message: err.status ? err.message : 'Failed to place order' });
  }
});

// POST /api/app/food/payments/razorpay/create
// Validates food items, computes total server-side, returns Razorpay order
router.post('/payments/razorpay/create', authenticateCustomer, async (req, res) => {
  try {
    const quote = await quoteFoodOrder(req.user.id, req.body);
    return res.json(await checkout.createPayment(req.user.id, req.body, 'food', quote.total));
  } catch (err) {
    return res.status(err.status ?? 500).json({ message: err.message });
  }
});

// POST /api/app/food/payments/razorpay/verify
// Verifies signature then places the food order as paid
router.post('/payments/razorpay/verify', authenticateCustomer, async (req, res) => {
  try {
    const verified = await checkout.verifyPayment(req.user.id, req.body, 'food');
    const result = await sequelize.transaction(async transaction => {
      await User.findByPk(req.user.id, { transaction, lock: transaction.LOCK.UPDATE });
      const prior = await Payment.findOne({ where: { gateway: 'razorpay', txnId: verified.id }, transaction });
      if (prior) {
        const order = await Order.findByPk(prior.orderId, { transaction });
        if (!order || order.customerId !== req.user.id) throw checkout.fail('Payment already used', 409);
        return order.toJSON();
      }
      return placeFoodOrder(req.user.id, { ...req.body, payment_method: 'razorpay' }, {
        transaction, paymentId: verified.id, paidAmount: verified.amount,
      });
    });
    return res.status(201).json({ ...result, payment_id: verified.id });
  } catch (err) {
    if (!err.status) console.error('[FOOD RAZORPAY VERIFY]', err.message);
    return res.status(err.status ?? 500).json({ message: err.status ? err.message : 'Failed to place order' });
  }
});

module.exports = router;

const router  = require('express').Router();
const crypto  = require('crypto');
const Razorpay = require('razorpay');
const { Op }  = require('sequelize');
const svc = require('../../services/food.service');
const { placeFoodOrder } = require('../../services/food-order.service');
const { authenticateCustomer } = require('../../middlewares/customer.middleware');
const MenuItem = require('../../models/menu-item.model');
const Restaurant = require('../../models/restaurant.model');

// Food-tab API. Browsing is public like products/categories; placing an order needs login.

// GET /api/app/food/status?lat=&lng=  → { enabled, storeId?, restaurantCount? }
// Apps show the Food tab only when enabled is true.
router.get('/status', async (req, res) => {
  try { res.json(await svc.getFoodStatus(req.query.lat, req.query.lng)); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/app/food/restaurants?lat=&lng=
router.get('/restaurants', async (req, res) => {
  try { res.json(await svc.listPublicRestaurants(req.query.lat, req.query.lng)); }
  catch (err) { res.status(500).json({ message: err.message }); }
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
    const { restaurant_id, items } = req.body;
    if (!restaurant_id || !Array.isArray(items) || items.length === 0)
      return res.status(400).json({ message: 'restaurant_id and items are required' });

    const restaurant = await Restaurant.findOne({ where: { id: restaurant_id, isActive: true } });
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

    const ids = items.map(i => Number(i.menu_item_id ?? i.id));
    const menu = await MenuItem.findAll({ where: { id: { [Op.in]: ids }, restaurantId: restaurant.id, isActive: true } });
    const byId = new Map(menu.map(m => [m.id, m]));

    let subtotal = 0;
    for (const it of items) {
      const id = Number(it.menu_item_id ?? it.id);
      const m  = byId.get(id);
      if (!m) return res.status(409).json({ message: 'Some items are no longer on the menu.' });
      subtotal += m.price * (Number(it.qty) || 1);
    }
    const deliveryFee = subtotal >= 99 ? 0 : 25;
    const total = subtotal + deliveryFee + 5; // +5 handling

    const rzp = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    const order = await rzp.orders.create({ amount: Math.round(total * 100), currency: 'INR', receipt: `food_${Date.now()}` });
    return res.json({ key: process.env.RAZORPAY_KEY_ID, razorpay_order_id: order.id, amount: order.amount });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/app/food/payments/razorpay/verify
// Verifies signature then places the food order as paid
router.post('/payments/razorpay/verify', authenticateCustomer, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, ...orderBody } = req.body;
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    if (expected !== razorpay_signature)
      return res.status(400).json({ message: 'Payment verification failed.' });

    const result = await placeFoodOrder(req.user.id, { ...orderBody, payment_method: 'razorpay' });
    return res.status(201).json({ ...result, payment_id: razorpay_payment_id });
  } catch (err) {
    if (!err.status) console.error('[FOOD RAZORPAY VERIFY]', err.message);
    return res.status(err.status ?? 500).json({ message: err.status ? err.message : 'Failed to place order' });
  }
});

module.exports = router;

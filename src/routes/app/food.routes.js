const router = require('express').Router();
const svc = require('../../services/food.service');
const { placeFoodOrder } = require('../../services/food-order.service');
const { authenticateCustomer } = require('../../middlewares/customer.middleware');

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

module.exports = router;

const router = require('express').Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireAdmin } = require('../../middlewares/admin.middleware');
const svc = require('../../services/food.service');

// Restaurants + menus for the Food tab. Food on/off per area lives on the
// dark store (foodEnabled) and is edited through /api/admin/dark-stores.
router.use(authenticate, requireAdmin);

const handle = (fn, status = 400) => async (req, res) => {
  try { await fn(req, res); }
  catch (err) { res.status(err.message?.endsWith('not found') ? 404 : status).json({ message: err.message }); }
};

// ── Restaurants ──
router.get('/restaurants', handle(async (req, res) => {
  res.json({ restaurants: await svc.listRestaurants({ storeId: req.query.storeId }) });
}, 500));
router.get('/restaurants/:id', handle(async (req, res) => {
  res.json({ restaurant: await svc.getRestaurant(req.params.id) });
}));
router.post('/restaurants', handle(async (req, res) => {
  res.status(201).json({ restaurant: await svc.createRestaurant(req.body) });
}));
router.put('/restaurants/:id', handle(async (req, res) => {
  res.json({ restaurant: await svc.updateRestaurant(req.params.id, req.body) });
}));
// ?field=isOpen toggles "open right now"; default toggles listing on/off.
router.patch('/restaurants/:id/toggle', handle(async (req, res) => {
  res.json({ restaurant: await svc.toggleRestaurant(req.params.id, req.query.field) });
}));
router.delete('/restaurants/:id', handle(async (req, res) => {
  await svc.deleteRestaurant(req.params.id);
  res.json({ message: 'Restaurant deleted' });
}));

// ── Menu ──
router.get('/restaurants/:id/menu', handle(async (req, res) => {
  res.json(await svc.getMenu(req.params.id));
}));
router.post('/restaurants/:id/menu-categories', handle(async (req, res) => {
  res.status(201).json({ category: await svc.createMenuCategory(req.params.id, req.body) });
}));
router.put('/restaurants/:id/menu-categories/:catId', handle(async (req, res) => {
  res.json({ category: await svc.updateMenuCategory(req.params.id, req.params.catId, req.body) });
}));
router.delete('/restaurants/:id/menu-categories/:catId', handle(async (req, res) => {
  await svc.deleteMenuCategory(req.params.id, req.params.catId);
  res.json({ message: 'Menu section deleted' });
}));
router.post('/restaurants/:id/menu-items', handle(async (req, res) => {
  res.status(201).json({ item: await svc.createMenuItem(req.params.id, req.body) });
}));
router.put('/restaurants/:id/menu-items/:itemId', handle(async (req, res) => {
  res.json({ item: await svc.updateMenuItem(req.params.id, req.params.itemId, req.body) });
}));
router.patch('/restaurants/:id/menu-items/:itemId/toggle', handle(async (req, res) => {
  res.json({ item: await svc.toggleMenuItem(req.params.id, req.params.itemId) });
}));
router.delete('/restaurants/:id/menu-items/:itemId', handle(async (req, res) => {
  await svc.deleteMenuItem(req.params.id, req.params.itemId);
  res.json({ message: 'Menu item deleted' });
}));

module.exports = router;

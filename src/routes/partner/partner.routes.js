const router = require('express').Router();
const multer = require('multer');
const svc    = require('../../services/partner.service');
const food   = require('../../services/food.service');
const s3     = require('../../services/s3.service');
const { authenticatePartner } = require('../../middlewares/partner.middleware');

// Restaurant partner panel API. Every route below login is scoped to
// req.partner.restaurantId (set by the middleware from the staff row) — ids
// in the URL are only ever looked up inside that restaurant.

const handle = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (err) {
    if (!err.status && !/not found/i.test(err.message)) console.error('[partner]', err.message);
    const status = err.status ?? (/not found/i.test(err.message) ? 404 : 400);
    res.status(status).json({ message: err.message });
  }
};

// Simple per-IP throttle on login: 10 tries / 15 min.
const attempts = new Map();
const loginThrottle = (req, res, next) => {
  const key = req.ip;
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now - rec.start > 15 * 60e3) { attempts.set(key, { start: now, n: 1 }); return next(); }
  if (++rec.n > 10) return res.status(429).json({ message: 'Too many attempts. Try again in a few minutes.' });
  next();
};

// POST /api/partner/auth/login  { mobile, password }
router.post('/auth/login', loginThrottle, handle(async (req, res) => {
  res.json(await svc.login(req.body ?? {}));
}));

router.use(authenticatePartner);
const rid = (req) => req.partner.restaurantId;

router.get('/me', handle(async (req, res) => {
  res.json({ staff: { id: req.partner.staffId, name: req.partner.name }, restaurant: await svc.getRestaurant(rid(req)) });
}));

// ── Restaurant profile ──
router.get('/restaurant', handle(async (req, res) => res.json({ restaurant: await svc.getRestaurant(rid(req)) })));
router.patch('/restaurant', handle(async (req, res) => res.json({ restaurant: await svc.updateRestaurant(rid(req), req.body ?? {}) })));

// ── Orders ──
router.get('/orders', handle(async (req, res) => res.json(await svc.listOrders(rid(req), req.query))));
router.get('/orders/:id', handle(async (req, res) => res.json({ order: await svc.getOrder(rid(req), req.params.id) })));
router.post('/orders/:id/accept',    handle(async (req, res) => res.json({ order: await svc.accept(rid(req), req.params.id, req.partner.name) })));
router.post('/orders/:id/preparing', handle(async (req, res) => res.json({ order: await svc.startPreparing(rid(req), req.params.id, req.partner.name) })));
router.post('/orders/:id/ready',     handle(async (req, res) => res.json({ order: await svc.markReady(rid(req), req.params.id, req.partner.name) })));
router.post('/orders/:id/reject',    handle(async (req, res) => res.json({ order: await svc.reject(rid(req), req.params.id, req.body?.reason, req.partner.name) })));

// ── Earnings ──
router.get('/dashboard', handle(async (req, res) => res.json(await svc.dashboard(rid(req), req.query))));
router.get('/earnings', handle(async (req, res) => res.json(await svc.earnings(rid(req)))));

// ── Menu (same rules as admin, locked to this restaurant) ──
router.get('/menu', handle(async (req, res) => res.json(await food.getMenu(rid(req)))));
router.post('/menu-categories', handle(async (req, res) => res.status(201).json({ category: await food.createMenuCategory(rid(req), req.body) })));
router.put('/menu-categories/:catId', handle(async (req, res) => res.json({ category: await food.updateMenuCategory(rid(req), req.params.catId, req.body) })));
router.delete('/menu-categories/:catId', handle(async (req, res) => { await food.deleteMenuCategory(rid(req), req.params.catId); res.json({ message: 'Menu section deleted' }); }));
router.post('/menu-items', handle(async (req, res) => res.status(201).json({ item: await food.createMenuItem(rid(req), req.body) })));
router.put('/menu-items/:itemId', handle(async (req, res) => res.json({ item: await food.updateMenuItem(rid(req), req.params.itemId, req.body) })));
router.patch('/menu-items/:itemId/toggle', handle(async (req, res) => res.json({ item: await food.toggleMenuItem(rid(req), req.params.itemId) })));
router.delete('/menu-items/:itemId', handle(async (req, res) => { await food.deleteMenuItem(rid(req), req.params.itemId); res.json({ message: 'Menu item deleted' }); }));

// ── Photo upload (menu items / restaurant) ──
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.mimetype)
      ? cb(null, true) : cb(new Error('Only JPG, PNG or WebP images')),
});
router.post('/upload', (req, res, next) => upload.single('image')(req, res, (err) => err ? res.status(400).json({ message: err.message }) : next()),
  handle(async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const { url } = await s3.uploadImage(req.file.buffer, `restaurant-${rid(req)}`);
    res.json({ url });
  }));

module.exports = router;

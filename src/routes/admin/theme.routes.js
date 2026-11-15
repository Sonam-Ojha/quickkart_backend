const router = require('express').Router();
const multer = require('multer');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireAdmin } = require('../../middlewares/admin.middleware');
const svc = require('../../services/theme.service');
const s3  = require('../../services/s3.service');

// Festival themes for the customer app + website.
router.use(authenticate, requireAdmin);

const handle = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (err) { res.status(err.status ?? 500).json({ message: err.message }); }
};

router.get('/', handle(async (_req, res) => res.json({ themes: await svc.list() })));
router.get('/stores', handle(async (_req, res) => res.json({ stores: await svc.storeOptions() })));
// Section product picker: ?q=search  or  ?ids=1,2,3
router.get('/products', handle(async (req, res) => {
  const ids = String(req.query.ids ?? '').split(',').map(Number).filter(n => n > 0);
  res.json({ products: ids.length ? await svc.productsByIds(ids) : await svc.searchProducts(req.query.q) });
}));
router.get('/:id', handle(async (req, res) => res.json({ theme: await svc.get(req.params.id) })));
router.post('/', handle(async (req, res) => res.status(201).json({ theme: await svc.create(req.body ?? {}) })));
router.put('/:id', handle(async (req, res) => res.json({ theme: await svc.update(req.params.id, req.body ?? {}) })));
router.patch('/:id/toggle', handle(async (req, res) => res.json({ theme: await svc.toggle(req.params.id) })));
router.delete('/:id', handle(async (req, res) => { await svc.remove(req.params.id); res.json({ message: 'Theme deleted' }); }));

// Lottie animation upload (.json, max 2 MB). Stored under products/ so it is
// publicly readable like other app images.
const lottie = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
router.post('/animation', (req, res, next) => lottie.single('file')(req, res, (err) => {
  if (err) return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'Animation must be under 2 MB' : err.message });
  next();
}), handle(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  let json;
  try { json = JSON.parse(req.file.buffer.toString('utf8')); } catch { json = null; }
  if (!json || !Array.isArray(json.layers) || !json.w || !json.h) {
    return res.status(400).json({ message: 'This is not a Lottie animation (.json). Download the "Lottie JSON" file from LottieFiles.' });
  }
  const { url } = await s3.uploadFile(req.file.buffer, 'animation.json', 'products/themes');
  res.json({ url });
}));

module.exports = router;

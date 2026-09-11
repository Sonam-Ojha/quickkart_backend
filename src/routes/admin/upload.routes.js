const router  = require('express').Router();
const multer  = require('multer');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireAdmin }  = require('../../middlewares/admin.middleware');
const s3 = require('../../services/s3.service');

// ── Config ────────────────────────────────────────────────────────────────────
const MAX_BYTES    = parseInt(process.env.MAX_IMAGE_SIZE_BYTES || String(5 * 1024 * 1024), 10);
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

// Use memoryStorage — we send the buffer directly to S3 (no local disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, WebP images are allowed'));
    }
    cb(null, true);
  },
});

// ── POST /api/admin/upload ────────────────────────────────────────────────────
// Body (multipart): image (file), productId (optional text field)
// Returns: { url, key }
router.post('/', authenticate, requireAdmin, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const scope = req.body.productId || 'general';

  try {
    const { url, key } = await s3.uploadImage(req.file.buffer, scope);
    return res.json({ url, key });
  } catch (err) {
    console.error('[upload] image upload failed:', err);
    return res.status(502).json({
      message: process.env.NODE_ENV === 'production'
        ? 'Image upload failed. Please try again.'
        : `Image upload failed: ${err.message}`,
    });
  }
});

// ── DELETE /api/admin/upload ──────────────────────────────────────────────────
// Body JSON: { key } — deletes one S3 object
router.delete('/', authenticate, requireAdmin, async (req, res) => {
  const { key } = req.body || {};
  if (!key) return res.status(400).json({ message: 'key is required' });

  // Basic key safety — only allow our products/ prefix
  if (!key.startsWith('products/')) {
    return res.status(400).json({ message: 'Invalid key prefix' });
  }

  try {
    await s3.deleteImage(key);
    return res.json({ message: 'Image deleted' });
  } catch (err) {
    console.error('[upload] S3 delete failed:', err.message);
    return res.status(502).json({ message: 'Image deletion failed. Please try again.' });
  }
});

module.exports = router;

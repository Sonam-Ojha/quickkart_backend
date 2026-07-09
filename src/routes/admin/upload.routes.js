const router  = require('express').Router();
const multer  = require('multer');
const path    = require('path');
const crypto  = require('crypto');
const { authenticate }  = require('../../middlewares/auth.middleware');
const { requireAdmin }  = require('../../middlewares/admin.middleware');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../../public/uploads'),
  filename: (_, file, cb) => {
    const unique = crypto.randomBytes(10).toString('hex');
    cb(null, `${unique}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase())
            && allowed.test(file.mimetype);
    cb(ok ? null : new Error('Only image files are allowed'), ok);
  },
});

// POST /api/admin/upload
router.post('/', authenticate, requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  return res.json({ url });
});

module.exports = router;

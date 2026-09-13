const router      = require('express').Router();
const multer      = require('multer');
const { authenticateCustomer } = require('../../middlewares/customer.middleware');
const s3          = require('../../services/s3.service');
const PrintOrder  = require('../../models/print-order.model');

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg', 'image/jpg', 'image/png',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Only PDF, DOC, DOCX, JPG, PNG files are allowed'));
    }
    cb(null, true);
  },
});

// POST /api/app/print/upload — upload one file, get back its URL
router.post('/upload', authenticateCustomer, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  try {
    const { url, key } = await s3.uploadFile(req.file.buffer, req.file.originalname, 'prints');
    return res.json({ url, key, name: req.file.originalname });
  } catch (err) {
    console.error('[print upload]', err.message);
    return res.status(502).json({ message: 'File upload failed. Please try again.' });
  }
});

// POST /api/app/print/orders — create a print order
router.post('/orders', authenticateCustomer, async (req, res) => {
  try {
    const { files, color = 'bw', paper = 'A4', sides = 'single', copies = 1,
            totalPages = 0, printCost = 0, grandTotal = 0, address_id } = req.body;
    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No files provided' });
    }
    const order = await PrintOrder.create({
      customerId: req.user.id,
      files,
      color,
      paper,
      sides,
      copies:      Number(copies),
      totalPages:  Number(totalPages),
      printCost:   Number(printCost),
      deliveryFee: 25,
      grandTotal:  Number(grandTotal),
      status:      'pending',
      addressId:   address_id ?? null,
    });
    return res.status(201).json(order);
  } catch (err) {
    console.error('[print order]', err.message);
    return res.status(500).json({ message: err.message });
  }
});

// GET /api/app/print/orders — list my print orders
router.get('/orders', authenticateCustomer, async (req, res) => {
  try {
    const orders = await PrintOrder.findAll({
      where:  { customerId: req.user.id },
      order:  [['created_at', 'DESC']],
    });
    return res.json(orders);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;

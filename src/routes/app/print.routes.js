const path        = require('path');
const router      = require('express').Router();
const multer      = require('multer');
const { authenticateCustomer } = require('../../middlewares/customer.middleware');
const s3          = require('../../services/s3.service');
const sequelize   = require('../../config/db');
const Order         = require('../../models/order.model');
const OrderTimeline = require('../../models/order-timeline.model');
const Payment       = require('../../models/payment.model');
const Address       = require('../../models/address.model');
const User          = require('../../models/user.model');
const { sendSms }   = require('../../services/otp.service');
const { storeForDelivery, NOT_SERVICEABLE } = require('../../services/storefront.service');

// Any image or office/text document. Checked by extension, because browsers
// and phones often send documents as application/octet-stream. Executables,
// scripts and SVG (can carry script) aren't in the list, so they're refused.
const ALLOWED_EXT = new Set(Object.keys(s3.FILE_MIME));
const MAX_MB = 25;

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return cb(new Error('This file type can\'t be printed. Upload a photo, PDF, Word, Excel, PowerPoint or text file.'));
    }
    cb(null, true);
  },
});

// Pricing lives here, not in the app, so the amount charged can't be edited
// client-side. Per printed page, per copy.
const RATE         = { bw: 3, color: 10 };
const DELIVERY_FEE = 25;

/** Best-effort page count. PDFs are counted; everything else counts as 1. */
function countPages(buffer, ext) {
  if (ext !== '.pdf') return 1;
  const text = buffer.toString('latin1');
  const n = (text.match(/\/Type\s*\/Page(?!s)\b/g) || []).length;
  return n > 0 ? n : 1;
}

// Accept both the API spelling and the labels the app shows.
const normColor = (v) => (/colou?r/i.test(String(v)) && !/black/i.test(String(v)) ? 'color' : 'bw');
const normSides = (v) => (/double/i.test(String(v)) ? 'double' : 'single');
const normPaper = (v) => (['A4', 'A3', 'Letter'].includes(v) ? v : 'A4');

// POST /api/app/print/upload — upload one file, get back its URL + page count
router.post('/upload', authenticateCustomer, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? `File is too large (max ${MAX_MB} MB).` : err.message;
      return res.status(400).json({ message: msg });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const { url, key } = await s3.uploadFile(req.file.buffer, req.file.originalname, 'prints');
    return res.json({
      url, key,
      name:  req.file.originalname,
      size:  req.file.size,
      pages: countPages(req.file.buffer, ext),
    });
  } catch (err) {
    console.error('[print upload]', err.message);
    return res.status(502).json({ message: 'File upload failed. Please try again.' });
  }
});

// POST /api/app/print/orders — place a print order. It's created as a normal
// Order (orderType 'print') so it reaches riders, the admin panel and the
// customer's order tracking exactly like a grocery order.
router.post('/orders', authenticateCustomer, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { files, color, paper, sides, copies = 1, address_id, lat, lng, payment_method = 'cod' } = req.body;
    if (!Array.isArray(files) || files.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: 'Add at least one file to print' });
    }
    if (files.some(f => !f || typeof f.url !== 'string' || !f.url)) {
      await t.rollback();
      return res.status(400).json({ message: 'Some files did not upload. Please re-add them.' });
    }

    if (address_id != null) {
      const owned = await Address.findOne({ where: { id: address_id, userId: req.user.id }, transaction: t });
      if (!owned) {
        await t.rollback();
        return res.status(400).json({ message: 'Delivery address not found' });
      }
    }

    const { store, located } = await storeForDelivery(lat, lng);
    if (located && !store) {
      await t.rollback();
      return res.status(400).json({ message: NOT_SERVICEABLE });
    }

    const job = {
      files: files.map(f => ({
        name:  String(f.name || 'Document'),
        url:   f.url,
        key:   f.key ?? null,
        pages: Math.max(1, parseInt(f.pages, 10) || 1),
      })),
      color:  normColor(color),
      paper:  normPaper(paper),
      sides:  normSides(sides),
      copies: Math.min(100, Math.max(1, parseInt(copies, 10) || 1)),
    };
    job.totalPages  = job.files.reduce((n, f) => n + f.pages, 0);
    job.ratePerPage = RATE[job.color];
    const printCost = job.totalPages * job.copies * job.ratePerPage;
    const total     = printCost + DELIVERY_FEE;

    const deliveryOtp = String(Math.floor(100000 + Math.random() * 900000));
    const order = await Order.create({
      customerId:  req.user.id,
      storeId:     store?.id ?? null,
      addressId:   address_id ?? null,
      orderType:   'print',
      printJob:    job,
      status:      'confirmed',
      subtotal:    printCost,
      deliveryFee: DELIVERY_FEE,
      discount:    0,
      total,
      deliveryOtp,
    }, { transaction: t });

    await OrderTimeline.bulkCreate([
      { orderId: order.id, status: 'pending',   note: `Print order placed — ${job.files.length} file(s), ${job.totalPages} page(s) × ${job.copies}` },
      { orderId: order.id, status: 'confirmed', note: 'Auto-confirmed on placement' },
    ], { transaction: t });

    await Payment.create({
      orderId: order.id,
      gateway: 'cod',
      amount:  total,
      status:  'pending',
    }, { transaction: t });

    await t.commit();

    const customer = await User.findByPk(req.user.id, { attributes: ['mobile', 'name'] });
    if (customer?.mobile) {
      sendSms(customer.mobile,
        `Hi ${customer.name || 'there'}! Your Jhatpats print order #${order.id} is placed. Total: Rs.${total} (Cash on Delivery). Delivery OTP: ${deliveryOtp}. Share it only with your rider.`
      ).catch(() => {});
    }

    require('../../services/rider-dispatch.service')
      .offerOrder(order.id)
      .catch(err => console.error('[dispatch] print order:', err.message));

    return res.status(201).json({ ...order.toJSON(), payment_method });
  } catch (err) {
    await t.rollback();
    console.error('[print order]', err.message);
    return res.status(500).json({ message: err.message });
  }
});

// GET /api/app/print/orders — my print orders (newest first)
router.get('/orders', authenticateCustomer, async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { customerId: req.user.id, orderType: 'print' },
      order: [['created_at', 'DESC']],
    });
    return res.json(orders);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;

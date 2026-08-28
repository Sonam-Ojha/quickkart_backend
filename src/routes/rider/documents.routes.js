const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const crypto  = require('crypto');
const { authenticateRider } = require('../../middlewares/rider.middleware');
const ctrl = require('../../controllers/rider/documents.controller');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../../public/uploads'),
  filename: (_, file, cb) => {
    const unique = crypto.randomBytes(10).toString('hex');
    cb(null, `kyc-${unique}${path.extname(file.originalname).toLowerCase()}`);
  },
});

// PDFs allowed here (unlike the admin image uploader) — scanned IDs are
// commonly PDFs.
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ok = /jpeg|jpg|png|webp|pdf/.test(path.extname(file.originalname).toLowerCase())
            && /jpeg|jpg|png|webp|pdf/.test(file.mimetype);
    cb(ok ? null : new Error('Only JPG, PNG, WEBP or PDF files are allowed'), ok);
  },
});

router.use(authenticateRider);

router.get('/',  ctrl.list);
router.post('/', upload.single('file'), ctrl.upload);   // multipart: file + docType

module.exports = router;

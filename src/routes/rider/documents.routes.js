const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const { authenticateRider } = require('../../middlewares/rider.middleware');
const ctrl = require('../../controllers/rider/documents.controller');

// Use memory storage — file bytes go straight to S3 (or local fallback),
// no temp file on disk. Works on Hostinger where disk writes can be unreliable.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const ok  = /\.(jpeg|jpg|png|webp|pdf)$/.test(ext);
    cb(ok ? null : new Error('Only JPG, PNG, WEBP or PDF files are allowed'), ok);
  },
});

router.use(authenticateRider);

router.get('/',  ctrl.list);
router.post('/', upload.single('file'), ctrl.upload);   // multipart: file + docType

module.exports = router;

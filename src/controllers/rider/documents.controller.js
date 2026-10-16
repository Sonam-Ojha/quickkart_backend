const Rider         = require('../../models/rider.model');
const RiderDocument = require('../../models/rider-document.model');
const s3            = require('../../services/s3.service');
const otpService    = require('../../services/otp.service');
const nodemailer    = require('nodemailer');

const DOC_LABELS = {
  aadhaar:    'Aadhaar Card',
  pan:        'PAN Card',
  license:    'Driving License',
  rc:         'RC (Vehicle Registration)',
  bank_proof: 'Bank Proof',
  photo:      'Profile Photo',
};

async function _notifyAdmin(rider, docType) {
  const adminEmail  = process.env.ADMIN_EMAIL;
  const adminMobile = process.env.ADMIN_MOBILE;
  const docLabel    = DOC_LABELS[docType] || docType;
  const adminUrl    = 'https://admin.jhatpats.com/riders';

  // ── Email ──────────────────────────────────────────────────────────────────
  if (adminEmail && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.hostinger.com',
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from:    `"Jhatpats Admin" <${process.env.SMTP_FROM}>`,
        to:      adminEmail,
        subject: `KYC Document Uploaded — ${rider.name} (${rider.mobile})`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;background:#fff;">
            <p style="font-size:20px;font-weight:bold;color:#f97316;margin:0 0 16px;">Jhatpats</p>
            <p style="color:#333;font-size:15px;margin:0 0 12px;">
              A rider has uploaded a KYC document and is waiting for your approval.
            </p>
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
              <tr><td style="padding:8px 0;color:#666;font-size:13px;">Rider Name</td><td style="padding:8px 0;font-weight:bold;color:#111;">${rider.name}</td></tr>
              <tr><td style="padding:8px 0;color:#666;font-size:13px;">Mobile</td><td style="padding:8px 0;font-weight:bold;color:#111;">${rider.mobile}</td></tr>
              <tr><td style="padding:8px 0;color:#666;font-size:13px;">Document</td><td style="padding:8px 0;font-weight:bold;color:#f97316;">${docLabel}</td></tr>
            </table>
            <a href="${adminUrl}" style="display:inline-block;padding:12px 24px;background:#f97316;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;">
              Review in Admin Panel →
            </a>
            <p style="color:#999;font-size:11px;margin-top:24px;">Jhatpats Admin Notification</p>
          </div>
        `,
      });
    } catch (e) {
      console.error('[KYC NOTIFY] Email failed:', e.message);
    }
  }

  // ── SMS ────────────────────────────────────────────────────────────────────
  if (adminMobile) {
    const msg = `Jhatpats: KYC document uploaded by rider ${rider.name} (${rider.mobile}) — ${docLabel}. Review at admin.jhatpats.com`;
    otpService.sendSms(adminMobile, msg).catch(() => {});
  }
}

// Which roll-up column on `riders` each document type feeds. rc and photo have
// no roll-up — they're stored but don't gate verification.
const KYC_FIELD = {
  aadhaar: 'kycAadhaarStatus',
  pan:     'kycPanStatus',
  license: 'kycLicenseStatus',
  bank_proof: 'kycBankStatus',
};
const DOC_TYPES = ['aadhaar', 'pan', 'license', 'rc', 'bank_proof', 'photo'];

const list = async (req, res) => {
  try {
    const documents = await RiderDocument.findAll({
      where: { riderId: req.rider.id },
      order: [['doc_type', 'ASC']],
    });
    const rider = await Rider.findByPk(req.rider.id, {
      attributes: ['status', 'kycAadhaarStatus', 'kycPanStatus', 'kycLicenseStatus', 'kycBankStatus'],
    });
    res.json({
      documents,
      required: Object.keys(KYC_FIELD),
      kyc: {
        aadhaar: rider.kycAadhaarStatus, pan: rider.kycPanStatus,
        license: rider.kycLicenseStatus, bank: rider.kycBankStatus,
      },
      status: rider.status,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const upload = async (req, res) => {
  try {
    const { docType } = req.body;
    if (!DOC_TYPES.includes(docType)) {
      return res.status(400).json({ message: `docType must be one of: ${DOC_TYPES.join(', ')}` });
    }
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    // Upload to S3 (falls back to local disk if S3 not configured)
    const { url: fileUrl } = await s3.uploadFile(req.file.buffer, req.file.originalname, 'kyc');

    // One row per (rider, docType): re-uploading replaces and resets review.
    const existing = await RiderDocument.findOne({ where: { riderId: req.rider.id, docType } });
    const doc = existing
      ? await existing.update({ fileUrl, status: 'uploaded', rejectionReason: null, reviewedAt: null })
      : await RiderDocument.create({ riderId: req.rider.id, docType, fileUrl, status: 'uploaded' });

    const field = KYC_FIELD[docType];
    if (field) await Rider.update({ [field]: 'uploaded' }, { where: { id: req.rider.id } });

    // Notify admin — fire and forget
    const rider = await Rider.findByPk(req.rider.id, { attributes: ['id', 'name', 'mobile'] });
    _notifyAdmin(rider, docType).catch(() => {});

    res.status(201).json({ message: 'Document uploaded', document: doc });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

module.exports = { list, upload, KYC_FIELD, DOC_TYPES };

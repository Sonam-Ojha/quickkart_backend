const Rider         = require('../../models/rider.model');
const RiderDocument = require('../../models/rider-document.model');

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

    const host    = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    const fileUrl = `${host}/uploads/${req.file.filename}`;

    // One row per (rider, docType): re-uploading replaces and resets review.
    const existing = await RiderDocument.findOne({ where: { riderId: req.rider.id, docType } });
    const doc = existing
      ? await existing.update({ fileUrl, status: 'uploaded', rejectionReason: null, reviewedAt: null })
      : await RiderDocument.create({ riderId: req.rider.id, docType, fileUrl, status: 'uploaded' });

    const field = KYC_FIELD[docType];
    if (field) await Rider.update({ [field]: 'uploaded' }, { where: { id: req.rider.id } });

    res.status(201).json({ message: 'Document uploaded', document: doc });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

module.exports = { list, upload, KYC_FIELD, DOC_TYPES };

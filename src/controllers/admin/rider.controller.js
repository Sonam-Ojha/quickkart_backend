const bcrypt = require('bcryptjs');
const svc    = require('../../services/rider.service');
const Rider  = require('../../models/rider.model');
const RiderDocument = require('../../models/rider-document.model');
const { KYC_FIELD } = require('../rider/documents.controller');

const list = async (req, res) => {
  try {
    const { storeId, status, search } = req.query;
    const riders = await svc.getAll({ storeId, status, search });
    res.json({ riders });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const add = async (req, res) => {
  try {
    const { name, mobile, storeId, rating, status, password, vehicleType, vehicleNumber } = req.body;
    if (!name || !mobile || !storeId) return res.status(400).json({ message: 'name, mobile, storeId are required' });
    const hashed = password ? await bcrypt.hash(password, 10) : null;
    const rider  = await svc.create({ name, mobile, storeId, rating, status, vehicleType, vehicleNumber, password: hashed });
    res.status(201).json({ message: 'Rider added', rider });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

const edit = async (req, res) => {
  try {
    const rider = await svc.update(req.params.id, req.body);
    res.json({ message: 'Rider updated', rider });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

const toggle = async (req, res) => {
  try {
    const rider = await svc.toggle(req.params.id);
    res.json({ message: 'Rider status toggled', rider });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

const remove = async (req, res) => {
  try {
    await svc.remove(req.params.id);
    res.json({ message: 'Rider deleted' });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

const setPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    const rider = await Rider.findByPk(req.params.id);
    if (!rider) return res.status(404).json({ message: 'Rider not found' });
    await rider.update({ password: await bcrypt.hash(password, 10) });
    res.json({ message: 'Password set successfully' });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

// ── KYC review ──────────────────────────────────────────────
const listDocuments = async (req, res) => {
  try {
    const documents = await RiderDocument.findAll({ where: { riderId: req.params.id }, order: [['doc_type', 'ASC']] });
    res.json({ documents });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const reviewDocument = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ message: "status must be 'verified' or 'rejected'" });
    }
    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({ message: 'rejectionReason is required when rejecting' });
    }

    const doc = await RiderDocument.findOne({ where: { id: req.params.docId, riderId: req.params.id } });
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    await doc.update({ status, rejectionReason: status === 'rejected' ? rejectionReason : null, reviewedAt: new Date() });

    const rider = await Rider.findByPk(req.params.id);
    const field = KYC_FIELD[doc.docType];
    if (field) await rider.update({ [field]: status });

    // Clearing every required document is what activates a pending rider.
    await rider.reload();
    const allVerified = Object.values(KYC_FIELD).every(f => rider[f] === 'verified');
    let activated = false;
    if (allVerified && rider.status === 'pending_verification') {
      await rider.update({ status: 'active' });
      activated = true;
    }

    res.json({ message: `Document ${status}`, document: doc, riderStatus: rider.status, activated });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

module.exports = { list, add, edit, toggle, remove, setPassword, listDocuments, reviewDocument };

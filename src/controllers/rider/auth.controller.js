const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const Rider      = require('../../models/rider.model');
const DarkStore  = require('../../models/darkstore.model');
const otpService = require('../../services/otp.service');

const SECRET = process.env.JWT_SECRET || 'my-secret-key';

const VEHICLE_TYPES = ['bike', 'scooter', 'ebike', 'bicycle', 'cycle', 'other'];

const signRider = (rider) => jwt.sign(
  { id: rider.id, name: rider.name, mobile: rider.mobile, role: 'rider' },
  SECRET, { expiresIn: '30d' },
);

// Only unlocks POST /auth/register, and only for the mobile that passed OTP.
const signSignup = (mobile) => jwt.sign(
  { mobile, role: 'rider_signup' }, SECRET, { expiresIn: '30m' },
);

// Load the store alongside the rider — the app shows the assigned pickup
// point right after login, and a second round-trip just for its name is waste.
const WITH_STORE = {
  include: [{ model: DarkStore, as: 'store', attributes: ['id', 'name', 'city', 'address'] }],
};

const publicRider = (r) => ({
  id: r.id, name: r.name, mobile: r.mobile,
  vehicleType: r.vehicleType, vehicleNumber: r.vehicleNumber,
  isOnline: r.isOnline, rating: r.rating, totalDeliveries: r.totalDeliveries,
  status: r.status, storeId: r.storeId,
  photoUrl: r.photoUrl, languageCode: r.languageCode,
  created_at: r.created_at,
  store: r.store
    ? { id: r.store.id, name: r.store.name, city: r.store.city, address: r.store.address }
    : null,
  kyc: {
    aadhaar: r.kycAadhaarStatus, pan: r.kycPanStatus,
    license: r.kycLicenseStatus, bank: r.kycBankStatus,
  },
});

// A rider who is suspended or inactive must not get a token at all.
const blockedReason = (rider) => {
  if (rider.status === 'suspended') return 'Account suspended. Contact admin.';
  if (rider.status === 'inactive')  return 'Account inactive. Contact admin.';
  return null;
};

// ── OTP login ───────────────────────────────────────────────
const sendOtp = async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!/^\d{10}$/.test(String(mobile || ''))) {
      return res.status(400).json({ message: 'Valid 10-digit mobile number required' });
    }
    const rider = await Rider.findOne({ where: { mobile } });
    if (rider) {
      const blocked = blockedReason(rider);
      if (blocked) return res.status(403).json({ message: blocked });
    }
    const result = await otpService.sendOtpSms(mobile);
    // With no SMS provider configured nothing reaches the phone, so surface
    // the code to unblock local testing. `result.otp` is only ever set on the
    // dev branch — once FAST2SMS_API_KEY exists this stops being sent.
    res.json({
      sent: true,
      registered: !!rider,
      dev: result.dev || false,
      ...(result.otp ? { devOtp: result.otp } : {}),
    });
  } catch (err) { res.status(500).json({ message: err.message || 'Failed to send OTP' }); }
};

const verifyOtp = async (req, res) => {
  try {
    const { mobile, otp } = req.body;
    if (!mobile || !otp) return res.status(400).json({ message: 'mobile and otp are required' });

    const check = otpService.verifyOtp(mobile, otp);
    if (!check.valid) return res.status(400).json({ message: check.reason });

    const rider = await Rider.findOne({ where: { mobile }, ...WITH_STORE });
    if (!rider) {
      // New number: hand back a signup token instead of a rider token.
      return res.json({ registered: false, signupToken: signSignup(mobile) });
    }
    const blocked = blockedReason(rider);
    if (blocked) return res.status(403).json({ message: blocked });

    res.json({ registered: true, token: signRider(rider), rider: publicRider(rider) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Requires the signup token from verifyOtp — the mobile comes from the token,
// never from the body, so nobody can register a number they didn't verify.
const register = async (req, res) => {
  try {
    const { mobile } = req.signup;
    const { name, vehicleType = 'bike', vehicleNumber, storeId } = req.body;

    if (!name || !String(name).trim()) return res.status(400).json({ message: 'name is required' });
    if (!VEHICLE_TYPES.includes(vehicleType)) {
      return res.status(400).json({ message: `vehicleType must be one of: ${VEHICLE_TYPES.join(', ')}` });
    }
    if (await Rider.findOne({ where: { mobile } })) {
      return res.status(409).json({ message: 'This mobile is already registered' });
    }

    // store_id is NOT NULL — fall back to the first active dark store.
    let store = storeId ? await DarkStore.findByPk(storeId) : null;
    if (storeId && !store) return res.status(404).json({ message: 'Dark store not found' });
    if (!store) store = await DarkStore.findOne({ where: { isActive: true } });
    if (!store) return res.status(503).json({ message: 'No active dark store available' });

    const rider = await Rider.create({
      name: String(name).trim(), mobile, vehicleType,
      vehicleNumber: vehicleNumber || null, storeId: store.id,
      // Can't take deliveries until admin clears the KYC documents.
      status: 'pending_verification',
    });

    await rider.reload(WITH_STORE);
    res.status(201).json({ token: signRider(rider), rider: publicRider(rider) });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

// Lets the app poll the verification-pending screen.
const me = async (req, res) => {
  try {
    const rider = await Rider.findByPk(req.rider.id, WITH_STORE);
    if (!rider) return res.status(404).json({ message: 'Rider not found' });
    res.json({ rider: publicRider(rider), verified: rider.status === 'active' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Store picker on the registration screen.
const stores = async (_req, res) => {
  try {
    res.json({ stores: await DarkStore.findAll({
      where: { isActive: true }, attributes: ['id', 'name', 'city', 'address'], order: [['name', 'ASC']],
    })});
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Password login (kept for admin-created riders) ──────────
const login = async (req, res) => {
  try {
    const { mobile, password } = req.body;
    if (!mobile || !password) return res.status(400).json({ message: 'mobile and password are required' });

    const rider = await Rider.findOne({ where: { mobile }, ...WITH_STORE });
    if (!rider) return res.status(401).json({ message: 'Invalid mobile or password' });

    const blocked = blockedReason(rider);
    if (blocked) return res.status(403).json({ message: blocked });
    if (!rider.password) return res.status(401).json({ message: 'Password not set. Sign in with OTP instead.' });

    const ok = await bcrypt.compare(password, rider.password);
    if (!ok) return res.status(401).json({ message: 'Invalid mobile or password' });

    res.json({ token: signRider(rider), rider: publicRider(rider) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { sendOtp, verifyOtp, register, me, stores, login };

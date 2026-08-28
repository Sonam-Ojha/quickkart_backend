const bcrypt      = require('bcryptjs');
const Rider       = require('../../models/rider.model');
const DarkStore   = require('../../models/darkstore.model');
const DutySession = require('../../models/rider-duty-session.model');
const dispatch    = require('../../services/rider-dispatch.service');

const getProfile = async (req, res) => {
  try {
    const rider = await Rider.findByPk(req.rider.id, {
      attributes: { exclude: ['password'] },
      include: [{ model: DarkStore, as: 'store', attributes: ['id', 'name', 'city', 'address'] }],
    });
    if (!rider) return res.status(404).json({ message: 'Rider not found' });
    res.json({ rider });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const updateProfile = async (req, res) => {
  try {
    const rider = await Rider.findByPk(req.rider.id);
    if (!rider) return res.status(404).json({ message: 'Rider not found' });

    const { name, vehicleType, vehicleNumber } = req.body;
    await rider.update({ name, vehicleType, vehicleNumber });
    res.json({ message: 'Profile updated', rider: { id: rider.id, name: rider.name, vehicleType: rider.vehicleType, vehicleNumber: rider.vehicleNumber } });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Both passwords required' });

    const rider = await Rider.findByPk(req.rider.id);
    if (!rider || !rider.password) return res.status(400).json({ message: 'No password set' });

    const ok = await bcrypt.compare(currentPassword, rider.password);
    if (!ok) return res.status(401).json({ message: 'Current password incorrect' });

    await rider.update({ password: await bcrypt.hash(newPassword, 10) });
    res.json({ message: 'Password changed successfully' });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

// Opens/closes a duty session alongside the flag. is_online alone can't tell
// you how long a rider was online — the Performance screen needs the sessions.
const _setDuty = async (rider, online) => {
  const open = await DutySession.findOne({
    where: { riderId: rider.id, endedAt: null },
    order: [['started_at', 'DESC']],
  });

  if (online) {
    if (!open) await DutySession.create({ riderId: rider.id, startedAt: new Date() });
  } else if (open) {
    const endedAt = new Date();
    await open.update({
      endedAt,
      durationMins: Math.max(0, Math.round((endedAt - new Date(open.startedAt)) / 60000)),
    });
  }

  await rider.update({ isOnline: online });
  // An offline rider must not keep a live incoming-order card.
  if (!online) await dispatch.dropPendingFor(rider.id);
};

// Explicit set: PATCH { online: true|false }. Omitting the body flips the flag,
// which keeps the older toggle-only client working.
const setDuty = async (req, res) => {
  try {
    const rider = await Rider.findByPk(req.rider.id);
    if (!rider) return res.status(404).json({ message: 'Rider not found' });

    const online = typeof req.body?.online === 'boolean' ? req.body.online : !rider.isOnline;
    await _setDuty(rider, online);
    res.json({ isOnline: rider.isOnline, message: rider.isOnline ? 'You are now online' : 'You are now offline' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const updateLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (latitude == null || longitude == null) {
      return res.status(400).json({ message: 'latitude and longitude are required' });
    }
    const rider = await Rider.findByPk(req.rider.id);
    if (!rider) return res.status(404).json({ message: 'Rider not found' });
    await rider.update({ latitude, longitude, lastLocationAt: new Date() });
    res.json({ latitude: rider.latitude, longitude: rider.longitude, lastLocationAt: rider.lastLocationAt });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

// Payout destination. Required before a withdrawal can be requested.
const updateBank = async (req, res) => {
  try {
    const { bankAccountName, bankAccountNo, bankIfsc, upiId } = req.body;
    if (!bankAccountNo && !upiId) {
      return res.status(400).json({ message: 'Provide bank details or a UPI ID' });
    }
    const rider = await Rider.findByPk(req.rider.id);
    if (!rider) return res.status(404).json({ message: 'Rider not found' });

    await rider.update({
      bankAccountName: bankAccountName ?? rider.bankAccountName,
      bankAccountNo:   bankAccountNo   ?? rider.bankAccountNo,
      bankIfsc:        bankIfsc        ?? rider.bankIfsc,
      upiId:           upiId           ?? rider.upiId,
      kycBankStatus:   'uploaded',
    });
    res.json({
      message: 'Payout details saved',
      // Never echo the full account number back.
      bank: rider.bankAccountNo ? `****${String(rider.bankAccountNo).slice(-4)}` : null,
      upiId: rider.upiId,
      kycBankStatus: rider.kycBankStatus,
    });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

module.exports = { getProfile, updateProfile, changePassword, toggleOnline: setDuty, setDuty, updateLocation, updateBank };

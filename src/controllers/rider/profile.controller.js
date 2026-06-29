const bcrypt    = require('bcryptjs');
const Rider     = require('../../models/rider.model');
const DarkStore = require('../../models/darkstore.model');

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

const toggleOnline = async (req, res) => {
  try {
    const rider = await Rider.findByPk(req.rider.id);
    if (!rider) return res.status(404).json({ message: 'Rider not found' });
    await rider.update({ isOnline: !rider.isOnline });
    res.json({ isOnline: rider.isOnline, message: rider.isOnline ? 'You are now online' : 'You are now offline' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { getProfile, updateProfile, changePassword, toggleOnline };

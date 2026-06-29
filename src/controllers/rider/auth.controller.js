const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const Rider   = require('../../models/rider.model');

const SECRET = process.env.JWT_SECRET || 'my-secret-key';

const login = async (req, res) => {
  try {
    const { mobile, password } = req.body;
    if (!mobile || !password) return res.status(400).json({ message: 'mobile and password are required' });

    const rider = await Rider.findOne({ where: { mobile } });
    if (!rider) return res.status(401).json({ message: 'Invalid mobile or password' });
    if (rider.status === 'suspended') return res.status(403).json({ message: 'Account suspended. Contact admin.' });
    if (rider.status === 'inactive')  return res.status(403).json({ message: 'Account inactive. Contact admin.' });

    if (!rider.password) return res.status(401).json({ message: 'Password not set. Contact admin.' });

    const ok = await bcrypt.compare(password, rider.password);
    if (!ok) return res.status(401).json({ message: 'Invalid mobile or password' });

    const token = jwt.sign(
      { id: rider.id, name: rider.name, mobile: rider.mobile, role: 'rider' },
      SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      rider: {
        id: rider.id, name: rider.name, mobile: rider.mobile,
        vehicleType: rider.vehicleType, vehicleNumber: rider.vehicleNumber,
        isOnline: rider.isOnline, rating: rider.rating,
        totalDeliveries: rider.totalDeliveries, status: rider.status,
      },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { login };

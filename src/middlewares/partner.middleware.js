const jwt = require('jsonwebtoken');
const RestaurantStaff = require('../models/restaurant-staff.model');

// Restaurant-partner tokens carry { staffId, restaurantId, role: 'restaurant_partner' }.
// The staff row is re-checked on every request so a login the admin disables
// (or moves) stops working immediately, not when the token expires.
const authenticatePartner = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ message: 'No token provided' });
  let payload;
  try {
    payload = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  if (payload.role !== 'restaurant_partner' || !payload.staffId) {
    return res.status(403).json({ message: 'Not a restaurant partner account' });
  }
  try {
    const staff = await RestaurantStaff.findByPk(payload.staffId);
    if (!staff || !staff.isActive || staff.restaurantId !== payload.restaurantId) {
      return res.status(401).json({ message: 'This login has been turned off. Contact Jhatpats.' });
    }
    // Everything downstream scopes by this — never by ids from the request.
    req.partner = { staffId: staff.id, restaurantId: staff.restaurantId, name: staff.name };
    next();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { authenticatePartner };

const jwt = require('jsonwebtoken');

const authenticateCustomer = (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my-secret-key');

    // Customer tokens must have role 'user'
    if (decoded.role !== 'user') {
      return res.status(403).json({ message: 'Not a customer account' });
    }

    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const optionalAuth = (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) return next();

  try {
    const token   = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my-secret-key');
    req.user = decoded;
  } catch {
    // ignore — browsing without auth is allowed
  }
  next();
};

module.exports = { authenticateCustomer, optionalAuth };

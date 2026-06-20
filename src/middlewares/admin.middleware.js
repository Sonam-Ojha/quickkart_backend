const ADMIN_ROLES = ['super_admin', 'ops_manager', 'catalog_mgr', 'marketing', 'support', 'finance'];

const requireAdmin = (req, res, next) => {
  if (!req.user || !ADMIN_ROLES.includes(req.user.role)) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({ message: 'Super admin access required' });
  }
  next();
};

module.exports = { requireAdmin, requireSuperAdmin };

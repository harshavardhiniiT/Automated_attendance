/**
 * RBAC Role Guard Middleware
 * Usage: requireRole('ADMIN') or requireRole('ADMIN', 'TEACHER')
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role(s): ${roles.join(' or ')}. Your role: ${req.user.role}`,
      });
    }
    next();
  };
};

module.exports = { requireRole };

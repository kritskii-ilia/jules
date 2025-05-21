const { protect } = require('./authMiddleware'); // Import the existing protect middleware

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};

// Combine protect and admin middleware
const adminProtect = [protect, admin];

module.exports = { admin, adminProtect };

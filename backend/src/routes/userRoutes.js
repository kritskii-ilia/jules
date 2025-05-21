const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// @route   GET /api/users/profile
// @desc    Get user profile and transaction history
// @access  Private
router.get('/profile', protect, userController.getProfile);

// @route   POST /api/users/disable-gaming
// @desc    Disable gaming for the user for 24 hours
// @access  Private
router.post('/disable-gaming', protect, userController.disableGaming);

module.exports = router;

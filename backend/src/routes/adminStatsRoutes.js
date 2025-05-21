const express = require('express');
const router = express.Router();
const adminStatsController = require('../controllers/adminStatsController');
const { adminProtect } = require('../middleware/adminAuthMiddleware');

// All routes in this file will be protected by adminProtect

// @route   GET /api/admin/stats/overview
// @desc    Get overview statistics for the platform
// @access  Admin
router.get('/overview', adminProtect, adminStatsController.getOverviewStats);

module.exports = router;

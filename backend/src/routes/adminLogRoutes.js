const express = require('express');
const router = express.Router();
const adminLogController = require('../controllers/adminLogController');
const { adminProtect } = require('../middleware/adminAuthMiddleware');

// All routes in this file will be protected by adminProtect

// @route   GET /api/admin/logs/admin-actions
// @desc    List admin action logs with pagination and filters
// @access  Admin
router.get('/admin-actions', adminProtect, adminLogController.listAdminActionLogs);

// @route   GET /api/admin/logs/system
// @desc    Get information about accessing system logs
// @access  Admin
router.get('/system', adminProtect, adminLogController.listSystemLogs);

module.exports = router;

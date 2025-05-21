const express = require('express');
const router = express.Router();
const adminUserController = require('../controllers/adminUserController');
const { adminProtect } = require('../middleware/adminAuthMiddleware'); // Middleware to protect admin routes

// All routes in this file will be protected by adminProtect

// @route   GET /api/admin/users
// @desc    List users with pagination and search
// @access  Admin
router.get('/', adminProtect, adminUserController.listUsers);

// @route   GET /api/admin/users/:userId
// @desc    Get detailed user information
// @access  Admin
router.get('/:userId', adminProtect, adminUserController.getUserDetails);

// @route   POST /api/admin/users/:userId/ban-site
// @desc    Ban user from site
// @access  Admin
router.post('/:userId/ban-site', adminProtect, adminUserController.banUser);

// @route   POST /api/admin/users/:userId/unban-site
// @desc    Unban user from site
// @access  Admin
router.post('/:userId/unban-site', adminProtect, adminUserController.unbanUser);

// @route   POST /api/admin/users/:userId/ban-chat
// @desc    Ban user from chat
// @access  Admin
router.post('/:userId/ban-chat', adminProtect, adminUserController.banUser);

// @route   POST /api/admin/users/:userId/unban-chat
// @desc    Unban user from chat
// @access  Admin
router.post('/:userId/unban-chat', adminProtect, adminUserController.unbanUser);

// @route   POST /api/admin/users/:userId/adjust-balance
// @desc    Adjust user balance
// @access  Admin
router.post('/:userId/adjust-balance', adminProtect, adminUserController.adjustUserBalance);

module.exports = router;

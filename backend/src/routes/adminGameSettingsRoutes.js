const express = require('express');
const router = express.Router();
const adminGameSettingsController = require('../controllers/adminGameSettingsController');
const { adminProtect } = require('../middleware/adminAuthMiddleware'); // Ensure you have this

// All routes in this file will be protected by adminProtect

// @route   GET /api/admin/game-settings
// @desc    Get all game configurations
// @access  Admin
router.get('/', adminProtect, adminGameSettingsController.getAllGameSettings);

// @route   GET /api/admin/game-settings/:gameId
// @desc    Get specific game configuration
// @access  Admin
router.get('/:gameId', adminProtect, adminGameSettingsController.getGameSetting);

// @route   PUT /api/admin/game-settings/:gameId
// @desc    Update specific game configuration
// @access  Admin
router.put('/:gameId', adminProtect, adminGameSettingsController.updateGameSetting);

module.exports = router;

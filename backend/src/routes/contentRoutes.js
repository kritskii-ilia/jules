const express = require('express');
const router = express.Router();
const contentController = require('../controllers/contentController');

// @route   GET /api/content/:pageKey
// @desc    Get public content for a specific page
// @access  Public
router.get('/:pageKey', contentController.getPublicContentPage);

module.exports = router;

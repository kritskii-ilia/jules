const express = require('express');
const router = express.Router();
const adminContentController = require('../controllers/adminContentController');
const { adminProtect } = require('../middleware/adminAuthMiddleware');

// All routes in this file will be protected by adminProtect

// @route   GET /api/admin/content-pages
// @desc    List all editable content pages (summary)
// @access  Admin
router.get('/', adminProtect, adminContentController.listAllContentPages);

// @route   GET /api/admin/content-pages/:pageKey
// @desc    Get content for a specific page
// @access  Admin
router.get('/:pageKey', adminProtect, adminContentController.getContentPage);

// @route   PUT /api/admin/content-pages/:pageKey
// @desc    Update content for a specific page
// @access  Admin
router.put('/:pageKey', adminProtect, adminContentController.updateContentPage);

module.exports = router;

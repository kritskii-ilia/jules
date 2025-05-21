const express = require('express');
const router = express.Router();
const adminChatController = require('../controllers/adminChatController');
const { adminProtect } = require('../middleware/adminAuthMiddleware');

// All routes in this file will be protected by adminProtect

// @route   GET /api/admin/chat/messages
// @desc    List and filter chat messages
// @access  Admin
router.get('/messages', adminProtect, adminChatController.listMessages);

// @route   DELETE /api/admin/chat/messages/:messageId
// @desc    Mark a chat message as deleted (soft delete)
// @access  Admin
router.delete('/messages/:messageId', adminProtect, adminChatController.deleteMessage);

module.exports = router;

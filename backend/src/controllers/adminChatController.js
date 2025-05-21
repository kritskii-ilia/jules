const adminChatService = require('../services/adminChatService');

const listMessages = async (req, res) => {
  try {
    const { page, limit, userId, dateFrom, dateTo, contentSearch, isDeleted } = req.query;
    const result = await adminChatService.listMessages({
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      userId,
      dateFrom,
      dateTo,
      contentSearch,
      isDeleted: isDeleted // Pass directly, service handles string/boolean conversion
    });
    res.json(result);
  } catch (error) {
    console.error('Error listing chat messages:', error);
    res.status(500).json({ message: 'Error listing chat messages.' });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const adminUserId = req.user.id; // From adminProtect middleware

    const updatedMessage = await adminChatService.deleteMessage(messageId, adminUserId);
    res.json({ message: 'Chat message marked as deleted successfully.', chatMessage: updatedMessage });
  } catch (error) {
    console.error(`Error deleting chat message ${req.params.messageId}:`, error);
    res.status(error.message.includes('not found') ? 404 : error.message.includes('already deleted') ? 400 : 500)
       .json({ message: error.message || 'Server error deleting chat message.' });
  }
};

module.exports = {
  listMessages,
  deleteMessage,
};

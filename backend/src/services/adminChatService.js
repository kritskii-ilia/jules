const ChatMessage = require('../models/ChatMessageModel');
const { emitChatMessageDeleted } = require('./socketService');
const { logAdminAction } = require('./adminLogService'); // Import admin logger

const listMessages = async ({ page = 1, limit = 20, userId, dateFrom, dateTo, contentSearch, isDeleted }) => {
  const query = {};

  if (userId) query.userId = userId;
  if (contentSearch) query.messageContent = { $regex: contentSearch, $options: 'i' };

  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }
  
  if (isDeleted !== undefined) { // Check for 'true', 'false', or all
    if (typeof isDeleted === 'string') {
        query.isDeleted = isDeleted === 'true';
    } else if (typeof isDeleted === 'boolean') {
        query.isDeleted = isDeleted;
    }
  }


  const messages = await ChatMessage.find(query)
    .populate('userId', 'username telegramId') // Populate user info
    .populate('deletedBy', 'username') // Populate who deleted it
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 })
    .exec();

  const count = await ChatMessage.countDocuments(query);

  return {
    messages,
    totalPages: Math.ceil(count / limit),
    currentPage: parseInt(page, 10),
    totalMessages: count,
  };
};

const deleteMessage = async (messageId, adminUserId) => {
  const message = await ChatMessage.findById(messageId);
  if (!message) {
    throw new Error('Message not found.');
  }
  if (message.isDeleted) {
    // Optionally, allow re-deleting or just return current state
    // For now, we'll just indicate it's already deleted to prevent redundant operations
    // throw new Error('Message is already deleted.'); 
    console.warn(`Admin ${adminUserId} attempted to delete already deleted message ${messageId}`);
    return message; // Or return a specific status/message
  }

  message.isDeleted = true;
  message.deletedBy = adminUserId;
  message.deletedAt = new Date();
  
  await message.save();
  
  emitChatMessageDeleted(messageId);

  await logAdminAction(
    adminUserId,
    'Admin', // Placeholder for adminUsername
    'CHAT_MESSAGE_DELETED',
    'chat_message',
    messageId,
    { originalContent: message.messageContent, originalUserId: message.userId?.toString() } 
    // Note: message.userId might be null if it was a system message, ensure toString() is safe
  );
  
  return message;
};

module.exports = {
  listMessages,
  deleteMessage,
};
